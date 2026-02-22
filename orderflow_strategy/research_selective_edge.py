"""
Research: Can we get YOUR edge with this data?
Target: 0-2 trades/day, 20-30-50+ pts per trade when they happen. Big moves, selective.
Runs strict configs over 9 days, per-day and per-trade breakdown. No CMD — run from IDE or python.
Usage: python research_selective_edge.py [--days N]   (default 9; use 4 for quicker run)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from collections import defaultdict

sys_path = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(sys_path))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
OUT_MD = DATA_DIR / "selective_edge_research.md"


def get_configs():
    base = json.loads((DATA_DIR / "baseline_params.json").read_text())
    swing = json.loads((DATA_DIR / "params_swing.json").read_text())
    # Your edge: only take TP when resistance is far (big move); cap trades per day
    configs = [
        ("min_tp_30", {**base, "min_tp_pts_above_entry": 30, "trail_sl_pts": 25}),
        ("min_tp_40", {**base, "min_tp_pts_above_entry": 40, "trail_sl_pts": 25}),
        ("min_tp_50", {**base, "min_tp_pts_above_entry": 50, "trail_sl_pts": 25}),
        ("min_tp_30_max1", {**base, "min_tp_pts_above_entry": 30, "trail_sl_pts": 25, "max_trades_per_day": 1}),
        ("min_tp_40_max1", {**base, "min_tp_pts_above_entry": 40, "trail_sl_pts": 25, "max_trades_per_day": 1}),
        ("min_tp_30_max2", {**base, "min_tp_pts_above_entry": 30, "trail_sl_pts": 25, "max_trades_per_day": 2}),
        ("swing_min_tp_30", {**swing, "min_tp_pts_above_entry": 30}),
        ("swing_min_tp_40_max1", {**swing, "min_tp_pts_above_entry": 40, "max_trades_per_day": 1}),
        ("cob_strict_50_min_tp_25", {**base, "cob_tp_threshold": 50, "min_tp_pts_above_entry": 25, "trail_sl_pts": 25}),
        ("combo_select", {**base, "min_tp_pts_above_entry": 35, "trail_sl_pts": 25, "max_trades_per_day": 2,
          "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3}),
    ]
    return configs


def run(days_limit=None):
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        print("No RTH .dbn in data/")
        return
    if days_limit:
        files = files[: days_limit]
        print(f"Limiting to first {len(files)} days.", flush=True)
    configs = get_configs()
    # Collect per config: list of (day, pnl_pts) for each trade
    results = {name: [] for name, _ in configs}
    details_by_config = {name: [] for name, _ in configs}

    for f in files:
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        day = f.stem
        for name, params in configs:
            r, details = run_backtest(
                bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC,
                return_trade_details=True, day_label=day,
            )
            for d in details:
                results[name].append((day, d["pnl_pts"], d.get("exit_reason")))
                details_by_config[name].append(d)
        print(f"  {day}", flush=True)

    # Build report
    lines = [
        "# Selective edge research (9 days)",
        "",
        "**Target:** 0–2 trades/day, 20–30–50+ pts per trade when they happen. Big moves only.",
        "",
        "## Summary by config",
        "",
        "| Config | Trades | Wins | Losses | WR% | Pnl pts | Avg pts/trade | Trades/day (0/1/2/3+) | Pnl distribution (pts) |",
        "|--------|--------|------|--------|-----|---------|---------------|------------------------|-------------------------|",
    ]

    for name, _ in configs:
        rows = results[name]
        if not rows:
            lines.append(f"| {name} | 0 | 0 | 0 | - | 0 | - | - | - |")
            continue
        trades = len(rows)
        wins = sum(1 for _, p, _ in rows if p > 0)
        losses = trades - wins
        wr = (wins / trades * 100) if trades else 0
        pnl_pts = sum(p for _, p, _ in rows)
        avg_pts = pnl_pts / trades if trades else 0
        pnl_list = [round(p, 1) for _, p, _ in rows]
        # Per-day count: how many days had 0, 1, 2, 3+ trades
        day_counts = defaultdict(int)
        for day, _, _ in rows:
            day_counts[day] += 1
        count_per_day = list(day_counts.values())
        zeros = len(files) - len(day_counts)  # days with no trades
        ones = sum(1 for c in count_per_day if c == 1)
        twos = sum(1 for c in count_per_day if c == 2)
        three_plus = sum(1 for c in count_per_day if c >= 3)
        day_dist = f"0:{zeros} 1:{ones} 2:{twos} 3+:{three_plus}"
        # Distribution: how many 20+, 30+, 50+
        gte20 = sum(1 for _, p, _ in rows if p >= 20)
        gte30 = sum(1 for _, p, _ in rows if p >= 30)
        gte50 = sum(1 for _, p, _ in rows if p >= 50)
        dist_str = f"≥20:{gte20} ≥30:{gte30} ≥50:{gte50} | {pnl_list[:15]}{'...' if len(pnl_list)>15 else ''}"
        lines.append(f"| {name} | {trades} | {wins} | {losses} | {wr:.0f} | {pnl_pts:.1f} | {avg_pts:.1f} | {day_dist} | {dist_str} |")

    lines.extend([
        "",
        "## Per-config trade list (day, pnl_pts, exit_reason)",
        "",
    ])
    for name, _ in configs:
        rows = results[name]
        lines.append(f"### {name}")
        if not rows:
            lines.append("- No trades.")
        else:
            for day, p, reason in rows:
                lines.append(f"- {day}  **{p:.1f} pts**  ({reason})")
        lines.append("")

    lines.extend([
        "## Interpretation",
        "",
        "- **Trades/day 0:1:2:3+** = how many days had 0, 1, 2, or 3+ trades. Goal: mostly 0 and 1.",
        "- **≥20 / ≥30 / ≥50** = count of trades with that many pts. Goal: many 20+, several 30+, some 50+.",
        "- If a config has few trades but avg_pts 20–30+ and WR decent, that’s the selective edge.",
        "",
    ])
    OUT_MD.write_text("\n".join(lines))
    print(f"Wrote {OUT_MD}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=None, help="Limit to first N days (default: all 9)")
    args = ap.parse_args()
    run(days_limit=args.days)
