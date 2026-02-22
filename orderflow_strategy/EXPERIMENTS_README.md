# Experiments V2 — what we test and how to run

## Reference

- **V1 baseline:** 15 trades, 93% WR, ~8 pt avg (9 days).
- **V2 (4-day proof):** min_tp_15 → 22.6 pt avg; min_tp_20 → 28.1 pt avg, same trade count in that window.

## Scripts

1. **run_full_9day_comparison.py**  
   Runs all 9 days once, then 13 configs (V1_baseline, V2_min_tp_15, V2_min_tp_20, trail variants, hold_until_reversal, COB buffer, select).  
   Writes: `data/full_9day_comparison.csv`, `data/full_9day_comparison.txt`.

2. **experiment_runner_v2.py**  
   Phased grid; each phase appends to `data/experiment_results_v2.csv`.
   - **Phase A — TP/COB:** tp_buffer_pts_cob (0.5, 1, 2, 3), min_tp_pts (10, 15, 20, 25), cob_tp_threshold (25, 40, 50), session_high.
   - **Phase B — Trail:** trail_sl_pts 0, 15, 25, 35.
   - **Phase C — Exit:** reversal_bos on/off, tp_style="hold" (no COB TP; exit only reversal BOS or SL or time), max_hold_bars 80/120/150.
   - **Phase D — Entry:** passive_cob 60/70, passive_bars 4, aggressive_vol 200/250, bos_ticks 3/4, bounce_bars 5, combo strict.

   Run all: `python experiment_runner_v2.py --phase all`  
   Or one phase: `python experiment_runner_v2.py --phase A`

## Engine change

- **tp_style="hold":** No TP at COB; exit only on reversal BOS, SL, or time (max_hold_bars). “Let it run until exhaustion.”

## Entry timing (30 sec earlier)

- We use 1-min bars; “enter 30 sec earlier” would need 30-sec (or tick) bars. Not in this run; can be added later if we build 30s bars from raw data.
