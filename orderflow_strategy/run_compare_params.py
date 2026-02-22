"""
Load each day once, run multiple param sets, print comparison. No look-ahead.
"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
base = json.loads((DATA_DIR / "baseline_params.json").read_text())

# Param sets to compare
configs = [
    ("baseline", base),
    ("min_tp_15", {**base, "min_tp_pts_above_entry": 15}),
    ("min_tp_20", {**base, "min_tp_pts_above_entry": 20}),
    ("trail_25", {**base, "trail_sl_pts": 25}),
    ("trail_0", {**base, "trail_sl_pts": 0}),
    ("min_tp_15_trail_25", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}),
    ("min_tp_20_trail_25", {**base, "min_tp_pts_above_entry": 20, "trail_sl_pts": 25}),
    ("no_rev_bos", {**base, "exit_on_reversal_bos": False}),
    ("select_3td", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25, "max_trades_per_day": 3, "passive_cob_threshold": 70, "aggressive_min_volume": 200}),
]
files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))

results = {name: {"trades": 0, "pnl_ticks": 0.0, "wins": 0, "losses": 0} for name, _ in configs}

for f in files:
    bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
    for name, params in configs:
        r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
        results[name]["trades"] += r.trades
        results[name]["pnl_ticks"] += r.total_pnl_ticks
        results[name]["wins"] += r.wins
        results[name]["losses"] += r.losses
    print(f.name, "done", flush=True)

print("\n=== COMPARISON (all days) ===\n")
for name, _ in configs:
    d = results[name]
    t = d["trades"]
    pnl_pts = d["pnl_ticks"] * 0.25
    wr = (d["wins"] / t * 100) if t else 0
    avg = (pnl_pts / t) if t else 0
    print(f"{name:25} trades={t:2}  pnl_pts={pnl_pts:7.1f}  wr={wr:5.1f}%  avg_pts/trade={avg:5.2f}")
print("\nDone", flush=True)
