# Live signals (MNQ)

**V1 and V2 run in parallel:** same strategy and params. **V1** = 1-min bar close (acts at end of each minute). **V2** = running bar (polls every 10s, acts as soon as the current minute’s bar satisfies). Discord and CSV tag every message: `V1 LONG ...`, `V1 TAKE PROFIT ...`, `V2 LONG ...`, `V2 TAKE PROFIT ...` so you can compare over the next month.

## Setup

- **Python:** 3.10+ with `pandas`, `databento`, `zoneinfo`.
- **API key:** Do **not** set until you have a subscription. Then set the env var before running:
  - CMD: `set DATABENTO_API_KEY=db-your-key-here`
  - Or create a `.env` in this folder with `DATABENTO_API_KEY=db-your-key-here` and use `python-dotenv` if you prefer.

## Run

From this folder:

```bash
python run.py
```

Or double‑click `run.cmd` (or run it from CMD).

- Runs only during RTH (9:30 AM–4:00 PM ET). Exits with a message if started outside that window.
- If you start after 9:30, it **backfills** from 9:30 to “now” so the strategy has full context, then polls every minute for the latest bar.
- CMD stays open and prints when there’s a signal (tagged by version):
  - `V1 LONG  <time EST 12hr>  MNQ <price>`  /  `V2 LONG  ...`
  - `V1 TAKE PROFIT  <time>  MNQ <price>  entry X  →  ±Y pts`  /  `V2 TAKE PROFIT  ...`
- CSV: `data/live_trades.csv` has columns `date, time_est, version, signal, price, entry_price, pnl_pts` so you can filter by V1 or V2.

## Data / API

- **Placeholder:** Code is written for **Databento** (same as your historical backtest). Key is read from `DATABENTO_API_KEY`; no key is configured until you have a subscription.
- **Level 2 / live data:** Same as what you used for the backtest (e.g. Databento CME MDP3, `mbp-10`) is the natural choice. Alternatives for live L2:
  - **Databento** – same dataset/schema as historical; subscription keeps billing simple.
  - **Polygon.io** – good L2 and real-time; separate subscription.
  - **Tradovate / broker feeds** – if you only need MNQ and already have a data sub there.

Right now the live path **polls the Historical API** every minute (no separate Live subscription required). When you add a Live API key, the same run loop can be switched to a real-time stream if you prefer.

## Params

- `params.json` in this folder matches your baseline with **tp_buffer_pts_cob: 0.5** (slightly better in tests). Other params (edge, TP at COB, SL, etc.) are the same as the backtest.

## Experiment: V1 (1-min) vs V2 (sub-minute)

To see if **faster reaction** (e.g. 10-sec bars) would give better entries/exits **without** running a forever backtest:

- From repo root: `cd orderflow_strategy && python compare_v1_v2_backtest.py [--days N]`
- Uses the same strategy and params; only bar granularity changes (60s vs 10s). Output: `orderflow_strategy/data/v1_v2_comparison.txt` with entry/exit time diff and PnL (V1 vs V2).
- For **parallel live** (V1 and V2 running together with tagged Discord/CSV), see **STREAMING_DESIGN.md** (Parallel live V1 + V2 with tracking).

## Folder

- This is a **separate** project from `orderflow_strategy`. Open this folder when you want to run live signals; one run command starts everything.
