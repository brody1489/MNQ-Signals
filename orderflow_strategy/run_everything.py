"""
One-and-done: full 9-day comparison + all experiment phases + tick entry replay. Auto-saves after each step.
Resume: re-run this script; it skips steps that already have output. ~1–1.5 hrs total.
Usage: double-click run.cmd   or   cd orderflow_strategy && python run_everything.py
"""
import csv
import json
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from config import DATA_DIR
from backtest_engine import load_dbn_streaming, run_backtest

BAR_SEC = 60.0
NINE_DAY_CSV = DATA_DIR / "full_9day_comparison.csv"
NINE_DAY_TXT = DATA_DIR / "full_9day_comparison.txt"
EXP_CSV = DATA_DIR / "experiment_results_v2.csv"
BEST_JSON = DATA_DIR / "best_params_v2.json"
ENTRY_SENSITIVITY_TXT = DATA_DIR / "entry_sensitivity.txt"
FIRST_4DAY_TXT = DATA_DIR / "first_4day_summary.txt"  # 4-day proof: ~1 trade/day, 22–28 pt avg
EXP_FIELDS = ["phase", "config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"]


def get_base():
    return json.loads((DATA_DIR / "baseline_params.json").read_text())


def get_9day_configs():
    base = get_base()
    return [
        ("V1_baseline", base),
        ("V2_min_tp_15", {**base, "min_tp_pts_above_entry": 15}),
        ("V2_min_tp_20", {**base, "min_tp_pts_above_entry": 20}),
        ("V2_min_tp_25", {**base, "min_tp_pts_above_entry": 25}),
        ("V2_trail_25", {**base, "trail_sl_pts": 25}),
        ("V2_trail_0", {**base, "trail_sl_pts": 0}),
        ("V2_min_tp_15_trail_25", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}),
        ("V2_min_tp_20_trail_25", {**base, "min_tp_pts_above_entry": 20, "trail_sl_pts": 25}),
        ("V2_no_reversal_bos", {**base, "exit_on_reversal_bos": False}),
        ("V2_hold_until_reversal", {**base, "tp_style": "hold", "max_hold_bars": 120}),
        ("V2_cob_buffer_0.5", {**base, "min_tp_pts_above_entry": 15, "tp_buffer_pts_cob": 0.5}),
        ("V2_cob_buffer_1", {**base, "min_tp_pts_above_entry": 15, "tp_buffer_pts_cob": 1.0}),
        ("V2_select", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25, "max_trades_per_day": 3, "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3}),
    ]


def get_phase_configs(phase):
    base = get_base()
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    if phase == "A":
        return [
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
    if phase == "B":
        return [
            ("B_trail_0", {**base_v2, "trail_sl_pts": 0}),
            ("B_trail_15", {**base_v2, "trail_sl_pts": 15}),
            ("B_trail_25", {**base_v2, "trail_sl_pts": 25}),
            ("B_trail_35", {**base_v2, "trail_sl_pts": 35}),
        ]
    if phase == "C":
        return [
            ("C_reversal_bos_on", base_v2),
            ("C_reversal_bos_off", {**base_v2, "exit_on_reversal_bos": False}),
            ("C_hold_80", {**base, "tp_style": "hold", "max_hold_bars": 80}),
            ("C_hold_120", {**base, "tp_style": "hold", "max_hold_bars": 120}),
            ("C_hold_150", {**base, "tp_style": "hold", "max_hold_bars": 150}),
        ]
    if phase == "D":
        return [
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
    return []


def run_nine_day():
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        print("No RTH .dbn files in data/")
        return False
    configs = get_9day_configs()
    results = {name: {"trades": 0, "pnl_ticks": 0.0, "wins": 0, "losses": 0} for name, _ in configs}
    for i, f in enumerate(files):
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        for name, params in configs:
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            results[name]["trades"] += r.trades
            results[name]["pnl_ticks"] += r.total_pnl_ticks
            results[name]["wins"] += r.wins
            results[name]["losses"] += r.losses
        print(f"  9-day: {f.name}", flush=True)
    rows = []
    for name, _ in configs:
        d = results[name]
        t = d["trades"]
        pnl_pts = d["pnl_ticks"] * 0.25
        wr = (d["wins"] / t * 100) if t else 0
        avg = (pnl_pts / t) if t else 0
        rows.append({"config": name, "trades": t, "wins": d["wins"], "losses": d["losses"], "wr_pct": round(wr, 1), "pnl_pts": round(pnl_pts, 2), "avg_pts_per_trade": round(avg, 2)})
    with open(NINE_DAY_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"])
        w.writeheader()
        w.writerows(rows)
    lines = ["=== FULL 9-DAY COMPARISON ===\n"] + [f"{r['config']:32} t={r['trades']:2} wr={r['wr_pct']:5}% avg_pts={r['avg_pts_per_trade']:5} pnl={r['pnl_pts']:7}" for r in rows]
    NINE_DAY_TXT.write_text("\n".join(lines))
    print("  Saved", NINE_DAY_CSV, flush=True)
    return True


def run_phase(phase):
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        return []
    configs = get_phase_configs(phase)
    if not configs:
        return []
    results = {name: {"trades": 0, "pnl_ticks": 0.0, "wins": 0, "losses": 0} for name, _ in configs}
    for i, f in enumerate(files):
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        for name, params in configs:
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            results[name]["trades"] += r.trades
            results[name]["pnl_ticks"] += r.total_pnl_ticks
            results[name]["wins"] += r.wins
            results[name]["losses"] += r.losses
        print(f"  Phase {phase}: {f.name}", flush=True)
    rows = []
    for name, _ in configs:
        d = results[name]
        t = d["trades"]
        pnl_pts = d["pnl_ticks"] * 0.25
        wr = (d["wins"] / t * 100) if t else 0
        avg = (pnl_pts / t) if t else 0
        rows.append({"phase": phase, "config": name, "trades": t, "wins": d["wins"], "losses": d["losses"], "wr_pct": round(wr, 1), "pnl_pts": round(pnl_pts, 2), "avg_pts_per_trade": round(avg, 2)})
    write_header = not EXP_CSV.exists()
    with open(EXP_CSV, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=EXP_FIELDS)
        if write_header:
            w.writeheader()
        w.writerows(rows)
    print(f"  Saved Phase {phase} to", EXP_CSV, flush=True)
    return rows


def get_all_params_map():
    m = {}
    for name, params in get_9day_configs():
        m[("9day", name)] = params
    for phase in "A", "B", "C", "D":
        for name, params in get_phase_configs(phase):
            m[(phase, name)] = params
    return m


def pick_best_and_save():
    all_rows = []
    if NINE_DAY_CSV.exists():
        for r in csv.DictReader(open(NINE_DAY_CSV)):
            r["phase"] = "9day"
            all_rows.append(r)
    if EXP_CSV.exists():
        for r in csv.DictReader(open(EXP_CSV)):
            all_rows.append(r)
    if not all_rows:
        print("No results to pick best from.")
        return None
    # Prefer wr >= 70%, then by avg_pts_per_trade
    candidates = [r for r in all_rows if float(r.get("wr_pct", 0)) >= 70 and int(r.get("trades", 0)) >= 1]
    if not candidates:
        candidates = [r for r in all_rows if int(r.get("trades", 0)) >= 1]
    best = max(candidates, key=lambda r: (float(r.get("avg_pts_per_trade", 0)), float(r.get("wr_pct", 0))))
    phase = best.get("phase", "9day")
    config = best["config"]
    params_map = get_all_params_map()
    params = params_map.get((phase, config))
    if not params:
        params = params_map.get(("9day", config))
    if params:
        BEST_JSON.write_text(json.dumps(params, indent=2))
        print(f"\nBest (9-day): {phase} / {config}  wr={best['wr_pct']}%  avg_pts={best['avg_pts_per_trade']}  trades={best['trades']}")
        print("  (The '30 pt avg, 1 trade/day' numbers were from first 4 days only — see data/first_4day_summary.txt)")
        print("  Saved", BEST_JSON, flush=True)
        return params
    return None


def run_first_4day_summary():
    """
    Run best configs on first 4 days only — this is the '4-day proof' window that gave
    ~1 trade/day and 22–28 pt avg (min_tp_15/20). 9-day dilutes that with more, smaller trades.
    """
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))[:4]
    if len(files) < 4:
        return
    base = get_base()
    configs = [
        ("V2_min_tp_15", {**base, "min_tp_pts_above_entry": 15}),
        ("V2_min_tp_20", {**base, "min_tp_pts_above_entry": 20}),
        ("V2_min_tp_25", {**base, "min_tp_pts_above_entry": 25}),
        ("V1_baseline", base),
    ]
    lines = ["=== FIRST 4 DAYS ONLY (same window as '4-day proof': ~1 trade/day, 22–28 pt avg) ===\n"]
    for name, params in configs:
        total_t, total_pnl, total_w = 0, 0.0, 0
        for f in files:
            bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            total_t += r.trades
            total_pnl += r.total_pnl_ticks
            total_w += r.wins
        pnl_pts = total_pnl * 0.25
        avg = (pnl_pts / total_t) if total_t else 0
        wr = (total_w / total_t * 100) if total_t else 0
        lines.append(f"  {name:22} trades={total_t}  wr={wr:.1f}%  pnl_pts={pnl_pts:.1f}  avg_pts={avg:.2f}")
    lines.append("\n(9-day run has more trades → lower avg. This 4-day window is the reference.)")
    FIRST_4DAY_TXT.write_text("\n".join(lines))
    print("  Saved", FIRST_4DAY_TXT, flush=True)


def run_entry_sensitivity(best_params):
    """Theoretical better entry: same edge, enter 1 bar earlier or later (no tick data)."""
    if not best_params:
        return
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        return
    results = []
    for offset, label in [(-1, "1 bar earlier"), (0, "current"), (1, "1 bar later")]:
        params = {**best_params, "entry_bar_offset": offset}
        total_t, total_pnl, total_w = 0, 0.0, 0
        for f in files:
            bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            total_t += r.trades
            total_pnl += r.total_pnl_ticks
            total_w += r.wins
        pnl_pts = total_pnl * 0.25
        avg = (pnl_pts / total_t) if total_t else 0
        wr = (total_w / total_t * 100) if total_t else 0
        results.append((label, total_t, wr, pnl_pts, avg))
        print(f"  Entry {label}: t={total_t} wr={wr:.1f}% avg_pts={avg:.2f}", flush=True)
    lines = ["Entry sensitivity (1-min bars; theoretical ±1 bar)", ""] + [f"  {r[0]:15} trades={r[1]} wr={r[2]:.1f}% pnl_pts={r[3]:.1f} avg_pts={r[4]:.2f}" for r in results]
    ENTRY_SENSITIVITY_TXT.write_text("\n".join(lines))
    print("  Saved", ENTRY_SENSITIVITY_TXT, flush=True)


def main():
    print("=== RUN EVERYTHING (9-day + experiments). Resume by re-running. ===\n", flush=True)
    # Step 1: 9-day comparison
    if not NINE_DAY_CSV.exists():
        print("Step 1: 9-day comparison ...", flush=True)
        run_nine_day()
    else:
        print("Step 1: 9-day already done.", flush=True)
    # Step 2: Experiment phases (skip phases already in CSV)
    done_phases = set()
    if EXP_CSV.exists():
        for r in csv.DictReader(open(EXP_CSV)):
            done_phases.add(r["phase"])
    for phase in "A", "B", "C", "D":
        if phase in done_phases:
            print(f"Step 2: Phase {phase} already done.", flush=True)
            continue
        print(f"Step 2: Phase {phase} ...", flush=True)
        run_phase(phase)
    # Step 3: Best params, 4-day summary, entry sensitivity
    print("\nStep 3: Pick best, 4-day summary, entry sensitivity ...", flush=True)
    best_params = pick_best_and_save()
    print("First 4 days (reference: ~1 trade/day, 22–28 pt avg):", flush=True)
    run_first_4day_summary()
    print("Entry sensitivity (theoretical ±1 bar):", flush=True)
    run_entry_sensitivity(best_params)
    # Step 4: Tick entry replay (4-min window per trade → first tick entry, pts better)
    print("\nStep 4: Tick entry replay (4-min window per trade) ...", flush=True)
    try:
        subprocess.run(
            [sys.executable, str(BASE_DIR / "tick_entry_replay.py")],
            cwd=str(BASE_DIR),
            check=False,
        )
    except Exception as e:
        print(f"  Tick replay skipped: {e}", flush=True)
    print("\nDone. Check data/full_9day_comparison.txt, data/first_4day_summary.txt, data/experiment_results_v2.csv, data/best_params_v2.json, data/entry_sensitivity.txt, data/tick_entry_report.txt", flush=True)


if __name__ == "__main__":
    main()
