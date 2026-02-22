# Orderflow strategy — backtest + find THE edge

## One command (you run it)

1. Open CMD.
2. `cd c:\Website_design\orderflow_strategy`
3. Run **one** of these:
   - **`run.cmd`** (double-click or type `run.cmd`), or  
   - **`python run_everything.py`**

That script:

- Runs the **full 9-day comparison** (V1 baseline vs V2 and variants), then **all experiment phases** (A: TP/COB, B: trail, C: exit, D: entry).
- **Saves after each step.** If you stop it or it crashes, run the same command again; it **resumes** (skips 9-day if the file exists, skips phases already in the CSV).
- Picks the **best config** (70%+ WR, then highest avg pts), writes **`data/best_params_v2.json`**.
- Runs **entry sensitivity** (theoretical entry 1 bar earlier / same / 1 bar later on 1-min bars) and writes **`data/entry_sensitivity.txt`**.

Rough runtime: about 1–1.5 hours (one day in memory at a time to limit RAM).

## Output files (in `data/`)

| File | Meaning |
|------|--------|
| `full_9day_comparison.csv` / `.txt` | V1 vs V2 and variants over 9 days. |
| `experiment_results_v2.csv` | Phases A–D (TP/COB, trail, exit, entry tweaks). |
| `best_params_v2.json` | Best params from the run (use for live / further tests). |
| `entry_sensitivity.txt` | Result of testing entry ±1 bar (no tick data). |

## Resume

Re-run **`run.cmd`** or **`python run_everything.py`**. It will skip any step that already has output and continue from the next one.

## Reference

- **V1 baseline:** 15 trades, 93% WR, ~8 pt avg (9 days).
- **V2 (4-day proof):** min_tp_15 → ~22.6 pt avg; min_tp_20 → ~28.1 pt avg with same edge.
