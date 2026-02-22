"""
Run full diagnostics on the best (or given) params across all days.
Prints: per-trade table, winners vs losers (avg/max size), exit reason breakdown,
MFE/MAE so we can see if SL is too tight or TP too early.
Usage: python audit_trades.py [--days N]
"""
import sys
import argparse
from pathlib import Path
import itertools
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest, get_best_params, BacktestResult


# Same grid as run_full.py so we can pick same "best" from aggregated results
def _get_grid_and_best(days_limit=None):
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
    results_dir = DATA_DIR / "results"
    npy_files = sorted(results_dir.glob("mnq_*.npy"))
    if not npy_files:
        return None, None, None
    if days_limit:
        npy_files = npy_files[:days_limit]
    total = np.zeros((len(combs), 4))
    for p in npy_files:
        arr = np.load(p)
        if arr.shape[0] == len(combs):
            total += arr
    results = []
    for i, c in enumerate(combs):
        agg = {"trades": int(total[i, 0]), "pnl": total[i, 1], "wins": int(total[i, 2]), "losses": int(total[i, 3])}
        params = dict(zip(keys, c))
        r = BacktestResult(
            params=params, trades=agg["trades"], wins=agg["wins"], losses=agg["losses"],
            total_pnl_ticks=agg["pnl"], sharpe=None, max_drawdown_ticks=0.0,
            win_rate=agg["wins"] / agg["trades"] if agg["trades"] else 0,
        )
        results.append(r)
    with_trades = [r for r in results if r.trades > 0]
    if not with_trades:
        return None, None, None
    quality = [r for r in with_trades if r.win_rate >= 0.35 and r.trades >= 2]
    best = get_best_params(quality, "total_pnl_ticks") if quality else get_best_params(with_trades, "total_pnl_ticks")
    return best.params, keys, combs


def main():
    ap = argparse.ArgumentParser(description="Audit trades: per-trade details, winners vs losers, exit reasons")
    ap.add_argument("--days", type=int, default=None, help="Limit to first N days (for speed)")
    ap.add_argument("--params", type=str, default=None, help="JSON of params to audit (else use best from optimize)")
    ap.add_argument("--params-file", type=str, default=None, help="Path to JSON file (e.g. data/baseline_params.json)")
    args = ap.parse_args()

    bar_sec = 60.0
    all_files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not all_files:
        print("No .dbn files in data/. Run fetch first.")
        return
    if args.days:
        all_files = all_files[: args.days]
        print(f"Using first {args.days} day(s)")
    print(f"Auditing {len(all_files)} day(s) ...")

    # Fallback params (hold-longer style) if no .npy results
    FALLBACK_PARAMS = {
        "sl_max_pts": 15, "sl_points_fallback": 15, "key_level_points": 40,
        "min_passive_accumulation_count": 3, "passive_cob_threshold": 70, "passive_lookback_bars": 60,
        "aggressive_min_volume": 200, "aggressive_window_seconds": 60,
        "bos_swing_lookback": 10, "bos_search_bars": 120, "bos_min_break_ticks": 2, "bounce_bars": 5,
        "trail_sl_pts": 15, "tp_style": "cob", "tp_buffer": 15, "min_run_pts": 10,
        "cob_tp_threshold": 30, "tp_buffer_pts_cob": 3, "cob_near_key_pts": 20,
        "sl_style": "level", "exit_on_reversal_bos": True,
        "no_first_minutes": 0, "lunch_window": "none",
    }
    import json
    if args.params_file:
        path = Path(args.params_file)
        if not path.is_absolute():
            path = Path(__file__).parent / path
        params = json.loads(path.read_text())
        print(f"Using params from file: {args.params_file}")
    elif args.params:
        params = json.loads(args.params)
        print("Using params from --params")
    else:
        params, _, _ = _get_grid_and_best(args.days)
        if params is None:
            params = FALLBACK_PARAMS
            print("No aggregated results; using built-in fallback (last best) params")
        else:
            print("Using BEST params from last optimize run")
    print()

    all_details = []
    for f in all_files:
        bars, trades_df = load_dbn_streaming(f, freq_sec=bar_sec)
        out = run_backtest(
            bars=bars, trades_df=trades_df, params=params, bar_sec=bar_sec,
            return_trade_details=True, day_label=f.stem,
        )
        if isinstance(out, tuple):
            result, details = out
        else:
            result, details = out, []
        all_details.extend(details)
        if details:
            print(f"  {f.name}: {result.trades} trades, pnl={result.total_pnl_ticks:.0f} ticks")

    if not all_details:
        print("No trades to audit.")
        return

    # --- Per-trade table ---
    print()
    print("=" * 100)
    print("PER-TRADE AUDIT")
    print("=" * 100)
    print(f"{'#':>3} {'day':<28} {'min':>4} {'entry_px':>10} {'exit_px':>10} {'pnl_ticks':>10} {'pnl_pts':>8} {'exit':<12} {'MFE':>6} {'MAE':>6}")
    print("-" * 105)
    for i, t in enumerate(all_details, 1):
        min_open = t.get("minutes_from_open", t.get("entry_bar", ""))
        print(f"{i:>3} {str(t.get('day','')):<28} {min_open!s:>4} {t['entry_price']:>10.2f} {t['exit_price']:>10.2f} {t['pnl_ticks']:>10.1f} {t.get('pnl_pts', t['pnl_ticks']*0.25):>8.2f} {t['exit_reason']:<12} {t['mfe_pts']:>6.1f} {t['mae_pts']:>6.1f}")

    # --- Winners vs losers ---
    winners = [t for t in all_details if t["pnl_ticks"] > 0]
    losers = [t for t in all_details if t["pnl_ticks"] <= 0]
    print()
    print("=" * 100)
    print("WINNERS vs LOSERS")
    print("=" * 100)
    if winners:
        avg_win_ticks = sum(t["pnl_ticks"] for t in winners) / len(winners)
        avg_win_pts = sum(t.get("pnl_pts", t["pnl_ticks"] * 0.25) for t in winners) / len(winners)
        max_win_ticks = max(t["pnl_ticks"] for t in winners)
        max_win_pts = max(t.get("pnl_pts", t["pnl_ticks"] * 0.25) for t in winners)
        print(f"  Winners: {len(winners)}  |  avg +{avg_win_ticks:.1f} ticks ({avg_win_pts:.2f} pts)  |  max +{max_win_ticks:.1f} ticks ({max_win_pts:.2f} pts)")
    if losers:
        avg_loss_ticks = sum(t["pnl_ticks"] for t in losers) / len(losers)
        avg_loss_pts = sum(t.get("pnl_pts", t["pnl_ticks"] * 0.25) for t in losers) / len(losers)
        max_loss_ticks = min(t["pnl_ticks"] for t in losers)
        max_loss_pts = min(t.get("pnl_pts", t["pnl_ticks"] * 0.25) for t in losers)
        print(f"  Losers:  {len(losers)}  |  avg {avg_loss_ticks:.1f} ticks ({avg_loss_pts:.2f} pts)  |  max {max_loss_ticks:.1f} ticks ({max_loss_pts:.2f} pts)")

    # --- Entry time: winners vs losers (min from session open; 0 = 9:30, 120 = 11:30 = lunch) ---
    if any(t.get("minutes_from_open") is not None for t in all_details):
        print()
        print("ENTRY TIME (minutes from 9:30 open) — are losers early/late/chop?")
        print("-" * 50)
        if winners:
            mins_w = [t["minutes_from_open"] for t in winners if t.get("minutes_from_open") is not None]
            if mins_w:
                print(f"  Winners: min={min(mins_w)} max={max(mins_w)} avg={sum(mins_w)/len(mins_w):.0f}  (lunch zone ~120–210)")
        if losers:
            mins_l = [t["minutes_from_open"] for t in losers if t.get("minutes_from_open") is not None]
            if mins_l:
                print(f"  Losers:  min={min(mins_l)} max={max(mins_l)} avg={sum(mins_l)/len(mins_l):.0f}")

    # --- Exit reason breakdown ---
    from collections import Counter
    reasons = Counter(t["exit_reason"] for t in all_details)
    print()
    print("EXIT REASON BREAKDOWN")
    print("-" * 40)
    for reason, count in reasons.most_common():
        pnl_for = sum(t["pnl_ticks"] for t in all_details if t["exit_reason"] == reason)
        print(f"  {reason:<14} {count:>3} trades   total PnL: {pnl_for:>8.1f} ticks")

    # --- Losers: did price go in our favor before we got stopped? ---
    print()
    print("LOSERS: MFE (max favorable excursion) — did we get stopped after price had gone up?")
    print("-" * 60)
    for t in losers[:15]:
        mfe = t["mfe_pts"]
        mae = t["mae_pts"]
        print(f"  pnl={t['pnl_ticks']:>6.1f} ticks  exit={t['exit_reason']:<12}  MFE={mfe:>5.1f} pts  MAE={mae:>5.1f} pts  (day={t.get('day','')})")
    if len(losers) > 15:
        print(f"  ... and {len(losers) - 15} more losers")

    # --- Winners: how much did we leave on the table? ---
    print()
    print("WINNERS: MFE vs realized — did we exit before the move ended?")
    print("-" * 60)
    for t in winners[:15]:
        mfe = t["mfe_pts"]
        realized_pts = t.get("pnl_pts", t["pnl_ticks"] * 0.25)
        left = mfe - realized_pts if mfe > 0 else 0
        print(f"  pnl={t['pnl_ticks']:>6.1f} ticks ({realized_pts:.1f} pts)  exit={t['exit_reason']:<12}  MFE={mfe:>5.1f} pts  left_on_table≈{left:.1f} pts")
    if len(winners) > 15:
        print(f"  ... and {len(winners) - 15} more winners")

    total_pnl = sum(t["pnl_ticks"] for t in all_details)
    print()
    print("=" * 100)
    print(f"TOTAL: {len(all_details)} trades  |  PnL: {total_pnl:.1f} ticks  |  Win rate: {100*len(winners)/len(all_details):.1f}%")
    print("=" * 100)

    # --- Quick recommendations ---
    print()
    print("QUICK DIAGNOSTICS")
    print("-" * 60)
    sl_exits = [t for t in all_details if t["exit_reason"] == "sl"]
    tp_exits = [t for t in all_details if t["exit_reason"] == "tp"]
    rev_exits = [t for t in all_details if t["exit_reason"] == "reversal_bos"]
    if losers and winners:
        avg_win = sum(t["pnl_ticks"] for t in winners) / len(winners)
        avg_loss = sum(t["pnl_ticks"] for t in losers) / len(losers)
        if abs(avg_loss) > avg_win:
            print("  • Avg loser larger than avg winner -> consider: wider SL / trail SL later, or tighter entry so fewer bad trades.")
        else:
            print("  • Avg winner > avg loser size -> win rate or trade count is the lever.")
    if sl_exits:
        mfe_on_sl = [t["mfe_pts"] for t in sl_exits]
        avg_mfe_sl = sum(mfe_on_sl) / len(mfe_on_sl)
        print(f"  • SL exits: {len(sl_exits)}. Avg MFE before exit: {avg_mfe_sl:.1f} pts (if MFE >> trail_sl_pts, trail may be too tight).")
    if tp_exits:
        print(f"  • TP exits: {len(tp_exits)}. Check if tp_buffer is too small (exiting too early).")
    print("  • Re-run with more/other days or different params via --params '{\"trail_sl_pts\":20,...}' to compare.")


if __name__ == "__main__":
    main()
