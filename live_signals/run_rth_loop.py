"""
Wrapper: run the live signal loop only during RTH (9:30 AM - 4:00 PM ET).
Outside RTH, sleep until next 9:30 AM ET. Use this when deployed (Railway, VPS)
so the process stays up 24/7 but only does work during market hours.
"""
import time
from datetime import datetime, timedelta
from pathlib import Path

# Ensure we can import from this package
Path(__file__).resolve().parent
import run

from config import RTH_START_ET, RTH_END_ET, EST


def _next_rth_start():
    """Return next 9:30 AM ET as datetime."""
    now = datetime.now(EST)
    start = now.replace(hour=RTH_START_ET[0], minute=RTH_START_ET[1], second=0, microsecond=0)
    if now < start:
        return start
    return start + timedelta(days=1)


def _sleep_until(target: datetime):
    """Sleep until target (in EST)."""
    now = datetime.now(EST)
    delta = (target - now).total_seconds()
    if delta > 0:
        time.sleep(delta)


if __name__ == "__main__":
    print("Live signals process started.", flush=True)
    print("RTH loop: will run live signals only during 9:30 AM - 4:00 PM ET. Ctrl+C to stop.", flush=True)
    while True:
        if not run.in_rth():
            next_start = _next_rth_start()
            print(f"Outside RTH. Sleeping until {next_start.strftime('%Y-%m-%d %I:%M %p')} ET.", flush=True)
            _sleep_until(next_start)
            continue
        print("RTH started. Running live signal loop.", flush=True)
        try:
            run.main()
        except Exception as e:
            print(f"Live loop error (will retry next session): {e}", flush=True)
        print("RTH ended. Sleeping until next session.", flush=True)
