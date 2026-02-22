"""
Live signals: one command to run. Backfills from 9:30 ET if started late, then polls
each minute for new bar, runs strategy, prints LONG / TAKE PROFIT with price and PnL.
Optional: set DISCORD_WEBHOOK_URL to post each signal to a Discord channel.
Set DATABENTO_API_KEY before running.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd

from config import API_KEY, BAR_SEC, RTH_START_ET, RTH_END_ET, EST, DISCORD_WEBHOOK_URL
from data_source import backfill_today_rth, poll_latest_bar
from strategy import process_bar


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
    """Post message to Discord webhook if DISCORD_WEBHOOK_URL is set. No extra deps."""
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


def _ensure_trade_log(base: Path):
    """Append-only CSV: date, time_est, signal, price, entry_price, pnl_pts."""
    data_dir = base / "data"
    data_dir.mkdir(exist_ok=True)
    log_path = data_dir / "live_trades.csv"
    if not log_path.exists():
        log_path.write_text("date,time_est,signal,price,entry_price,pnl_pts\n")
    return log_path


def _log_trade(log_path: Path, ts, signal: str, price: float, entry_price: float = None, pnl_pts: float = None):
    try:
        ts_est = ts.tz_convert(EST) if hasattr(ts, "tz_convert") else ts
        date = ts_est.strftime("%Y-%m-%d")
        time_est = ts_est.strftime("%H:%M:%S")
        ep = "" if entry_price is None else f"{entry_price:.2f}"
        pnl = "" if pnl_pts is None else f"{pnl_pts:.2f}"
        line = f"{date},{time_est},{signal},{price:.2f},{ep},{pnl}\n"
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
    # Use proven backtest params if present (70–80% WR, lunch skip, etc.)
    best_path = base.parent / "orderflow_strategy" / "data" / "best_params_v2.json"
    if best_path.exists():
        params = json.loads(best_path.read_text())
        print("Using best_params_v2.json from backtest (proven config).")
    log_path = _ensure_trade_log(base)

    if not API_KEY:
        print("DATABENTO_API_KEY is not set. Set it when you have a subscription, then run again.")
        sys.exit(1)

    if not in_rth():
        print("Outside RTH (9:30 AM - 4:00 PM ET). Start during session.")
        sys.exit(1)

    # Backfill from 9:30 to now so we have context
    bars, _ = backfill_today_rth()
    if bars is None or len(bars) == 0:
        print("No backfill data (maybe before 9:30 or API issue). Exiting.")
        sys.exit(1)

    state = {}
    last_bar_ts = bars.index[-1]
    # Ensure we have a timezone for bar index alignment (strategy uses bar index = position)
    print("Backfill loaded:", len(bars), "bars from", bars.index[0], "to", last_bar_ts)
    print("Watching for signals. Output: LONG | SHORT | TAKE PROFIT with time (EST) and MNQ price.")
    print("---")

    while True:
        now_et = datetime.now(EST)
        end_et = now_et.replace(hour=RTH_END_ET[0], minute=RTH_END_ET[1], second=0, microsecond=0)
        if now_et >= end_et:
            print("RTH over. Stopping.")
            break

        bar_series, bar_ts = poll_latest_bar(bars.index[0])
        if bar_ts is not None:
            # Only append if this bar is newer than last
            if bar_ts > last_bar_ts:
                new_row = pd.DataFrame([bar_series], index=[bar_ts])
                bars = pd.concat([bars, new_row])
                current_bar_idx = len(bars) - 1
                signal, state = process_bar(bars, current_bar_idx, params, state, BAR_SEC)
                price = float(bar_series.get("mid", 0))
                ts_str = _est_12hr(bar_ts)

                if signal == "LONG":
                    msg = f"LONG  {ts_str}  MNQ {price}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "LONG", price)
                elif signal == "SHORT":
                    msg = f"SHORT  {ts_str}  MNQ {price}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "SHORT", price)
                elif signal == "TAKE_PROFIT":
                    entry_price = state.get("entry_price")
                    pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
                    if pnl_pts is not None:
                        pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts"
                    else:
                        pnl_str = ""
                    msg = f"TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
                    print(msg)
                    _send_discord(msg)
                    _log_trade(log_path, bar_ts, "EXIT", price, entry_price, pnl_pts)

                last_bar_ts = bar_ts

        # Sleep until next minute boundary so we poll once per bar
        sleep_sec = BAR_SEC - (time.time() % BAR_SEC)
        if sleep_sec > 55:
            sleep_sec = 5  # avoid sleeping too long past the minute
        time.sleep(min(sleep_sec, 30))


if __name__ == "__main__":
    main()
