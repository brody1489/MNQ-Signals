# Live signals (MNQ)

One command to run. Uses the same edge and params as the backtest (including TP 0.5 pt below COB). Outputs only: **LONG**, **SHORT**, **TAKE PROFIT** with EST 12hr time and current MNQ price.

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
- CMD stays open and prints only when there’s a signal:
  - `LONG  <time EST 12hr>  MNQ <price>`
  - `SHORT  <time EST 12hr>  MNQ <price>`
  - `TAKE PROFIT  <time EST 12hr>  MNQ <price>`

## Data / API

- **Placeholder:** Code is written for **Databento** (same as your historical backtest). Key is read from `DATABENTO_API_KEY`; no key is configured until you have a subscription.
- **Level 2 / live data:** Same as what you used for the backtest (e.g. Databento CME MDP3, `mbp-10`) is the natural choice. Alternatives for live L2:
  - **Databento** – same dataset/schema as historical; subscription keeps billing simple.
  - **Polygon.io** – good L2 and real-time; separate subscription.
  - **Tradovate / broker feeds** – if you only need MNQ and already have a data sub there.

Right now the live path **polls the Historical API** every minute (no separate Live subscription required). When you add a Live API key, the same run loop can be switched to a real-time stream if you prefer.

## Params

- `params.json` in this folder matches your baseline with **tp_buffer_pts_cob: 0.5** (slightly better in tests). Other params (edge, TP at COB, SL, etc.) are the same as the backtest.

## Folder

- This is a **separate** project from `orderflow_strategy`. Open this folder when you want to run live signals; one run command starts everything.
