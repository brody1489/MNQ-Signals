"""
Set and go: fetch data (within limits) and run tests.
Run this after: cd orderflow_strategy && pip install -r requirements.txt
"""
import sys
from pathlib import Path

# Add this dir for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import DATA_DIR


def main():
    print("=" * 60)
    print("MNQ ORDER FLOW - FETCH + TEST")
    print("=" * 60)
    print()

    # 1. Fetch (auto-confirms, limits enforced in fetch_data.py)
    print("[1/2] Fetching 6 min of MNQH6 MBP-10 (auto-stops if over 1GB or $5)...")
    from fetch_data import main as fetch_main

    # Patch argv so fetch runs with --confirm (no --dry-run)
    orig = sys.argv
    sys.argv = ["fetch_data.py", "--confirm"]
    try:
        fetch_main()
    except SystemExit as e:
        if e.code != 0:
            print("Fetch stopped (limits or error). No test run.")
            sys.exit(e.code)
    finally:
        sys.argv = orig

    print()

    # 2. Report what we got
    dbn_files = list(DATA_DIR.glob("*.dbn"))
    if not dbn_files:
        print("[2/2] No data files. Skipping tests.")
        return

    latest = max(dbn_files, key=lambda p: p.stat().st_mtime)
    size_mb = latest.stat().st_size / (1024**2)
    print(f"[2/2] Data ready: {latest.name} ({size_mb:.1f} MB)")
    print()

    # 3. Run backtest
    print("Running backtest sweep...")
    try:
        from backtest_engine import run_parameter_sweep
        from backtest_params import ParamGrid

        results = run_parameter_sweep(latest, ParamGrid(), max_configs=200)
        print()
        with_trades = [r for r in results if r.trades > 0]
        best = max(with_trades, key=lambda x: x.total_pnl_ticks) if with_trades else None
        print(f"Results: {len(with_trades)}/{len(results)} configs produced trades")
        if best:
            print(f"Best: pnl={best.total_pnl_ticks:.1f} ticks trades={best.trades} wr={best.win_rate:.0%}")
    except Exception as e:
        print(f"(Backtest placeholder - full logic coming: {e})")

    print()
    print("Done. Data in data/ - run again to fetch more (adds new files).")


if __name__ == "__main__":
    main()
