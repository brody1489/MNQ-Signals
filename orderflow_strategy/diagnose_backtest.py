"""
Diagnose why long backtest produces 0 trades. Run on ONE day's .dbn.
Usage: python diagnose_backtest.py [path_to.dbn]
  If no path given, uses most recent mnq_MNQc0_RTH_*.dbn in data/
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backtest_engine import (
    load_dbn_streaming,
    _passive_accumulation_level,
    _detect_bos,
    _aggressive_accumulation_bars,
    TICK,
    POINT,
)
from config import DATA_DIR

BAR_SEC = 60.0


def main():
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
    else:
        files = list(DATA_DIR.glob("mnq_MNQc0_RTH_*.dbn"))
        if not files:
            print("No mnq_MNQc0_RTH_*.dbn in data/. Run long backtest for one day first or pass a path.")
            return
        path = max(files, key=lambda p: p.stat().st_mtime)
    print(f"Loading {path} ({path.stat().st_size / 1024**2:.0f} MB)...")
    bars, trades_df = load_dbn_streaming(path, freq_sec=BAR_SEC, build_cob=True)
    if bars is None or len(bars) < 20:
        print("Too few bars.")
        return

    n = len(bars)
    print(f"\n--- BAR STATS (n={n}) ---")
    mid_ok = (bars["mid"] > 0).sum()
    mid_zero = (bars["mid"] == 0).sum()
    print(f"  mid: min={bars['mid'].min():.2f} max={bars['mid'].max():.2f}  (bars with mid>0: {mid_ok}, mid=0: {mid_zero})")
    if mid_zero > 10:
        print("  >>> WARNING: Many bars have mid=0. Book updates may not be in DBN or bar indexing issue.")
    print(f"  bid_depth: min={bars['bid_depth'].min():.2f} max={bars['bid_depth'].max():.2f} mean={bars['bid_depth'].mean():.2f}")
    print(f"  ask_depth: min={bars['ask_depth'].min():.2f} max={bars['ask_depth'].max():.2f} mean={bars['ask_depth'].mean():.2f}")
    bid_ge_50 = (bars["bid_depth"] >= 50).sum()
    ask_ge_50 = (bars["ask_depth"] >= 50).sum()
    bid_zero = (bars["bid_depth"] == 0).sum()
    print(f"  bars with bid_depth>=50: {bid_ge_50}  ask_depth>=50: {ask_ge_50}  |  bid_depth=0: {bid_zero}")

    if "buy_vol" in bars.columns and "sell_vol" in bars.columns:
        total_buy = bars["buy_vol"].sum()
        total_sell = bars["sell_vol"].sum()
        print(f"  buy_vol total={total_buy}  sell_vol total={total_sell}")
        bars_with_buy = (bars["buy_vol"] >= 150).sum()
        print(f"  bars with buy_vol>=150: {bars_with_buy}")
    else:
        print("  WARNING: no buy_vol/sell_vol columns!")
        total_buy = total_sell = 0

    # Params: same as 9-day (baseline) so we match the edge that produced trades
    import json
    params_path = DATA_DIR / "baseline_params.json"
    params = json.loads(params_path.read_text()) if params_path.exists() else {}
    params.setdefault("enable_shorts", True)
    passive_lookback_bars = params.get("passive_lookback_bars", 60)
    cob = params.get("passive_cob_threshold", 50)
    min_pa = params.get("min_passive_accumulation_count", 3)
    kl_pts = params.get("key_level_points", 20)
    bos_lookback = params.get("bos_swing_lookback", 10)
    bos_ticks = params.get("bos_min_break_ticks", 2)
    bos_search_bars = params.get("bos_search_bars", 120)
    bounce_bars = params.get("bounce_bars", 5)
    agg_vol = params.get("aggressive_min_volume", 150)
    agg_win = params.get("aggressive_window_seconds", 60)

    price = bars["mid"].values
    need = passive_lookback_bars + bos_lookback * 4 + 1
    print(f"\n--- FUNNEL (need at least {need} bars; we have {n}) ---")

    count_pa_long = 0
    count_pa_short = 0
    count_retest_bos_long = 0
    count_retest_bos_short = 0
    count_agg_long = 0
    count_agg_short = 0

    for i in range(0, min(n - need, 500)):  # cap at 500 to be fast
        has_pa, acc_level = _passive_accumulation_level(bars, i, passive_lookback_bars, cob, min_pa, "long")
        if has_pa:
            count_pa_long += 1
        has_dist, res_level = _passive_accumulation_level(bars, i, passive_lookback_bars, cob, min_pa, "short")
        if has_dist:
            count_pa_short += 1

    print(f"  i in [0,500): LONG  has_pa (bid_depth>={cob}): {count_pa_long}  |  SHORT has_pa (ask_depth>={cob}): {count_pa_short}")

    if count_pa_long == 0 and count_pa_short == 0:
        print("\n  >>> No passive accumulation at all. Likely cause: bid_depth/ask_depth never reach threshold.")
        print("      Check: depth scale (mean above). If mean << 50, lower passive_cob_threshold in params or check DBN depth units.")
        return

    # Deeper: for first few PA indices, check retest+BOS+aggressive
    for i in range(0, n - need):
        has_pa, acc_level = _passive_accumulation_level(bars, i, passive_lookback_bars, cob, min_pa, "long")
        if not has_pa:
            continue
        for t in range(i, min(i + bos_search_bars, n - bos_lookback * 2 - bounce_bars - 1)):
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
            if entry_bar_idx >= n:
                continue
            entry_price = price[entry_bar_idx]
            if entry_price < acc_level - kl_pts * POINT:
                continue
            count_retest_bos_long += 1
            agg_ok = _aggressive_accumulation_bars(bars, entry_bar_idx, BAR_SEC, agg_win, agg_vol, "long")
            if agg_ok:
                count_agg_long += 1
                print(f"  LONG candidate: i={i} entry_bar={entry_bar_idx} entry_price={entry_price:.2f} acc_level={acc_level:.2f}")
        if count_retest_bos_long >= 5 and count_agg_long == 0:
            print("  LONG: have retest+BOS but aggressive never passes (buy_vol>sell_vol and buy_vol>=150 in window).")
            break
        if count_agg_long >= 3:
            break

    for i in range(0, n - need):
        has_dist, res_level = _passive_accumulation_level(bars, i, passive_lookback_bars, cob, min_pa, "short")
        if not has_dist:
            continue
        for t in range(i, min(i + bos_search_bars, n - bos_lookback * 2 - bounce_bars - 1)):
            if bars["mid"].iloc[t] < res_level - kl_pts * POINT:
                continue
            if t + bounce_bars + 1 >= n:
                break
            next_mids = bars["mid"].iloc[t + 1 : t + bounce_bars + 1].values
            if np.min(next_mids) >= res_level - kl_pts * POINT:
                continue
            sub_price = price[t : min(t + bos_search_bars, n)]
            if len(sub_price) < bos_lookback * 2 + 1:
                continue
            bos_list = _detect_bos(sub_price, bos_lookback, bos_ticks, "down")
            if not bos_list:
                continue
            entry_bar_idx = t + bos_list[0]
            if entry_bar_idx >= n:
                continue
            entry_price = price[entry_bar_idx]
            if entry_price > res_level + kl_pts * POINT:
                continue
            count_retest_bos_short += 1
            agg_ok = _aggressive_accumulation_bars(bars, entry_bar_idx, BAR_SEC, agg_win, agg_vol, "short")
            if agg_ok:
                count_agg_short += 1
                print(f"  SHORT candidate: i={i} entry_bar={entry_bar_idx} entry_price={entry_price:.2f} res_level={res_level:.2f}")
        if count_retest_bos_short >= 5 and count_agg_short == 0:
            print("  SHORT: have retest+BOS but aggressive never passes.")
            break
        if count_agg_short >= 3:
            break

    print(f"\n  Funnel: retest+BOS LONG={count_retest_bos_long} SHORT={count_retest_bos_short}  |  aggressive ok LONG={count_agg_long} SHORT={count_agg_short}")
    if count_agg_long == 0 and count_agg_short == 0 and (count_retest_bos_long > 0 or count_retest_bos_short > 0):
        print("  >>> Aggressive volume filter is killing all candidates. Try lowering aggressive_min_volume (e.g. 50 or 100) in params.")
    print()


if __name__ == "__main__":
    main()
