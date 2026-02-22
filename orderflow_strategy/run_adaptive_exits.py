"""
Adaptive exits test: no "TP at 30 pts". Hold until things fall apart — reversal BOS, exhaustion, or trail-from-high (only after we've run 30+).
I run this and report back. Usage: python run_adaptive_exits.py [--days N]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0


def main():
    days = 4  # quick run; override with --days
    if "--days" in sys.argv:
        i = sys.argv.index("--days")
        if i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1])
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))[:days]
    if not files:
        print("No DBN files")
        return
    base = json.loads((DATA_DIR / "baseline_params.json").read_text())
    # Configs: same entry logic; only exit logic changes
    configs = [
        ("1_cob_min_tp_15", {**base, "tp_style": "cob", "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}),  # current
        ("2_hold_trail25", {**base, "tp_style": "hold", "trail_sl_pts": 25, "max_hold_bars": 120}),  # trail at 25 to entry-2
        ("3_hold_trail25_act30", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "max_hold_bars": 120}),  # trail from high only after 30 pts
        ("4_hold_trail25_act30_exh", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "exit_on_exhaustion": True, "max_hold_bars": 120}),
        ("5_hold_trail25_act30_long", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "max_hold_bars": 200}),
    ]
    results = []
    for name, params in configs:
        total_t, total_pnl, total_w = 0, 0.0, 0
        details_all = []
        for f in files:
            bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
            r, details = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC, return_trade_details=True, day_label=f.stem)
            total_t += r.trades
            total_pnl += r.total_pnl_ticks
            total_w += r.wins
            details_all.extend(details)
        pnl_pts = total_pnl * 0.25
        avg = (pnl_pts / total_t) if total_t else 0
        wr = (total_w / total_t * 100) if total_t else 0
        exit_reasons = {}
        for d in details_all:
            r = d.get("exit_reason", "?")
            exit_reasons[r] = exit_reasons.get(r, 0) + 1
        results.append((name, total_t, wr, pnl_pts, avg, exit_reasons, details_all))
        print(f"  {name}: trades={total_t} wr={wr:.0f}% pnl_pts={pnl_pts:.1f} avg_pts={avg:.1f} exits={exit_reasons}", flush=True)

    out = [f"# Adaptive exits test ({len(files)} days)", ""]
    out.append("| Config | Trades | WR% | Pnl pts | Avg pts | Exit reasons |")
    out.append("|--------|--------|-----|---------|---------|---------------|")
    for name, t, wr, pnl, avg, reasons, _ in results:
        out.append(f"| {name} | {t} | {wr:.0f} | {pnl:.1f} | {avg:.1f} | {reasons} |")
    out.extend(["", "## Per-trade (config 3 & 4: hold + trail from high after 30 pts)", ""])
    for name, _, _, _, _, _, details in results:
        if "act30" not in name:
            continue
        out.append(f"### {name}")
        for d in details:
            out.append(f"- {d['day']} bar {d['entry_bar']} pnl={d['pnl_pts']:.1f} mfe={d['mfe_pts']:.1f} exit={d['exit_reason']}")
        out.append("")
    report_path = DATA_DIR / "adaptive_exits_report.md"
    report_path.write_text("\n".join(out))
    print(f"\nWrote {report_path}", flush=True)


if __name__ == "__main__":
    main()
