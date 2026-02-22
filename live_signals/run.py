"""
Live signals: V1 (1-min bars) and V2 (running bar, poll every 10s) run in parallel.
Same params, same strategy — V1 acts at bar close, V2 acts as soon as the running bar satisfies.
Discord and CSV tag each message with V1 or V2. Set DATABENTO_API_KEY and DISCORD_WEBHOOK_URL.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd

from config import API_KEY, BAR_SEC, RTH_START_ET, RTH_END_ET, EST, DISCORD_WEBHOOK_URL
from data_source import backfill_today_rth, get_recent_bars_and_running
from strategy import process_bar

# How often to poll for V2 (running bar). V1 still only acts at 1-min bar close.
V2_POLL_SEC = 10


def _est_12hr(ts) -> str:
    """Format timestamp as EST 12-hour clock (e.g. 2:35:42 PM EST). Cross-platform."""
    try:
        if hasattr(ts, "tz_localize"):
            if ts.tzinfo is None:
                ts = ts.tz_localize("UTC").tz_convert(EST)
            else:
                ts = ts.tz_convert(EST)
        elif hasattr(ts, "astimezone"):
            ts = ts.astimezone(EST)
        s = ts.strftime("%I:%M:%S %p EST")
        if len(s) and s[0] == "0":
            s = s[1:]
        return s
    except Exception:
        return str(ts)


def in_rth() -> bool:
    now = datetime.now(EST)
    start = now.replace(hour=RTH_START_ET[0], minute=RTH_START_ET[1], second=0, microsecond=0)
    end = now.replace(hour=RTH_END_ET[0], minute=RTH_END_ET[1], second=0, microsecond=0)
    return start <= now < end


def _send_discord(message: str) -> None:
    if not DISCORD_WEBHOOK_URL:
        return
    try:
        body = json.dumps({"content": message}).encode("utf-8")
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


def _ensure_trade_log(base: Path) -> Path:
    """Append-only CSV: date, time_est, version, signal, price, entry_price, pnl_pts."""
    data_dir = base / "data"
    data_dir.mkdir(exist_ok=True)
    log_path = data_dir / "live_trades.csv"
    if not log_path.exists():
        log_path.write_text("date,time_est,version,signal,price,entry_price,pnl_pts\n")
    return log_path


def _log_trade(
    log_path: Path,
    ts,
    signal: str,
    price: float,
    version: str,
    entry_price: float = None,
    pnl_pts: float = None,
) -> None:
    try:
        ts_est = ts.tz_convert(EST) if hasattr(ts, "tz_convert") else ts
        date = ts_est.strftime("%Y-%m-%d")
        time_est = ts_est.strftime("%H:%M:%S")
        ep = "" if entry_price is None else f"{entry_price:.2f}"
        pnl = "" if pnl_pts is None else f"{pnl_pts:.2f}"
        line = f"{date},{time_est},{version},{signal},{price:.2f},{ep},{pnl}\n"
        with open(log_path, "a") as f:
            f.write(line)
    except Exception:
        pass


def main():
    base = Path(__file__).resolve().parent
    params_path = base / "params.json"
    if not params_path.exists():
        print("params.json not found. Exiting.")
        sys.exit(1)
    params = json.loads(params_path.read_text())
    best_path = base.parent / "orderflow_strategy" / "data" / "best_params_v2.json"
    if best_path.exists():
        params = json.loads(best_path.read_text())
        print("Using best_params_v2.json from backtest.")
    log_path = _ensure_trade_log(base)

    if not API_KEY:
        print("DATABENTO_API_KEY is not set. Set it when you have a subscription, then run again.")
        sys.exit(1)

    if not in_rth():
        print("Outside RTH (9:30 AM - 4:00 PM ET). Start during session.")
        sys.exit(1)

    bars, _ = backfill_today_rth()
    if bars is None or len(bars) == 0:
        print("No backfill data (maybe before 9:30 or API issue). Exiting.")
        sys.exit(1)

    session_start = bars.index[0]
    last_bar_ts = bars.index[-1]
    state_v1 = {}
    state_v2 = {}

    print("Backfill loaded:", len(bars), "bars from", session_start, "to", last_bar_ts)
    print("V1 = 1-min bar close. V2 = running bar (poll every", V2_POLL_SEC, "s). Same params.")
    print("Discord/CSV: V1 LONG ..., V1 TAKE PROFIT ..., V2 LONG ..., etc.")
    print("---")

    while True:
        now_et = datetime.now(EST)
        end_et = now_et.replace(hour=RTH_END_ET[0], minute=RTH_END_ET[1], second=0, microsecond=0)
        if now_et >= end_et:
            print("RTH over. Stopping.")
            break

        new_completed, running_bar, running_bar_ts = get_recent_bars_and_running(session_start, last_bar_ts)

        # Append new completed bar(s) to shared history
        if new_completed is not None and len(new_completed) > 0:
            bars = pd.concat([bars, new_completed])
            last_bar_ts = bars.index[-1]
            # V1: evaluate only at the new bar(s) — one at a time
            for i in range(len(bars) - len(new_completed), len(bars)):
                current_bar_idx = i
                signal, state_v1 = process_bar(bars, current_bar_idx, params, state_v1, BAR_SEC)
                bar_ts = bars.index[current_bar_idx]
                price = float(bars["mid"].iloc[current_bar_idx])
                ts_str = _est_12hr(bar_ts)
                if signal == "LONG":
                    msg = f"V1 LONG  {ts_str}  MNQ {price}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "LONG", price, "V1")
                elif signal == "SHORT":
                    msg = f"V1 SHORT  {ts_str}  MNQ {price}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "SHORT", price, "V1")
                elif signal == "TAKE_PROFIT":
                    entry_price = state_v1.get("entry_price")
                    pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
                    pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts" if pnl_pts is not None else ""
                    msg = f"V1 TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "EXIT", price, "V1", entry_price, pnl_pts)

        # V2: evaluate every poll with completed bars + running bar
        if running_bar is not None and running_bar_ts is not None:
            bars_v2 = pd.concat([bars, pd.DataFrame([running_bar], index=[running_bar_ts])])
            current_bar_idx = len(bars_v2) - 1
            signal, state_v2 = process_bar(bars_v2, current_bar_idx, params, state_v2, BAR_SEC)
            price = float(running_bar.get("mid", 0))
            ts_str = _est_12hr(running_bar_ts)
            if signal == "LONG":
                msg = f"V2 LONG  {ts_str}  MNQ {price}"
                print(msg)
                _send_discord(msg)
                _log_trade(log_path, running_bar_ts, "LONG", price, "V2")
            elif signal == "SHORT":
                msg = f"V2 SHORT  {ts_str}  MNQ {price}"
                print(msg)
                _send_discord(msg)
                _log_trade(log_path, running_bar_ts, "SHORT", price, "V2")
            elif signal == "TAKE_PROFIT":
                entry_price = state_v2.get("entry_price")
                pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
                pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts" if pnl_pts is not None else ""
                msg = f"V2 TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
                print(msg)
                _send_discord(msg)
                _log_trade(log_path, running_bar_ts, "EXIT", price, "V2", entry_price, pnl_pts)

        time.sleep(V2_POLL_SEC)


if __name__ == "__main__":
    main()
