"""
Long-horizon backtest: 1 year or 1 month from TODAY (no hardcoded dates).
- Fetches one RTH day at a time, runs backtest (longs + shorts). Saves to schema-specific files:
  mbp-1 -> data/long_backtest_trades.jsonl; mbp-10 -> data/long_backtest_trades_mbp10.jsonl.
- Params from data/baseline_params.json (same edge as 9-day). Resumable per file.
- Default: last 12 months to today (1 year). Use --months 1 for last 1 month.
- 402 insufficient_funds: day is skipped; add budget at databento.com and re-run to fill gaps.
- mbp-10 (L2) single-day RTH can be >5 GB; ensure sufficient budget and consider batch in portal.

CMD prompts (set API key first: set DATABENTO_API_KEY=db-your-key):
  1) Open folder:
       cd /d c:\\Website_design\\orderflow_strategy
  2) Delete results (clean slate):
       del data\\long_backtest_trades.jsonl
       del data\\long_backtest_trades_mbp10.jsonl
  3) Run (dates = from today; pick one):
       python run_long_backtest.py --workers 10
       python run_long_backtest.py --schema mbp-10 --months 1 --workers 10
       python run_long_backtest.py --schema mbp-1 --months 1 --workers 10
"""
from __future__ import annotations

import argparse
import gc
import json
import multiprocessing
import sys
import threading
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import databento as db

# Allow running from repo root or from orderflow_strategy
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backtest_engine import load_dbn_streaming, run_backtest
from config import DATA_DIR, DATASET, SYMBOL, get_api_key

# Long backtest uses continuous front-month so every date has data (MNQH6 is only one contract; 2025 dates need then-front-month).
CONTINUOUS_SYMBOL = "MNQ.c.0"

BAR_SEC = 60.0
# RTH 9:30 AM - 4:00 PM ET
EST = __import__("zoneinfo").ZoneInfo("America/New_York")
RTH_START = (9, 30)
RTH_END = (16, 0)

def _results_file_for_schema(schema: str) -> str:
    """Separate result files per schema so 1-month L2 vs L1 comparison doesn't overwrite."""
    if schema == "mbp-10":
        return "long_backtest_trades_mbp10.jsonl"
    return "long_backtest_trades.jsonl"


# L1 (mbp-1) depth scale is ~2–6; we use this percentile so only strongest bars = PA. Higher = fewer, more selective setups.
L1_PA_PERCENTILE = 98


def load_saved_trades(results_path: Path) -> tuple[list[dict], set[str]]:
    """Load existing results from JSONL. Returns (all_trades, completed_days)."""
    all_trades = []
    completed_days = set()
    if not results_path.exists():
        return all_trades, completed_days
    for line in results_path.read_text().strip().splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            day_str = row.get("day", "")
            trades = row.get("trades", [])
            completed_days.add(day_str)
            all_trades.extend(trades)
        except (json.JSONDecodeError, TypeError):
            continue
    return all_trades, completed_days


def append_day_results(results_path: Path, day: date, details: list[dict]) -> None:
    """Append one day's trades to the JSONL file."""
    line = json.dumps({"day": str(day), "trades": details}) + "\n"
    with open(results_path, "a", encoding="utf-8") as f:
        f.write(line)


def trading_days_back(n_months: int, end_date: date | None = None) -> list[date]:
    """Trading days (weekdays) from (end - n calendar months) to end, inclusive.
    Uses ~31 days per month so '1 month' = last ~31 days to today, not 'first of last month'.
    """
    end = end_date or date.today()
    # ~31 days per month: 1 month = last 31 days, 12 months = last 372 days
    start = end - timedelta(days=n_months * 31)
    return trading_days_between(start, end)


def trading_days_between(start_date: date, end_date: date) -> list[date]:
    """Trading days (weekdays) from start_date to end_date, inclusive."""
    days = []
    d = start_date
    while d <= end_date:
        if d.weekday() < 5:  # Mon–Fri
            days.append(d)
        d += timedelta(days=1)
    return days


def rth_utc_range(day: date) -> tuple[str, str]:
    """Return (start_utc_str, end_utc_str) for that day's RTH."""
    start_et = datetime(day.year, day.month, day.day, RTH_START[0], RTH_START[1], 0, tzinfo=EST)
    end_et = datetime(day.year, day.month, day.day, RTH_END[0], RTH_END[1], 0, tzinfo=EST)
    start_utc = start_et.astimezone(timezone.utc)
    end_utc = end_et.astimezone(timezone.utc)
    return start_utc.strftime("%Y-%m-%dT%H:%M:%S"), end_utc.strftime("%Y-%m-%dT%H:%M:%S")


def load_params(schema_override: str | None = None) -> dict:
    """Load params: SAME as 9-day (baseline_params.json) so we run the exact same edge. Add enable_shorts for both sides."""
    baseline_path = DATA_DIR / "baseline_params.json"
    if baseline_path.exists():
        params = json.loads(baseline_path.read_text())
    else:
        # Fallback to live params if no baseline (e.g. fresh clone)
        live_params = ROOT.parent / "live_signals" / "params.json"
        params = json.loads(live_params.read_text()) if live_params.exists() else {}
    params.setdefault("enable_shorts", True)
    return params


def fetch_one_day(
    client: db.Historical,
    day: date,
    schema: str,
    out_path: Path,
    dry_run: bool,
    *,
    symbol: str = SYMBOL,
    stype_in: str = "raw_symbol",
) -> tuple[bool, float, float]:
    """Fetch one RTH day. Returns (success, cost_usd, size_gb). Use symbol=CONTINUOUS_SYMBOL, stype_in='continuous' for long backtest so each date gets then-front-month."""
    start_str, end_str = rth_utc_range(day)
    try:
        cost_usd = float(client.metadata.get_cost(
            dataset=DATASET,
            start=start_str,
            end=end_str,
            symbols=symbol,
            schema=schema,
            stype_in=stype_in,
        ))
        size_bytes = int(client.metadata.get_billable_size(
            dataset=DATASET,
            start=start_str,
            end=end_str,
            symbols=symbol,
            schema=schema,
            stype_in=stype_in,
        ))
    except Exception as e:
        print(f"    {day}: metadata error {e}")
        return False, 0.0, 0.0

    size_gb = size_bytes / (1024**3)
    if dry_run:
        print(f"    {day}: ${cost_usd:.2f}  {size_gb:.2f} GB")
        return True, cost_usd, size_gb

    if out_path.exists():
        return True, 0.0, out_path.stat().st_size / (1024**3)

    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # suppress BentoWarning e.g. "request size > 5 GB"
            client.timeseries.get_range(
                dataset=DATASET,
                start=start_str,
                end=end_str,
                symbols=symbol,
                schema=schema,
                stype_in=stype_in,
                path=str(out_path),
            )
        return True, cost_usd, out_path.stat().st_size / (1024**3)
    except Exception as e:
        err = str(e).lower()
        if "402" in err or "insufficient" in err or "budget" in err:
            print(f"    {day}: 402 insufficient budget — day skipped. Add funds at databento.com and re-run to fill.", flush=True)
        else:
            print(f"    {day}: fetch error {e}", flush=True)
        return False, 0.0, 0.0


def _worker_process(
    worker_id: int,
    days_chunk: list[date],
    schema: str,
    keep_files: bool,
    params: dict,
    results_path: Path,
    data_dir: Path,
    fetch_lock,  # multiprocessing.Manager().Lock() - only one worker fetches at a time (API limit)
    progress_queue,  # put (day_str, n_trades, worker_id) after each day; main thread prints
    main_file_lock,  # append to main JSONL after each day so progress is saved immediately
) -> tuple[float, int]:
    """
    Run in a separate process: fetch (under lock) + backtest for each day.
    Each day is appended to the main results file immediately (under main_file_lock) so
    progress is saved and resumable. Returns (total_cost, num_days_done).
    """
    client = db.Historical(get_api_key())
    total_cost = 0.0
    done = 0
    for day in days_chunk:
        day_str = str(day)
        out_path = data_dir / f"mnq_MNQc0_RTH_{day}.dbn"
        with fetch_lock:
            ok, cost, _ = fetch_one_day(
                client, day, schema, out_path, dry_run=False,
                symbol=CONTINUOUS_SYMBOL, stype_in="continuous",
            )
        if not ok:
            continue
        total_cost += cost
        try:
            details = run_one_day(out_path, params, day_str)
            line = json.dumps({"day": day_str, "trades": details}) + "\n"
            with main_file_lock:
                with open(results_path, "a", encoding="utf-8") as f:
                    f.write(line)
            done += 1
            try:
                progress_queue.put((day_str, len(details), worker_id))
            except Exception:
                pass
        except Exception:
            pass
        if not keep_files and out_path.exists():
            out_path.unlink()
        gc.collect()
    return (total_cost, done)


def run_one_day(path: Path, params: dict, day_label: str) -> list[dict]:
    """Build bars from DBN, run backtest with trade details. Return list of trade detail dicts."""
    import numpy as np
    bars, trades_df = load_dbn_streaming(path, freq_sec=BAR_SEC, build_cob=True)
    if bars is None or len(bars) < 20:
        return []
    # Same edge as 9-day: only "big" setups (real accumulation). MBP-10 (L2) often has depth 50+ → use baseline.
    # MBP-1 (L1) depth is ~2–6 → use high percentile so only strongest bars count as PA (see L1_PA_PERCENTILE).
    cob_default = params.get("passive_cob_threshold", 50)
    max_bid = float(bars["bid_depth"].max()) if "bid_depth" in bars.columns else 0
    max_ask = float(bars["ask_depth"].max()) if "ask_depth" in bars.columns else 0
    if max_bid < cob_default or max_ask < cob_default:
        pct = L1_PA_PERCENTILE
        p_bid = float(np.percentile(bars["bid_depth"], pct)) if "bid_depth" in bars.columns else cob_default
        p_ask = float(np.percentile(bars["ask_depth"], pct)) if "ask_depth" in bars.columns else cob_default
        adaptive = max(2.0, min(p_bid, p_ask))
        params = {**params, "passive_cob_threshold": round(adaptive, 2)}
    _, details = run_backtest(
        bars=bars,
        trades_df=trades_df,
        params=params,
        bar_sec=BAR_SEC,
        return_trade_details=True,
        day_label=day_label,
    )
    return details or []


def aggregate_by_group(trades: list[dict], key_fn) -> dict:
    """Group trades by key_fn(t) (e.g. month or week). Return dict of group_key -> stats."""
    groups = defaultdict(list)
    for t in trades:
        groups[key_fn(t)].append(t)
    out = {}
    for k, lst in sorted(groups.items()):
        pts = [x["pnl_pts"] for x in lst]
        longs = [x for x in lst if x.get("side") == "long"]
        shorts = [x for x in lst if x.get("side") == "short"]
        out[k] = {
            "trades": len(lst),
            "wins": sum(1 for p in pts if p > 0),
            "losses": sum(1 for p in pts if p <= 0),
            "total_pts": sum(pts),
            "avg_pts": sum(pts) / len(pts) if pts else 0,
            "longs": {
                "trades": len(longs),
                "wins": sum(1 for x in longs if x["pnl_pts"] > 0),
                "losses": sum(1 for x in longs if x["pnl_pts"] <= 0),
                "total_pts": sum(x["pnl_pts"] for x in longs),
                "avg_pts": sum(x["pnl_pts"] for x in longs) / len(longs) if longs else 0,
            },
            "shorts": {
                "trades": len(shorts),
                "wins": sum(1 for x in shorts if x["pnl_pts"] > 0),
                "losses": sum(1 for x in shorts if x["pnl_pts"] <= 0),
                "total_pts": sum(x["pnl_pts"] for x in shorts),
                "avg_pts": sum(x["pnl_pts"] for x in shorts) / len(shorts) if shorts else 0,
            },
        }
    return out


def print_report(trades: list[dict], by_month: dict, by_week: dict | None, overall: dict) -> None:
    """Print full breakdown to stdout."""
    def p(s=""):
        print(s, flush=True)

    p()
    p("=" * 70)
    p("LONG BACKTEST — FULL BREAKDOWN (PnL in POINTS)")
    p("=" * 70)
    p(f"Total trades: {overall['trades']}  |  Wins: {overall['wins']}  |  Losses: {overall['losses']}")
    if overall["trades"]:
        wr = 100 * overall["wins"] / overall["trades"]
        p(f"Win rate: {wr:.1f}%  |  Total PnL: {overall['total_pts']:+.2f} pts  |  Avg per trade: {overall['avg_pts']:+.2f} pts")
    p()
    p("--- BY SIDE ---")
    p(f"  LONGS:  trades={overall['longs']['trades']}  wins={overall['longs']['wins']}  losses={overall['longs']['losses']}  "
      f"total={overall['longs']['total_pts']:+.2f} pts  avg={overall['longs']['avg_pts']:+.2f} pts")
    p(f"  SHORTS: trades={overall['shorts']['trades']}  wins={overall['shorts']['wins']}  losses={overall['shorts']['losses']}  "
      f"total={overall['shorts']['total_pts']:+.2f} pts  avg={overall['shorts']['avg_pts']:+.2f} pts")
    p()

    if by_month:
        p("--- BY MONTH ---")
        cum = 0.0
        for month_key in sorted(by_month.keys()):
            m = by_month[month_key]
            cum += m["total_pts"]
            p(f"  {month_key}: trades={m['trades']}  wins={m['wins']}  losses={m['losses']}  "
              f"total={m['total_pts']:+.2f} pts  avg={m['avg_pts']:+.2f} pts  cum={cum:+.2f} pts")
            p(f"         longs: {m['longs']['total_pts']:+.2f} pts  |  shorts: {m['shorts']['total_pts']:+.2f} pts")
        p()

    if by_week:
        p("--- BY WEEK ---")
        cum = 0.0
        for week_key in sorted(by_week.keys()):
            w = by_week[week_key]
            cum += w["total_pts"]
            p(f"  {week_key}: trades={w['trades']}  total={w['total_pts']:+.2f} pts  cum={cum:+.2f} pts")
        p()

    # Cumulative curve (by day)
    if trades:
        by_day = defaultdict(float)
        for t in trades:
            by_day[t["day"]] += t["pnl_pts"]
        sorted_days = sorted(by_day.keys())
        cum = 0.0
        p("--- CUMULATIVE PnL (by day) ---")
        for d in sorted_days[:10]:
            cum += by_day[d]
            p(f"  {d}: {by_day[d]:+.2f} pts  →  cum {cum:+.2f} pts")
        if len(sorted_days) > 10:
            p("  ...")
            for d in sorted_days[10:-5]:
                cum += by_day[d]
            for d in sorted_days[-5:]:
                cum += by_day[d]
                p(f"  {d}: {by_day[d]:+.2f} pts  →  cum {cum:+.2f} pts")
        p(f"  Final cumulative: {overall['total_pts']:+.2f} pts")
    p("=" * 70)


def main():
    ap = argparse.ArgumentParser(
        description="Long backtest: 1 year L1 (mbp-1) or 1 month L2 (mbp-10). Day-by-day fetch, low RAM/storage."
    )
    ap.add_argument("--months", type=int, default=12, help="Months of data (default 12 = 1 year)")
    ap.add_argument("--schema", type=str, default="mbp-1", choices=["mbp-1", "mbp-10"],
                    help="mbp-1 = L1 (smaller, matches live). mbp-10 = L2 (1 month typical).")
    ap.add_argument("--keep-files", action="store_true", help="Keep .dbn files after each day (default: delete to save space)")
    ap.add_argument("--dry-run", action="store_true", help="Only list days and cost/size, no fetch or backtest")
    ap.add_argument("--end", type=str, default=None, help="End date YYYY-MM-DD (default: today)")
    ap.add_argument("--start", type=str, default=None, help="Start date YYYY-MM-DD. Omit for 'last N months to --end' (N from --months).")
    ap.add_argument("--workers", type=int, default=6, metavar="N", help="Parallel workers (default 6; use 10–12 for max speed, 1 for sequential)")
    args = ap.parse_args()

    end_date = date.today()
    if args.end:
        try:
            end_date = datetime.strptime(args.end, "%Y-%m-%d").date()
        except ValueError:
            print("Invalid --end. Use YYYY-MM-DD.")
            sys.exit(1)

    if args.start:
        try:
            start_date = datetime.strptime(args.start, "%Y-%m-%d").date()
        except ValueError:
            print("Invalid --start. Use YYYY-MM-DD.")
            sys.exit(1)
        if start_date > end_date:
            print("--start must be on or before --end.")
            sys.exit(1)
        days = trading_days_between(start_date, end_date)
        range_desc = f"{args.start} to {args.end}"
    else:
        days = trading_days_back(args.months, end_date)
        range_desc = f"last {args.months} months to {end_date}"
    if not days:
        print("No trading days in range.")
        sys.exit(0)

    params = load_params()
    params["enable_shorts"] = True

    workers = max(1, min(args.workers, 12))
    print("=" * 60, flush=True)
    print("LONG BACKTEST (long-horizon: BOTH longs and shorts)", flush=True)
    print(f"  Schema: {args.schema}  |  Range: {range_desc}  |  Trading days: {len(days)}", flush=True)
    if days:
        print(f"  First day: {days[0]}  |  Last day: {days[-1]}", flush=True)
    print(f"  RTH: 9:30 AM - 4:00 PM ET  |  1-min bars  |  Longs + Shorts", flush=True)
    if workers > 1:
        print(f"  Workers: {workers} (parallel; ~{workers}x faster, ~{workers}x RAM for active days)", flush=True)
    print("=" * 60, flush=True)

    key = get_api_key()
    client = db.Historical(key)
    results_path = DATA_DIR / _results_file_for_schema(args.schema)
    all_trades, completed_days = load_saved_trades(results_path)
    print(f"  Results: {results_path.name} (L1 1-month and 1-year share this file; resume skips completed days)", flush=True)
    print(f"  Config: data/baseline_params.json | PA threshold: 50 (L2) or top {L1_PA_PERCENTILE}%% depth (L1)", flush=True)
    # Recover any leftover worker files from a previous interrupted run (old code wrote to _w*.jsonl)
    worker_files = sorted(results_path.parent.glob(results_path.stem + "_w*.jsonl"))
    if worker_files:
        day_lines = []
        for wf in worker_files:
            for line in wf.read_text(encoding="utf-8").strip().splitlines():
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                    day_lines.append((row.get("day", ""), line))
                except (json.JSONDecodeError, TypeError):
                    continue
            wf.unlink()
        if day_lines:
            day_lines.sort(key=lambda x: x[0])
            with open(results_path, "a", encoding="utf-8") as f:
                for _, line in day_lines:
                    f.write(line if line.endswith("\n") else line + "\n")
            all_trades, completed_days = load_saved_trades(results_path)
            print(f"  Recovered {len(day_lines)} day(s) from previous run → {len(completed_days)} total in {results_path}", flush=True)
    if completed_days and not worker_files:
        print(f"  Resuming: {len(completed_days)} day(s) already in {results_path}", flush=True)

    if args.dry_run:
        total_cost = 0.0
        total_gb = 0.0
        for day in days:
            start_str, end_str = rth_utc_range(day)
            try:
                c = float(client.metadata.get_cost(
                    dataset=DATASET, start=start_str, end=end_str,
                    symbols=CONTINUOUS_SYMBOL, schema=args.schema, stype_in="continuous",
                ))
                sz = int(client.metadata.get_billable_size(
                    dataset=DATASET, start=start_str, end=end_str,
                    symbols=CONTINUOUS_SYMBOL, schema=args.schema, stype_in="continuous",
                ))
                total_cost += c
                total_gb += sz / (1024**3)
                print(f"  {day}: ${c:.2f}  {sz/(1024**3):.2f} GB", flush=True)
            except Exception as e:
                print(f"  {day}: {e}", flush=True)
        print(f"\n  Total est. cost: ${total_cost:.2f}  |  Total est. size: {total_gb:.2f} GB", flush=True)
        print("  Run without --dry-run to fetch and backtest.", flush=True)
        return

    total_cost = 0.0
    total_days = len(days)
    todo = [d for d in days if str(d) not in completed_days]
    if not todo:
        print("  All days already done.", flush=True)
    elif workers <= 1:
        # Sequential
        for i, day in enumerate(days):
            day_str = str(day)
            num = i + 1
            if day_str in completed_days:
                print(f"  [{num:3d}/{total_days}] {day}  skipped (already done)", flush=True)
                continue
            out_path = DATA_DIR / f"mnq_MNQc0_RTH_{day}.dbn"
            ok, cost, size_gb = fetch_one_day(
                client, day, args.schema, out_path, dry_run=False,
                symbol=CONTINUOUS_SYMBOL, stype_in="continuous",
            )
            if not ok:
                continue
            total_cost += cost
            print(f"  [{num:3d}/{total_days}] {day}  fetched ({out_path.stat().st_size/1024**2:.0f} MB)  running backtest...", flush=True)
            try:
                details = run_one_day(out_path, params, day_str)
                all_trades.extend(details)
                append_day_results(results_path, day, details)
                completed_days.add(day_str)
                print(f"  [{num:3d}/{total_days}] {day}  done ({len(details)} trades) — saved.", flush=True)
            except Exception as e:
                print(f"  [{num:3d}/{total_days}] {day}  Error: {e}", flush=True)
            if not args.keep_files and out_path.exists():
                out_path.unlink()
            gc.collect()
    else:
        # Parallel: round-robin chunk. Only one worker fetches at a time (API concurrency limit).
        # Backtest runs in parallel; progress printed as each day completes.
        chunks = [[] for _ in range(workers)]
        for j, d in enumerate(todo):
            chunks[j % workers].append(d)
        print(f"  Processing {len(todo)} days with {workers} workers (fetch serialized to avoid API limits)...", flush=True)
        with multiprocessing.Manager() as mgr:
            fetch_lock = mgr.Lock()
            main_file_lock = mgr.Lock()
            progress_queue = mgr.Queue()

            def progress_printer():
                while True:
                    item = progress_queue.get()
                    if item is None:
                        break
                    day_str, n_trades, wid = item
                    print(f"  {day_str}  done ({n_trades} trades) — worker {wid}", flush=True)

            printer_thread = threading.Thread(target=progress_printer)
            printer_thread.start()
            try:
                with multiprocessing.Pool(workers) as pool:
                    tasks = [
                        (wid, chunks[wid], args.schema, args.keep_files, params, results_path, DATA_DIR, fetch_lock, progress_queue, main_file_lock)
                        for wid in range(workers) if chunks[wid]
                    ]
                    results = pool.starmap(_worker_process, tasks)
                total_cost = sum(r[0] for r in results)
            finally:
                progress_queue.put(None)
                printer_thread.join()
        all_trades, completed_days = load_saved_trades(results_path)

    if not all_trades:
        print("\nNo trades from backtest. Check params and data.")
        return

    # Overall
    pts = [t["pnl_pts"] for t in all_trades]
    longs = [t for t in all_trades if t.get("side") == "long"]
    shorts = [t for t in all_trades if t.get("side") == "short"]
    overall = {
        "trades": len(all_trades),
        "wins": sum(1 for p in pts if p > 0),
        "losses": sum(1 for p in pts if p <= 0),
        "total_pts": sum(pts),
        "avg_pts": sum(pts) / len(pts),
        "longs": {
            "trades": len(longs),
            "wins": sum(1 for x in longs if x["pnl_pts"] > 0),
            "losses": sum(1 for x in longs if x["pnl_pts"] <= 0),
            "total_pts": sum(x["pnl_pts"] for x in longs),
            "avg_pts": sum(x["pnl_pts"] for x in longs) / len(longs) if longs else 0,
        },
        "shorts": {
            "trades": len(shorts),
            "wins": sum(1 for x in shorts if x["pnl_pts"] > 0),
            "losses": sum(1 for x in shorts if x["pnl_pts"] <= 0),
            "total_pts": sum(x["pnl_pts"] for x in shorts),
            "avg_pts": sum(x["pnl_pts"] for x in shorts) / len(shorts) if shorts else 0,
        },
    }

    # By month
    def month_key(t):
        d = t.get("day")
        if isinstance(d, str) and len(d) >= 7:
            return d[:7]  # YYYY-MM
        return str(d)

    by_month = aggregate_by_group(all_trades, month_key)

    # By week (if 1 month only)
    by_week = None
    if args.months <= 1:
        def week_key(t):
            d = t.get("day")
            if isinstance(d, str):
                try:
                    dt = datetime.strptime(d[:10], "%Y-%m-%d").date()
                except ValueError:
                    return d
                return f"{d[:10]} (w{dt.isocalendar()[1]})"
            return str(d)
        by_week = aggregate_by_group(all_trades, week_key)

    print_report(all_trades, by_month, by_week, overall)
    print(f"\nTotal fetch cost (approx): ${total_cost:.2f}", flush=True)
    print(f"Results saved to: {results_path}", flush=True)


if __name__ == "__main__":
    main()
