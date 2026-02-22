"""
SAFE Databento data fetcher for MNQ.
- ALWAYS checks cost/size BEFORE fetching
- Streams to file (NOT RAM)
- Hard limits to avoid unexpected bills
"""
import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import databento as db

from config import (
    DATASET,
    get_api_key,
    MAX_DAYS_PER_REQUEST,
    MAX_ESTIMATED_COST_USD,
    MAX_ESTIMATED_GB,
    MAX_HOURS_DEFAULT,
    DATA_DIR,
    SCHEMA,
    SYMBOL,
)


def parse_args():
    p = argparse.ArgumentParser(description="Fetch MNQ Level 2 data from Databento (SAFE MODE)")
    p.add_argument("--hours", type=float, default=MAX_HOURS_DEFAULT,
                   help=f"Hours of data (e.g. 0.25=15min). Max ~{MAX_DAYS_PER_REQUEST*24}")
    p.add_argument("--start", type=str, default=None,
                   help="Start datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM), UTC. Default: 4 days ago")
    p.add_argument("--dry-run", action="store_true",
                   help="Only check cost/size, DO NOT fetch (no charge)")
    p.add_argument("--confirm", action="store_true",
                   help="REQUIRED to actually fetch. Without this, only dry-run.")
    p.add_argument("--symbol", type=str, default=SYMBOL,
                   help=f"Symbol (default: {SYMBOL})")
    return p.parse_args()


def main():
    args = parse_args()

    # Compute start/end
    if args.start:
        try:
            if "T" in args.start:
                start_dt = datetime.fromisoformat(args.start.replace("Z", "+00:00"))
            else:
                start_dt = datetime.fromisoformat(args.start + "T00:00:00+00:00")
        except ValueError as e:
            print(f"Invalid --start: {e}")
            sys.exit(1)
    else:
        # Default: 4 days ago, 14:30 UTC = 9:30 AM ET (market open)
        start_dt = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=4)
        start_dt = start_dt.replace(hour=14, minute=30, second=0, microsecond=0)

    end_dt = start_dt + timedelta(hours=float(args.hours))

    # Safety: cap hours
    if float(args.hours) > MAX_DAYS_PER_REQUEST * 24:
        print(f"ERROR: Max {MAX_DAYS_PER_REQUEST} days ({MAX_DAYS_PER_REQUEST*24} hours) per request.")
        sys.exit(1)

    start_str = start_dt.strftime("%Y-%m-%dT%H:%M")
    end_str = end_dt.strftime("%Y-%m-%dT%H:%M")

    print("=" * 60)
    print("DATABENTO FETCH - SAFE MODE")
    print("=" * 60)
    print(f"Dataset:  {DATASET}")
    print(f"Symbol:   {args.symbol} (single contract)")
    print(f"Schema:   {SCHEMA}")
    hrs = float(args.hours)
    print(f"Range:    {start_str} -> {end_str} ({hrs} hrs)")
    print()

    key = get_api_key()
    client = db.Historical(key)

    # STEP 1: Get cost (NO charge for this call)
    print("Checking cost (no charge)...")
    try:
        cost_usd = client.metadata.get_cost(
            dataset=DATASET,
            start=start_str,
            end=end_str,
            symbols=args.symbol,
            schema=SCHEMA,
            stype_in="raw_symbol",
        )
        cost_usd = float(cost_usd)
    except Exception as e:
        print(f"ERROR getting cost: {e}")
        sys.exit(1)

    # STEP 2: Get billable size (NO charge)
    print("Checking size...")
    try:
        size_bytes = client.metadata.get_billable_size(
            dataset=DATASET,
            start=start_str,
            end=end_str,
            symbols=args.symbol,
            schema=SCHEMA,
            stype_in="raw_symbol",
        )
        size_bytes = int(size_bytes)
    except Exception as e:
        print(f"ERROR getting size: {e}")
        sys.exit(1)

    size_gb = size_bytes / (1024**3)
    print()
    print(f"  Estimated cost:  ${cost_usd:.2f} USD")
    print(f"  Estimated size:  {size_gb:.2f} GB ({size_bytes:,} bytes)")
    print()

    # SAFETY CHECKS
    if cost_usd > MAX_ESTIMATED_COST_USD:
        print(f"BLOCKED: Cost ${cost_usd:.2f} exceeds limit ${MAX_ESTIMATED_COST_USD}")
        print("Reduce --hours or edit config.MAX_ESTIMATED_COST_USD (not recommended).")
        sys.exit(1)
    if size_gb > MAX_ESTIMATED_GB:
        print(f"BLOCKED: Size {size_gb:.2f} GB exceeds limit {MAX_ESTIMATED_GB} GB")
        print("Reduce --hours or edit config.MAX_ESTIMATED_GB")
        sys.exit(1)

    if args.dry_run or not args.confirm:
        if not args.confirm:
            print("DRY RUN (no data fetched). Add --confirm to actually fetch.")
        else:
            print("DRY RUN only (--dry-run was set).")
        print("No charges incurred.")
        sys.exit(0)

    # STEP 3: Fetch - stream directly to file (minimal RAM)
    out_file = DATA_DIR / f"mnq_{args.symbol}_{start_dt.strftime('%Y%m%d_%H%M')}_{int(hrs*60)}m.dbn"
    print(f"Fetching to: {out_file}")
    print("(streaming to disk, not loading into RAM)")
    print()

    try:
        store = client.timeseries.get_range(
            dataset=DATASET,
            start=start_str,
            end=end_str,
            symbols=args.symbol,
            schema=SCHEMA,
            stype_in="raw_symbol",
            path=str(out_file),
        )
        print(f"Done. File: {out_file}")
        print(f"Size on disk: {out_file.stat().st_size / (1024**2):.1f} MB")
    except Exception as e:
        print(f"ERROR fetching: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
