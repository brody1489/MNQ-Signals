"""
One script: fetch RTH (9:30-4 PM ET) for as many days as budget allows, then optimize.
Run: python run_full.py   or   python run_full.py --optimize-only

Uses 1-min bars, streaming (low RAM), 1 worker, focused grid.
Resumable: stop anytime, re-run same cmd to pick up where you left off.
After changing param grid: clear data\\optimize_done.txt and data\\results\\*.npy
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

# --- BUDGET: edit this ---
BUDGET_USD = 50.0              # Stop when spend would exceed this
MAX_DAYS = 10                  # Max trading days to try
RTH_START_UTC = "14:30"        # 9:30 AM ET (EST) = 14:30 UTC
RTH_END_UTC = "21:00"          # 4:00 PM ET = 21:00 UTC (6.5 hrs)
OPTIMIZE_CONFIGS = 48          # Focused grid: SL cap, key optional, passive 2vs3, entry relaxed
BAR_SEC = 60.0                 # 1-min bars: zoom out, setups 10–200 min, trades 10–60+ min


def _run_one_day(f_path, combs, keys, bar_sec):
    """
    Load one day via streaming (no full df), build bars+trades, run configs.
    Returns (fname, day_arr). Keeps RAM low (~few GB max).
    """
    from pathlib import Path
    import gc
    from backtest_engine import load_dbn_streaming, run_backtest
    bars, trades_df = load_dbn_streaming(Path(f_path), freq_sec=bar_sec)
    day_arr = np.zeros((len(combs), 4))
    for i, c in enumerate(combs):
        params = dict(zip(keys, c))
        r = run_backtest(bars=bars, trades_df=trades_df, params=params, bar_sec=bar_sec)
        day_arr[i, 0] = r.trades
        day_arr[i, 1] = r.total_pnl_ticks
        day_arr[i, 2] = r.wins
        day_arr[i, 3] = r.losses
    del bars, trades_df
    gc.collect()
    return (Path(f_path).name, day_arr)


def _trading_days_back(n: int) -> list:
    """Last N trading days (no weekends)."""
    days = []
    d = datetime.now(timezone.utc).date()
    while len(days) < n:
        if d.weekday() < 5:  # Mon=0, Fri=4
            days.append(d)
        d -= timedelta(days=1)
    return days


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Check costs only, no fetch")
    ap.add_argument("--optimize-only", action="store_true", help="Skip fetch, only run optimize on existing data")
    ap.add_argument("--fast", action="store_true", help="100 configs (even faster first pass)")
    ap.add_argument("--configs", type=int, default=None, help="Max configs")
    ap.add_argument("--days", type=int, default=None, help="Use only N smallest days (fast iteration)")
    args = ap.parse_args()
    from config import get_api_key, DATA_DIR, DATASET, SCHEMA, SYMBOL
    import databento as db
    from backtest_engine import load_dbn, run_parameter_sweep, get_best_params
    from backtest_params import ParamGrid

    print("=" * 60)
    print("FETCH RTH DAYS + OPTIMIZE")
    print("=" * 60)
    print(f"Budget: ${BUDGET_USD}  Max days: {MAX_DAYS}")
    print(f"RTH: 9:30 AM - 4:00 PM ET (per day)")
    print()

    # If optimize-only, skip fetch and use existing files
    all_files = list(DATA_DIR.glob(f"mnq_{SYMBOL}_RTH_*.dbn"))
    if args.optimize_only:
        if not all_files:
            print("No RTH data in data/. Run without --optimize-only to fetch first.")
            return
        print(f"Optimize only: using {len(all_files)} existing file(s)")
    else:
        key = get_api_key()
        client = db.Historical(key)
        spent = 0.0
        fetched = []
        days = _trading_days_back(MAX_DAYS)

        for day in days:
            start_str = f"{day}T{RTH_START_UTC}"
            end_str = f"{day}T{RTH_END_UTC}"

            try:
                cost = float(client.metadata.get_cost(
                    dataset=DATASET,
                    start=start_str,
                    end=end_str,
                    symbols=SYMBOL,
                    schema=SCHEMA,
                    stype_in="raw_symbol",
                ))
            except Exception as e:
                print(f"  {day}: skip ({e})")
                continue

            if spent + cost > BUDGET_USD:
                print(f"  {day}: skip (would exceed budget: ${spent + cost:.2f})")
                continue

            out_file = DATA_DIR / f"mnq_{SYMBOL}_RTH_{day}.dbn"
            if args.dry_run:
                if out_file.exists():
                    print(f"  {day}: have")
                else:
                    print(f"  {day}: would fetch ${cost:.2f}")
                    spent += cost
                continue

            if out_file.exists():
                print(f"  {day}: already have {out_file.name}")
                fetched.append(out_file)
                continue

            print(f"  {day}: fetch ${cost:.2f} ... ", end="", flush=True)
            try:
                client.timeseries.get_range(
                    dataset=DATASET,
                    start=start_str,
                    end=end_str,
                    symbols=SYMBOL,
                    schema=SCHEMA,
                    stype_in="raw_symbol",
                    path=str(out_file),
                )
                spent += cost
                fetched.append(out_file)
                print(f"done ({out_file.stat().st_size / 1024**2:.0f} MB)")
            except Exception as e:
                print(f"error: {e}")

        print()
        if args.dry_run:
            print(f"Dry run: would spend ~${spent:.2f} for new days (already have: {sum(1 for d in days if (DATA_DIR / f'mnq_{SYMBOL}_RTH_{d}.dbn').exists())})")
            return

        print(f"Fetched {len(fetched)} days, ~${spent:.2f} spent")
        all_files = list(set(fetched) | {f for f in DATA_DIR.glob(f"mnq_{SYMBOL}_RTH_*.dbn")})
    if not all_files:
        print("No data. Check budget or dates.")
        return

    # Optimize: focused grid + parallel over days (CPU workers, 1-min bars = fast)
    from backtest_engine import run_backtest, _build_bars, load_dbn
    import itertools
    import multiprocessing

    bar_sec = BAR_SEC
    # Your edge: strict sequence (passive at level -> retest/bounce -> BOS -> aggressive). Tunable numbers only.
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
        [3, 4], [50, 70], [60],   # at least 3 passive acc bars, COB over 50/70
        [100, 150, 200], [60],
        [10], [120], [2], [3, 5],  # bounce_bars after retest
        [15], ["cob", "session_high"], [15], [10],
        [20, 30, 40], [2, 3, 5], [15, 20],
        ["level"], [True],
    ]
    combs = list(itertools.product(*values))
    n_configs = args.configs if args.configs is not None else (24 if args.fast else OPTIMIZE_CONFIGS)
    if len(combs) > n_configs:
        np.random.seed(42)
        idx = np.random.choice(len(combs), n_configs, replace=False)
        combs = [combs[i] for i in idx]

    results_dir = DATA_DIR / "results"
    results_dir.mkdir(exist_ok=True)
    done_file = DATA_DIR / "optimize_done.txt"
    # Sort by name (chronological) for consistent resumability; --days N uses first N
    all_files_sorted = sorted(all_files)
    if args.days is not None:
        all_files_sorted = all_files_sorted[: args.days]
        print(f"Using first {len(all_files_sorted)} day(s)")

    if done_file.exists():
        days_done = [line.strip() for line in done_file.read_text().splitlines() if line.strip()]
    else:
        days_done = []
    files_todo = [f for f in all_files_sorted if f.name not in days_done]

    if not files_todo:
        print("All days already processed. Loading results from disk...")
    else:
        if days_done:
            print(f"Resuming: {len(days_done)} day(s) done, {len(files_todo)} remaining.")
        print()
        print(f"Running {len(combs)} configs on {len(files_todo)} day(s), 1 worker (low RAM ~few GB), streaming...")
        import gc
        for fi, f in enumerate(files_todo):
            print(f"  Day {fi+1}/{len(files_todo)}: {f.name} ... ", end="", flush=True)
            fname, day_arr = _run_one_day(str(f), combs, keys, bar_sec)
            stem = fname.replace(".dbn", "")
            np.save(results_dir / f"{stem}.npy", day_arr)
            with open(done_file, "a") as fp:
                fp.write(fname + "\n")
            gc.collect()
            print("done")

    # Aggregate from disk: sum all .npy in results/ (only those matching current config count)
    npy_files = sorted(results_dir.glob("mnq_*.npy"))
    if not npy_files:
        print("No result files. Run optimize first.")
        return
    total = np.zeros((len(combs), 4))
    for p in npy_files:
        arr = np.load(p)
        if arr.shape[0] == len(combs):
            total += arr
    aggregated_by_idx = [{"trades": int(total[i, 0]), "pnl": total[i, 1], "wins": int(total[i, 2]), "losses": int(total[i, 3])} for i in range(len(combs))]

    # Build results (index matches combs)

    from backtest_engine import BacktestResult
    results = []
    for i, c in enumerate(combs):
        agg = aggregated_by_idx[i]
        params = dict(zip(keys, c))
        r = BacktestResult(
            params=params,
            trades=agg["trades"],
            wins=agg["wins"],
            losses=agg["losses"],
            total_pnl_ticks=agg["pnl"],
            sharpe=None,
            max_drawdown_ticks=0.0,
            win_rate=agg["wins"] / agg["trades"] if agg["trades"] else 0,
        )
        results.append(r)

    with_trades = [r for r in results if r.trades > 0]
    print()
    print(f"Configs with trades: {len(with_trades)} / {len(results)}")

    if with_trades:
        # Prefer configs with decent win rate (quality), then best PnL
        quality = [r for r in with_trades if r.win_rate >= 0.35 and r.trades >= 2]
        best = get_best_params(quality, "total_pnl_ticks") if quality else get_best_params(with_trades, "total_pnl_ticks")
        print()
        print("BEST PARAMS (prefer WR>=35%, trades>=2):")
        print(f"  trades={best.trades} wins={best.wins} losses={best.losses} pnl={best.total_pnl_ticks:.1f} ticks")
        for k, v in best.params.items():
            print(f"  {k}: {v}")
    else:
        print("No configs produced trades.")

    print()
    print("Done. Data in data/")


if __name__ == "__main__":
    main()
