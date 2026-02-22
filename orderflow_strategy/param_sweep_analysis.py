"""
Sweep key parameters; write one row per config to data/sweep_results.csv (append).
Use --days N to limit days (faster). No look-ahead: same bar-by-bar backtest.
"""
import json
import sys
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import numpy as np

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0

# Baseline to copy and vary
def get_baseline():
    return json.loads((DATA_DIR / "baseline_params.json").read_text())

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=9, help="Max days to run (default 9)")
    ap.add_argument("--out", type=str, default=None, help="CSV path (default data/sweep_results.csv)")
    args = ap.parse_args()
    out_path = Path(args.out) if args.out else DATA_DIR / "sweep_results.csv"
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))[: args.days]

    # Grid: focus on trail, min_tp, COB, selectivity, reversal_bos
    grid = [
        {},
        {"trail_sl_pts": 0},
        {"trail_sl_pts": 25},
        {"trail_sl_pts": 35},
        {"min_tp_pts_above_entry": 15},
        {"min_tp_pts_above_entry": 20},
        {"trail_sl_pts": 25, "min_tp_pts_above_entry": 15},
        {"trail_sl_pts": 25, "min_tp_pts_above_entry": 20},
        {"cob_tp_threshold": 40},
        {"cob_tp_threshold": 50},
        {"passive_cob_threshold": 70},
        {"aggressive_min_volume": 200},
        {"bos_min_break_ticks": 3},
        {"exit_on_reversal_bos": False},
        {"max_trades_per_day": 3},
        {"trail_sl_pts": 25, "min_tp_pts_above_entry": 15, "max_trades_per_day": 3},
        {"trail_sl_pts": 25, "min_tp_pts_above_entry": 20, "passive_cob_threshold": 70, "aggressive_min_volume": 200},
    ]

    base = get_baseline()
    rows = []
    for overrides in grid:
        params = {**base, **overrides}
        total_trades = 0
        total_pnl_ticks = 0.0
        total_wins = 0
        total_losses = 0
        for f in files:
            bars, trades_df = load_dbn_streaming(f, freq_sec=BAR_SEC)
            r = run_backtest(bars=bars, trades_df=trades_df, params=params, bar_sec=BAR_SEC)
            total_trades += r.trades
            total_pnl_ticks += r.total_pnl_ticks
            total_wins += r.wins
            total_losses += r.losses
        pnl_pts = total_pnl_ticks * 0.25
        avg_pts = pnl_pts / total_trades if total_trades else 0
        wr = total_wins / total_trades if total_trades else 0
        row = {
            "config": str(overrides),
            "trades": total_trades,
            "wins": total_wins,
            "losses": total_losses,
            "wr_pct": round(wr * 100, 1),
            "pnl_pts": round(pnl_pts, 2),
            "avg_pts_per_trade": round(avg_pts, 2),
        }
        rows.append(row)
        print(overrides, "->", total_trades, "trades", f"wr={wr*100:.1f}%", f"avg_pts={avg_pts:.2f}", flush=True)

    # Append to CSV
    exists = out_path.exists()
    with open(out_path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"])
        if not exists:
            w.writeheader()
        w.writerows(rows)
    print("Wrote", out_path, flush=True)

if __name__ == "__main__":
    main()
