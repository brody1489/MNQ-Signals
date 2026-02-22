"""
Explore the data for your setup SEQUENCE (not same bar):
1. Passive accumulation FIRST (during the move - red heatmap, price through it; strong buyers at bottom)
2. Near key level - bounce off strong buyers
3. BOS - reversal, structure break
4. Aggressive accumulation - green > red, confirmation
5. ENTER

Run: python explore_sequence.py
Uses smallest day for speed. Prints when we find the sequence and the structure.
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, _detect_bos, _passive_accumulation_count, _near_key_level, _aggressive_accumulation_bars, TICK

def main():
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"), key=lambda f: f.stat().st_size)
    if not files:
        print("No data.")
        return
    f = files[0]  # smallest for speed (02-16 ~96MB)
    print(f"Exploring: {f.name} ({f.stat().st_size/1024**2:.0f} MB)")
    print()

    bars, _ = load_dbn_streaming(f, freq_sec=60)
    if len(bars) < 30:
        print("Too few bars (file may be truncated).")
        return

    price = bars["mid"].values
    session_high = bars["mid"].max()
    session_low = bars["mid"].min()
    key_levels = [session_low, session_high]

    # Params - relaxed
    cob = 50
    min_pa = 3
    passive_lookback = 60
    kl_pts = 60  # wider: bounce can be 30-50 pts from key
    agg_vol = 100  # "we dont need a ton"
    agg_win = 60
    bos_lookback = 10
    bos_ticks = 2

    setups = []
    i = 0
    while i < len(bars) - bos_lookback * 4:
        start_pa = max(0, i - passive_lookback)
        window_bars = bars.iloc[start_pa : i + 1]
        bos_up = _detect_bos(price[i:], bos_lookback, bos_ticks, "up")
        pa_long = _passive_accumulation_count(window_bars, cob, min_pa, "long")

        if not bos_up and not pa_long:
            i += 1
            continue

        for j in range(i + bos_lookback * 2, min(i + 120, len(bars) - 1)):
            sub_price = price[i : j + 1]
            if len(sub_price) < bos_lookback * 2 + 1:
                continue
            bos_idx = _detect_bos(sub_price, bos_lookback, bos_ticks, "up")
            if not bos_idx:
                continue
            entry_bar_idx = i + bos_idx[0]
            entry_price = price[entry_bar_idx]
            entry_ts = bars.index[entry_bar_idx]

            sub_bars = bars.iloc[max(0, entry_bar_idx - passive_lookback) : entry_bar_idx + 1]
            pa_ok = len(_passive_accumulation_count(sub_bars, cob, min_pa, "long")) > 0
            kl_ok = _near_key_level(entry_price, key_levels, kl_pts)
            agg_ok = _aggressive_accumulation_bars(bars, entry_bar_idx, 60, agg_win, agg_vol, "long")

            # SL sanity: how far is session_low from entry?
            dist_to_support = entry_price - session_low
            sl_far = dist_to_support > 30  # would risk 30+ pts

            # Diagnostic: count how often each combo passes
            if pa_ok and kl_ok and agg_ok:
                # Downtrend before? (lower lows in lookback)
                lb = max(0, entry_bar_idx - passive_lookback)
                if entry_bar_idx - lb >= 20:
                    pre_price = price[lb:entry_bar_idx]
                    lows = [pre_price[k] for k in range(1, len(pre_price)-1) 
                            if pre_price[k] <= pre_price[k-1] and pre_price[k] <= pre_price[k+1]]
                    downtrend = len(lows) >= 2 and lows[-1] < lows[0] if lows else False
                else:
                    downtrend = None

                bounce_low = price[max(0, entry_bar_idx - 20):entry_bar_idx + 1].min()
                dist_bounce_to_key = min(abs(bounce_low - session_low), abs(bounce_low - session_high))

                setups.append({
                    "entry_bar": entry_bar_idx,
                    "entry_ts": entry_ts,
                    "entry_price": entry_price,
                    "pa_ok": pa_ok, "kl_ok": kl_ok, "agg_ok": agg_ok,
                    "dist_to_support_pts": round(dist_to_support, 1),
                    "sl_would_be_far": sl_far,
                    "bounce_low": round(bounce_low, 1),
                    "dist_bounce_to_key": round(dist_bounce_to_key, 1),
                    "downtrend_before": downtrend,
                })
            i = entry_bar_idx + 1
            break
        else:
            i += 1

    print("=" * 70)
    print("SEQUENCE FOUND (your setup: passive -> bounce/key -> BOS -> aggressive -> enter)")
    print("=" * 70)
    print(f"Setups found: {len(setups)}")
    for s in setups:
        print()
        print(f"  Entry: bar {s['entry_bar']} @ {s['entry_ts']} price {s['entry_price']:.1f}")
        print(f"    Passive (in lookback): {s['pa_ok']} | Key level: {s['kl_ok']} | Aggressive: {s['agg_ok']}")
        print(f"    Bounce low: {s['bounce_low']} (within {s['dist_bounce_to_key']} pts of key)")
        print(f"    Entry to session_low: {s['dist_to_support_pts']} pts  {'<- SL TOO FAR!' if s['sl_would_be_far'] else ''}")
        print(f"    Downtrend before: {s['downtrend_before']}")
    # Count what blocks us: BOS candidates vs each check
    bos_count = pa_only = kl_only = agg_only = 0
    ii = 0
    while ii < len(bars) - bos_lookback * 4:
        start_pa = max(0, ii - passive_lookback)
        window_bars = bars.iloc[start_pa : ii + 1]
        bos_up = _detect_bos(price[ii:], bos_lookback, bos_ticks, "up")
        pa_long = _passive_accumulation_count(window_bars, cob, min_pa, "long")
        if not bos_up and not pa_long:
            ii += 1
            continue
        for j in range(ii + bos_lookback * 2, min(ii + 120, len(bars) - 1)):
            sub_price = price[ii : j + 1]
            if len(sub_price) < bos_lookback * 2 + 1:
                continue
            bos_idx = _detect_bos(sub_price, bos_lookback, bos_ticks, "up")
            if not bos_idx:
                continue
            entry_bar_idx = ii + bos_idx[0]
            entry_price = price[entry_bar_idx]
            sub_bars = bars.iloc[max(0, entry_bar_idx - passive_lookback) : entry_bar_idx + 1]
            pa_ok = len(_passive_accumulation_count(sub_bars, cob, min_pa, "long")) > 0
            kl_ok = _near_key_level(entry_price, key_levels, kl_pts)
            agg_ok = _aggressive_accumulation_bars(bars, entry_bar_idx, 60, agg_win, agg_vol, "long")
            bos_count += 1
            if pa_ok:
                pa_only += 1
            if kl_ok:
                kl_only += 1
            if agg_ok:
                agg_only += 1
            ii = entry_bar_idx + 1
            break
        else:
            ii += 1

    print()
    print("DIAGNOSTIC: BOS candidates vs each check")
    print(f"  BOS candidates: {bos_count}")
    print(f"  Pass passive: {pa_only} | Pass key level: {kl_only} | Pass aggressive: {agg_only}")
    print()
    print("If setups=0: sequence too strict or BOS/passive/agg defs off.")
    print("If sl_would_be_far: need SL cap (use fallback when support >20-30 pts away).")
    print("If downtrend_before=False: may be entering in chop, not after clear selloff.")


if __name__ == "__main__":
    main()
