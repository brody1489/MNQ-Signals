# Deploying live signals so they run without you (and post to Discord)

Run the bot somewhere 24/7 during RTH so it doesn’t miss bars, and send every LONG / TAKE PROFIT to Discord so you can track from your phone.

**Full setup (PC → GitHub → Discord → Databento → Railway):** see **[SETUP_FROM_SCRATCH.md](SETUP_FROM_SCRATCH.md)** for a single start-to-finish guide with links and exact steps.

---

## 1. Discord webhook (do this first)

1. Open your Discord server → pick (or create) a channel, e.g. `#signals`.
2. Channel settings → **Integrations** → **Webhooks** → **New Webhook**.
3. Name it (e.g. "MNQ Live"), copy the **Webhook URL**.
4. Set it in your environment (see below) as `DISCORD_WEBHOOK_URL`.

The code already posts every LONG and every TAKE PROFIT (with price and PnL) to that URL. No extra libraries.

---

## 2. Where to host (cheap / free)

### Option A: **Railway** (good balance, ~$5/mo or free credit)

- **Step-by-step:** see **[RAILWAY_WALKTHROUGH.md](RAILWAY_WALKTHROUGH.md)** in this folder.
- Push your repo (or just the `live_signals` folder) to GitHub.
- Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
- Set **Root Directory** to `live_signals` if the repo root is the whole project; set **Start Command** to `python run_rth_loop.py`.
- In Railway dashboard: **Variables** → add `DATABENTO_API_KEY` and `DISCORD_WEBHOOK_URL`.
- Railway runs the process 24/7; the RTH wrapper only runs the loop during market hours and sleeps otherwise.

### Option B: **Your own PC** (free)

- Leave the machine on during RTH. Run `python run.py` (or `run.cmd`) and set `DISCORD_WEBHOOK_URL` in the environment or in a `.env` file in `live_signals/`.
- You get Discord alerts; the script doesn’t need to be “published” anywhere.

### Option C: **$5/mo VPS** (DigitalOcean, Linode, etc.)

- Create a small droplet (e.g. 1 GB RAM).
- Clone your repo, install Python + deps, set env vars, run the same wrapper so the process sleeps outside RTH and runs during 9:30–4 ET.
- You’re in full control; no platform limits.

### Option D: **PythonAnywhere** (free tier limited)

- Free accounts can run scheduled tasks (cron) but not a single long-running 6.5‑hour process easily. Paid ($5/mo) gives one always-on worker.
- Possible but more fiddly than Railway or a VPS.

**Recommendation:** Use **Railway** (or a $5 VPS if you prefer full control). Set `DATABENTO_API_KEY` and `DISCORD_WEBHOOK_URL` in the host’s environment so the bot runs and posts to Discord; you track everything in the channel.

---

## 3. Run only during RTH (so it doesn’t “miss” and doesn’t error)

The script already checks `in_rth()` and exits with “RTH over” at 4 PM ET. To have it **wait until 9:30 ET and then run**, and **sleep until next day** when outside RTH (so one long-lived process is fine on Railway/VPS), use a small wrapper.

Create **`run_rth_loop.py`** in `live_signals/` (see below). It:

- Loops forever.
- If outside RTH: sleep until next 9:30 AM ET (or 4 PM ET if we’re in the gap 4 PM–9:30 AM).
- If inside RTH: run `run.main()` (your existing loop); when it exits at 4 PM, sleep until next 9:30 AM ET.

Then on Railway (or VPS) run:

```bash
python run_rth_loop.py
```

So the “published” process is this one script; it never tries to run the strategy outside RTH, so it doesn’t miss anything and stays in control.

---

## 4. Env vars the host must set

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABENTO_API_KEY` | Yes | Your Databento API key (live data). |
| `DISCORD_WEBHOOK_URL` | No | Webhook URL; if set, every LONG / TAKE PROFIT is posted to Discord. |

On Railway: Project → Variables.  
On a VPS: `export` in the shell or use a `.env` file (and `python-dotenv` if you load it in code).

---

## 5. What gets posted to Discord

- **LONG** `10:45:00 AM EST  MNQ 25084.75`
- **TAKE PROFIT** `11:02:00 AM EST  MNQ 25100.25  entry 25084.75  →  +15.50 pts`  
  (or negative for a loss)

So you see each signal and the P&L of the trade. The CSV log on the server still has the full history for scoring (e.g. weekly WR and total pts).

---

## 6. “Scoring” and tracking

- **Live:** Each EXIT is in `live_signals/data/live_trades.csv` with `pnl_pts`. Sum EXITs for the week = total pts; count EXITs with `pnl_pts > 0` = wins → WR.
- **Discord:** You see each trade as it happens; you can manually or with a small script aggregate by week. So “running it for a month and tracking” = let the deployed process run, watch Discord, and use the CSV (or a script that reads it) to compute weekly stats and confirm it matches the backtest ballpark (e.g. 70–80% WR, target pts/week).

---

## 7. Summary

1. Create a Discord webhook, set `DISCORD_WEBHOOK_URL`.
2. Deploy the repo (or `live_signals`) to **Railway** (or a $5 VPS).
3. Set `DATABENTO_API_KEY` and `DISCORD_WEBHOOK_URL` on the host.
4. Run **`python run_rth_loop.py`** so it only runs during RTH and sleeps otherwise.
5. Track: Discord for real-time; `live_trades.csv` (or a script on it) for weekly WR and pts.

That’s the minimal way to “publish it somewhere for cheap,” have it not miss RTH, and have you (and the code) in control with Discord + CSV for scoring and confirmation.
