"""Run baseline on first 3 days only; write analysis_trades_3day.json and summary. Fast."""
import json
import sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
POST_BARS = [30, 60, 120]

def main():
    params = json.loads((DATA_DIR / "baseline_params.json").read_text())
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))[:3]
    all_trades = []
    for f in files:
        bars, trades_df = load_dbn_streaming(f, freq_sec=BAR_SEC)
        r, details = run_backtest(bars=bars, trades_df=trades_df, params=params, bar_sec=BAR_SEC,
            return_trade_details=True, day_label=f.stem)
        if not details:
            continue
        mid = bars["mid"].values
        for d in details:
            exit_bar = d["exit_bar"]
            rec = {"day": d["day"], "entry_bar": d["entry_bar"], "exit_bar": exit_bar,
                "entry_price": float(d["entry_price"]), "exit_price": float(d["exit_price"]),
                "pnl_pts": float(d["pnl_pts"]), "exit_reason": d["exit_reason"],
                "mfe_pts": float(d["mfe_pts"]), "mae_pts": float(d["mae_pts"])}
            for nb in POST_BARS:
                end = min(exit_bar + 1 + nb, len(mid))
                if end <= exit_bar + 1:
                    rec[f"post_run_pts_{nb}"] = None
                    rec[f"post_low_{nb}"] = None
                else:
                    window = mid[exit_bar + 1 : end]
                    rec[f"post_run_pts_{nb}"] = float(np.max(window) - d["exit_price"])
                    rec[f"post_low_{nb}"] = float(np.min(window))
            all_trades.append(rec)
        print(f.name, len(details), flush=True)
    (DATA_DIR / "analysis_trades_3day.json").write_text(json.dumps(all_trades, indent=2))
    tp = [t for t in all_trades if t["exit_reason"] == "tp"]
    lines = [f"Trades: {len(all_trades)}", f"TP exits: {len(tp)}"]
    for nb in POST_BARS:
        vals = [t[f"post_run_pts_{nb}"] for t in tp if t.get(f"post_run_pts_{nb}") is not None]
        if vals:
            lines.append(f"Post-TP next {nb} bars: avg run={np.mean(vals):.1f} pts max={np.max(vals):.1f}")
    (DATA_DIR / "analysis_summary_3day.txt").write_text("\n".join(lines))
    print("Done. Wrote analysis_trades_3day.json and analysis_summary_3day.txt", flush=True)

if __name__ == "__main__":
    main()
