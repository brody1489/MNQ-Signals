"""
Run all 9 days once; for each config run backtest and aggregate.
Writes data/full_9day_comparison.csv and data/full_9day_comparison.txt.
V1 baseline = 15 trades, 93% WR, ~8 pt avg. Compare to V2 and variants.
"""
import json
import sys
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
base = json.loads((DATA_DIR / "baseline_params.json").read_text())

# V1 = original baseline (8 pt avg). V2 = min_tp_15 style. Plus variants.
CONFIGS = [
    ("V1_baseline", base),
    ("V2_min_tp_15", {**base, "min_tp_pts_above_entry": 15}),
    ("V2_min_tp_20", {**base, "min_tp_pts_above_entry": 20}),
    ("V2_min_tp_25", {**base, "min_tp_pts_above_entry": 25}),
    ("V2_trail_25", {**base, "trail_sl_pts": 25}),
    ("V2_trail_0", {**base, "trail_sl_pts": 0}),
    ("V2_min_tp_15_trail_25", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}),
    ("V2_min_tp_20_trail_25", {**base, "min_tp_pts_above_entry": 20, "trail_sl_pts": 25}),
    ("V2_no_reversal_bos", {**base, "exit_on_reversal_bos": False}),
    ("V2_hold_until_reversal", {**base, "tp_style": "hold", "max_hold_bars": 120}),
    ("V2_cob_buffer_0.5", {**base, "min_tp_pts_above_entry": 15, "tp_buffer_pts_cob": 0.5}),
    ("V2_cob_buffer_1", {**base, "min_tp_pts_above_entry": 15, "tp_buffer_pts_cob": 1.0}),
    ("V2_select", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25, "max_trades_per_day": 3, "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3}),
]

def main():
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        print("No RTH .dbn files in data/")
        return
    results = {name: {"trades": 0, "pnl_ticks": 0.0, "wins": 0, "losses": 0} for name, _ in CONFIGS}
    for f in files:
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        for name, params in CONFIGS:
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            results[name]["trades"] += r.trades
            results[name]["pnl_ticks"] += r.total_pnl_ticks
            results[name]["wins"] += r.wins
            results[name]["losses"] += r.losses
        print(f.name, flush=True)

    rows = []
    for name, _ in CONFIGS:
        d = results[name]
        t = d["trades"]
        pnl_pts = d["pnl_ticks"] * 0.25
        wr = (d["wins"] / t * 100) if t else 0
        avg = (pnl_pts / t) if t else 0
        rows.append({"config": name, "trades": t, "wins": d["wins"], "losses": d["losses"], "wr_pct": round(wr, 1), "pnl_pts": round(pnl_pts, 2), "avg_pts_per_trade": round(avg, 2)})
        print(f"{name:30} trades={t:2}  pnl_pts={pnl_pts:7.1f}  wr={wr:5.1f}%  avg_pts/trade={avg:5.2f}")

    out_csv = DATA_DIR / "full_9day_comparison.csv"
    with open(out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"])
        w.writeheader()
        w.writerows(rows)
    print("Wrote", out_csv, flush=True)

    lines = [
        "=== FULL 9-DAY COMPARISON ===",
        f"V1 baseline: 15 trades, 93% WR, ~8 pt avg (reference)",
        "",
    ]
    for r in rows:
        lines.append(f"{r['config']:30} trades={r['trades']:2}  pnl_pts={r['pnl_pts']:7.1f}  wr={r['wr_pct']:5.1f}%  avg_pts={r['avg_pts_per_trade']:5.2f}")
    out_txt = DATA_DIR / "full_9day_comparison.txt"
    out_txt.write_text("\n".join(lines))
    print("Wrote", out_txt, flush=True)

if __name__ == "__main__":
    main()
