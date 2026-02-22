"""
Master test suite: all phases in order, auto-save after each phase, low RAM (one day at a time).
TP methods, trail, entry, time filters, research combos, pick best, entry sensitivity, 4-day summary, tick replay.
Resume: re-run; skips phases that already have results in data/master_results.csv.
Usage: run_master.cmd  or  cd orderflow_strategy && python run_master.py
"""
from __future__ import annotations

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
MASTER_CSV = DATA_DIR / "master_results.csv"
BEST_JSON = DATA_DIR / "best_params_v2.json"
ENTRY_SENSITIVITY_TXT = DATA_DIR / "entry_sensitivity.txt"
FIRST_4DAY_TXT = DATA_DIR / "first_4day_summary.txt"
FIELDS = ["phase", "config", "trades", "wins", "losses", "wr_pct", "pnl_pts", "avg_pts_per_trade"]


def get_base():
    return json.loads((DATA_DIR / "baseline_params.json").read_text())


def get_all_master_configs():
    """Returns [(phase_id, config_name, params), ...]. phase_id is int 0..4 for backtest phases."""
    base = get_base()
    out = []

    # Phase 0: TP methods (cob min_tp, hold, hold+trail_act, exhaustion, session_high, cob_thresh)
    out.append((0, "TP_min_tp_0", {**base, "trail_sl_pts": 25}))
    for x in [10, 15, 20, 25, 30]:
        out.append((0, f"TP_min_tp_{x}", {**base, "min_tp_pts_above_entry": x, "trail_sl_pts": 25}))
    out.append((0, "TP_hold_120", {**base, "tp_style": "hold", "trail_sl_pts": 25, "max_hold_bars": 120}))
    out.append((0, "TP_hold_trail_act_25", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 25, "max_hold_bars": 120}))
    out.append((0, "TP_hold_trail_act_30", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "max_hold_bars": 120}))
    out.append((0, "TP_hold_exhaustion", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "exit_on_exhaustion": True, "max_hold_bars": 120}))
    out.append((0, "TP_session_high", {**base, "tp_style": "session_high", "trail_sl_pts": 25, "min_run_pts": 15}))
    for thresh in [30, 40, 50]:
        out.append((0, f"TP_cob_thresh_{thresh}", {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25, "cob_tp_threshold": thresh}))

    # Phase 1: Trail (0, 15, 25, 35; hold with trail_activation 0/25/30)
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "tp_style": "cob"}
    for trail in [0, 15, 25, 35]:
        out.append((1, f"Trail_{trail}", {**base_v2, "trail_sl_pts": trail}))
    out.append((1, "Trail_hold_act_0", {**base, "tp_style": "hold", "trail_sl_pts": 25, "max_hold_bars": 120}))
    for a in [25, 30]:
        out.append((1, f"Trail_hold_act_{a}", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": a, "max_hold_bars": 120}))

    # Phase 2: Entry (passive_cob, agg, BOS, max_trades, bounce)
    base_v2 = {**base, "min_tp_pts_above_entry": 15, "trail_sl_pts": 25}
    for cob in [50, 70]:
        out.append((2, f"Entry_cob_{cob}", {**base_v2, "passive_cob_threshold": cob}))
    for agg in [150, 200, 250]:
        out.append((2, f"Entry_agg_{agg}", {**base_v2, "aggressive_min_volume": agg}))
    for bos in [2, 3, 4]:
        out.append((2, f"Entry_bos_{bos}", {**base_v2, "bos_min_break_ticks": bos}))
    for mx in [1, 2, 3, 5]:
        out.append((2, f"Entry_max_trades_{mx}", {**base_v2, "max_trades_per_day": mx}))
    for b in [3, 5]:
        out.append((2, f"Entry_bounce_{b}", {**base_v2, "bounce_bars": b}))
    out.append((2, "Entry_combo_strict", {**base_v2, "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3, "max_trades_per_day": 2}))

    # Phase 3: Time (no_first, lunch)
    for no_first in [0, 15, 30]:
        out.append((3, f"Time_no_first_{no_first}", {**base_v2, "no_first_minutes": no_first}))
    out.append((3, "Time_lunch_skip", {**base_v2, "lunch_window": "11:30-1"}))
    out.append((3, "Time_no_first_15_lunch", {**base_v2, "no_first_minutes": 15, "lunch_window": "11:30-1"}))

    # Phase 4: Research combos (from articles: strict entry + hold + trail_act + exhaustion; min_tp 30 max 1; etc.)
    out.append((4, "R_strict_hold_act30_exh", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "exit_on_exhaustion": True, "max_hold_bars": 120, "passive_cob_threshold": 70, "aggressive_min_volume": 200, "bos_min_break_ticks": 3, "max_trades_per_day": 2}))
    out.append((4, "R_min_tp_30_max1", {**base, "min_tp_pts_above_entry": 30, "trail_sl_pts": 25, "max_trades_per_day": 1}))
    out.append((4, "R_min_tp_40_max1", {**base, "min_tp_pts_above_entry": 40, "trail_sl_pts": 25, "max_trades_per_day": 1}))
    out.append((4, "R_hold_act30_max2", {**base, "tp_style": "hold", "trail_sl_pts": 25, "trail_activation_pts": 30, "max_hold_bars": 150, "max_trades_per_day": 2}))
    out.append((4, "R_cob50_min_tp_25", {**base, "cob_tp_threshold": 50, "min_tp_pts_above_entry": 25, "trail_sl_pts": 25}))

    return out


def get_configs_by_phase(phase_id: int):
    return [(name, params) for p, name, params in get_all_master_configs() if p == phase_id]


def get_params_map():
    return {(str(phase), name): params for phase, name, params in get_all_master_configs()}


def run_phase(phase_id: int):
    configs = get_configs_by_phase(phase_id)
    if not configs:
        return
    files = sorted(DATA_DIR.glob("mnq_*_RTH_*.dbn"))
    if not files:
        return
    results = {name: {"trades": 0, "pnl_ticks": 0.0, "wins": 0, "losses": 0} for name, _ in configs}
    for f in files:
        bars, tr = load_dbn_streaming(f, freq_sec=BAR_SEC)
        for name, params in configs:
            r = run_backtest(bars=bars, trades_df=tr, params=params, bar_sec=BAR_SEC)
            results[name]["trades"] += r.trades
            results[name]["pnl_ticks"] += r.total_pnl_ticks
            results[name]["wins"] += r.wins
            results[name]["losses"] += r.losses
        print(f"  Phase {phase_id}: {f.name}", flush=True)
    rows = []
    for name, _ in configs:
        d = results[name]
        t = d["trades"]
        pnl_pts = d["pnl_ticks"] * 0.25
        wr = (d["wins"] / t * 100) if t else 0
        avg = (pnl_pts / t) if t else 0
        rows.append({"phase": str(phase_id), "config": name, "trades": t, "wins": d["wins"], "losses": d["losses"], "wr_pct": round(wr, 1), "pnl_pts": round(pnl_pts, 2), "avg_pts_per_trade": round(avg, 2)})
    write_header = not MASTER_CSV.exists()
    with open(MASTER_CSV, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if write_header:
            w.writeheader()
        w.writerows(rows)
    print(f"  Saved Phase {phase_id} to {MASTER_CSV}", flush=True)


def phases_done():
    if not MASTER_CSV.exists():
        return set()
    return {r["phase"] for r in csv.DictReader(open(MASTER_CSV))}


def pick_best_and_save():
    if not MASTER_CSV.exists():
        print("No master_results.csv")
        return None
    params_map = get_params_map()
    all_rows = list(csv.DictReader(open(MASTER_CSV)))
    if not all_rows:
        return None
    candidates = [r for r in all_rows if float(r.get("wr_pct", 0)) >= 70 and int(r.get("trades", 0)) >= 1]
    if not candidates:
        candidates = [r for r in all_rows if int(r.get("trades", 0)) >= 1]
    best = max(candidates, key=lambda r: (float(r.get("avg_pts_per_trade", 0)), float(r.get("wr_pct", 0))))
    key = (best["phase"], best["config"])
    params = params_map.get(key)
    if params:
        BEST_JSON.write_text(json.dumps(params, indent=2))
        print(f"\nBest: phase {best['phase']} / {best['config']}  wr={best['wr_pct']}%  avg_pts={best['avg_pts_per_trade']}  trades={best['trades']}")
        print("  Saved", BEST_JSON, flush=True)
        return params
    return None


def run_entry_sensitivity(best_params):
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
    lines = ["Entry sensitivity (1-min bars)", ""] + [f"  {r[0]:15} trades={r[1]} wr={r[2]:.1f}% pnl_pts={r[3]:.1f} avg_pts={r[4]:.2f}" for r in results]
    ENTRY_SENSITIVITY_TXT.write_text("\n".join(lines))
    print("  Saved", ENTRY_SENSITIVITY_TXT, flush=True)


def run_first_4day_summary():
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
    lines = ["=== FIRST 4 DAYS ONLY ===\n"]
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
    FIRST_4DAY_TXT.write_text("\n".join(lines))
    print("  Saved", FIRST_4DAY_TXT, flush=True)


def main():
    print("=== MASTER TEST SUITE (all phases, auto-save, resume-safe) ===\n", flush=True)
    # Backtest phases 0..4
    for phase_id in range(5):
        done = phases_done()
        if str(phase_id) in done:
            print(f"Phase {phase_id} already done.", flush=True)
            continue
        print(f"Phase {phase_id} ...", flush=True)
        run_phase(phase_id)

    # Phase 5: best + entry sensitivity + 4-day summary
    print("\nPhase 5: Pick best, entry sensitivity, 4-day summary ...", flush=True)
    best_params = pick_best_and_save()
    print("Entry sensitivity:", flush=True)
    run_entry_sensitivity(best_params)
    print("First 4 days:", flush=True)
    run_first_4day_summary()

    # Phase 6: tick replay
    print("\nPhase 6: Tick entry replay ...", flush=True)
    try:
        subprocess.run([sys.executable, str(BASE_DIR / "tick_entry_replay.py")], cwd=str(BASE_DIR), check=False)
    except Exception as e:
        print(f"  Tick replay skipped: {e}", flush=True)

    print("\nDone. Check data/master_results.csv, data/best_params_v2.json, data/entry_sensitivity.txt, data/first_4day_summary.txt, data/tick_entry_report.txt", flush=True)


if __name__ == "__main__":
    main()
