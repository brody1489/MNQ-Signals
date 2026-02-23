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

from config import API_KEY, BAR_SEC, RTH_START_ET, RTH_END_ET, EST, DISCORD_WEBHOOK_URL, SCHEMA, DATA_DELAY_MINUTES, USE_LIVE_DATA
from data_source import backfill_today_rth, get_recent_bars_and_running
from strategy import process_bar

try:
    from live_stream import run_live_session, LiveBarBuilder
    LIVE_STREAM_AVAILABLE = True
except Exception:
    LIVE_STREAM_AVAILABLE = False

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


def _send_discord(message: str) -> bool:
    """Send a message to the Discord webhook. Returns True if sent, False otherwise."""
    if not DISCORD_WEBHOOK_URL:
        return False
    try:
        body = json.dumps({"content": message}).encode("utf-8")
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "MNQ-Signals/1.0",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception as e:
        err = str(e)
        if "403" in err or "Forbidden" in err:
            print(f"[Discord] send failed: {e} — Webhook URL rejected. Create a NEW webhook in Discord and paste the new URL into Railway.", flush=True)
        else:
            print(f"[Discord] send failed: {e}", flush=True)
        return False


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
    print("[live] main() started", flush=True)
    params_path = base / "params.json"
    if not params_path.exists():
        print("params.json not found. Exiting.", flush=True)
        sys.exit(1)
    params = json.loads(params_path.read_text())
    best_path = base.parent / "orderflow_strategy" / "data" / "best_params_v2.json"
    if best_path.exists():
        params = json.loads(best_path.read_text())
        print("Using best_params_v2.json from backtest.", flush=True)
    log_path = _ensure_trade_log(base)

    discord_len = len(DISCORD_WEBHOOK_URL) if DISCORD_WEBHOOK_URL else 0
    print("Databento schema:", SCHEMA, "| API_KEY:", "set" if API_KEY else "NOT SET", "| Discord:", "set" if DISCORD_WEBHOOK_URL else "NOT SET", f"(URL len={discord_len})", "| data delay:", DATA_DELAY_MINUTES, "min", flush=True)

    while not API_KEY:
        print("DATABENTO_API_KEY is not set. Sleeping 5 min and will retry (Railway stays up).", flush=True)
        time.sleep(300)

    if not in_rth():
        print("Outside RTH (9:30 AM - 4:00 PM ET). Start during session.", flush=True)
        sys.exit(1)

    now_et = datetime.now(EST)
    if now_et.weekday() >= 5:
        print("Today is weekend (market closed). Exiting so we don't burn API retries. Will run again next RTH.", flush=True)
        return

    bars, _ = backfill_today_rth()
    backfill_retries = 0
    while bars is None or len(bars) == 0:
        if not in_rth():
            print("RTH ended while waiting for backfill. Exiting cleanly.", flush=True)
            return
        backfill_retries += 1
        print(
            f"No backfill data (retry {backfill_retries}). See [backfill] lines above for the actual error or empty-data reason. Sleeping 2 min.",
            flush=True,
        )
        time.sleep(120)
        bars, _ = backfill_today_rth()

    session_start = bars.index[0]
    last_bar_ts = bars.index[-1]
    state_v1 = {}
    state_v2 = {}

    print("Backfill loaded:", len(bars), "bars from", session_start, "to", last_bar_ts, flush=True)
    print("V1 = 1-min bar close. V2 = running bar (poll every", V2_POLL_SEC, "s). Same params.", flush=True)
    print("Discord/CSV: V1 LONG ..., V1 TAKE PROFIT ..., V2 LONG ..., etc.", flush=True)
    # Ensure bars have all columns strategy needs (lookback, levels, COB)
    required = ["mid", "bid_depth", "ask_depth", "buy_vol", "sell_vol", "cob_ask"]
    missing = [c for c in required if c not in bars.columns]
    if missing:
        print(f"[WARN] Bars missing columns: {missing}", flush=True)
    else:
        print("Bar columns OK: mid, bid_depth, ask_depth, buy_vol, sell_vol, cob_ask", flush=True)
    # Strategy needs 60-bar passive lookback + 120-bar BOS search; ensure we have enough
    need_bars = 20 + max(params.get("passive_lookback_bars", 60), params.get("bos_search_bars", 120))
    if len(bars) >= need_bars:
        print(f"Full lookback ready: {len(bars)} bars (need {need_bars} for passive+BOS).", flush=True)
    else:
        print(f"[WARN] Only {len(bars)} bars; strategy needs {need_bars} for full passive+BOS.", flush=True)
    # Run V1 once for the last backfilled bar so we don't miss a setup that completed on it
    try:
        idx_last = len(bars) - 1
        signal, state_v1 = process_bar(bars, idx_last, params, state_v1, BAR_SEC)
        bar_ts = bars.index[idx_last]
        price = float(bars["mid"].iloc[idx_last])
        ts_str = _est_12hr(bar_ts)
        if signal == "LONG":
            msg = f"V1 LONG  {ts_str}  MNQ {price}"
            print(msg, flush=True)
            _send_discord(msg)
            _log_trade(log_path, bar_ts, "LONG", price, "V1")
        elif signal == "SHORT":
            msg = f"V1 SHORT  {ts_str}  MNQ {price}"
            print(msg, flush=True)
            _send_discord(msg)
            _log_trade(log_path, bar_ts, "SHORT", price, "V1")
        elif signal == "TAKE_PROFIT":
            entry_price = state_v1.get("entry_price")
            pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
            pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts" if pnl_pts is not None else ""
            msg = f"V1 TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
            print(msg, flush=True)
            _send_discord(msg)
            _log_trade(log_path, bar_ts, "EXIT", price, "V1", entry_price, pnl_pts)
        else:
            print("V1 catch-up: no signal on last backfilled bar.", flush=True)
    except Exception as e:
        print(f"[V1 catch-up error] {e}", flush=True)
    # One-time Discord test so you see a message and network flow
    if DISCORD_WEBHOOK_URL:
        mode = "LIVE stream" if (USE_LIVE_DATA and LIVE_STREAM_AVAILABLE) else "Historical poll"
        if _send_discord(f"Live signals started. MNQ {SCHEMA}. Bars: {len(bars)}. V1+V2 watching ({mode})."):
            print("Discord test message sent.", flush=True)
        else:
            print("Discord test failed — check webhook URL in Railway (see [Discord] line above).", flush=True)
    else:
        print("DISCORD_WEBHOOK_URL not set — no notifications until set.", flush=True)
    print("---", flush=True)

    builder = None
    use_live = USE_LIVE_DATA and LIVE_STREAM_AVAILABLE
    if use_live:
        print("Using Databento Live stream for real-time bars (V1 = 1-min close, V2 = running bar).", flush=True)
        session_start_ns = int(pd.Timestamp(session_start).value)
        builder, _ = run_live_session(session_start_ns, replay_minutes_ago=1)
        if builder is None:
            print("[live] Fallback to Historical polling (Live failed to start).", flush=True)
            use_live = False
        else:
            time.sleep(2)

    poll_count = 0
    while True:
        now_et = datetime.now(EST)
        end_et = now_et.replace(hour=RTH_END_ET[0], minute=RTH_END_ET[1], second=0, microsecond=0)
        if now_et >= end_et:
            print("RTH over. Stopping.", flush=True)
            if builder is not None:
                builder.stop()
            break

        if use_live and builder is not None:
            new_completed = builder.get_completed_bars()
            running_bar, running_bar_ts = builder.get_running_bar()
            if running_bar is not None:
                running_bar = running_bar.to_dict()
        else:
            try:
                new_completed, running_bar, running_bar_ts = get_recent_bars_and_running(session_start, last_bar_ts)
            except Exception as e:
                print(f"[poll error] {e}", flush=True)
                time.sleep(V2_POLL_SEC)
                continue

        # Append new completed bar(s) to shared history
        if new_completed is not None and len(new_completed) > 0:
            try:
                bars = pd.concat([bars, new_completed])
                last_bar_ts = bars.index[-1]
            except Exception as e:
                print(f"[concat error] {e}", flush=True)
            else:
                # V1: evaluate only at the new bar(s) — one at a time
                for i in range(len(bars) - len(new_completed), len(bars)):
                    try:
                        current_bar_idx = i
                        signal, state_v1 = process_bar(bars, current_bar_idx, params, state_v1, BAR_SEC)
                        bar_ts = bars.index[current_bar_idx]
                        price = float(bars["mid"].iloc[current_bar_idx])
                        ts_str = _est_12hr(bar_ts)
                        if signal == "LONG":
                            msg = f"V1 LONG  {ts_str}  MNQ {price}"
                            print(msg, flush=True)
                            _send_discord(msg)
                            _log_trade(log_path, bar_ts, "LONG", price, "V1")
                        elif signal == "SHORT":
                            msg = f"V1 SHORT  {ts_str}  MNQ {price}"
                            print(msg, flush=True)
                            _send_discord(msg)
                            _log_trade(log_path, bar_ts, "SHORT", price, "V1")
                        elif signal == "TAKE_PROFIT":
                            entry_price = state_v1.get("entry_price")
                            pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
                            pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts" if pnl_pts is not None else ""
                            msg = f"V1 TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
                            print(msg, flush=True)
                            _send_discord(msg)
                            _log_trade(log_path, bar_ts, "EXIT", price, "V1", entry_price, pnl_pts)
                    except Exception as e:
                        print(f"[V1 process_bar error] {e}", flush=True)

        # V2: evaluate every poll with completed bars + running bar
        if running_bar is not None and running_bar_ts is not None:
            try:
                bars_v2 = pd.concat([bars, pd.DataFrame([running_bar], index=[running_bar_ts])])
                current_bar_idx = len(bars_v2) - 1
                signal, state_v2 = process_bar(bars_v2, current_bar_idx, params, state_v2, BAR_SEC)
                price = float(running_bar.get("mid", 0))
                ts_str = _est_12hr(running_bar_ts)
                if signal == "LONG":
                    msg = f"V2 LONG  {ts_str}  MNQ {price}"
                    print(msg, flush=True)
                    _send_discord(msg)
                    _log_trade(log_path, running_bar_ts, "LONG", price, "V2")
                elif signal == "SHORT":
                    msg = f"V2 SHORT  {ts_str}  MNQ {price}"
                    print(msg, flush=True)
                    _send_discord(msg)
                    _log_trade(log_path, running_bar_ts, "SHORT", price, "V2")
                elif signal == "TAKE_PROFIT":
                    entry_price = state_v2.get("entry_price")
                    pnl_pts = (price - entry_price) / 1.0 if entry_price is not None else None
                    pnl_str = f"  entry {entry_price:.2f}  →  {pnl_pts:+.2f} pts" if pnl_pts is not None else ""
                    msg = f"V2 TAKE PROFIT  {ts_str}  MNQ {price}{pnl_str}"
                    print(msg, flush=True)
                    _send_discord(msg)
                    _log_trade(log_path, running_bar_ts, "EXIT", price, "V2", entry_price, pnl_pts)
            except Exception as e:
                print(f"[V2 process_bar error] {e}", flush=True)

        poll_count += 1
        if poll_count % 6 == 0:
            print(f"[heartbeat] bars={len(bars)} last_ts={last_bar_ts} poll={poll_count}", flush=True)
        time.sleep(V2_POLL_SEC)


if __name__ == "__main__":
    main()
