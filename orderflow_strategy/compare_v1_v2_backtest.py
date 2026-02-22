"""
Compare V1 (1-min bars) vs V2 (10-sec bars) backtest on the same days.
Same strategy, same params — only bar granularity changes. Answers: would sub-minute
reaction give better/worse entries, exits, and PnL? Run from orderflow_strategy:
  python compare_v1_v2_backtest.py [--days N] [--out report.txt]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

sys_path = Path(__file__).resolve().parent
if str(sys_path) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(sys_path))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC_V1 = 60.0
BAR_SEC_V2 = 10.0  # sub-minute: 6x more bars per day, so we evaluate 6x more often


def main():
    ap = argparse.ArgumentParser(description="V1 (1-min) vs V2 (10-sec) backtest comparison")
    ap.add_argument("--days", type=int, default=None, help="Max DBN days to run (default: all)")
    ap.add_argument("--out", type=str, default=None, help="Output report path (default: data/v1_v2_comparison.txt)")
    args = ap.parse_args()

    params_path = DATA_DIR / "best_params_v2.json"
    if not params_path.exists():
        params_path = DATA_DIR.parent / "live_signals" / "params.json"
    if not params_path.exists():
        print("Need best_params_v2.json or live_signals/params.json")
        return
    params = json.loads(params_path.read_text())

    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        print("No RTH .dbn files in data/")
        return
    if args.days:
        files = files[: args.days]

    all_v1 = []
    all_v2 = []
    for f in files:
        day_label = f.stem
        # V1: 1-min bars
        bars_v1, tr_v1 = load_dbn_streaming(f, freq_sec=BAR_SEC_V1)
        r1, details_v1 = run_backtest(
            bars=bars_v1, trades_df=tr_v1, params=params, bar_sec=BAR_SEC_V1,
            return_trade_details=True, day_label=day_label,
        )
        # V2: 10-sec bars (same strategy, finer granularity)
        bars_v2, tr_v2 = load_dbn_streaming(f, freq_sec=BAR_SEC_V2)
        r2, details_v2 = run_backtest(
            bars=bars_v2, trades_df=tr_v2, params=params, bar_sec=BAR_SEC_V2,
            return_trade_details=True, day_label=day_label,
        )
        for d in details_v1:
            d["_day_file"] = f
        for d in details_v2:
            d["_day_file"] = f
        all_v1.extend(details_v1)
        all_v2.extend(details_v2)

    # Match by day then by trade index (first trade of day, second, ...)
    from collections import defaultdict
    by_day_v1 = defaultdict(list)
    by_day_v2 = defaultdict(list)
    for d in all_v1:
        by_day_v1[d["day"]].append(d)
    for d in all_v2:
        by_day_v2[d["day"]].append(d)

    lines = [
        "=== V1 (1-min bars) vs V2 (10-sec bars) — same strategy, same params ===",
        f"Days: {len(files)}  V1 trades: {len(all_v1)}  V2 trades: {len(all_v2)}",
        "",
    ]

    matched = []
    for day in sorted(by_day_v1.keys()):
        list_v1 = by_day_v1[day]
        list_v2 = by_day_v2.get(day, [])
        for i in range(max(len(list_v1), len(list_v2))):
            t1 = list_v1[i] if i < len(list_v1) else None
            t2 = list_v2[i] if i < len(list_v2) else None
            if t1 is None or t2 is None:
                lines.append(f"  {day} trade {i+1}: only in {'V1' if t1 else 'V2'}")
                continue
            # Bar index: V1 is minutes from open, V2 is 10-sec from open (so bar_v2/6 ≈ bar_v1)
            entry_ts_v1 = t1.get("entry_bar")  # bar index
            entry_ts_v2 = t2.get("entry_bar")
            # Entry time in "minutes from session start" for comparison
            entry_min_v1 = entry_ts_v1  # 1-min bar index = minutes
            entry_min_v2 = entry_ts_v2 * 10 / 60.0  # 10-sec bar index -> minutes
            exit_min_v1 = t1.get("exit_bar", 0)
            exit_min_v2 = t2.get("exit_bar", 0) * 10 / 60.0
            pnl1 = t1.get("pnl_pts", 0)
            pnl2 = t2.get("pnl_pts", 0)
            entry_sec_earlier = (entry_min_v1 - entry_min_v2) * 60  # positive = V2 entered earlier (seconds)
            exit_sec_earlier = (exit_min_v1 - exit_min_v2) * 60
            matched.append({
                "day": day,
                "entry_min_v1": entry_min_v1,
                "entry_min_v2": entry_min_v2,
                "entry_sec_earlier": entry_sec_earlier,
                "exit_min_v1": exit_min_v1,
                "exit_min_v2": exit_min_v2,
                "exit_sec_earlier": exit_sec_earlier,
                "pnl_v1": pnl1,
                "pnl_v2": pnl2,
                "entry_price_v1": t1.get("entry_price"),
                "entry_price_v2": t2.get("entry_price"),
                "exit_price_v1": t1.get("exit_price"),
                "exit_price_v2": t2.get("exit_price"),
            })
            lines.append(
                f"  {day} #{i+1}: entry V1={entry_min_v1:.0f}m V2={entry_min_v2:.1f}m (V2 {entry_sec_earlier:+.0f}s)  "
                f"exit V1={exit_min_v1:.0f}m V2={exit_min_v2:.1f}m  pnl V1={pnl1:.2f} V2={pnl2:.2f}"
            )

    if matched:
        avg_entry_sec = sum(m["entry_sec_earlier"] for m in matched) / len(matched)
        avg_pnl_v1 = sum(m["pnl_v1"] for m in matched) / len(matched)
        avg_pnl_v2 = sum(m["pnl_v2"] for m in matched) / len(matched)
        total_v1 = sum(m["pnl_v1"] for m in matched)
        total_v2 = sum(m["pnl_v2"] for m in matched)
        lines.extend([
            "",
            "--- Summary ---",
            f"Matched trades: {len(matched)}",
            f"Entry: V2 vs V1 on average {avg_entry_sec:+.0f} sec (positive = V2 entered earlier)",
            f"PnL per trade: V1 avg {avg_pnl_v1:.2f} pts  V2 avg {avg_pnl_v2:.2f} pts",
            f"Total PnL: V1 {total_v1:.2f} pts  V2 {total_v2:.2f} pts  (V2−V1: {total_v2 - total_v1:+.2f})",
        ])
        # Zoom-in: first 3 trades with human-readable "V2 would enter at HH:MM:SS" (9:30 + minutes)
        lines.append("")
        lines.append("--- Sample (first 3) — V2 entry/exit in 'minutes from 9:30 ET' —")
        for m in matched[:3]:
            # 9:30 + entry_min_v2 minutes => approximate clock time
            lines.append(
                f"  {m['day']}: V1 entry @ {m['entry_min_v1']:.0f}m exit @ {m['exit_min_v1']:.0f}m "
                f"pnl={m['pnl_v1']:.2f}  |  V2 entry @ {m['entry_min_v2']:.1f}m exit @ {m['exit_min_v2']:.1f}m "
                f"pnl={m['pnl_v2']:.2f}  (V2 entry {m['entry_sec_earlier']:+.0f}s)"
            )

    out_path = Path(args.out) if args.out else DATA_DIR / "v1_v2_comparison.txt"
    out_path.write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
