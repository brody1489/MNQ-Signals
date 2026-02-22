"""Single day: full details + post-exit run. Print to stdout for capture."""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
# Smallest RTH file by size is often 02-16
f = DATA_DIR / "mnq_MNQH6_RTH_2026-02-16.dbn"
params = json.loads((DATA_DIR / "baseline_params.json").read_text())
bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
r, details = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC, return_trade_details=True, day_label=f.stem)
mid = bars["mid"].values
print("Day:", f.name, "Trades:", len(details), "Total_pts:", r.total_pnl_ticks * 0.25, "WR:", r.win_rate, flush=True)
for i, d in enumerate(details):
    exit_bar = d["exit_bar"]
    ex = d["exit_price"]
    # next 60 bars
    end60 = min(exit_bar + 1 + 60, len(mid))
    post60_high = np.max(mid[exit_bar+1:end60]) if end60 > exit_bar+1 else ex
    post60_low = np.min(mid[exit_bar+1:end60]) if end60 > exit_bar+1 else ex
    run60 = post60_high - ex
    print(f"  #{i+1} exit_reason={d['exit_reason']} pnl_pts={d['pnl_pts']:.2f} mfe={d['mfe_pts']:.2f} mae={d['mae_pts']:.2f} tp_dist_pts={d.get('tp_distance_pts')} post60_run_pts={run60:.1f} post60_low_vs_exit={post60_low - ex:.1f}", flush=True)
print("Done", flush=True)
