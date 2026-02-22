"""
Strategy parameters to sweep during optimization.
We optimize your edge: key level proximity, limit order (passive) threshold, aggressive vol,
BOS lookback, level-based SL/TP (below support / below resistance), exit on reversal BOS.
Not fixed TP 50 / SL 10 — SL/TP follow key levels with fallbacks.
"""
from dataclasses import dataclass, field
from typing import List

@dataclass
class ParamGrid:
    """All strategy parameters we want to optimize."""

    # --- Key level proximity (points) ---
    key_level_points: List[int] = field(default_factory=lambda: [5, 10, 15, 20])

    # --- Passive accumulation (heatmap / limit orders) ---
    min_passive_accumulation_count: List[int] = field(default_factory=lambda: [2, 3, 4])
    passive_cob_threshold: List[int] = field(default_factory=lambda: [30, 50, 70, 100])  # min contracts for "red"

    # --- Aggressive accumulation (market orders) ---
    aggressive_min_volume: List[int] = field(default_factory=lambda: [100, 150, 200, 250])
    aggressive_window_seconds: List[int] = field(default_factory=lambda: [5, 10, 15])

    # --- BOS (Break of Structure) ---
    bos_swing_lookback: List[int] = field(default_factory=lambda: [3, 5, 7])  # bars for swing high/low
    bos_min_break_ticks: List[int] = field(default_factory=lambda: [2, 4, 6])

    # --- Take profit ---
    tp1_points_below_large_order: List[int] = field(default_factory=lambda: [2, 5, 8])
    tp2_points_below_key_level: List[int] = field(default_factory=lambda: [2, 5])

    # --- Stop loss ---
    sl_ticks: List[int] = field(default_factory=lambda: [8, 12, 16, 20])
    use_trailing_sl: List[bool] = field(default_factory=lambda: [False, True])

    # --- BOS on entry: exit on reversal BOS or hold to TP/SL? ---
    exit_on_reversal_bos: List[bool] = field(default_factory=lambda: [False, True])


# Key levels we'll compute (from OHLCV or external)
KEY_LEVEL_TYPES = [
    "prev_day_high", "prev_day_low", "prev_day_open", "prev_day_close",
    "prev_week_high", "prev_week_low", "prev_week_open", "prev_week_close",
    "prev_month_high", "prev_month_low", "prev_month_open", "prev_month_close",
    "today_open", "week_open", "month_open",
    "overnight_high", "overnight_low",
    "cash_open", "previous_close",
    "asia_high", "asia_low", "london_high", "london_low",
]
