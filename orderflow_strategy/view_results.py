"""Quick view of results from completed days. Run: python view_results.py"""
import sys
from pathlib import Path
import itertools
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import BacktestResult, get_best_params

results_dir = DATA_DIR / "results"
# Must match run_full.py grid exactly
keys = [
    "sl_max_pts", "sl_points_fallback", "key_level_points",
    "min_passive_accumulation_count", "passive_cob_threshold", "passive_lookback_bars",
    "aggressive_min_volume", "aggressive_window_seconds",
    "bos_swing_lookback", "bos_search_bars", "bos_min_break_ticks", "bounce_bars",
    "trail_sl_pts", "tp_style", "tp_buffer", "min_run_pts",
    "cob_tp_threshold", "tp_buffer_pts_cob", "cob_near_key_pts",
    "sl_style", "exit_on_reversal_bos",
]
values = [
    [15, 25], [15], [20, 40],
    [3, 4], [50, 70], [60],
    [100, 150, 200], [60],
    [10], [120], [2], [3, 5],
    [15], ["cob", "session_high"], [15], [10],
    [20, 30, 40], [2, 3, 5], [15, 20],
    ["level"], [True],
]
combs = list(itertools.product(*values))
if len(combs) > 48:
    np.random.seed(42)
    idx = np.random.choice(len(combs), 48, replace=False)
    combs = [combs[i] for i in idx]

npy_files = sorted(results_dir.glob("mnq_*_RTH_*.npy"))
print(f"Aggregating {len(npy_files)} day(s): {[p.stem.replace('mnq_MNQH6_RTH_', '') for p in npy_files]}")

total = np.zeros((len(combs), 4))
for p in npy_files:
    arr = np.load(p)
    if arr.shape[0] == len(combs):
        total += arr
    else:
        print(f"  Skip {p.name} (wrong shape)")

results = []
for i, c in enumerate(combs):
    t, pnl, w, l = int(total[i, 0]), total[i, 1], int(total[i, 2]), int(total[i, 3])
    results.append(BacktestResult(
        params=dict(zip(keys, c)),
        trades=t, wins=w, losses=l,
        total_pnl_ticks=pnl, sharpe=None, max_drawdown_ticks=0,
        win_rate=w/t if t else 0,
    ))

with_trades = [r for r in results if r.trades > 0]
print(f"\nConfigs with trades: {len(with_trades)} / {len(results)}")

if with_trades:
    best = get_best_params(with_trades, "total_pnl_ticks")
    print("\nBEST (by PnL):")
    print(f"  trades={best.trades} wins={best.wins} losses={best.losses} pnl={best.total_pnl_ticks:.1f} ticks  wr={100*best.win_rate:.1f}%")
    for k, v in best.params.items():
        print(f"  {k}: {v}")
    # Top 5 by PnL
    by_pnl = sorted(with_trades, key=lambda r: r.total_pnl_ticks, reverse=True)[:5]
    print("\nTOP 5 by PnL:")
    for i, r in enumerate(by_pnl, 1):
        print(f"  {i}. trades={r.trades} pnl={r.total_pnl_ticks:.0f} wr={100*r.win_rate:.0f}% | cob={r.params.get('passive_cob_threshold')} passive_lb={r.params.get('passive_lookback_bars')} bos_lb={r.params.get('bos_swing_lookback')} agg_vol={r.params.get('aggressive_min_volume')}")
else:
    print("No configs produced trades.")
