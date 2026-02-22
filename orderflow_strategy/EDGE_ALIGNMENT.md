# Edge alignment: why ~8 pt average vs your 10–20+ pt “swing” intent

## What the baseline actually did (9 days)

- **15 trades**, 122 pts total → **~8.1 pts per trade**.
- **14 wins, 1 loss** (one SL on Feb 13).
- Almost every exit was **TP** (first COB resistance above entry). The loser was **SL** (never went in our favor).

## Per-trade reality check

| Day   | Trades | Pnl (pts) | Notes |
|-------|--------|-----------|--------|
| 02-05 | 2      | 35.4, 17.5 | **Big** — your style |
| 02-06 | 1      | 2.9  | Small; MFE 4.75 |
| 02-09 | 1      | 0.25 | Tiny; MFE 2.12 |
| 02-10 | 2      | 4.0, 5.4 | Small |
| 02-11 | 2      | 8.4, 4.3 | Mixed |
| 02-12 | 2      | 8.3, 16.0 | One big, one small |
| 02-13 | 3      | 23.6, **-15**, 1.0 | One big, one loser, one tiny |
| 02-16 | 2      | 8.6, 3.0 | Mixed |

So we *do* get a few 15–35 pt winners, but we also take many 1–8 pt “bumps” that don’t match your described edge (long setup, then 10–20+ minimum, often 30–70–100+).

---

## 1:1 gap: what the code does vs what you want

### Your edge (from your description)

1. **Setup time:** 30–60–120–240 minutes of context (passive accumulation at a level, retest, bounce, BOS, aggressive).
2. **Entry:** “Perfect” entry after that setup — you’d mark it on a screenshot (e.g. 11:30, 11:43, 12:02, 12:05 = passive accumulation, then long).
3. **Hold time:** In the trade 5–30+ minutes (sometimes more), not in-and-out for a few points.
4. **Target:** Minimum easy 10–20 pts; often 30, 50, 70, 100+ from an ideal entry.

### What the code does today

1. **Entry sequence:** Matches you conceptually (passive at level → retest → bounce → BOS → aggressive). **But** it takes *every* setup that passes the filters. Many of these are “small bubble” moves (MFE 2–10 pts), not the “big bubble” you’re trading on screenshots.
2. **TP:** We exit at the **first** COB resistance above entry (with a small buffer, e.g. 0.5–2 pts). That first resistance is often only 5–10 pts away → we lock 5–10 pts and never see the 30–100 pt expansion.
3. **Trail:** At +15 pts we move SL to entry − 2. So any pullback after a small run gets us out at ~+13. That’s “scalp” behavior, not “hold for the big move.”
4. **Reversal BOS:** We exit on first bearish BOS. That can be a small pullback; price often continues up afterward → we cut runners early.
5. **Selectivity:** No filter for “this move is big enough to be worth it.” We don’t require a minimum run from level, or a minimum distance to first resistance, so we take small and big setups alike.

So: **entries are in the right “family” but not filtered for “big move only”; exits are tuned for small, quick TP and tight trail**, which pulls the average down to ~8 pts.

---

## What we’re doing “right”

- Same **sequence**: passive → retest → bounce → BOS → aggressive.
- **TP only at real heatmap resistance** (no random fixed PT).
- **SL under support** (level-based), with cap.
- **No look-ahead**; all bar-by-bar.

---

## What to change to get 1:1 with your edge

### 1. Hold longer / don’t TP at first tiny resistance

- **Add `min_tp_pts_above_entry`:** Only take COB TP if that resistance is at least X pts above entry (e.g. 15 or 20). Ignore the first small “bump” and hold for a real target.
- **Optional:** Prefer “second” COB resistance (next ceiling) instead of the nearest one, so we don’t exit at the first 5–10 pt wall.

### 2. Trail later (don’t scalp the runner)

- **Increase `trail_sl_pts`** from 15 to 25–30+ so we don’t lock +15 and then get stopped on a normal pullback.
- **Optional:** Only start trailing after we’ve reached a first target (e.g. trail only after +20 pts).

### 3. More selective entries (fewer, bigger setups)

- **Stronger passive accumulation:** More bars (e.g. 4+) and/or higher `passive_cob_threshold` (e.g. 70).
- **Larger BOS:** `bos_min_break_ticks` 3–4 so we only enter on a clear break, not a 2-tick wiggle.
- **Optional:** Require a minimum “run” from level to entry (e.g. entry must be at least X pts above the accumulation low) so we’re not entering on a 1–2 pt bounce.

### 4. Reversal BOS

- **Option A:** Turn off `exit_on_reversal_bos` and rely on SL + TP only (simplest “hold the runner”).
- **Option B:** Only exit on reversal BOS after we’ve already moved the trail (e.g. after +20 pts), so we don’t exit on the first small pullback.

### 5. Cap trades per day (optional)

- **`max_trades_per_day`:** Already effectively 5 in code. For “swing” style you might set 2–3 so we only take the clearest setups.

---

## What’s in code now

- **`min_tp_pts_above_entry`:** Only take COB TP when that resistance is at least this many pts above entry (default 0 = off). Set to 15 or 20 to hold for bigger targets.
- **`max_trades_per_day`:** Cap trades per day (default 5). Set to 2–3 for “swing” selectivity.
- **Swing preset:** `data/params_swing.json` — same edge, but: `min_tp_pts_above_entry=15`, `trail_sl_pts=25`, `max_trades_per_day=3`, stricter entry (4 passive bars, COB 70, BOS 3 ticks, agg vol 200).

**Compare baseline vs swing:**

```bash
python audit_trades.py --params-file data/baseline_params.json
python audit_trades.py --params-file data/params_swing.json
```

Check total trades, total pts, avg pts per trade, and MFE vs realized. If swing gives fewer trades but 10–20+ pt average, we’re aligned; then you can tune `min_tp_pts_above_entry` / `trail_sl_pts` / entry filters further.

Once you have screenshots with exact times/levels, we can add filters (e.g. “only if passive accumulation in last 60 min” or “entry bar between 11:00–14:00”) to get even closer to a “mini me” of your edge.
