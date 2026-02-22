"""
Run thousands of configs, output best params.
Usage: python optimize.py [--configs 2000] [--data path/to/file.dbn]
"""
import argparse
from pathlib import Path

from config import DATA_DIR
from backtest_engine import load_dbn, run_backtest, run_parameter_sweep, get_best_params
from backtest_params import ParamGrid


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--configs", type=int, default=500, help="Max param configs to test")
    p.add_argument("--data", type=str, default=None, help="DBN file (default: latest in data/)")
    args = p.parse_args()

    if args.data:
        dbn_path = Path(args.data)
    else:
        files = list(DATA_DIR.glob("*.dbn"))
        if not files:
            print("No .dbn files. Run fetch_data.py --confirm first.")
            return
        dbn_path = max(files, key=lambda x: x.stat().st_mtime)

    print(f"Data: {dbn_path.name}")
    print(f"Running {args.configs} configs...")
    results = run_parameter_sweep(dbn_path, ParamGrid(), max_configs=args.configs)

    # Filter to configs that produced trades
    with_trades = [r for r in results if r.trades > 0]
    print(f"\nConfigs with trades: {len(with_trades)} / {len(results)}")

    if not with_trades:
        print("No configs produced trades. Try more data or looser params.")
        return

    best_pnl = get_best_params(with_trades, "total_pnl_ticks")
    best_sharpe = get_best_params(with_trades, "sharpe") if any(r.sharpe is not None for r in with_trades) else None

    print("\n" + "=" * 60)
    print("BEST BY PNL (ticks)")
    print("=" * 60)
    print(f"  trades={best_pnl.trades} wins={best_pnl.wins} losses={best_pnl.losses}")
    print(f"  pnl_ticks={best_pnl.total_pnl_ticks:.1f} win_rate={best_pnl.win_rate:.0%}")
    print(f"  params: {best_pnl.params}")

    if best_sharpe and best_sharpe.sharpe:
        print("\n" + "=" * 60)
        print("BEST BY SHARPE")
        print("=" * 60)
        print(f"  sharpe={best_sharpe.sharpe:.2f} trades={best_sharpe.trades}")
        print(f"  params: {best_sharpe.params}")

    # Top 5 by pnl
    sorted_pnl = sorted(with_trades, key=lambda r: r.total_pnl_ticks, reverse=True)[:5]
    print("\nTop 5 by PNL:")
    for i, r in enumerate(sorted_pnl, 1):
        print(f"  {i}. pnl={r.total_pnl_ticks:.1f} trades={r.trades} wr={r.win_rate:.0%}")


if __name__ == "__main__":
    main()
