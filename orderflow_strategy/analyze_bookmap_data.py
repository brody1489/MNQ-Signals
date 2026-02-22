"""
Stream through DBN data to quantify what Bookmap shows:
- Heatmap/COB: bid_depth, ask_depth (resting orders) - what makes red vs yellow vs blue?
- Volume bubbles: trade sizes - what's typical vs "big"?
- Aggressive accumulation: buy vs sell volume in windows - what matters?

Run: python analyze_bookmap_data.py
Uses streaming - low RAM. Pick one file or all RTH files.
"""
import sys
from pathlib import Path

import numpy as np
import databento as db

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR


def stream_analyze(dbn_path: Path):
    """Stream one DBN, collect depth + trade stats."""
    store = db.DBNStore.from_file(str(dbn_path))
    depths_bid = []
    depths_ask = []
    trade_sizes = []
    # Per 10-sec window: buy_vol, sell_vol (for aggressive acc)
    window_ns = 10 * 1_000_000_000
    first_ts = [None]
    buy_sells = []  # (buy_vol, sell_vol) per window

    def cb(r):
        ts = r.ts_recv
        if first_ts[0] is None:
            first_ts[0] = ts
        if r.action == "T":
            sz = int(r.size)
            trade_sizes.append(sz)
            side = str(getattr(r, "side", "B"))
            w = (ts - first_ts[0]) // window_ns
            while len(buy_sells) <= w:
                buy_sells.append([0, 0])
            if side == "B":
                buy_sells[w][0] += sz
            else:
                buy_sells[w][1] += sz
        elif hasattr(r, "levels") and r.levels:
            bid_d = sum(lev.bid_sz for lev in r.levels)
            ask_d = sum(lev.ask_sz for lev in r.levels)
            depths_bid.append(bid_d)
            depths_ask.append(ask_d)

    store.replay(cb)
    del store

    depths_bid = np.array(depths_bid) if depths_bid else np.array([])
    depths_ask = np.array(depths_ask) if depths_ask else np.array([])
    trade_sizes = np.array(trade_sizes) if trade_sizes else np.array([])
    return depths_bid, depths_ask, trade_sizes, buy_sells


def main():
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        print("No RTH .dbn files in data/")
        return
    # Use smallest file for quick analysis, or first one
    f = files[0]
    print(f"Analyzing: {f.name} ({f.stat().st_size / 1024**2:.0f} MB)")
    print()

    depths_bid, depths_ask, trade_sizes, buy_sells = stream_analyze(f)

    print("=" * 60)
    print("HEATMAP / COB (resting limit orders - bid/ask depth)")
    print("=" * 60)
    for name, arr in [("bid_depth", depths_bid), ("ask_depth", depths_ask)]:
        if len(arr) == 0:
            continue
        print(f"\n{name}:")
        print(f"  min={arr.min():.0f}  max={arr.max():.0f}  mean={arr.mean():.1f}  median={np.median(arr):.1f}")
        for p in [50, 75, 90, 95, 99]:
            print(f"  p{p}={np.percentile(arr, p):.0f}", end="  ")
        print()
        for thresh in [30, 50, 70, 100, 150, 200]:
            pct = 100 * (arr >= thresh).sum() / len(arr)
            print(f"  >= {thresh} contracts: {pct:.1f}% of snapshots")
    print()

    print("=" * 60)
    print("VOLUME BUBBLES (trade sizes - market orders)")
    print("=" * 60)
    if len(trade_sizes) > 0:
        print(f"  min={trade_sizes.min()}  max={trade_sizes.max()}  mean={trade_sizes.mean():.1f}")
        for p in [50, 75, 90, 95, 99]:
            print(f"  p{p}={np.percentile(trade_sizes, p):.0f}", end="  ")
        print()
        for thresh in [5, 10, 20, 50, 100, 200]:
            pct = 100 * (trade_sizes >= thresh).sum() / len(trade_sizes)
            print(f"  >= {thresh} contracts: {pct:.1f}% of trades")
    print()

    print("=" * 60)
    print("AGGRESSIVE ACCUMULATION (buy vs sell vol per 10-sec window)")
    print("=" * 60)
    buy_sells = np.array(buy_sells)  # (n_windows, 2)
    if len(buy_sells) > 0:
        buy_vol = buy_sells[:, 0]
        sell_vol = buy_sells[:, 1]
        total = buy_vol + sell_vol
        delta = buy_vol - sell_vol
        mask = total >= 10
        if mask.sum() > 0:
            print(f"  Windows with total vol >= 10: {mask.sum()}")
            print(f"  buy_vol:  mean={buy_vol[mask].mean():.0f}  p90={np.percentile(buy_vol[mask], 90):.0f}")
            print(f"  sell_vol: mean={sell_vol[mask].mean():.0f}  p90={np.percentile(sell_vol[mask], 90):.0f}")
            print(f"  delta (buy-sell): mean={delta[mask].mean():.1f}  p90={np.percentile(np.abs(delta[mask]), 90):.0f}")
            for thresh in [50, 100, 150, 200, 300]:
                strong_buy = (buy_vol > sell_vol) & (buy_vol >= thresh)
                strong_sell = (sell_vol > buy_vol) & (sell_vol >= thresh)
                print(f"  buy_vol >= {thresh} and buy > sell: {strong_buy.sum()} windows")
                print(f"  sell_vol >= {thresh} and sell > buy: {strong_sell.sum()} windows")
    print()
    print("Done. Use these numbers to calibrate COB thresholds (heatmap) and aggressive_min_volume (bubbles).")


if __name__ == "__main__":
    main()
