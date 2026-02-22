"""Quick 9-day: V1, V2, and each with enter 1 bar earlier. Writes data/entry_timing_comparison.txt"""
import json
import sys
from pathlib import Path
BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
base = json.loads((DATA_DIR / "baseline_params.json").read_text())
# V1 = baseline (trail 15, no min_tp). V2 = min_tp_15 + trail_25, no lunch.
V1 = {**base, "trail_sl_pts": 15}
V2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
best = json.loads((DATA_DIR / "best_params_v2.json").read_text())  # Time_lunch_skip

configs = [
    ("V1 (baseline)", V1),
    ("V1, 1 bar earlier", {**V1, "entry_bar_offset": -1}),
    ("V2 (min_tp_15, trail_25)", V2),
    ("V2, 1 bar earlier", {**V2, "entry_bar_offset": -1}),
    ("Best (Time_lunch_skip)", best),
    ("Best, 1 bar earlier", {**best, "entry_bar_offset": -1}),
]
files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
if not files:
    print("No DBN files")
    sys.exit(1)
rows = []
for name, params in configs:
    t, pnl, w = 0, 0.0, 0
    for f in files:
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
        t += r.trades
        pnl += r.total_pnl_ticks
        w += r.wins
    pnl_pts = pnl * 0.25
    avg = (pnl_pts / t) if t else 0
    wr = (w / t * 100) if t else 0
    rows.append((name, t, wr, pnl_pts, avg))
    print(f"  {name}: t={t} wr={wr:.1f}% pnl_pts={pnl_pts:.1f} avg_pts={avg:.2f}")
out = ["9-day comparison: V1, V2, Best, and 'enter 1 bar earlier' for each", ""]
out.append(f"{'Config':<28} {'Trades':>6} {'WR%':>6} {'Pnl_pts':>8} {'Avg_pts':>8}")
out.append("-" * 58)
for name, t, wr, pnl_pts, avg in rows:
    out.append(f"{name:<28} {t:>6} {wr:>5.1f}% {pnl_pts:>8.1f} {avg:>8.2f}")
path = DATA_DIR / "entry_timing_comparison.txt"
path.write_text("\n".join(out))
print(f"\nWrote {path}")
