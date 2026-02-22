"""
Run baseline vs experiments on the same 9 days. Each change tested alone and in combination.
Usage: python experiment_runner.py [--days N] [--out data/experiment_results.csv]

Saves baseline as reference, then runs:
- Single-factor: tp_buffer_pts_cob, sl_points_fallback, no_first_minutes, lunch_window, trail_sl_pts, cob_tp_threshold
- Combos: best single-factor ideas combined (e.g. no lunch + tighter tp, no first 15 + tighter sl)
"""
import sys
import json
import argparse
from pathlib import Path
from copy import deepcopy

sys.path.insert(0, str(Path(__file__).parent))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0


def load_baseline():
    p = Path(__file__).parent / "data" / "baseline_params.json"
    if not p.exists():
        raise FileNotFoundError(f"Baseline not found: {p}. Create it from your best run.")
    return json.loads(p.read_text())


def run_all_days(params, days_limit=None, return_details=False):
    """Run backtest on all RTH days. Returns (trades, wins, losses, total_pnl_ticks, details_list)."""
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if days_limit:
        files = files[:days_limit]
    total_trades = total_wins = total_losses = total_pnl = 0
    all_details = []
    for f in files:
        bars, trades_df = load_dbn_streaming(f, freq_sec=BAR_SEC, build_cob=True)
        out = run_backtest(
            bars=bars, trades_df=trades_df, params=params, bar_sec=BAR_SEC,
            return_trade_details=return_details, day_label=f.stem,
        )
        if return_details and isinstance(out, tuple):
            result, details = out
            all_details.extend(details)
        else:
            result = out if not return_details else out[0]
        total_trades += result.trades
        total_wins += result.wins
        total_losses += result.losses
        total_pnl += result.total_pnl_ticks
    wr = total_wins / total_trades if total_trades else 0
    return total_trades, total_wins, total_losses, total_pnl, wr, all_details


def build_experiments():
    """Single-factor and combo experiments. Baseline is not in this list (run separately)."""
    single = []

    # TP: points below COB resistance (0 = at resistance, 2 = baseline)
    for v in [0, 0.5, 1]:
        single.append((f"tp_buffer_pts_cob={v}", {"tp_buffer_pts_cob": v}))

    # SL: tighter fallback (15 = baseline)
    for v in [10, 11, 12, 13]:
        single.append((f"sl_points_fallback={v}", {"sl_points_fallback": v}))

    # No first N minutes (0 = baseline)
    for v in [5, 10, 15]:
        single.append((f"no_first_minutes={v}", {"no_first_minutes": v}))

    # Lunch window (none = baseline)
    for w in ["11-1", "11:30-1", "12-1"]:
        single.append((f"lunch_window={w}", {"lunch_window": w}))

    # Trail SL to BE earlier/later (15 = baseline)
    for v in [10, 20]:
        single.append((f"trail_sl_pts={v}", {"trail_sl_pts": v}))

    # COB threshold for resistance (30 = baseline): only bigger walls = TP further
    for v in [20, 40]:
        single.append((f"cob_tp_threshold={v}", {"cob_tp_threshold": v}))

    # Combos: pair single-factor ideas
    combos = [
        ("no_first_15 + lunch_11:30-1", {"no_first_minutes": 15, "lunch_window": "11:30-1"}),
        ("no_first_15 + sl_12", {"no_first_minutes": 15, "sl_points_fallback": 12}),
        ("lunch_11:30-1 + tp_1pt", {"lunch_window": "11:30-1", "tp_buffer_pts_cob": 1}),
        ("lunch_11:30-1 + sl_12", {"lunch_window": "11:30-1", "sl_points_fallback": 12}),
        ("tp_1pt + sl_12", {"tp_buffer_pts_cob": 1, "sl_points_fallback": 12}),
        ("no_first_15 + tp_1pt", {"no_first_minutes": 15, "tp_buffer_pts_cob": 1}),
        ("no_first_10 + lunch_12-1", {"no_first_minutes": 10, "lunch_window": "12-1"}),
        ("tp_0pt + no_lunch_11:30", {"tp_buffer_pts_cob": 0, "lunch_window": "11:30-1"}),
    ]

    return single, combos


def main():
    ap = argparse.ArgumentParser(description="Run baseline vs experiments; output comparison table")
    ap.add_argument("--days", type=int, default=None, help="Limit to first N days")
    ap.add_argument("--out", type=str, default="", help="Save table to CSV (e.g. data/experiment_results.csv)")
    ap.add_argument("--baseline-only", action="store_true", help="Only run baseline and print entry-time summary")
    ap.add_argument("--single-only", action="store_true", help="Only run single-factor experiments")
    args = ap.parse_args()

    baseline = load_baseline()
    days_msg = f" (first {args.days} days)" if args.days else ""
    print("Baseline params loaded from data/baseline_params.json")
    print(f"Running on {len(list(DATA_DIR.glob('mnq_*_RTH_*.dbn')))} days{days_msg}...")
    print()

    # 1) Run baseline
    t, w, l, pnl, wr, details = run_all_days(baseline, days_limit=args.days, return_details=True)
    baseline_metrics = (t, w, l, pnl, wr)
    print("BASELINE")
    print(f"  trades={t} wins={w} losses={l} pnl={pnl:.1f} ticks wr={100*wr:.1f}%")
    if details:
        losers = [d for d in details if d["pnl_ticks"] <= 0]
        winners = [d for d in details if d["pnl_ticks"] > 0]
        if winners:
            entry_bars_w = [d["minutes_from_open"] for d in winners]
            print(f"  Winners entry (min from open): min={min(entry_bars_w)} max={max(entry_bars_w)} avg={sum(entry_bars_w)/len(entry_bars_w):.0f}")
        if losers:
            entry_bars_l = [d["minutes_from_open"] for d in losers]
            print(f"  Losers  entry (min from open): min={min(entry_bars_l)} max={max(entry_bars_l)} avg={sum(entry_bars_l)/len(entry_bars_l):.0f}")
    print()

    if args.baseline_only:
        return

    single, combos = build_experiments()
    experiments = single if args.single_only else single + combos

    rows = [["experiment", "trades", "wins", "losses", "pnl_ticks", "wr_pct", "delta_pnl", "delta_wr"]]
    rows.append(["BASELINE", t, w, l, round(pnl, 1), round(100 * wr, 1), 0, 0])

    out_path = Path(args.out) if args.out else None
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            f.write(",".join(rows[0]) + "\n")
            f.write(",".join(str(x) for x in rows[1]) + "\n")

    for name, overrides in experiments:
        params = deepcopy(baseline)
        params.update(overrides)
        t, w, l, pnl, wr, _ = run_all_days(params, days_limit=args.days, return_details=False)
        delta_pnl = pnl - baseline_metrics[3]
        delta_wr = 100 * (wr - baseline_metrics[4])
        row = [name, t, w, l, round(pnl, 1), round(100 * wr, 1), round(delta_pnl, 1), round(delta_wr, 1)]
        rows.append(row)
        print(f"  {name}: trades={t} pnl={pnl:.1f} wr={100*wr:.1f}%  (Δpnl={delta_pnl:+.1f} Δwr={delta_wr:+.1f}%)")
        if out_path:
            with open(out_path, "a") as f:
                f.write(",".join(str(x) for x in row) + "\n")

    print()
    print("SUMMARY (vs baseline)")
    print("-" * 90)
    for r in rows:
        print("  ".join(str(x) for x in r))

    if out_path:
        print(f"\nResults appended to {out_path} (saved after each experiment)")


if __name__ == "__main__":
    main()
