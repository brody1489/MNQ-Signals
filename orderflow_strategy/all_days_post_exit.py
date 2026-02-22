"""For each RTH day: run baseline, for each trade print pnl_pts, tp_distance_pts, post60_run_pts, post60_low_vs_exit. One line per trade to stdout."""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
params = json.loads((DATA_DIR / "baseline_params.json").read_text())
files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
all_rows = []
for f in files:
    bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
    r, details = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC, return_trade_details=True, day_label=f.stem)
    mid = bars["mid"].values
    for d in details:
        exit_bar = d["exit_bar"]
        ex = d["exit_price"]
        end60 = min(exit_bar + 1 + 60, len(mid))
        post60_high = np.max(mid[exit_bar+1:end60]) if end60 > exit_bar+1 else ex
        post60_low = np.min(mid[exit_bar+1:end60]) if end60 > exit_bar+1 else ex
        run60 = float(post60_high - ex)
        low_vs_exit = float(post60_low - ex)
        tp_dist = d.get("tp_distance_pts")
        all_rows.append({
            "day": f.stem, "exit_reason": d["exit_reason"], "pnl_pts": d["pnl_pts"],
            "tp_distance_pts": tp_dist, "post60_run_pts": run60, "post60_low_vs_exit": low_vs_exit,
            "mfe_pts": d["mfe_pts"], "mae_pts": d["mae_pts"],
        })
    print(f.name, len(details), flush=True)

# Summary stats
import json as j
out = DATA_DIR / "all_days_post_exit.json"
out.write_text(j.dumps(all_rows, indent=2))
print("Wrote", out, flush=True)

tp = [r for r in all_rows if r["exit_reason"] == "tp"]
if tp:
    print("\n--- TP exits: tp_distance_pts (how far was first resistance?) ---", flush=True)
    dists = [r["tp_distance_pts"] for r in tp if r.get("tp_distance_pts") is not None]
    if dists:
        print(f"  avg={np.mean(dists):.1f} min={np.min(dists):.1f} max={np.max(dists):.1f} median={np.median(dists):.1f}", flush=True)
    print("\n--- TP exits: post60_run_pts (pts run in next 60 bars after we exited) ---", flush=True)
    run60s = [r["post60_run_pts"] for r in tp]
    print(f"  avg={np.mean(run60s):.1f} max={np.max(run60s):.1f} median={np.median(run60s):.1f} count_gt20={sum(1 for x in run60s if x>20)}", flush=True)
    print("\n--- TP exits: post60_low_vs_exit (did price go below our exit in next 60 bars?) ---", flush=True)
    lows = [r["post60_low_vs_exit"] for r in tp]
    print(f"  avg={np.mean(lows):.1f} min={np.min(lows):.1f} (negative = dipped below exit)", flush=True)
    print(f"  Would trail-15 have been hit? (low < exit-15): {sum(1 for r in tp if r['post60_low_vs_exit'] < -15)}/{len(tp)}", flush=True)

sl = [r for r in all_rows if r["exit_reason"] == "sl"]
if sl:
    print("\n--- SL exits: MFE (did price ever go in our favor?) ---", flush=True)
    for r in sl:
        print(f"  {r['day']} pnl_pts={r['pnl_pts']:.2f} mfe_pts={r['mfe_pts']:.2f} mae_pts={r['mae_pts']:.2f}", flush=True)
print("Done", flush=True)
