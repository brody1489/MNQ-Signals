"""
Strategy backtest engine — executes YOUR edge exactly.

Sequence (strict order):
1. Passive accumulation at a level: at least min_pa bars (3+) with COB >= threshold (heatmap).
2. Key level = that level (low of accumulation zone).
3. Price retests the level and bounces (rejection/absorption).
4. BOS (break of structure) in our direction.
5. Aggressive accumulation (buy vol > sell vol, >= min) right after → ENTER.

TP: Only at real heatmap resistance above entry (first significant COB above), a few ticks below. Never TP at or below entry.
Exit: Reversal BOS or SL below support. All no look-ahead.
"""
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from collections import defaultdict
import itertools

import databento as db
import pandas as pd
import numpy as np

from config import DATA_DIR
from backtest_params import ParamGrid


@dataclass
class BacktestResult:
    params: dict
    trades: int
    wins: int
    losses: int
    total_pnl_ticks: float
    sharpe: Optional[float]
    max_drawdown_ticks: float
    win_rate: float = 0.0


def load_dbn(dbn_path: Path) -> pd.DataFrame:
    """Load full DBN to DataFrame (RAM-heavy). Prefer load_dbn_streaming for optimize."""
    store = db.DBNStore.from_file(str(dbn_path))
    return store.to_df()


def load_dbn_streaming(dbn_path: Path, freq_sec: float = 60.0, build_cob: bool = True):
    """
    Build bars + trades from DBN using replay() - never loads full df. Keeps RAM low.
    When build_cob=True, each bar gets cob_ask: list of (price, depth) for resistance (heatmap).
    Returns (bars: pd.DataFrame, trades_df: pd.DataFrame).
    """
    store = db.DBNStore.from_file(str(dbn_path))
    first_ts_ns = [None]
    bars_dict = {}
    trades_list = []
    TICK_PX = 0.25  # MNQ

    def callback(r):
        ts_ns = r.ts_recv
        if first_ts_ns[0] is None:
            first_ts_ns[0] = ts_ns
        bar_ns = int(freq_sec * 1_000_000_000)
        bar_idx = (ts_ns - first_ts_ns[0]) // bar_ns

        if r.action == "T":
            side = str(getattr(r, "side", "B"))  # B or A
            trades_list.append((ts_ns, side, int(r.size)))
            if bar_idx not in bars_dict:
                bars_dict[bar_idx] = {"mid_sum": 0.0, "mid_last": 0.0, "bid_sum": 0.0, "ask_sum": 0.0, "n": 0, "buy_vol": 0, "sell_vol": 0}
                if build_cob:
                    bars_dict[bar_idx]["ask_at_price"] = defaultdict(float)
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
                bars_dict[bar_idx] = {"mid_sum": 0.0, "mid_last": mid, "bid_sum": 0.0, "ask_sum": 0.0, "n": 0, "buy_vol": 0, "sell_vol": 0}
                if build_cob:
                    bars_dict[bar_idx]["ask_at_price"] = defaultdict(float)
            d = bars_dict[bar_idx]
            d["mid_last"] = mid
            d["bid_sum"] += bid_d
            d["ask_sum"] += ask_d
            d["n"] += 1
            if build_cob:
                for lev in r.levels:
                    px = round(lev.pretty_ask_px / TICK_PX) * TICK_PX
                    d["ask_at_price"][px] += lev.ask_sz

    store.replay(callback)
    del store

    if not bars_dict:
        return pd.DataFrame(columns=["mid", "bid_depth", "ask_depth"]), pd.DataFrame(columns=["ts_recv", "side", "size"])

    bar_idx_sorted = sorted(bars_dict.keys())
    base = pd.Timestamp(first_ts_ns[0], unit="ns")
    times = [base + pd.Timedelta(seconds=int(i) * freq_sec) for i in bar_idx_sorted]
    rows = []
    for i in bar_idx_sorted:
        d = bars_dict[i]
        row = {
            "mid": d["mid_last"],
            "bid_depth": d["bid_sum"] / d["n"] if d["n"] else 0,
            "ask_depth": d["ask_sum"] / d["n"] if d["n"] else 0,
            "buy_vol": d.get("buy_vol", 0),
            "sell_vol": d.get("sell_vol", 0),
        }
        if build_cob and "ask_at_price" in d:
            # Store (price, depth) for levels with depth >= 1; sorted by price for fast nearest-above lookup
            cob_ask = sorted([(p, depth) for p, depth in d["ask_at_price"].items() if depth >= 1])
            row["cob_ask"] = cob_ask
        else:
            row["cob_ask"] = []
        rows.append(row)
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


# MNQ tick size; 1 point = 1.0 (index points)
TICK = 0.25
POINT = 1.0


def _build_bars(df: pd.DataFrame, freq_sec: float = 1.0) -> pd.DataFrame:
    """Resample to bars for BOS detection."""
    df = df.copy()
    df["ts"] = pd.to_datetime(df.index.get_level_values("ts_recv"))
    df = df.set_index("ts")
    # Mid price
    df["mid"] = (df["bid_px_00"] + df["ask_px_00"]) / 2
    # Total bid/ask depth
    bid_cols = [c for c in df.columns if c.startswith("bid_sz_")]
    ask_cols = [c for c in df.columns if c.startswith("ask_sz_")]
    df["bid_depth"] = df[bid_cols].sum(axis=1)
    df["ask_depth"] = df[ask_cols].sum(axis=1)

    bars = df.resample(f"{freq_sec}s").agg({
        "mid": "last",
        "bid_depth": "mean",
        "ask_depth": "mean",
    }).dropna()
    return bars


def _swing_highs_lows(price: np.ndarray, lookback: int):
    """Return arrays of swing high/low indices."""
    n = len(price)
    swing_high_idx = []
    swing_low_idx = []
    for i in range(lookback, n - lookback):
        window = price[i - lookback : i + lookback + 1]
        if price[i] == np.max(window):
            swing_high_idx.append(i)
        if price[i] == np.min(window):
            swing_low_idx.append(i)
    return swing_high_idx, swing_low_idx


def _detect_bos(
    price: np.ndarray,
    lookback: int,
    min_break_ticks: int,
    direction: str,
) -> list:
    """Detect Break of Structure. Returns indices where BOS occurred."""
    swing_high_idx, swing_low_idx = _swing_highs_lows(price, lookback)
    bos_idx = []
    min_break = min_break_ticks * TICK

    if direction == "up":
        # Bullish BOS: price breaks above recent swing high
        for i in range(lookback * 2 + 1, len(price)):
            recent_highs = [price[j] for j in swing_high_idx if j < i and i - j <= lookback * 4]
            if recent_highs and price[i] > max(recent_highs) + min_break:
                bos_idx.append(i)
                break  # first break
    else:
        # Bearish BOS: price breaks below recent swing low
        for i in range(lookback * 2 + 1, len(price)):
            recent_lows = [price[j] for j in swing_low_idx if j < i and i - j <= lookback * 4]
            if recent_lows and price[i] < min(recent_lows) - min_break:
                bos_idx.append(i)
                break

    return bos_idx


def _passive_accumulation_count(
    bars: pd.DataFrame,
    cob_threshold: int,
    min_count: int,
    direction: str,
) -> list:
    """
    Passive accumulation = bars where depth >= cob_threshold (heatmap).
    Returns indices where we've seen >= min_count such bars in this window.
    """
    col = "bid_depth" if direction == "long" else "ask_depth"
    above = (bars[col] >= cob_threshold).astype(int)
    rolling = above.rolling(min_count * 2, min_periods=min_count).sum()
    idx = np.where(rolling >= min_count)[0]
    return idx.tolist()


def _passive_accumulation_level(
    bars: pd.DataFrame,
    start_idx: int,
    lookback_bars: int,
    cob_threshold: float,
    min_count: int,
    direction: str,
) -> tuple:
    """
    Your edge: passive accumulation at a level (at least min_count bars with COB >= threshold).
    Returns (True, acc_level) if we have >= min_count such bars; else (False, None).
    acc_level = min(mid) over those bars = the support level for longs.
    """
    end = start_idx + 1
    start = max(0, start_idx - lookback_bars)
    window = bars.iloc[start:end]
    col = "bid_depth" if direction == "long" else "ask_depth"
    above = window[col] >= cob_threshold
    if above.sum() < min_count:
        return False, None
    # Level = min price (mid) where we had passive acc
    mid_vals = window["mid"].values
    above_vals = above.values
    acc_mids = mid_vals[above_vals]
    acc_level = float(np.min(acc_mids))
    return True, acc_level


def _aggressive_accumulation(
    df: pd.DataFrame,
    start_ts: pd.Timestamp,
    window_sec: int,
    min_volume: int,
    direction: str,
) -> bool:
    """Check if aggressive buy/sell volume in window exceeds min."""
    trades = df[(df["action"] == "T") & (df.index.get_level_values("ts_recv") >= start_ts)]
    trades = trades[trades.index.get_level_values("ts_recv") <= start_ts + pd.Timedelta(seconds=window_sec)]
    if trades.empty:
        return False
    buy_vol = trades[trades["side"] == "B"]["size"].sum()
    sell_vol = trades[trades["side"] == "A"]["size"].sum()
    if direction == "long":
        return buy_vol > sell_vol and buy_vol >= min_volume
    return sell_vol > buy_vol and sell_vol >= min_volume


def _aggressive_accumulation_bars(
    bars: pd.DataFrame,
    entry_bar_idx: int,
    bar_sec: float,
    agg_win_sec: int,
    min_volume: int,
    direction: str,
) -> bool:
    """O(1) aggressive check using pre-aggregated buy_vol, sell_vol per bar."""
    if "buy_vol" not in bars.columns or "sell_vol" not in bars.columns:
        return False
    agg_bars = max(1, int(agg_win_sec / bar_sec))
    start = max(0, entry_bar_idx - agg_bars + 1)
    sub = bars.iloc[start : entry_bar_idx + 1]
    buy_vol = sub["buy_vol"].sum()
    sell_vol = sub["sell_vol"].sum()
    if direction == "long":
        return buy_vol > sell_vol and buy_vol >= min_volume
    return sell_vol > buy_vol and sell_vol >= min_volume


def _aggressive_accumulation_trades(
    trades_df: pd.DataFrame,
    start_ts: pd.Timestamp,
    window_sec: int,
    min_volume: int,
    direction: str,
) -> bool:
    """Same as above but for minimal trades_df with columns ts_recv, side, size. O(n) per call."""
    end_ts = start_ts + pd.Timedelta(seconds=window_sec)
    mask = (trades_df["ts_recv"] >= start_ts) & (trades_df["ts_recv"] <= end_ts)
    t = trades_df.loc[mask]
    if t.empty:
        return False
    buy_vol = t[t["side"] == "B"]["size"].sum()
    sell_vol = t[t["side"] == "A"]["size"].sum()
    if direction == "long":
        return buy_vol > sell_vol and buy_vol >= min_volume
    return sell_vol > buy_vol and sell_vol >= min_volume


def _near_key_level(price: float, key_levels: list, points: int) -> bool:
    """Price within points of any key level."""
    for level in key_levels:
        if level is None or np.isnan(level):
            continue
        if abs(price - level) <= points:
            return True
    return False


def _nearest_cob_resistance_above(
    cob_ask: list,
    current_price: float,
    min_depth: float,
    buffer_pts: float = 2.0,
    key_levels: Optional[list] = None,
    near_key_pts: float = 20.0,
) -> Optional[float]:
    """
    Find nearest real resistance above current price from COB/heatmap (ask depth).
    cob_ask: list of (price, depth) sorted by price.
    Returns TP price = resistance - buffer_pts, or None if no valid resistance in view.
    Prefer levels at/near key levels or round numbers (within near_key_pts) when given.
    """
    if not cob_ask:
        return None
    candidates = [(p, d) for p, d in cob_ask if p > current_price and d >= min_depth]
    if not candidates:
        return None
    # Prefer resistance at/near key levels or round numbers (more likely real orders)
    if key_levels:
        near = []
        for p, d in candidates:
            for kl in key_levels:
                if kl is not None and not np.isnan(kl) and abs(p - kl) <= near_key_pts:
                    near.append((p, d))
                    break
            else:
                round50 = round(p / 50) * 50
                if abs(p - round50) <= near_key_pts:
                    near.append((p, d))
        if near:
            candidates = near
    # Nearest above = min price; TP just below resistance
    resistance = min(p for p, d in candidates)
    return resistance - buffer_pts * POINT


def run_backtest(
    df: Optional[pd.DataFrame] = None,
    params: Optional[dict] = None,
    bars: Optional[pd.DataFrame] = None,
    trades_df: Optional[pd.DataFrame] = None,
    bar_sec: float = 1.0,
    return_trade_details: bool = False,
    day_label: Optional[str] = None,
):
    """
    Run strategy backtest.
    Pass either (df, params) or (bars, trades_df, params). Latter avoids holding full df in RAM.
    If return_trade_details=True, returns (BacktestResult, list[dict]) with per-trade exit_reason, MFE, MAE.
    """
    if params is None:
        return BacktestResult(
            params={}, trades=0, wins=0, losses=0,
            total_pnl_ticks=0.0, sharpe=None, max_drawdown_ticks=0.0,
        )
    if bars is None and df is not None:
        bars = _build_bars(df, freq_sec=bar_sec)
    if bars is not None and trades_df is None and df is not None:
        trades_df = df[df["action"] == "T"][["side", "size"]].copy()
        trades_df["ts_recv"] = pd.to_datetime(df.loc[df["action"] == "T"].index.get_level_values("ts_recv"))
    if bars is None or len(bars) < 20:
        return BacktestResult(
            params=params,
            trades=0, wins=0, losses=0,
            total_pnl_ticks=0.0, sharpe=None, max_drawdown_ticks=0.0,
        )

    min_pa = params.get("min_passive_accumulation_count", 3)
    cob = params.get("passive_cob_threshold", 50)  # filter: only 50+ COB = heatmap levels
    passive_lookback_bars = params.get("passive_lookback_bars", 60)  # in-the-move: e.g. 60 min
    kl_pts = params.get("key_level_points", 10)
    agg_vol = params.get("aggressive_min_volume", 200)
    agg_win = params.get("aggressive_window_seconds", 10)
    bos_lookback = params.get("bos_swing_lookback", 15)  # bars: 15–30 min for BOS in the move
    bos_ticks = params.get("bos_min_break_ticks", 4)
    bos_search_bars = params.get("bos_search_bars", 120)  # max bars to search for BOS (e.g. 2 hr)
    tp_pts = params.get("tp_points", 40)
    sl_ticks = params.get("sl_ticks", 12)
    tp_style = params.get("tp_style", "fixed")  # "fixed" | "session_high" | "cob" (adaptive: real resistance from heatmap)
    tp_buffer = params.get("tp_buffer", 5)       # points below session_high for TP (or below COB resistance when cob)
    cob_tp_threshold = params.get("cob_tp_threshold", 30)  # min ask depth to treat as real resistance (20, 30, 40...)
    tp_buffer_pts_cob = params.get("tp_buffer_pts_cob", 3)  # TP just below resistance (e.g. zone 23298-23305 -> TP 23295)
    cob_near_key_pts = params.get("cob_near_key_pts", 20)   # prefer resistance within this of key/round levels
    exit_on_reversal_bos = params.get("exit_on_reversal_bos", True)
    # Level-based SL: below next support (strong buyers); fallback if no level in range
    sl_style = params.get("sl_style", "level")    # "level" | "fixed"
    sl_buffer_pts = params.get("sl_buffer_pts", 2)       # points below support
    sl_points_fallback = params.get("sl_points_fallback", 15)  # pts below entry when no level

    # Key levels at entry = running high/low to entry bar only (no look-ahead)
    price = bars["mid"].values
    trade_pnls = []
    trade_details = []
    bounce_bars = params.get("bounce_bars", 5)  # bars after retest to confirm bounce
    i = 0

    while i < len(bars) - passive_lookback_bars - bos_lookback * 4:
        # 1) Passive accumulation at a level: >= min_pa bars with COB >= cob in lookback
        has_pa, acc_level = _passive_accumulation_level(
            bars, i, passive_lookback_bars, cob, min_pa, "long"
        )
        if not has_pa or acc_level is None:
            i += 1
            continue

        # 2) Retest + bounce: price comes back to level then bounces
        found_entry_bar = None
        for t in range(i, min(i + bos_search_bars, len(bars) - bos_lookback * 2 - bounce_bars - 1)):
            if bars["mid"].iloc[t] > acc_level + kl_pts * POINT:
                continue
            # Retest: price at or near level
            if t + bounce_bars + 1 >= len(bars):
                break
            next_mids = bars["mid"].iloc[t + 1 : t + bounce_bars + 1].values
            if np.max(next_mids) <= acc_level + kl_pts * POINT:
                continue
            # 3) BOS up after the bounce (in price from t onward)
            sub_price = price[t : min(t + bos_search_bars, len(bars))]
            if len(sub_price) < bos_lookback * 2 + 1:
                continue
            bos_list = _detect_bos(sub_price, bos_lookback, bos_ticks, "up")
            if not bos_list:
                continue
            entry_bar_idx = t + bos_list[0]
            if entry_bar_idx >= len(bars):
                continue
            entry_price = price[entry_bar_idx]
            entry_ts = bars.index[entry_bar_idx]
            # Entry must be above or at level (we're long after bounce)
            if entry_price < acc_level - kl_pts * POINT:
                continue
            # 4) Aggressive accumulation at/after entry bar
            if "buy_vol" in bars.columns and "sell_vol" in bars.columns:
                agg_ok = _aggressive_accumulation_bars(bars, entry_bar_idx, bar_sec, agg_win, agg_vol, "long")
            elif trades_df is not None:
                agg_ok = _aggressive_accumulation_trades(trades_df, entry_ts, agg_win, agg_vol, "long")
            else:
                agg_ok = _aggressive_accumulation(df, entry_ts, agg_win, agg_vol, "long")
            if not agg_ok:
                continue
            # Time filters: no first N minutes, no lunch window (bar 0 = session start 9:30 ET)
            no_first_minutes = params.get("no_first_minutes", 0)
            if no_first_minutes and entry_bar_idx < no_first_minutes:
                continue
            lunch_window = params.get("lunch_window", "none")
            if lunch_window != "none":
                # 1-min bars: 9:30 = bar 0. 11:00 = 90, 11:30 = 120, 12:00 = 150, 13:00 = 210
                start_bar, end_bar = {"11-1": (90, 210), "11:30-1": (120, 210), "12-1": (150, 210)}.get(lunch_window, (0, 0))
                if start_bar <= entry_bar_idx < end_bar:
                    continue
            found_entry_bar = entry_bar_idx
            break

        if found_entry_bar is None:
            i += 1
            continue

        entry_bar_idx = found_entry_bar
        # Optional: test "theoretical better entry" (e.g. 1 bar earlier/later) without tick data
        entry_bar_offset = params.get("entry_bar_offset", 0)
        entry_bar_idx = max(0, min(entry_bar_idx + entry_bar_offset, len(bars) - 1))
        entry_price = price[entry_bar_idx]
        entry_ts = bars.index[entry_bar_idx]
        running_high = bars["mid"].iloc[: entry_bar_idx + 1].max()
        running_low = bars["mid"].iloc[: entry_bar_idx + 1].min()
        key_levels_at_entry = [running_low, running_high, acc_level]

        # SL: below support (running_low at entry), capped. No look-ahead.
        sl_max_pts = params.get("sl_max_pts", 25)
        trail_sl_pts = params.get("trail_sl_pts", 15)
        if sl_style == "level":
            support = running_low
            sl_price = support - sl_buffer_pts * POINT
            dist_pts = entry_price - sl_price
            if sl_price >= entry_price or dist_pts < 3 * POINT:
                sl_price = entry_price - sl_points_fallback * POINT
            elif dist_pts > sl_max_pts:
                sl_price = entry_price - sl_points_fallback * POINT
        else:
            sl_price = entry_price - sl_ticks * TICK
        exit_price = None
        exit_reason = None
        exit_bar_k = None
        trail_activation_pts = params.get("trail_activation_pts", 0)  # 0 = legacy: move SL to entry-2 at trail_sl_pts. >0 = only trail from high once we're this many pts in profit
        for k in range(entry_bar_idx + 1, len(bars)):
            p = bars["mid"].iloc[k]
            high_so_far = bars["mid"].iloc[entry_bar_idx : k + 1].max()
            if trail_sl_pts:
                if trail_activation_pts > 0:
                    # Adaptive: only start trailing from high once we've run at least trail_activation_pts (e.g. 30). Then protect from high.
                    if high_so_far >= entry_price + trail_activation_pts * POINT:
                        trail_from = high_so_far - trail_sl_pts * POINT
                        sl_price = max(sl_price, trail_from)
                else:
                    # Legacy: once we're trail_sl_pts up, move SL to entry-2
                    if p >= entry_price + trail_sl_pts * POINT:
                        sl_price = max(sl_price, entry_price - 2 * POINT)
            if p <= sl_price:
                exit_price = sl_price
                exit_reason = "sl"
                exit_bar_k = k
                break
            if exit_on_reversal_bos and k > entry_bar_idx + bos_lookback:
                sub = price[entry_bar_idx : k + 1]
                if len(sub) >= bos_lookback * 2 + 1:
                    bos_dn = _detect_bos(sub, bos_lookback, bos_ticks, "down")
                    if bos_dn:
                        exit_price = p
                        exit_reason = "reversal_bos"
                        exit_bar_k = k
                        break
            # Exhaustion exit: in profit + buyers failing (price down, sellers dominating). No fixed TP — exit when momentum fails.
            exit_on_exhaustion = params.get("exit_on_exhaustion", False)
            if exit_on_exhaustion and exit_price is None and k >= entry_bar_idx + 2 and "buy_vol" in bars.columns and "sell_vol" in bars.columns:
                unrealized_pts = (p - entry_price) / POINT
                if unrealized_pts > 5:  # only consider when we're meaningfully in profit
                    prev_mid = bars["mid"].iloc[k - 1]
                    prev2_mid = bars["mid"].iloc[k - 2]
                    sell_k = bars["sell_vol"].iloc[k]
                    buy_k = bars["buy_vol"].iloc[k]
                    sell_prev = bars["sell_vol"].iloc[k - 1]
                    buy_prev = bars["buy_vol"].iloc[k - 1]
                    # Two bars down (stalling) and sellers dominating
                    two_bars_down = p < prev_mid and prev_mid < prev2_mid
                    sellers_dominating = (sell_k > buy_k and sell_prev > buy_prev)
                    if two_bars_down and sellers_dominating:
                        exit_price = p
                        exit_reason = "exhaustion"
                        exit_bar_k = k
                        break
            # TP: skip if "hold" (let run until reversal BOS or SL only)
            if tp_style == "hold":
                pass  # no TP; exit only on reversal_bos or sl or time
            elif tp_style == "cob" and "cob_ask" in bars.columns:
                cob_ask = bars.iloc[k].get("cob_ask") or []
                if isinstance(cob_ask, list) and cob_ask:
                    tp_price = _nearest_cob_resistance_above(
                        cob_ask, p, cob_tp_threshold,
                        buffer_pts=tp_buffer_pts_cob,
                        key_levels=key_levels_at_entry,
                        near_key_pts=cob_near_key_pts,
                    )
                    if tp_price is not None and tp_price > entry_price and p >= tp_price:
                        # Only take TP if resistance is far enough above entry (hold for bigger move)
                        min_tp_pts = params.get("min_tp_pts_above_entry", 0)
                        if min_tp_pts <= 0 or (tp_price - entry_price) >= min_tp_pts * POINT:
                            exit_price = tp_price
                            exit_reason = "tp"
                            exit_bar_k = k
                            break
            if tp_style == "session_high" and exit_price is None:
                high_prior = bars["mid"].iloc[entry_bar_idx:k].max() if k > entry_bar_idx else entry_price
                min_run_pts = params.get("min_run_pts", 10)
                if high_prior >= entry_price + min_run_pts * POINT:
                    tp_price = high_prior - tp_buffer * POINT
                    if tp_price > entry_price and p >= tp_price:
                        exit_price = tp_price
                        exit_reason = "tp"
                        exit_bar_k = k
                        break
            if tp_style not in ("cob", "session_high", "hold") and exit_price is None:
                tp_price = entry_price + tp_pts * TICK
                if p >= tp_price:
                    exit_price = tp_price
                    exit_reason = "tp"
                    exit_bar_k = k
                    break
        max_hold_bars = params.get("max_hold_bars", 80)
        if exit_price is None and entry_bar_idx + max_hold_bars < len(bars):
            exit_bar_k = min(entry_bar_idx + max_hold_bars, len(bars) - 1)
            exit_price = bars["mid"].iloc[exit_bar_k]
            exit_reason = "time"
        if exit_price is not None:
            pnl_ticks = (exit_price - entry_price) / TICK
            trade_pnls.append(pnl_ticks)
            if return_trade_details and exit_bar_k is not None:
                high_run = bars["mid"].iloc[entry_bar_idx : exit_bar_k + 1].max()
                low_run = bars["mid"].iloc[entry_bar_idx : exit_bar_k + 1].min()
                mfe_pts = (high_run - entry_price) / POINT
                mae_pts = (entry_price - low_run) / POINT
                detail = {
                    "day": day_label,
                    "entry_bar": entry_bar_idx,
                    "minutes_from_open": entry_bar_idx,
                    "exit_bar": exit_bar_k,
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "pnl_ticks": pnl_ticks,
                    "pnl_pts": pnl_ticks * TICK / POINT,
                    "exit_reason": exit_reason or "unknown",
                    "mfe_pts": mfe_pts,
                    "mae_pts": mae_pts,
                    "acc_level": acc_level,
                }
                if exit_reason == "tp":
                    detail["tp_distance_pts"] = (exit_price - entry_price) / POINT
                else:
                    detail["tp_distance_pts"] = None
                trade_details.append(detail)
        i = entry_bar_idx + 1
        max_trades_per_day = params.get("max_trades_per_day", 5)
        if len(trade_pnls) >= max_trades_per_day:
            break

    # Results
    trades = len(trade_pnls)
    wins = sum(1 for p in trade_pnls if p > 0)
    losses = sum(1 for p in trade_pnls if p <= 0)
    total_pnl = sum(trade_pnls)
    win_rate = wins / trades if trades else 0
    dd = 0.0
    cum = 0
    for p in trade_pnls:
        cum += p
        dd = min(dd, cum)
    sharpe = (np.mean(trade_pnls) / (np.std(trade_pnls) + 1e-9)) * np.sqrt(252) if len(trade_pnls) >= 2 else None

    result = BacktestResult(
        params=params,
        trades=trades,
        wins=wins,
        losses=losses,
        total_pnl_ticks=total_pnl,
        sharpe=sharpe,
        max_drawdown_ticks=abs(dd),
        win_rate=win_rate,
    )
    if return_trade_details:
        return result, trade_details
    return result


def _param_combinations(grid: ParamGrid, max_configs: int) -> list:
    """Generate parameter combinations, optionally sampled."""
    keys = [
        "min_passive_accumulation_count",
        "passive_cob_threshold",
        "key_level_points",
        "aggressive_min_volume",
        "aggressive_window_seconds",
        "bos_swing_lookback",
        "bos_min_break_ticks",
        "tp_points",
        "sl_ticks",
    ]
    values = [
        grid.min_passive_accumulation_count,
        grid.passive_cob_threshold,
        grid.key_level_points,
        grid.aggressive_min_volume,
        grid.aggressive_window_seconds,
        grid.bos_swing_lookback,
        grid.bos_min_break_ticks,
        [20, 30, 40, 50],  # tp_points
        grid.sl_ticks,
    ]
    combs = list(itertools.product(*values))
    if len(combs) > max_configs:
        np.random.seed(42)
        idx = np.random.choice(len(combs), max_configs, replace=False)
        combs = [combs[i] for i in idx]
    return [dict(zip(keys, c)) for c in combs]


def run_parameter_sweep(
    dbn_path: Path,
    param_grid: ParamGrid,
    max_configs: int = 1000,
) -> list[BacktestResult]:
    df = load_dbn(dbn_path)
    if df.empty:
        return []

    combs = _param_combinations(param_grid, max_configs)
    results = []
    for i, params in enumerate(combs):
        r = run_backtest(df, params)
        results.append(r)
        if (i + 1) % 200 == 0:
            print(f"  ... {i + 1}/{len(combs)} configs done")
    return results


def get_best_params(results: list[BacktestResult], metric: str = "total_pnl_ticks") -> BacktestResult:
    """Return best result by metric."""
    valid = [r for r in results if r.trades > 0]
    if not valid:
        return results[0] if results else None
    if metric == "sharpe" and any(r.sharpe is not None for r in valid):
        return max(valid, key=lambda r: r.sharpe if r.sharpe is not None else -999)
    return max(valid, key=lambda r: getattr(r, metric, 0))


if __name__ == "__main__":
    data_files = list(DATA_DIR.glob("*.dbn"))
    if not data_files:
        print("No .dbn files. Run fetch_data.py --confirm first.")
    else:
        latest = max(data_files, key=lambda p: p.stat().st_mtime)
        print(f"Running sweep on {latest}")
        results = run_parameter_sweep(latest, ParamGrid(), max_configs=500)
        best = get_best_params(results)
        print(f"\nBest config: {best.params}")
        print(f"  trades={best.trades} wins={best.wins} losses={best.losses} pnl={best.total_pnl_ticks:.1f}")
