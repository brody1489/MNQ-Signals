"""
Phased experiments on all 9 days. Each phase appends to data/experiment_results_v2.csv.
No look-ahead. Run: python experiment_runner_v2.py [--phase A|B|C|D|all]
"""
import json
import sys
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
OUT_CSV = DATA_DIR / "experiment_results_v2.csv"
FIELDS = ["phase", "config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"]


def get_base():
    return json.loads((DATA_DIR / "baseline_params.json").read_text())


def run_configs(config_list, phase_name, days_limit=None):
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if days_limit:
        files = files[: days_limit]
    if not files:
        return []
    rows = []
    for name, params in config_list:
        total_t, total_pnl, total_w, total_l = 0, 0.0, 0, 0
        for f in files:
            bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            total_t += r.trades
            total_pnl += r.total_pnl_ticks
            total_w += r.wins
            total_l += r.losses
        pnl_pts = total_pnl * 0.25
        wr = (total_w / total_t * 100) if total_t else 0
        avg = (pnl_pts / total_t) if total_t else 0
        row = {"phase": phase_name, "config": name, "trades": total_t, "wins": total_w, "losses": total_l, "wr_pct": round(wr, 1), "pnl_pts": round(pnl_pts, 2), "avg_pts_per_trade": round(avg, 2)}
        rows.append(row)
        print(f"  {name:45} t={total_t:2} wr={wr:5.1f}% avg_pts={avg:5.2f} pnl={pnl_pts:7.1f}", flush=True)
    return rows


def phase_a_tp_cob(days_limit=None):
    """A: TP/COB — buffer, min_tp_pts, cob_tp_threshold."""
    base = get_base()
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    configs = [
        ("A_cob_buffer_0.5", {**base_v2, "tp_buffer_pts_cob": 0.5}),
        ("A_cob_buffer_1", {**base_v2, "tp_buffer_pts_cob": 1.0}),
        ("A_cob_buffer_2", {**base_v2, "tp_buffer_pts_cob": 2.0}),
        ("A_cob_buffer_3", {**base_v2, "tp_buffer_pts_cob": 3.0}),
        ("A_min_tp_10", {**base_v2, "min_tp_pts_above_entry": 10}),
        ("A_min_tp_15", base_v2),
        ("A_min_tp_20", {**base_v2, "min_tp_pts_above_entry": 20}),
        ("A_min_tp_25", {**base_v2, "min_tp_pts_above_entry": 25}),
        ("A_cob_thresh_25", {**base_v2, "cob_tp_threshold": 25}),
        ("A_cob_thresh_40", {**base_v2, "cob_tp_threshold": 40}),
        ("A_cob_thresh_50", {**base_v2, "cob_tp_threshold": 50}),
        ("A_session_high", {**base, "tp_style": "session_high", "trail_sl_pts": 25, "min_run_pts": 15}),
    ]
    return run_configs(configs, "A", days_limit)


def phase_b_trail(days_limit=None):
    """B: Trail — 0, 15, 25, 35; let run vs lock."""
    base = get_base()
    base_v2 = {**base, "min_tp_pts_above_entry": 15}
    configs = [
        ("B_trail_0", {**base_v2, "trail_sl_pts": 0}),
        ("B_trail_15", {**base_v2, "trail_sl_pts": 15}),
        ("B_trail_25", {**base_v2, "trail_sl_pts": 25}),
        ("B_trail_35", {**base_v2, "trail_sl_pts": 35}),
    ]
    return run_configs(configs, "B", days_limit)


def phase_c_exit(days_limit=None):
    """C: Exit logic — reversal BOS on/off, hold until reversal only, max_hold."""
    base = get_base()
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    configs = [
        ("C_reversal_bos_on", base_v2),
        ("C_reversal_bos_off", {**base_v2, "exit_on_reversal_bos": False}),
        ("C_hold_80", {**base, "tp_style": "hold", "max_hold_bars": 80}),
        ("C_hold_120", {**base, "tp_style": "hold", "max_hold_bars": 120}),
        ("C_hold_150", {**base, "tp_style": "hold", "max_hold_bars": 150}),
    ]
    return run_configs(configs, "C", days_limit)


def phase_d_entry(days_limit=None):
    """D: Entry tweaks — passive, aggressive, BOS, bounce (same edge, better entry)."""
    base = get_base()
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    configs = [
        ("D_baseline_v2", base_v2),
        ("D_passive_cob_70", {**base_v2, "passive_cob_threshold": 70}),
        ("D_passive_cob_60", {**base_v2, "passive_cob_threshold": 60}),
        ("D_passive_bars_4", {**base_v2, "min_passive_accumulation_count": 4}),
        ("D_agg_200", {**base_v2, "aggressive_min_volume": 200}),
        ("D_agg_250", {**base_v2, "aggressive_min_volume": 250}),
        ("D_bos_3", {**base_v2, "bos_min_break_ticks": 3}),
        ("D_bos_4", {**base_v2, "bos_min_break_ticks": 4}),
        ("D_bounce_5", {**base_v2, "bounce_bars": 5}),
        ("D_combo_strict", {**base_v2, "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3}),
    ]
    return run_configs(configs, "D", days_limit)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", choices=["A", "B", "C", "D", "all"], default="all")
    ap.add_argument("--days", type=int, default=None, help="Limit to first N days (default: all 9)")
    args = ap.parse_args()
    days_limit = args.days
    if days_limit:
        print(f"Using first {days_limit} days", flush=True)
    write_header = not OUT_CSV.exists()
    all_rows = []
    if args.phase in ("A", "all"):
        print("Phase A: TP/COB", flush=True)
        all_rows.extend(phase_a_tp_cob(days_limit))
    if args.phase in ("B", "all"):
        print("Phase B: Trail", flush=True)
        all_rows.extend(phase_b_trail(days_limit))
    if args.phase in ("C", "all"):
        print("Phase C: Exit logic", flush=True)
        all_rows.extend(phase_c_exit(days_limit))
    if args.phase in ("D", "all"):
        print("Phase D: Entry tweaks", flush=True)
        all_rows.extend(phase_d_entry(days_limit))

    if all_rows:
        with open(OUT_CSV, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            if write_header:
                w.writeheader()
            w.writerows(all_rows)
        print("Appended to", OUT_CSV, flush=True)


if __name__ == "__main__":
    main()
