"""
Run baseline backtest on all days with full trade details.
For each trade compute POST-EXIT price action (analysis only, no look-ahead in strategy):
  - max high in next 30/60/120 bars after exit -> how much we left on table if we held
  - min low in next 30/60/120 bars -> would we have been stopped if we held?
Writes data/analysis_trades.json and data/analysis_summary.txt
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import numpy as np

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
POST_BARS = [30, 60, 120]  # bars after exit to measure forward run

def main():
    params_path = DATA_DIR / "baseline_params.json"
    params = json.loads(params_path.read_text())
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    all_trades = []
    for f in files:
        bars, trades_df = load_dbn_streaming(f, freq_sec=BAR_SEC)
        r, details = run_backtest(
            bars=bars, trades_df=trades_df, params=params, bar_sec=BAR_SEC,
            return_trade_details=True, day_label=f.stem,
        )
        if not details:
            continue
        mid = bars["mid"].values
        for d in details:
            exit_bar = d["exit_bar"]
            exit_price = d["exit_price"]
            entry_price = d["entry_price"]
            rec = {
                "day": d["day"],
                "entry_bar": d["entry_bar"],
                "exit_bar": exit_bar,
                "entry_price": float(entry_price),
                "exit_price": float(exit_price),
                "pnl_pts": float(d["pnl_pts"]),
                "exit_reason": d["exit_reason"],
                "mfe_pts": float(d["mfe_pts"]),
                "mae_pts": float(d["mae_pts"]),
            }
            # Post-exit: what happened in next 30/60/120 bars (analysis only)
            for nb in POST_BARS:
                end = min(exit_bar + 1 + nb, len(mid))
                if end <= exit_bar + 1:
                    rec[f"post_high_{nb}"] = None
                    rec[f"post_low_{nb}"] = None
                    rec[f"post_run_pts_{nb}"] = None  # max(0, post_high - exit_price)
                    continue
                window = mid[exit_bar + 1 : end]
                post_high = float(np.max(window))
                post_low = float(np.min(window))
                rec[f"post_high_{nb}"] = post_high
                rec[f"post_low_{nb}"] = post_low
                rec[f"post_run_pts_{nb}"] = float(post_high - exit_price)  # pts after our exit in that window
            all_trades.append(rec)
        print(f.name, "trades", len(details), flush=True)

    out_json = DATA_DIR / "analysis_trades.json"
    out_json.write_text(json.dumps(all_trades, indent=2))
    print("Wrote", out_json, flush=True)

    # Summary
    wins = [t for t in all_trades if t["pnl_pts"] > 0]
    losses = [t for t in all_trades if t["pnl_pts"] <= 0]
    tp_exits = [t for t in all_trades if t["exit_reason"] == "tp"]
    sl_exits = [t for t in all_trades if t["exit_reason"] == "sl"]
    rev_exits = [t for t in all_trades if t["exit_reason"] == "reversal_bos"]

    lines = []
    lines.append("=== BASELINE FULL TRADE ANALYSIS ===")
    lines.append(f"Total trades: {len(all_trades)}  Wins: {len(wins)}  Losses: {len(losses)}  WR: {100*len(wins)/len(all_trades):.1f}%" if all_trades else "No trades")
    lines.append(f"Total PnL pts: {sum(t['pnl_pts'] for t in all_trades):.2f}  Avg pts/trade: {np.mean([t['pnl_pts'] for t in all_trades]):.2f}" if all_trades else "")
    lines.append(f"Exit reasons: tp={len(tp_exits)} sl={len(sl_exits)} reversal_bos={len(rev_exits)}")
    lines.append("")

    if tp_exits:
        lines.append("--- AFTER TP EXIT: how much did price run in next 30/60/120 bars? ---")
        for nb in POST_BARS:
            key = f"post_run_pts_{nb}"
            vals = [t[key] for t in tp_exits if t[key] is not None]
            if vals:
                lines.append(f"  Post-exit run (next {nb} bars): avg={np.mean(vals):.1f} pts  max={np.max(vals):.1f}  min={np.min(vals):.1f}  median={np.median(vals):.1f}")
        lines.append("  -> If we held longer, would we have captured more? (and would we have been stopped?)")
        # For TP exits: in next 60 bars, did price ever go below exit_price - 15? (would trail have stopped us?)
        for nb in [60, 120]:
            key_low = f"post_low_{nb}"
            left = [t for t in tp_exits if t[key_low] is not None]
            if left:
                below_exit = sum(1 for t in left if t[key_low] < t["exit_price"])
                below_exit_minus_15 = sum(1 for t in left if t[key_low] < t["exit_price"] - 15)
                lines.append(f"  In next {nb} bars after TP: price went below exit_price in {below_exit}/{len(left)} trades, below exit-15 in {below_exit_minus_15}/{len(left)}")
    lines.append("")

    if sl_exits:
        lines.append("--- SL EXITS: MFE/MAE ---")
        for t in sl_exits:
            lines.append(f"  day={t['day']} pnl_pts={t['pnl_pts']:.2f} mfe_pts={t['mfe_pts']:.2f} mae_pts={t['mae_pts']:.2f}")
        lines.append("  -> Did price ever go in our favor before stopping? (MFE > 0?)")
    lines.append("")

    if rev_exits:
        lines.append("--- REVERSAL BOS EXITS ---")
        for t in rev_exits[:10]:
            lines.append(f"  day={t['day']} pnl_pts={t['pnl_pts']:.2f} mfe_pts={t['mfe_pts']:.2f}")
        if len(rev_exits) > 10:
            lines.append(f"  ... and {len(rev_exits)-10} more")
    lines.append("")

    # Per-trade table
    lines.append("--- PER-TRADE (entry_bar, exit_reason, pnl_pts, mfe, mae, post_run_30/60/120) ---")
    for i, t in enumerate(all_trades):
        p30 = t.get("post_run_pts_30")
        p60 = t.get("post_run_pts_60")
        p120 = t.get("post_run_pts_120")
        lines.append(f"  {i+1:2} bar={t['entry_bar']:3} exit={t['exit_reason']:12} pnl={t['pnl_pts']:6.2f} mfe={t['mfe_pts']:5.2f} mae={t['mae_pts']:5.2f} post30={p30:.1f if p30 is not None else 0} post60={p60:.1f if p60 is not None else 0} post120={p120:.1f if p120 is not None else 0}")

    summary_path = DATA_DIR / "analysis_summary.txt"
    summary_path.write_text("\n".join(lines))
    print("Wrote", summary_path, flush=True)

if __name__ == "__main__":
    main()
