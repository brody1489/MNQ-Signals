"""
Real-time bar builder from Databento Live API.
Use for live signals: backfill once (Historical), then stream live. V1 = 1-min bar close (live candle), V2 = running bar.
"""
from collections import defaultdict
from datetime import datetime, timedelta
import queue
import threading
import pandas as pd

try:
    import databento as db
except ImportError:
    db = None

from config import (
    API_KEY,
    BAR_SEC,
    RTH_START_ET,
    EST,
    DATASET,
    SCHEMA,
    DATA_DELAY_MINUTES,
)

SYMBOL_RAW = "MNQH6"
TICK_PX = 0.25
BAR_NS = int(BAR_SEC * 1_000_000_000)


def _session_start_ns_today():
    """Today 9:30 AM ET as Unix timestamp in nanoseconds (for bar_idx)."""
    now = datetime.now(EST)
    start = now.replace(hour=RTH_START_ET[0], minute=RTH_START_ET[1], second=0, microsecond=0)
    return pd.Timestamp(start).value


def _dict_to_row(d) -> dict:
    """Turn bar dict into strategy row (mid, bid_depth, ask_depth, buy_vol, sell_vol, cob_ask)."""
    n = d.get("n", 0)
    return {
        "mid": d["mid_last"],
        "bid_depth": d["bid_sum"] / n if n else 0.0,
        "ask_depth": d["ask_sum"] / n if n else 0.0,
        "buy_vol": d.get("buy_vol", 0),
        "sell_vol": d.get("sell_vol", 0),
        "cob_ask": sorted([(p, depth) for p, depth in d.get("ask_at_price", {}).items() if depth >= 1]),
    }


class LiveBarBuilder:
    """
    Builds 1-min bars from Databento Live stream. Thread-safe: callback runs in Live thread;
    main thread calls get_completed_bars() and get_running_bar().
    """

    def __init__(self, session_start_ns: int):
        self.session_start_ns = session_start_ns
        self._lock = threading.Lock()
        self._bars_dict = {}
        self._current_bar_idx = None
        self._completed_queue = queue.Queue()
        self._live_client = None
        self._live_thread = None
        self._stopped = False

    def _bar_ts(self, bar_idx: int) -> pd.Timestamp:
        return pd.Timestamp(self.session_start_ns + bar_idx * BAR_NS, unit="ns")

    def _record_callback(self, r):
        if self._stopped:
            return
        ts_ns = r.ts_recv
        bar_idx = (ts_ns - self.session_start_ns) // BAR_NS
        if bar_idx < 0:
            return
        with self._lock:
            if bar_idx not in self._bars_dict:
                self._bars_dict[bar_idx] = {
                    "mid_last": 0.0,
                    "bid_sum": 0.0,
                    "ask_sum": 0.0,
                    "n": 0,
                    "buy_vol": 0,
                    "sell_vol": 0,
                    "ask_at_price": defaultdict(float),
                }
            d = self._bars_dict[bar_idx]

            if r.action == "T":
                side = str(getattr(r, "side", "B"))
                if side == "B":
                    d["buy_vol"] = d.get("buy_vol", 0) + int(r.size)
                else:
                    d["sell_vol"] = d.get("sell_vol", 0) + int(r.size)
            elif hasattr(r, "levels") and r.levels:
                mid = (r.levels[0].pretty_bid_px + r.levels[0].pretty_ask_px) / 2
                bid_d = sum(lev.bid_sz for lev in r.levels)
                ask_d = sum(lev.ask_sz for lev in r.levels)
                d["mid_last"] = mid
                d["bid_sum"] += bid_d
                d["ask_sum"] += ask_d
                d["n"] += 1
                for lev in r.levels:
                    px = round(lev.pretty_ask_px / TICK_PX) * TICK_PX
                    d["ask_at_price"][px] += lev.ask_sz

            prev = self._current_bar_idx
            self._current_bar_idx = bar_idx
            if prev is not None and bar_idx > prev:
                for completed_idx in range(prev, bar_idx):
                    if completed_idx in self._bars_dict:
                        row = _dict_to_row(self._bars_dict[completed_idx])
                        self._completed_queue.put((self._bar_ts(completed_idx), row))

    def get_completed_bars(self) -> pd.DataFrame:
        """Drain completed bars (full 1-min candles). Call from main thread."""
        rows = []
        while True:
            try:
                bar_ts, row = self._completed_queue.get_nowait()
                rows.append((bar_ts, row))
            except queue.Empty:
                break
        if not rows:
            return pd.DataFrame()
        times = [r[0] for r in rows]
        data = [r[1] for r in rows]
        df = pd.DataFrame(data, index=pd.DatetimeIndex(times))
        df.index.name = "ts"
        return df

    def get_running_bar(self):
        """Current (incomplete) bar as (Series, bar_ts) or (None, None)."""
        with self._lock:
            idx = self._current_bar_idx
            if idx is None or idx not in self._bars_dict:
                return None, None
            d = self._bars_dict[idx]
        row = _dict_to_row(d)
        bar_ts = self._bar_ts(idx)
        return pd.Series(row), bar_ts

    def start(self, replay_start_utc: datetime):
        """Start Live client in a daemon thread. replay_start_utc = start of intraday replay (e.g. now - 1 min)."""
        if not API_KEY or db is None:
            print("[live_stream] API_KEY or databento missing.", flush=True)
            return False
        start_ts = pd.Timestamp(replay_start_utc)
        self._stopped = False

        def run_live():
            try:
                client = db.Live(key=API_KEY)
                client.subscribe(
                    dataset=DATASET,
                    schema=SCHEMA,
                    symbols=SYMBOL_RAW,
                    stype_in="raw_symbol",
                    start=start_ts,
                )
                client.add_callback(self._record_callback)
                self._live_client = client
                client.start()
                client.block_for_close()
            except Exception as e:
                if not self._stopped:
                    print(f"[live_stream] Live client error: {e}", flush=True)
            finally:
                self._live_client = None

        self._live_thread = threading.Thread(target=run_live, daemon=True)
        self._live_thread.start()
        return True

    def stop(self):
        """Stop the Live client so block_for_close returns."""
        self._stopped = True
        if self._live_client is not None:
            try:
                self._live_client.stop()
            except Exception:
                pass
            self._live_client = None


def run_live_session(
    session_start_ns: int,
    replay_minutes_ago: int = 1,
):
    """
    Create a LiveBarBuilder, start Live with intraday replay from (now - replay_minutes_ago).
    Returns (builder, replay_start_utc) or (None, None) on failure.
    """
    if not API_KEY or db is None:
        return None, None
    now_utc = datetime.utcnow()
    replay_start_utc = now_utc - timedelta(minutes=replay_minutes_ago)
    builder = LiveBarBuilder(session_start_ns)
    if not builder.start(replay_start_utc):
        return None, None
    return builder, replay_start_utc
