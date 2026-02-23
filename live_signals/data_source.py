"""
Live data: backfill today's RTH (if started after 9:30), then stream live bars.
API key from config — set DATABENTO_API_KEY when you have a subscription.
"""
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import tempfile
import pandas as pd

try:
    import databento as db
except ImportError:
    db = None

from config import API_KEY, BAR_SEC, RTH_START_ET, EST, DATASET, SCHEMA, SYMBOL

# MNQ front month symbol for CME (e.g. MNQH6 = Mar 2026); update as needed or use continuous
SYMBOL_RAW = "MNQH6"


def _build_bars_from_replay(store, freq_sec: float = 60.0):
    """Build bars + trades from DBN store (same logic as backtest). Returns (bars_df, trades_df)."""
    first_ts_ns = [None]
    bars_dict = {}
    trades_list = []
    TICK_PX = 0.25

    def callback(r):
        ts_ns = r.ts_recv
        if first_ts_ns[0] is None:
            first_ts_ns[0] = ts_ns
        bar_ns = int(freq_sec * 1_000_000_000)
        bar_idx = (ts_ns - first_ts_ns[0]) // bar_ns
        if r.action == "T":
            side = str(getattr(r, "side", "B"))
            trades_list.append((ts_ns, side, int(r.size)))
            if bar_idx not in bars_dict:
                bars_dict[bar_idx] = {"mid_last": 0.0, "bid_sum": 0.0, "ask_sum": 0.0, "n": 0, "buy_vol": 0, "sell_vol": 0, "ask_at_price": defaultdict(float)}
            d = bars_dict[bar_idx]
            if side == "B":
                d["buy_vol"] = d.get("buy_vol", 0) + int(r.size)
            else:
                d["sell_vol"] = d.get("sell_vol", 0) + int(r.size)
        elif hasattr(r, "levels") and r.levels:
            mid = (r.levels[0].pretty_bid_px + r.levels[0].pretty_ask_px) / 2
            bid_d = sum(lev.bid_sz for lev in r.levels)
            ask_d = sum(lev.ask_sz for lev in r.levels)
            if bar_idx not in bars_dict:
                bars_dict[bar_idx] = {"mid_last": mid, "bid_sum": 0.0, "ask_sum": 0.0, "n": 0, "buy_vol": 0, "sell_vol": 0, "ask_at_price": defaultdict(float)}
            d = bars_dict[bar_idx]
            d["mid_last"] = mid
            d["bid_sum"] += bid_d
            d["ask_sum"] += ask_d
            d["n"] += 1
            for lev in r.levels:
                px = round(lev.pretty_ask_px / TICK_PX) * TICK_PX
                d["ask_at_price"][px] += lev.ask_sz

    store.replay(callback)
    if not bars_dict:
        return pd.DataFrame(columns=["mid", "bid_depth", "ask_depth", "buy_vol", "sell_vol", "cob_ask"]), pd.DataFrame(columns=["ts_recv", "side", "size"])
    bar_idx_sorted = sorted(bars_dict.keys())
    base = pd.Timestamp(first_ts_ns[0], unit="ns")
    times = [base + pd.Timedelta(seconds=int(i) * freq_sec) for i in bar_idx_sorted]
    rows = []
    for i in bar_idx_sorted:
        d = bars_dict[i]
        cob_ask = sorted([(p, depth) for p, depth in d.get("ask_at_price", {}).items() if depth >= 1])
        rows.append({
            "mid": d["mid_last"],
            "bid_depth": d["bid_sum"] / d["n"] if d["n"] else 0,
            "ask_depth": d["ask_sum"] / d["n"] if d["n"] else 0,
            "buy_vol": d.get("buy_vol", 0),
            "sell_vol": d.get("sell_vol", 0),
            "cob_ask": cob_ask,
        })
    bars = pd.DataFrame(rows, index=pd.DatetimeIndex(times))
    bars.index.name = "ts"
    if trades_list:
        trades_df = pd.DataFrame(
            [(pd.Timestamp(t, unit="ns"), s, sz) for t, s, sz in trades_list],
            columns=["ts_recv", "side", "size"],
        )
    else:
        trades_df = pd.DataFrame(columns=["ts_recv", "side", "size"])
    return bars, trades_df


def backfill_today_rth() -> tuple:
    """
    Fetch today's RTH from 9:30 ET to now (if we're in RTH). Returns (bars, trades_df) or (None, None).
    Requires API_KEY set. If you start after 9:30, this loads from session start so strategy has context.
    """
    if not API_KEY or db is None:
        print("[backfill] Skipped: API_KEY not set or databento not installed.", flush=True)
        return None, None
    now_et = datetime.now(EST)
    start_et = now_et.replace(hour=RTH_START_ET[0], minute=RTH_START_ET[1], second=0, microsecond=0)
    if now_et < start_et:
        return None, None
    start_utc = start_et.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    end_utc = now_et.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    path = None
    try:
        print(f"[backfill] Requesting: {start_utc} -> {end_utc} UTC | symbol={SYMBOL_RAW} dataset={DATASET} schema={SCHEMA}", flush=True)
        with tempfile.NamedTemporaryFile(suffix=".dbn", delete=False) as f:
            path = f.name
        client = db.Historical(API_KEY)
        client.timeseries.get_range(
            dataset=DATASET,
            start=start_utc,
            end=end_utc,
            symbols=SYMBOL_RAW,
            schema=SCHEMA,
            stype_in="raw_symbol",
            path=path,
        )
        store = db.DBNStore.from_file(path)
        bars, trades_df = _build_bars_from_replay(store, BAR_SEC)
        Path(path).unlink(missing_ok=True)
        if bars is None or len(bars) == 0:
            print(
                f"[backfill] API returned NO DATA for this range. Requested: {start_utc} to {end_utc} UTC, "
                f"symbol={SYMBOL_RAW}, dataset={DATASET}, schema={SCHEMA}. "
                "Possible: weekend/holiday, wrong symbol (e.g. roll MNQH6), or subscription doesn't include this data.",
                flush=True,
            )
            return None, None
        return bars, trades_df
    except Exception as e:
        if path and Path(path).exists():
            Path(path).unlink(missing_ok=True)
        err_type = type(e).__name__
        print(f"[backfill] Databento error: {err_type}: {e}", flush=True)
        print(
            "[backfill] Check: (1) API key valid and has Historical access, (2) symbol correct (e.g. MNQH6 for front month), "
            "(3) today is a US trading day (Mon–Fri, not holiday), (4) dataset GLBX.MDP3 and schema mbp-1 match your plan.",
            flush=True,
        )
        return None, None


def poll_latest_bar(start_ts: pd.Timestamp) -> tuple:
    """
    Fetch the most recent 2 minutes of data and return the latest complete bar.
    Returns (bar_series, bar_ts) or (None, None). Uses Historical API (same as backtest).
    start_ts: session start (e.g. today 9:30 ET) so bar index is minutes from open.
    """
    if not API_KEY or db is None:
        return None, None
    now_et = datetime.now(EST)
    end_utc = now_et.astimezone(timezone.utc)
    start_utc = end_utc - timedelta(minutes=2)
    start_str = start_utc.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_utc.strftime("%Y-%m-%dT%H:%M:%S")
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".dbn", delete=False) as f:
            path = f.name
        client = db.Historical(API_KEY)
        client.timeseries.get_range(
            dataset=DATASET, start=start_str, end=end_str,
            symbols=SYMBOL_RAW, schema=SCHEMA, stype_in="raw_symbol", path=path,
        )
        store = db.DBNStore.from_file(path)
        bars, _ = _build_bars_from_replay(store, BAR_SEC)
        Path(path).unlink(missing_ok=True)
        path = None
        if bars is None or len(bars) == 0:
            return None, None
        # Return last bar as a row (series) and its timestamp
        last = bars.iloc[-1]
        last_ts = bars.index[-1]
        return last, last_ts
    except Exception as e:
        if path and Path(path).exists():
            Path(path).unlink(missing_ok=True)
        print(f"[poll_latest_bar] Databento error: {e}", flush=True)
        return None, None


def get_recent_bars_and_running(
    session_start_ts: pd.Timestamp, last_completed_bar_ts: pd.Timestamp
) -> tuple:
    """
    Fetch last 2 minutes of data; return (new_completed_bars_df, running_bar_series, running_bar_ts).
    Used for V2: running bar = current minute so far (partial). New completed = bars we don't have yet.
    """
    if not API_KEY or db is None:
        return pd.DataFrame(), None, None
    now_et = datetime.now(EST)
    end_utc = now_et.astimezone(timezone.utc)
    start_utc = end_utc - timedelta(minutes=2)
    start_str = start_utc.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_utc.strftime("%Y-%m-%dT%H:%M:%S")
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".dbn", delete=False) as f:
            path = f.name
        client = db.Historical(API_KEY)
        client.timeseries.get_range(
            dataset=DATASET, start=start_str, end=end_str,
            symbols=SYMBOL_RAW, schema=SCHEMA, stype_in="raw_symbol", path=path,
        )
        store = db.DBNStore.from_file(path)
        bars, _ = _build_bars_from_replay(store, BAR_SEC)
        Path(path).unlink(missing_ok=True)
        path = None
        if bars is None or len(bars) == 0:
            return pd.DataFrame(), None, None
        # Last bar is the "running" (current minute, possibly partial)
        running_bar_ts = bars.index[-1]
        running_bar = bars.iloc[-1]
        # New completed = bars that are strictly after last_completed_bar_ts
        new_completed = bars.iloc[:-1]
        if len(new_completed) > 0:
            new_completed = new_completed[new_completed.index > last_completed_bar_ts]
        return new_completed, running_bar, running_bar_ts
    except Exception as e:
        if path and Path(path).exists():
            Path(path).unlink(missing_ok=True)
        print(f"[get_recent_bars_and_running] Databento error: {e}", flush=True)
        return pd.DataFrame(), None, None
