# Full setup: PC → GitHub → Discord webhook → Databento API → Railway

Do these in order. Each section has links and exactly where to click.

---

## Part 1: Get your code from your PC onto GitHub

Railway runs your code by pulling it from GitHub. So first we put the project on GitHub.

### 1.1 Create a GitHub account (if you don’t have one)

- Go to **https://github.com**
- Sign up (email or Google). Remember your username.

### 1.2 Install Git on your PC (if you don’t have it)

- Go to **https://git-scm.com/download/win**
- Download “64-bit Git for Windows” and run the installer (defaults are fine).
- Open a **new** PowerShell or Command Prompt after installing.

### 1.3 Create a new repo on GitHub

- Go to **https://github.com/new**
- **Repository name:** e.g. `live-signals` or `website-design` (any name).
- **Public** is fine.
- Do **not** check “Add a README” (we’re pushing existing code).
- Click **Create repository**.

### 1.4 Push your project from your PC to that repo

In PowerShell (or Command Prompt), run these from the folder that **contains** `live_signals` (e.g. your project root `Website_design`):

```powershell
cd c:\Website_design
git init
git add .
git commit -m "Initial commit - live signals"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username and `YOUR_REPO_NAME` with the repo you just created (e.g. `live-signals`).  
If GitHub asks you to log in, use your GitHub username and a **Personal Access Token** (not your password): create one at **https://github.com/settings/tokens** → Generate new token (classic), tick `repo`, then paste the token when Git asks for a password.

**Result:** Your code (including the `live_signals` folder) is now on GitHub. You’ll use this repo in Railway.

---

## Part 2: Get your Discord webhook URL

The bot will post LONG and TAKE PROFIT messages to a Discord channel. You need one webhook URL for that channel.

### 2.1 Open Discord

- In a browser: **https://discord.com/app** (or use the Discord app).
- Open the **server** where you want the alerts (or create one).

### 2.2 Create or pick a channel

- Create a channel (e.g. `#signals`) or use an existing one.
- Right‑click the channel → **Edit Channel** (or click the gear next to the channel name).

### 2.3 Create the webhook

- In the channel settings, go to **Integrations** (left sidebar).
- Click **Webhooks** → **New Webhook** (or **Create Webhook**).
- Give it a name (e.g. `MNQ Live`).
- Click **Copy Webhook URL**. That URL is your `DISCORD_WEBHOOK_URL`.

**Important:** Don’t paste this URL in chat or in code. You’ll paste it only into Railway’s Variables (Part 5).

**Result:** You have a webhook URL that looks like `https://discord.com/api/webhooks/123456789/abcdef...`. Keep it somewhere safe (e.g. a note) until you add it to Railway.

---

## Part 3: Get your Databento API key (for live / Level 2 data)

The live signals app uses Databento for live market data (including L2). You need an API key and access to live data.

### 3.1 Log in or sign up at Databento

- Go to **https://databento.com**
- Click **Sign In** or **Get Started** and create an account if needed.

### 3.2 Create or copy an API key

- In the dashboard, go to **https://databento.com/portal/keys** (or: **Portal** → **API Keys**).
- Click **Create API Key** (or use an existing key).
- Give it a label (e.g. `live-signals-railway`).
- Copy the key. It usually starts with `db-`.

**Result:** You have an API key like `db-xxxxxxxxxxxx`. Keep it secret; you’ll add it only in Railway.

### 3.3 Make sure you have live / L2 access

- Your key must have access to **live** (and L2) data for the dataset you use (e.g. `GLBX.MDP3` for CME).
- In the Databento portal, check your **subscription** or **data access**: ensure live (and MBP/L2) is enabled for the products you trade (e.g. MNQ).
- If you only had historical access before, you may need to add a live data subscription in the Databento portal (billing/subscription section).

**Result:** You have a Databento API key that can access live L2 (or equivalent) data for your symbol.

---

## Part 4: Create a Railway project and deploy from GitHub

Railway will run your code 24/7 and only execute the strategy during RTH (9:30 AM–4:00 PM ET).

### 4.1 Open Railway and log in with GitHub

- Go to **https://railway.app**
- Click **Login** → **Login with GitHub**.
- Authorize Railway to access your GitHub account.

### 4.2 Create a new project from your repo

- On the dashboard, click **New Project**.
- Choose **Deploy from GitHub repo**.
- If asked, **Configure GitHub App** and allow access to the repo you pushed in Part 1.
- Select the **repository** that contains `live_signals` (e.g. `live-signals` or `website-design`).
- Railway will create a **service** linked to that repo.

### 4.3 Set the root directory and start command

- Click the **service** (the box that represents your repo).
- Go to the **Settings** tab.
- Find **Root Directory** (under “Source” or “Build”):
  - If your repo root **is** the whole project (e.g. `Website_design` with a `live_signals` folder inside), set Root Directory to: **`live_signals`**.
  - If your repo contains **only** the contents of `live_signals` (no parent folder), leave Root Directory **empty**.
- Find **Start Command** (or “Custom start command” / “Run command”):
  - Set it to: **`python run_rth_loop.py`**
- Save if there’s a Save button.

**Result:** Railway will install from `requirements.txt` in that root and run `python run_rth_loop.py` when the app starts.

---

## Part 5: Add Discord webhook and Databento API key on Railway

The app reads these from the environment; they must be set in Railway, not in the code.

### 5.1 Open Variables

- In the same **service** on Railway, open the **Variables** tab (or **Environment** / **Env Variables**).

### 5.2 Add two variables

Click **Add Variable** (or **New Variable**) and add:

| Variable name (exact)   | Value |
|-------------------------|--------|
| `DATABENTO_API_KEY`     | Your Databento API key from Part 3 (e.g. `db-xxxxx`) |
| `DISCORD_WEBHOOK_URL`   | Your Discord webhook URL from Part 2 (full URL starting with `https://discord.com/api/webhooks/...`) |

- Names must be **exactly** as above (copy‑paste to avoid typos).
- Values: no quotes; paste the key and the full webhook URL.

### 5.3 Redeploy

- After saving variables, Railway usually redeploys automatically.
- If not: open **Deployments** → click the latest deployment → **Redeploy** (or push a new commit to the repo).

**Result:** The bot has access to Databento (live/L2) and can post to your Discord channel.

---

## Part 6: Check that it’s running

### 6.1 Logs

- In Railway: **Deployments** → click the latest deployment → **View Logs** (or **Logs**).
- You should see something like:
  - `RTH loop: will run live signals only during 9:30 AM - 4:00 PM ET. Ctrl+C to stop.`
  - Then either:
    - `Outside RTH. Sleeping until ...` (outside market hours), or
    - `RTH started. Running live signal loop.` and `Backfill loaded: ... bars ...` (during 9:30–4 ET).

### 6.2 Discord

- During RTH, when the strategy fires:
  - You should see **LONG** and **TAKE PROFIT** messages in the Discord channel you hooked up.
- If nothing appears: double‑check the **Variables** in Railway (`DISCORD_WEBHOOK_URL` is the full URL) and that the app is actually in RTH and generating signals (check logs for errors).

---

## Quick reference: links

| What | Link |
|------|------|
| GitHub (sign up / new repo) | https://github.com and https://github.com/new |
| Git for Windows | https://git-scm.com/download/win |
| GitHub Personal Access Token | https://github.com/settings/tokens |
| Discord (web) | https://discord.com/app |
| Databento (login / signup) | https://databento.com |
| Databento API keys | https://databento.com/portal/keys (or Portal → API Keys) |
| Railway | https://railway.app |

---

## Checklist (in order)

- [ ] **Part 1:** Code is on GitHub (repo created, `git push` done from your PC).
- [ ] **Part 2:** Discord webhook created; URL copied (not shared in chat).
- [ ] **Part 3:** Databento account; API key created; live/L2 access confirmed.
- [ ] **Part 4:** Railway project created; deploy from your GitHub repo; Root Directory = `live_signals` (if repo has parent folder); Start Command = `python run_rth_loop.py`.
- [ ] **Part 5:** In Railway Variables: `DATABENTO_API_KEY` and `DISCORD_WEBHOOK_URL` set; redeploy if needed.
- [ ] **Part 6:** Logs show “RTH loop” and either “Sleeping until” or “Backfill loaded”; Discord gets messages during RTH.

If a step doesn’t match what you see (e.g. Railway or GitHub changed the UI), say which step and what’s on screen and we can adjust.
