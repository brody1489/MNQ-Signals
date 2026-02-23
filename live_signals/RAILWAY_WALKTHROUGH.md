# Railway deploy walkthrough (step-by-step)

**Want the full path from zero?** Use **[SETUP_FROM_SCRATCH.md](SETUP_FROM_SCRATCH.md)** — it walks through: getting code from your PC to GitHub, creating the Discord webhook, getting the Databento API key (live/L2), then Railway deploy and variables.

This doc below is the Railway-only sequence (assuming you already have code on GitHub and your webhook + API key).

---

## 1. What we need from you

- **Discord webhook URL**  
  You said you’ll give this. Once you have it, you’ll paste it into Railway in step 5.

- **Databento API key**  
  Same key you use for backtest data. You’ll paste it into Railway in step 5.

- **Code on GitHub**  
  Railway deploys from a Git repo. Either:
  - Push your whole project (e.g. `Website_design`) to a GitHub repo, or  
  - Create a repo that contains **only** the `live_signals` folder (so the repo root is `live_signals`).

If the repo root is **the whole project** (e.g. `Website_design`), we’ll set Railway’s **Root Directory** to `live_signals` so it runs from that folder.

---

## 2. Create a Railway account

1. Go to **[railway.app](https://railway.app)**.
2. Click **Login** → sign in with **GitHub** (easiest for deploy).
3. Approve Railway’s access to your GitHub if asked.

---

## 3. New project from GitHub

1. In Railway dashboard, click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select the repo that has your code (the one that contains `live_signals`).
4. If the repo has more than just `live_signals`, Railway will add a “service” from that repo. We’ll point it at `live_signals` in the next step.

---

## 4. Point the service at `live_signals` (if repo root isn’t already `live_signals`)

1. Click the **service** (the box that was created from your repo).
2. Open the **Settings** tab (or **Variables** first — see below).
3. Find **Root Directory** (or **Source** → **Root Directory**).
4. Set it to: **`live_signals`**  
   (so Railway runs and installs from the `live_signals` folder).
5. Find **Build Command**. You can leave it empty (Railway will auto-detect Python and run `pip install -r requirements.txt` if `requirements.txt` is in `live_signals`).
6. Find **Start Command** (or **Run Command**). Set it to:
   ```bash
   python -u run_rth_loop.py
   ```
   (`-u` = unbuffered stdout so deploy logs show every line. If you use the Dockerfile or nixpacks.toml, this is already set.)

   So the process runs the RTH loop and only does work during market hours.

If your GitHub repo **is** only the contents of `live_signals` (repo root = `live_signals`), leave **Root Directory** empty and set **Start Command** to `python -u run_rth_loop.py`.

---

## 5. Add your secrets (webhook + API key)

1. In the same service, open the **Variables** tab.
2. Click **Add Variable** (or **New Variable**).
3. Add:

   | Name | Value |
   |------|--------|
   | `DATABENTO_API_KEY` | Your Databento API key (e.g. `db-xxxxx`) |
   | `DISCORD_WEBHOOK_URL` | Your Discord webhook URL (the one you’re going to give) |

4. Save. Railway will redeploy when you change variables (or you can trigger a redeploy from the **Deployments** tab).

You don’t put the webhook or API key in the code — only in these variables. The app reads them from the environment.

---

## 6. Deploy and check logs

1. Trigger a **Deploy** if it didn’t start automatically (e.g. **Deployments** → **Deploy** or push a commit to the repo).
2. Open the **Deployments** tab, click the latest deployment, then open **View Logs**.
3. You should see something like:
   - `RTH loop: will run live signals only during 9:30 AM - 4:00 PM ET. Ctrl+C to stop.`
   - Then either `Outside RTH. Sleeping until ...` or `RTH started. Running live signal loop.` and `Backfill loaded: ... bars ...`

If you see an error about missing `DATABENTO_API_KEY`, go back to **Variables** and confirm both variables are set (no typos in the names).

---

## 7. Discord check

- When RTH is open and a signal fires, the app will POST to your webhook.
- **If you see `[Discord] send failed: HTTP Error 403: Forbidden`:** The webhook URL is invalid or was deleted. Fix it: In Discord go to your **server** → **channel** → **Integrations** → **Webhooks**. Click **New Webhook** (or **Create Webhook**), give it a name, copy the **webhook URL** (it starts with `https://discord.com/api/webhooks/...`). In Railway **Variables**, set `DISCORD_WEBHOOK_URL` (or `Discord_webhook_url`) to that exact URL, then redeploy.
- You should see messages in the Discord channel like:
  - `LONG  10:45:00 AM EST  MNQ 25084.75`
  - `TAKE PROFIT  11:02:00 AM EST  MNQ 25100.25  entry 25084.75  →  +15.50 pts`

If nothing appears, check:
- **Variables** in Railway: `DISCORD_WEBHOOK_URL` is set and is the full URL (starts with `https://discord.com/api/webhooks/...`).
- **Logs**: no errors when the app tries to send (e.g. 4xx from Discord).

---

## 8. Cost

- Railway gives a **free trial** and often **monthly credit** (e.g. $5).
- This app is a single long-running process that sleeps most of the time, so usage is low. If you exceed free credit, they’ll charge (typically a few dollars per month for this kind of worker).
- You can set a **spend limit** in Railway account settings.

---

## Quick checklist

- [ ] GitHub repo has `live_signals` (and its `requirements.txt`, `run_rth_loop.py`, etc.).
- [ ] Railway project created from that repo.
- [ ] Root Directory set to `live_signals` (if repo root isn’t already `live_signals`).
- [ ] Start Command: `python run_rth_loop.py`.
- [ ] Variables: `DATABENTO_API_KEY` and `DISCORD_WEBHOOK_URL` set.
- [ ] Deploy and check logs for “RTH loop” and “Backfill loaded” (during RTH).
- [ ] Confirm Discord messages when a signal fires.

Once you have the webhook URL, paste it into Railway as `DISCORD_WEBHOOK_URL` and you’re set. If you hit a specific step that doesn’t match what you see on screen (e.g. Railway changed their UI), describe the screen and we can adjust the steps.
