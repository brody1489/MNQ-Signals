"""
Targeted tick replay: for each 1-min backtest entry we only expand 9:58–10:02 (or entry_bar ± 2 min)
to event-level data and find the first moment we would have entered on a live/tick feed.
So we get "1-min said enter at 10:00 @ 25,000; tick would have been 9:59:12 @ 24,998" = X pts better.
No full tick backtest — only ~4 min of events per trade. Run after you have trade details.
Usage: python tick_entry_replay.py [--days N]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd

try:
    import databento as db
except ImportError:
    db = None

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import (
    load_dbn_streaming,
    run_backtest,
    _detect_bos,
    TICK,
    POINT,
)

BAR_SEC = 60.0
# Window around entry bar: 2 min before, 2 min after (4 min total of tick data per trade)
WINDOW_BARS_BEFORE = 2
WINDOW_BARS_AFTER = 2
# Fine bars for "when would we enter" (1 sec = 240 points in 4 min)
FINE_BAR_SEC = 1.0


def collect_events_for_windows(dbn_path: Path, windows: list[tuple[int, int]]) -> dict[int, list[dict]]:
    """
    Replay DBN once; for each (session_start_ns, entry_bar) in windows, collect events in that 4-min window.
    windows: list of (session_start_ns, entry_bar). Returns dict keyed by (entry_bar,) or index into windows.
    """
    # key = entry_bar (we assume one session per file so session_start is same for all)
    by_key = defaultdict(list)
    if not windows:
        return dict(by_key)
    session_start_ns = windows[0][0]
    window_list = [
        (entry_bar,
         session_start_ns + int((entry_bar - WINDOW_BARS_BEFORE) * 60 * 1e9),
         session_start_ns + int((entry_bar + WINDOW_BARS_AFTER + 1) * 60 * 1e9))
        for _, entry_bar in windows
    ]

    def callback(r):
        ts_ns = r.ts_recv
        rec = {"ts_ns": ts_ns}
        if r.action == "T":
            rec["action"] = "T"
            rec["side"] = str(getattr(r, "side", "B"))
            rec["size"] = int(r.size)
        elif hasattr(r, "levels") and r.levels:
            mid = (r.levels[0].pretty_bid_px + r.levels[0].pretty_ask_px) / 2
            rec["mid"] = mid
        for entry_bar, w_start, w_end in window_list:
            if w_start <= ts_ns <= w_end:
                by_key[entry_bar].append(rec)
                break

    store = db.DBNStore.from_file(str(dbn_path))
    store.replay(callback)
    return dict(by_key)


def events_to_fine_bars(events: list[dict], fine_sec: float = 1.0) -> pd.DataFrame:
    """Build 1-sec (or fine_sec) bars: mid (last), buy_vol, sell_vol from event list."""
    if not events:
        return pd.DataFrame(columns=["mid", "buy_vol", "sell_vol"])
    first_ns = min(e["ts_ns"] for e in events)
    bar_ns = int(fine_sec * 1e9)
    bars_dict = defaultdict(lambda: {"mid": 0.0, "buy_vol": 0, "sell_vol": 0})
    for e in events:
        ts_ns = e["ts_ns"]
        idx = (ts_ns - first_ns) // bar_ns
        if e.get("action") == "T":
            if e.get("side") == "B":
                bars_dict[idx]["buy_vol"] += e.get("size", 0)
            else:
                bars_dict[idx]["sell_vol"] += e.get("size", 0)
        elif "mid" in e:
            bars_dict[idx]["mid"] = e["mid"]
    idx_sorted = sorted(bars_dict.keys())
    # Forward-fill mid
    last_mid = None
    for i in idx_sorted:
        if bars_dict[i]["mid"] != 0:
            last_mid = bars_dict[i]["mid"]
        elif last_mid is not None:
            bars_dict[i]["mid"] = last_mid
    times = [pd.Timestamp(first_ns + i * bar_ns, unit="ns") for i in idx_sorted]
    rows = [{"mid": bars_dict[i]["mid"], "buy_vol": bars_dict[i]["buy_vol"], "sell_vol": bars_dict[i]["sell_vol"]} for i in idx_sorted]
    return pd.DataFrame(rows, index=pd.DatetimeIndex(times))


def first_tick_entry_in_window(
    fine_bars: pd.DataFrame,
    acc_level: float,
    kl_pts: float,
    bounce_bars: int,
    bos_lookback: int,
    bos_ticks: int,
    agg_win_sec: int,
    agg_min_vol: int,
) -> tuple[int | None, float | None]:
    """
    Find first fine bar index where: retest (mid <= acc_level + kl_pts), bounce (next bars go above),
    BOS up, and aggressive vol in last agg_win_sec. Returns (bar_idx, mid_price) or (None, None).
    """
    if len(fine_bars) < bounce_bars + bos_lookback * 2 + 5:
        return None, None
    price = fine_bars["mid"].values
    n = len(price)
    upper = acc_level + kl_pts * POINT
    min_break = bos_ticks * TICK
    agg_bars = max(1, int(agg_win_sec / FINE_BAR_SEC))

    for t in range(0, n - bounce_bars - bos_lookback * 2 - 1):
        if price[t] > upper:
            continue
        if t + bounce_bars + 1 >= n:
            break
        next_mids = price[t + 1 : t + bounce_bars + 1]
        if np.max(next_mids) <= upper:
            continue
        sub = price[t : min(t + 120, n)]
        if len(sub) < bos_lookback * 2 + 1:
            continue
        bos_list = _detect_bos(sub, bos_lookback, bos_ticks, "up")
        if not bos_list:
            continue
        entry_idx = t + bos_list[0]
        if entry_idx >= n:
            continue
        entry_price = price[entry_idx]
        if entry_price < acc_level - kl_pts * POINT:
            continue
        start = max(0, entry_idx - agg_bars + 1)
        sub_bars = fine_bars.iloc[start : entry_idx + 1]
        buy_vol = sub_bars["buy_vol"].sum()
        sell_vol = sub_bars["sell_vol"].sum()
        if buy_vol <= sell_vol or buy_vol < agg_min_vol:
            continue
        return int(entry_idx), float(entry_price)
    return None, None


def main():
    if db is None:
        print("Need databento: pip install databento")
        return
    import argparse
    ap = argparse.ArgumentParser(description="Tick entry replay: 4-min window per trade, find first tick entry")
    ap.add_argument("--days", type=int, default=None, help="Limit to first N days")
    ap.add_argument("--out", type=str, default=None, help="Output txt path (default data/tick_entry_report.txt)")
    args = ap.parse_args()
    baseline = DATA_DIR / "baseline_params.json"
    best_path = DATA_DIR / "best_params_v2.json"
    if best_path.exists():
        params_v2 = json.loads(best_path.read_text())
    else:
        params = json.loads(baseline.read_text())
        params_v2 = {**params, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if args.days:
        files = files[: args.days]
    if not files:
        print("No RTH .dbn files in data/")
        return

    all_details = []
    for f in files:
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        r, details = run_backtest(bars=bars, trades_df=tr, params=params_v2, bar_sec=BAR_SEC, return_trade_details=True, day_label=f.stem)
        for d in details:
            d["_dbn_path"] = f
            d["_session_start_ns"] = int(bars.index[0].value)
        all_details.extend(details)

    if not all_details:
        print("No trades to replay.")
        return

    kl_pts = params_v2.get("key_level_points", 20)
    bounce_bars = params_v2.get("bounce_bars", 3)
    bos_lookback = params_v2.get("bos_swing_lookback", 10)
    bos_ticks = params_v2.get("bos_min_break_ticks", 2)
    agg_win = params_v2.get("aggressive_window_seconds", 60)
    agg_vol = params_v2.get("aggressive_min_volume", 150)
    # On 1-sec bars, use smaller lookback for BOS
    bos_lookback_fine = max(3, bos_lookback // 6)

    # Group by day (dbn path) so we replay each DBN only once
    by_day = defaultdict(list)
    for d in all_details:
        by_day[d["_dbn_path"]].append(d)

    results = []
    for dbn_path, day_details in by_day.items():
        session_start_ns = day_details[0]["_session_start_ns"]
        windows = [(session_start_ns, d["entry_bar"]) for d in day_details]
        events_by_bar = collect_events_for_windows(dbn_path, windows)
        for d in day_details:
            day_label = d["day"]
            entry_bar = d["entry_bar"]
            entry_price_1min = d["entry_price"]
            acc_level = d.get("acc_level")
            if acc_level is None:
                results.append({"day": day_label, "entry_bar": entry_bar, "entry_1min": entry_price_1min, "tick_idx": None, "tick_price": None, "pts_better": None})
                continue
            events = events_by_bar.get(entry_bar, [])
            fine_bars = events_to_fine_bars(events, FINE_BAR_SEC)
            tick_idx, tick_price = first_tick_entry_in_window(
                fine_bars, acc_level, kl_pts, bounce_bars, bos_lookback_fine, bos_ticks, agg_win, agg_vol
            )
            pts_better = None
            if tick_price is not None and entry_price_1min is not None:
                pts_better = round((entry_price_1min - tick_price) / POINT, 2)
            results.append({
                "day": day_label,
                "entry_bar": entry_bar,
                "entry_1min": entry_price_1min,
                "tick_idx": tick_idx,
                "tick_price": tick_price,
                "pts_better": pts_better,
            })
            print(f"  {day_label} bar={entry_bar} 1min={entry_price_1min:.2f} tick_price={tick_price} pts_better={pts_better}", flush=True)
        print(f"  Replayed {dbn_path.name} once for {len(day_details)} trades", flush=True)

    # Summary
    with_tick = [r for r in results if r["tick_price"] is not None]
    pts_better_list = [r["pts_better"] for r in with_tick if r["pts_better"] is not None]
    lines = [
        "=== Tick entry replay (4-min window per trade, 1-sec bars) ===",
        f"Trades: {len(all_details)}  With tick entry found: {len(with_tick)}",
        "",
    ]
    if pts_better_list:
        lines.append(f"Entry improvement (1-min price - tick price): avg={np.mean(pts_better_list):.2f} pts max={np.max(pts_better_list):.2f} pts")
    lines.append("")
    for r in results:
        lines.append(f"  {r['day']} bar={r['entry_bar']} 1min={r['entry_1min']:.2f} tick={r['tick_price']} pts_better={r['pts_better']}")
    out_path = Path(args.out) if args.out else DATA_DIR / "tick_entry_report.txt"
    out_path.write_text("\n".join(lines))
    print("\nWrote", out_path, flush=True)


if __name__ == "__main__":
    main()
