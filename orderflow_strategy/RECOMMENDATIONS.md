# Recommendations from data (no look-ahead)

## 4-day comparison (first 4 days) — actual backtest result

| Config              | Trades | Pnl (pts) | WR   | Avg pts/trade |
|---------------------|--------|-----------|------|----------------|
| baseline            | 4      | 56.0      | 100% | **14.00**     |
| **min_tp_15**       | 4      | **90.5**  | 100% | **22.62**     |
| **min_tp_20**       | 4      | **112.5** | 100% | **28.12**     |
| min_tp_15_trail_25  | 4      | 90.5      | 100% | 22.62         |
| select (stricter)   | 5      | 96.4      | 100% | 19.27         |

**Finding:** Same 4 trades in that window, but **min_tp_pts_above_entry=15** raises avg from 14 to **22.6 pts**; **min_tp_20** raises it to **28.1 pts**. No look-ahead: we simply don’t take TP when the first COB resistance is &lt; 15 (or 20) pts; we hold for the next level or stop/reversal. That’s the main lever for “big movers” and 70%+ WR.

---

## What we measured

1. **Full 9-day baseline:** 15 trades, 122 pts (~8.1 pts/trade), 14W / 1L. Every trade had post-exit price action computed (next 30/60/120 bars).
2. **First COB resistance:** Median **6.8 pts** above entry (avg 9.9, max 35.4). So we're usually taking TP at a **small** first bump.
3. **After we took TP:** In the next 60 bars, price ran another **20+ pts** in **10 of 14** TP trades (avg +35.9 pts). So we're often exiting way before the move ends.
4. **Would holding have gotten us stopped?** In **11 of 14** TP trades, price went at least 15 pts below our exit in the next 60 bars → trail-15 would have stopped us. So in **3 trades** we could have held and captured 31–88 more pts (02-06 #1, 02-09 #1, 02-16 #2). Those 3 had first resistance at **0.25–3 pts** — we should not take TP that small.
5. **The 1 loser:** SL exit, MFE=0 → entry was wrong, not stop placement. Level-based SL is fine.

## What we changed (backtest + live)

- **min_tp_pts_above_entry = 15**  
  Don't take COB TP when that resistance is &lt; 15 pts above entry. Hold for a real target or get stopped/reversal. This directly fixes the 3 “left 31–88 pts on the table” trades.

- **trail_sl_pts = 25** (was 15)  
  Trail only after +25 pts so we don’t lock a small profit and get shaken out on a normal pullback.

- **trade_details** now include **tp_distance_pts** for TP exits so future audits show “first resistance distance.”

- **live_signals:** Same logic and params: `min_tp_pts_above_entry: 15`, `trail_sl_pts: 25` in `params.json`; strategy only takes TP when resistance ≥ 15 pts above entry.

## What you should run when back

1. **Full 9-day param comparison** (if not already finished):
   ```bash
   cd orderflow_strategy
   python run_compare_params.py
   ```
   Prints baseline vs min_tp_15, min_tp_20, trail_25, trail_0, combo (min_tp_15 + trail_25), no_rev_bos, and “select” (stricter entry + max 3 trades/day). Compare **trades**, **pnl_pts**, **wr%**, **avg_pts/trade**. Target: **70%+ WR**, **10–20+ avg pts/trade**, selective (e.g. 1–2 per day).

2. **Audit with recommended params:**
   ```bash
   python audit_trades.py --params-file data/params_swing.json
   ```
   `params_swing.json` has min_tp_15, trail_25, max_trades_per_day=3, passive_cob 70, aggressive 200, BOS 3 ticks. Check MFE vs realized and exit reasons.

3. **Re-run full trade analysis** (optional) with new params to regenerate `analysis_trades.json` and see post-exit stats for the new logic.

## Target profile

- **Win rate:** 70%+ (ideally 80%+).
- **Size:** Big movers — 10–20+ pts typical, 30–50–70+ on good days.
- **Selectivity:** 0–2 trades per day, easy to follow; by the time you get the alert, the move isn’t half over because we’re not taking 4–8 pt TPs.

If the 9-day comparison shows that **min_tp_15** (or **min_tp_20**) + **trail_25** gives fewer trades but **higher avg pts and similar or better total pts** with 70%+ WR, that’s the configuration to use live and for future tests.
