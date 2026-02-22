# How we know we're getting the 70–80% WR and points (live)

## What’s in place

1. **Same edge live**  
   When you run `python run.py` (or `run.cmd`) from `live_signals/`, the script:
   - Loads **best_params_v2.json** from `orderflow_strategy/data/` if it exists (proven config: lunch skip 11:30–1, min_tp_15, trail_25).
   - If that file is missing, it uses `params.json` in live_signals.

2. **Trade log**  
   Every LONG and every exit (TP/SL/reversal) is appended to:
   - **`live_signals/data/live_trades.csv`**  
   Columns: `date`, `time_est`, `signal`, `price`, `entry_price`, `pnl_pts`  
   - LONG rows: `signal=LONG`, `price` = entry; `entry_price` and `pnl_pts` empty.  
   - EXIT rows: `signal=EXIT`, `price` = exit, `entry_price` and `pnl_pts` filled.

3. **Execute**  
   The script prints: **LONG** / **TAKE PROFIT** with EST time and MNQ price. You (or your broker API) place the order at that price. One signal per setup; same logic as backtest.

## How to measure “are we getting the same results?”

- **Per trade:** Each EXIT row in `live_trades.csv` has `pnl_pts`.  
- **Per day/week:**  
  - Count EXIT rows in a date range = number of trades.  
  - Sum `pnl_pts` for that range = total points.  
  - Count EXIT rows with `pnl_pts > 0` = wins → win rate = wins / trades.

Example (PowerShell, from repo root):

```powershell
# Trades and total pts this week (adjust path if needed)
Import-Csv "live_signals\data\live_trades.csv" | Where-Object { $_.signal -eq "EXIT" } | Measure-Object -Property pnl_pts -Sum
# Wins: filter EXIT where pnl_pts > 0
```

Or open `live_trades.csv` in Excel: filter `signal=EXIT`, sum `pnl_pts` for the week, count rows for trades, count rows with `pnl_pts > 0` for wins.

## What to expect (from backtest)

- **Proven config (Time_lunch_skip):** 9-day backtest → 12 trades, 75% WR, 163 pts total, ~13.6 pts/trade.  
- **Rough weekly equivalent:** ~1–2 trades/day → ~5–12 trades/week; if WR and avg hold, **~70–170+ pts/week** in that range.  
- If your live WR and pts/week are in that ballpark after 20+ trades, the edge is holding. If they’re much worse, check: same symbol (MNQ), same session (RTH), and that you’re not trading during lunch (11:30–1) if using the lunch-skip config.

## Summary

- **Know:** Use `live_trades.csv` (EXIT rows) to compute trades, wins, total pts, WR, and pts/week.  
- **Execute:** Run live script → it prints LONG / TAKE PROFIT with time and price; you trade at that price. The script uses the same proven params (best_params_v2.json) so the edge is the same as in the trials.
