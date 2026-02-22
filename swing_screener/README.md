# Large-Cap Swing Screener v2

One command → list of tickers that pass swing filters with **key levels**, **sector/relative strength**, **4-week cooldown**, and a **meaningful 1–10 score**. No max tickers; you see every name that qualifies.

**v2 changes:** 2-year history for **support/resistance** from swing pivots; **sector** (GICS) and **relative strength** vs sector ETF; **4-week cooldown** (tickers suggested in last 28 days are excluded); **earnings** via `get_earnings_dates()`; **score 1–10** (pullback, near support, upside, sector, stock vs sector, volume, RSI, 50 SMA slope). Output CSV includes Support, Resistance, Upside_Pct, Sector, Stock_vs_Sector_20d. All runs are appended to `screener_log.csv` for cooldown.

---

## What you need

- **Python 3.8+** (install from [python.org](https://www.python.org/downloads/) if needed)
- **No API keys** for v1 (uses Yahoo Finance via yfinance)

---

## First-time setup (once)

1. **Open CMD** (Win+R → type `cmd` → Enter).

2. **Go to the screener folder:**
   ```bat
   cd c:\Website_design\swing_screener
   ```

3. **Create a virtual environment (recommended):**
   ```bat
   python -m venv venv
   venv\Scripts\activate
   ```
   You should see `(venv)` in the prompt.

4. **Install dependencies:**
   ```bat
   pip install -r requirements.txt
   ```

---

## Run the screener (every day)

**Paste this into CMD (one line or two), then wait a few minutes:**

```bat
cd c:\Website_design\swing_screener
py run_screener.py
```

If you use a virtual environment, activate it first:

```bat
cd c:\Website_design\swing_screener
venv\Scripts\activate
py run_screener.py
```

4. **Wait a few minutes** (~1–2 min for data, then filtering). It will:
   - Load S&P 500
   - Fetch about 1 year of price data in batches
   - Compute metrics, apply filters (trend, pullback, last 2–3 days, volume, SPY regime, cap ≥ $20B, earnings)
   - Print each ticker with a short narrative
   - Save a CSV: `screener_YYYYMMDD.csv` in the same folder

5. **Use the output:**  
   Copy the tickers into your spreadsheet, then track each over the next 4 weeks (entry, exit, % gain/loss) so you can measure win rate and average gain.

---

## If you don’t use a virtual environment

From any folder in CMD:

```bat
cd c:\Website_design\swing_screener
python run_screener.py
```

(Make sure `python` is on your PATH and that you’ve run `pip install -r requirements.txt` once from that folder or globally.)

---

## Output

- **Console:** Number of tickers and, for each, a few lines: dip %, last 2d/3d return, volume, structure (price vs 50/200 SMA), levels, earnings.
- **File:** `screener_YYYYMMDD.csv` with columns: Date, Ticker, Close, Pct_Down_20d, Pct_Down_52w, Last_2d_Pct, RSI, SMA50, SMA200, Market_Cap_B, Earnings_Days.

---

## Filters (what gets in)

- S&P 500, then:
  - Market cap ≥ $20B, 20d avg volume ≥ 500k
  - Price above 50 and 200 SMA; 50 SMA above 200 SMA
  - 5–15% down from 20-day high
  - Last 2 days up **or** last 3 days up (stabilization)
  - Recent volume not > 1.3× 20d avg (no distribution)
  - Price < 15% above 200 SMA
  - SPY above 200 SMA (regime)
  - Next earnings not within 14 days

No limit on how many tickers are returned; the filters naturally keep the list short.

---

## Your tracking (recommended)

- **Spreadsheet:** Date run | Ticker | Entry date | Exit date | Hold (days) | % gain/loss | Notes
- Run daily, log only the tickers you actually trade. After ~4 weeks per cohort you’ll have win rate and average % gain to tune the system (and later: Polygon, whales, etc.).
