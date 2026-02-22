"""
After run_full_9day_comparison.py or experiment_runner_v2.py, read CSV and print best configs.
Optional: write best params to data/best_params_v2.json (from 9-day comparison).
"""
import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

def main():
    # 9-day comparison
    p9 = DATA_DIR / "full_9day_comparison.csv"
    if p9.exists():
        rows = list(csv.DictReader(p9.open()))
        print("=== FULL 9-DAY COMPARISON ===\n")
        # Sort by avg_pts_per_trade desc, then wr_pct
        rows_sorted = sorted(rows, key=lambda r: (float(r["avg_pts_per_trade"]), float(r["wr_pct"])), reverse=True)
        for r in rows_sorted[:15]:
            print(f"  {r['config']:32} t={r['trades']:2} wr={r['wr_pct']:5}% avg_pts={r['avg_pts_per_trade']:5} pnl={r['pnl_pts']:7}")
        best = rows_sorted[0] if rows_sorted else None
        if best and float(best.get("wr_pct", 0)) >= 70:
            # Map config name to params (simplified: we'd need to store params; for now just print)
            print(f"\nBest (wr>=70%): {best['config']} avg_pts={best['avg_pts_per_trade']} wr={best['wr_pct']}%")
    else:
        print("Run run_full_9day_comparison.py first to create full_9day_comparison.csv")

    # Experiment results
    pe = DATA_DIR / "experiment_results_v2.csv"
    if pe.exists():
        rows = list(csv.DictReader(pe.open()))
        print("\n=== EXPERIMENT RESULTS (by phase, best avg_pts) ===\n")
        by_phase = {}
        for r in rows:
            ph = r.get("phase", "?")
            by_phase.setdefault(ph, []).append(r)
        for ph in sorted(by_phase.keys()):
            arr = sorted(by_phase[ph], key=lambda r: float(r.get("avg_pts_per_trade", 0)), reverse=True)
            print(f"  Phase {ph}: best {arr[0]['config']} avg_pts={arr[0]['avg_pts_per_trade']} wr={arr[0]['wr_pct']}%")
    else:
        print("\nRun experiment_runner_v2.py to create experiment_results_v2.csv")

if __name__ == "__main__":
    main()
