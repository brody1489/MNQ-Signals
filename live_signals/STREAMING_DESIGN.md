# Live stream vs 1-minute bars: design note

## Why we use 1-minute bars today

- The strategy was **designed and backtested** on 1-minute bars (passive accumulation, BOS, bounce, aggressive volume over bars). The live pipeline was built to match: fetch last 2 minutes, build 1-min bars, run the same logic so live ≈ backtest.
- So we only "see" a new bar once per minute and only **act at bar close**. That can delay entries/exits by **up to ~60 seconds**.

## Could faster reaction help?

**Yes.** Acting as soon as conditions are met (e.g. 20 seconds into the minute) could:
- Get **better entries** (closer to the actual break).
- **Tighter exits** (hit TP/SL when price hits, not at next bar).
- Avoid the "up to 59 second" lag.

## What’s possible without throwing away the strategy

We can keep the **same 1-minute bar logic** but stop waiting for the bar to close:

1. **Use Databento’s Live (streaming) API** instead of polling Historical — subscribe to MBP-10 (and trades) for the symbol and receive updates in real time.
2. **Build a "running" 1-minute bar** that updates on every MBP/trade (or every N ms): same fields (mid, bid_depth, ask_depth, buy_vol, sell_vol, cob_ask) but updated continuously.
3. **On each update** (or every 1–5 seconds to limit CPU), treat the running bar as the "current" bar and run the same strategy. Fire LONG/TP **as soon** as conditions are met (could be 2s, 30s, or 50s into the minute).

That gives **sub-minute reaction** while reusing the current strategy. Full tick-level logic would be a separate, larger redesign.

## What would need to be built

| Piece | Description |
|-------|-------------|
| **Live client** | Use `databento` Live API (see [Databento Live docs](https://databento.com/docs/api-reference-live/client/live)): connect, subscribe to symbol + MBP-10 (+ trades), handle reconnects. |
| **Running bar** | Same structure as current bar (mid, bid_depth, ask_depth, buy_vol, sell_vol, cob_ask). On each MBP/trade message, update the current bar; on minute boundary, finalize and append to history, start new running bar. |
| **Evaluate on update** | Call `process_bar(bars, current_bar_idx, params, state)` with `bars = history + running_bar`, and `current_bar_idx = len(bars)-1`. Run every tick, or every 1–5 seconds to balance latency vs CPU. |
| **Dedupe signals** | Only send LONG once per entry, TP once per exit (state already tracks `in_position`). |

## Tradeoffs

- **1-min bars (current):** Simple, matches backtest exactly, low CPU, but up to ~60s delay.
- **Running bar + stream:** Same strategy, faster reaction (seconds), better potential entries/exits; requires Live subscription, more code, and more CPU (or throttle to e.g. every 5s).

---

## Backtesting V2 (sub-minute) without "forever"

We don’t need to backtest tick-by-tick. We can **throttle** to 10-second bars:

- **Same strategy**, same params; only `bar_sec` changes: 60 (V1) vs 10 (V2).
- One day = 390 bars (V1) vs 2340 bars (V2) — so ~6× more evaluations per day, but still fast (seconds per day).
- **Script:** `orderflow_strategy/compare_v1_v2_backtest.py`  
  - Runs V1 (1-min) and V2 (10-sec) on the same DBN files, matches trades by day and order, and reports entry/exit time difference and PnL (V1 vs V2).  
  - Run from repo root: `cd orderflow_strategy && python compare_v1_v2_backtest.py [--days N]`  
  - Output: `data/v1_v2_comparison.txt` (and stdout). So we can see if V2 would have entered earlier and whether PnL is better or worse **without** a forever backtest.

---

## Parallel live V1 + V2 with tracking

Once we have **live stream + running bar**, we can run **both** versions in the same process and track them:

1. **Single stream** → build completed 1-min bars (for V1) and a running bar (for V2).
2. **V1:** On each **minute boundary**, run the strategy on completed bars only (current production behavior). Emit signals tagged **`V1`**.
3. **V2:** On each **update** (e.g. every 5 sec), run the strategy with `bars = completed + running_bar`. Emit signals tagged **`V2`**.
4. **Tracking:**  
   - Discord: prefix messages with `[V1]` or `[V2]` (e.g. `[V1] LONG 10:45:00 ...`, `[V2] LONG 10:44:35 ...`).  
   - CSV: add a `version` column (`V1` or `V2`) so we can compare which version fired when and with what PnL.
5. **Dedupe:** Each version keeps its own `state` (entry_price, in_position, etc.); they don’t share position. So we see two parallel “paper” lines: V1 and V2, and we can compare real-time which one would have done better.

That way we **experiment live** with the same ideas/strategies: same logic, two reaction speeds, and we see side-by-side which is better.

---

## Zoom-in on a few trades (done in code)

To “go through the data and zoom in on entries/exits” **without CMD hand-waving**:

- **V1 vs V2 backtest** (above) already compares the same trades at 1-min vs 10-sec resolution and reports entry/exit time and PnL. So we see “V2 would have entered 28 sec earlier, PnL +0.5 pts” in a table.
- **Tick-level zoom** (optional): `orderflow_strategy/tick_entry_replay.py` replays a 4-min window around each 1-min entry and finds when a **tick-level** (1-sec bars) entry would have occurred and how many points better. Run: `python tick_entry_replay.py [--days N]` → `data/tick_entry_report.txt`.

So: backtest comparison + optional tick replay = “zoom in on a few trades” done correctly in code, not by hand.

---

This file is a design note; the current live pipeline remains 1-min bar polling until we implement the streaming path.
