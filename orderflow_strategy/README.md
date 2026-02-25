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

## Long backtest (1 year L1 or 1 month L2)

Runs your **fixed params** (same as live) over many trading days: **fetches one RTH day at a time**, runs backtest (longs + shorts), **discards raw data** so storage and RAM stay bounded. Uses **mbp-1 (L1)** by default (matches live, smaller size); optional **mbp-10 (L2)** for 1 month.

**Requirements:** `DATABENTO_API_KEY` set (same as live/fetch). Params from `live_signals/params.json` or `data/best_params_v2.json` if present.

**CMD (run from `orderflow_strategy`):**

```cmd
cd c:\Website_design\orderflow_strategy
set DATABENTO_API_KEY=db-your-key-here
python run_long_backtest.py --months 12
```

**Options:**

| Command | Meaning |
|--------|--------|
| `python run_long_backtest.py --months 12` | 1 year of L1 (mbp-1), RTH only, 1-min bars. Deletes each day’s file after run to save space. |
| `python run_long_backtest.py --months 1 --schema mbp-10` | 1 month of L2 (mbp-10). |
| `python run_long_backtest.py --months 12 --dry-run` | Only list days and estimated cost/size; no fetch or backtest. |
| `python run_long_backtest.py --months 12 --keep-files` | Keep `.dbn` files in `data/` after each day (for re-runs without re-fetch). |

**Output:** Overall and by-month (or by-week if 1 month) breakdown: trades, wins, losses, **total PnL in points**, avg PnL per trade, **longs vs shorts** (each with same metrics), and cumulative PnL by day.

**Exact 1-year window (e.g. match subscription “1 year L1” from a start date):**
```cmd
python run_long_backtest.py --start 2025-02-23 --end 2026-02-23
```

**If you see 402 account_insufficient_funds:** Your plan’s “1 year L1” can still require a positive **balance/budget** in the Databento portal (billing → add funds or set budget). If the range is the issue, use `--start` and `--end` so the window falls inside your included history (e.g. from the day you got access).

**If you see 0 MB fetched / 0 trades every day:** The long backtest uses continuous front-month symbol `MNQ.c.0` so each date gets the correct contract. If you ran before this fix, delete `data/long_backtest_trades.jsonl` and re-run.

## Reference

- **V1 baseline:** 15 trades, 93% WR, ~8 pt avg (9 days).
- **V2 (4-day proof):** min_tp_15 → ~22.6 pt avg; min_tp_20 → ~28.1 pt avg with same edge.
