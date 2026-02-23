"""
Same edge as backtest: passive at level -> retest -> bounce -> BOS -> aggressive -> LONG or SHORT.
Long: passive accumulation (bid), BOS up, aggressive buy. Short: passive distribution (ask), BOS down, aggressive sell.
TP at COB resistance (long) or SL/reversal BOS (short). State: in_position, side ("long"|"short"), entry_price, sl_price, etc.
"""
import numpy as np
import pandas as pd
from typing import Optional

TICK = 0.25
POINT = 1.0


def _swing_highs_lows(price: np.ndarray, lookback: int):
    n = len(price)
    swing_high_idx, swing_low_idx = [], []
    for i in range(lookback, n - lookback):
        window = price[i - lookback : i + lookback + 1]
        if price[i] == np.max(window):
            swing_high_idx.append(i)
        if price[i] == np.min(window):
            swing_low_idx.append(i)
    return swing_high_idx, swing_low_idx


def _detect_bos(price: np.ndarray, lookback: int, min_break_ticks: int, direction: str) -> list:
    swing_high_idx, swing_low_idx = _swing_highs_lows(price, lookback)
    min_break = min_break_ticks * TICK
    bos_idx = []
    if direction == "up":
        for i in range(lookback * 2 + 1, len(price)):
            recent_highs = [price[j] for j in swing_high_idx if j < i and i - j <= lookback * 4]
            if recent_highs and price[i] > max(recent_highs) + min_break:
                bos_idx.append(i)
                break
    else:
        for i in range(lookback * 2 + 1, len(price)):
            recent_lows = [price[j] for j in swing_low_idx if j < i and i - j <= lookback * 4]
            if recent_lows and price[i] < min(recent_lows) - min_break:
                bos_idx.append(i)
                break
    return bos_idx


def _passive_accumulation_level(bars: pd.DataFrame, start_idx: int, lookback_bars: int,
                                cob_threshold: float, min_count: int) -> tuple:
    """Long: bid_depth >= threshold, level = min(mid) = support."""
    end = start_idx + 1
    start = max(0, start_idx - lookback_bars)
    window = bars.iloc[start:end]
    above = window["bid_depth"] >= cob_threshold
    if above.sum() < min_count:
        return False, None
    acc_mids = window.loc[above, "mid"].values
    return True, float(np.min(acc_mids))


def _passive_distribution_level(bars: pd.DataFrame, start_idx: int, lookback_bars: int,
                                cob_threshold: float, min_count: int) -> tuple:
    """Short: ask_depth >= threshold, level = max(mid) = resistance."""
    end = start_idx + 1
    start = max(0, start_idx - lookback_bars)
    window = bars.iloc[start:end]
    above = window["ask_depth"] >= cob_threshold
    if above.sum() < min_count:
        return False, None
    acc_mids = window.loc[above, "mid"].values
    return True, float(np.max(acc_mids))


def _aggressive_accumulation_bars(bars: pd.DataFrame, entry_bar_idx: int, bar_sec: float,
                                  agg_win_sec: int, min_volume: int, direction: str = "long") -> bool:
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


def _nearest_cob_resistance_above(cob_ask: list, current_price: float, min_depth: float,
                                  buffer_pts: float, key_levels: list, near_key_pts: float) -> Optional[float]:
    if not cob_ask:
        return None
    candidates = [(p, d) for p, d in cob_ask if p > current_price and d >= min_depth]
    if not candidates:
        return None
    if key_levels:
        near = []
        for p, d in candidates:
            for kl in key_levels:
                if kl is not None and not np.isnan(kl) and abs(p - kl) <= near_key_pts:
                    near.append((p, d))
                    break
            else:
                r50 = round(p / 50) * 50
                if abs(p - r50) <= near_key_pts:
                    near.append((p, d))
        if near:
            candidates = near
    resistance = min(p for p, d in candidates)
    return resistance - buffer_pts * POINT


def process_bar(bars: pd.DataFrame, current_bar_idx: int, params: dict, state: dict,
                bar_sec: float = 60.0) -> tuple:
    """
    Returns (signal, new_state).
    signal: "LONG" | "SHORT" | "TAKE_PROFIT" | None. State includes "side": "long" | "short" when in position.
    """
    state = dict(state)
    n = len(bars)
    if n < 20 or "mid" not in bars.columns:
        return None, state
    price = bars["mid"].values

    side = state.get("side", "long")
    # --- In position: check exit ---
    if state.get("in_position"):
        entry_price = state["entry_price"]
        entry_bar_idx = state["entry_bar_idx"]
        sl_price = state["sl_price"]
        key_levels_at_entry = state.get("key_levels_at_entry", [])
        running_low = state.get("running_low", entry_price - 50)
        running_high = state.get("running_high", entry_price + 50)
        k = current_bar_idx
        if k <= entry_bar_idx:
            return None, state
        p = bars["mid"].iloc[k]

        if side == "long":
            trail_sl_pts = params.get("trail_sl_pts", 15)
            if trail_sl_pts and p >= entry_price + trail_sl_pts * POINT:
                sl_price = max(sl_price, entry_price - 2 * POINT)
                state["sl_price"] = sl_price
            if p <= sl_price:
                state["in_position"] = False
                state.pop("side", None)
                return "TAKE_PROFIT", state
            bos_lookback = params.get("bos_swing_lookback", 10)
            bos_ticks = params.get("bos_min_break_ticks", 2)
            if params.get("exit_on_reversal_bos", True) and k > entry_bar_idx + bos_lookback:
                sub = price[entry_bar_idx : k + 1]
                if len(sub) >= bos_lookback * 2 + 1:
                    if _detect_bos(sub, bos_lookback, bos_ticks, "down"):
                        state["in_position"] = False
                        state.pop("side", None)
                        return "TAKE_PROFIT", state
            cob_tp_threshold = params.get("cob_tp_threshold", 30)
            tp_buffer_pts_cob = params.get("tp_buffer_pts_cob", 0.5)
            cob_near_key_pts = params.get("cob_near_key_pts", 20)
            if "cob_ask" in bars.columns:
                cob_ask = bars.iloc[k].get("cob_ask") or []
                if isinstance(cob_ask, list) and cob_ask:
                    tp_price = _nearest_cob_resistance_above(
                        cob_ask, p, cob_tp_threshold, tp_buffer_pts_cob,
                        key_levels_at_entry, cob_near_key_pts,
                    )
                    if tp_price is not None and tp_price > entry_price and p >= tp_price:
                        min_tp_pts = params.get("min_tp_pts_above_entry", 0)
                        if min_tp_pts <= 0 or (tp_price - entry_price) >= min_tp_pts * POINT:
                            state["in_position"] = False
                            state.pop("side", None)
                            return "TAKE_PROFIT", state
        else:
            # Short exit: SL above, reversal BOS up
            trail_sl_pts = params.get("trail_sl_pts", 15)
            if trail_sl_pts and p <= entry_price - trail_sl_pts * POINT:
                sl_price = min(sl_price, entry_price + 2 * POINT)
                state["sl_price"] = sl_price
            if p >= sl_price:
                state["in_position"] = False
                state.pop("side", None)
                return "TAKE_PROFIT", state
            bos_lookback = params.get("bos_swing_lookback", 10)
            bos_ticks = params.get("bos_min_break_ticks", 2)
            if params.get("exit_on_reversal_bos", True) and k > entry_bar_idx + bos_lookback:
                sub = price[entry_bar_idx : k + 1]
                if len(sub) >= bos_lookback * 2 + 1:
                    if _detect_bos(sub, bos_lookback, bos_ticks, "up"):
                        state["in_position"] = False
                        state.pop("side", None)
                        return "TAKE_PROFIT", state
        return None, state

    # --- Flat: check entry (only if current bar could be entry bar) ---
    passive_lookback_bars = params.get("passive_lookback_bars", 60)
    bos_lookback = params.get("bos_swing_lookback", 10)
    bos_search_bars = params.get("bos_search_bars", 120)
    bounce_bars = params.get("bounce_bars", 5)
    cob = params.get("passive_cob_threshold", 50)
    min_pa = params.get("min_passive_accumulation_count", 3)
    kl_pts = params.get("key_level_points", 20)
    bos_ticks = params.get("bos_min_break_ticks", 2)
    agg_vol = params.get("aggressive_min_volume", 150)
    agg_win = params.get("aggressive_window_seconds", 60)
    no_first = params.get("no_first_minutes", 0)
    lunch = params.get("lunch_window", "none")

    if current_bar_idx < no_first:
        return None, state
    if lunch != "none":
        start_bar, end_bar = {"11-1": (90, 210), "11:30-1": (120, 210), "12-1": (150, 210)}.get(lunch, (0, 0))
        if start_bar <= current_bar_idx < end_bar:
            return None, state

    i = max(0, current_bar_idx - bos_search_bars)
    while i <= current_bar_idx - passive_lookback_bars - bos_lookback * 2 - bounce_bars - 1:
        has_pa, acc_level = _passive_accumulation_level(bars, i, passive_lookback_bars, cob, min_pa)
        if not has_pa or acc_level is None:
            i += 1
            continue
        for t in range(i, min(i + bos_search_bars, n - bos_lookback * 2 - bounce_bars - 1)):
            if t > current_bar_idx:
                break
            if bars["mid"].iloc[t] > acc_level + kl_pts * POINT:
                continue
            if t + bounce_bars + 1 >= n:
                break
            next_mids = bars["mid"].iloc[t + 1 : t + bounce_bars + 1].values
            if np.max(next_mids) <= acc_level + kl_pts * POINT:
                continue
            sub_price = price[t : min(t + bos_search_bars, n)]
            if len(sub_price) < bos_lookback * 2 + 1:
                continue
            bos_list = _detect_bos(sub_price, bos_lookback, bos_ticks, "up")
            if not bos_list:
                continue
            entry_bar_idx = t + bos_list[0]
            if entry_bar_idx != current_bar_idx:
                continue
            if entry_bar_idx >= n:
                continue
            entry_price = price[entry_bar_idx]
            if entry_price < acc_level - kl_pts * POINT:
                continue
            if not _aggressive_accumulation_bars(bars, entry_bar_idx, bar_sec, agg_win, agg_vol, direction="long"):
                continue
            running_high = bars["mid"].iloc[: entry_bar_idx + 1].max()
            running_low = bars["mid"].iloc[: entry_bar_idx + 1].min()
            key_levels_at_entry = [running_low, running_high, acc_level]
            sl_points_fallback = params.get("sl_points_fallback", 15)
            sl_buffer_pts = params.get("sl_buffer_pts", 2)
            sl_max_pts = params.get("sl_max_pts", 25)
            support = running_low
            sl_price = support - sl_buffer_pts * POINT
            dist_pts = entry_price - sl_price
            if sl_price >= entry_price or dist_pts < 3 * POINT:
                sl_price = entry_price - sl_points_fallback * POINT
            elif dist_pts > sl_max_pts:
                sl_price = entry_price - sl_points_fallback * POINT
            state["in_position"] = True
            state["side"] = "long"
            state["entry_price"] = float(entry_price)
            state["entry_bar_idx"] = entry_bar_idx
            state["running_low"] = running_low
            state["key_levels_at_entry"] = key_levels_at_entry
            state["sl_price"] = sl_price
            return "LONG", state
        i += 1

    # --- Flat: short entry (passive distribution at resistance -> retest -> BOS down -> aggressive sell) ---
    if "ask_depth" not in bars.columns:
        return None, state
    k = current_bar_idx
    cob_short = params.get("passive_cob_threshold", 50)
    min_pa_short = params.get("min_passive_accumulation_count", 3)
    has_res, res_level = _passive_distribution_level(bars, k, passive_lookback_bars, cob_short, min_pa_short)
    if has_res and res_level is not None:
        near_pts = params.get("key_level_points", 20)
        p = bars["mid"].iloc[k]
        if abs(p - res_level) <= near_pts * POINT:
            start = max(0, k - bos_search_bars)
            sub_price = price[start : k + 1]
            if len(sub_price) >= bos_lookback * 2 + 1:
                bos_list = _detect_bos(sub_price, bos_lookback, bos_ticks, "down")
                if bos_list:
                    entry_bar_idx = start + bos_list[0]
                    if entry_bar_idx == k:
                        if _aggressive_accumulation_bars(bars, k, bar_sec, agg_win, agg_vol, direction="short"):
                            running_high = bars["mid"].iloc[max(0, k - bos_lookback) : k + 1].max()
                            sl_points_fallback = params.get("sl_points_fallback", 15)
                            sl_price = float(running_high) + sl_points_fallback * POINT
                            state["in_position"] = True
                            state["side"] = "short"
                            state["entry_price"] = float(p)
                            state["entry_bar_idx"] = k
                            state["sl_price"] = sl_price
                            state["running_high"] = float(running_high)
                            state["key_levels_at_entry"] = [res_level]
                            return "SHORT", state
    return None, state
