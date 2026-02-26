# The Trading Circle — Deploy Walkthrough (Step by Step)

Do this in order. You’ll have: your own domain, site live 24/7, contact form DMs you, and 8:30 PM auto-updates (win rate, % gain, traders, new/deleted channels).

---

## Part 1: New Discord bot (website only)

You want a **separate** bot so you don’t touch the old one. This bot will: (1) get DMed when someone submits the contact form, (2) run every night at 8:30 to update config/traders from Discord.

### 1.1 Create the application

1. Go to **https://discord.com/developers/applications**
2. Click **“New Application”**. Name it e.g. **“TTC Website”**. Create.
3. Open the app → left sidebar **“Bot”**.
4. Click **“Add Bot”**.
5. Under **Privileged Gateway Intents**, turn **ON**:
   - **Server Members Intent**
   - **Message Content Intent** (if you want the bot to read recap messages)
6. Click **“Reset Token”** and **copy the token**. Save it somewhere safe (you’ll put it in `.env` on the server). You won’t see it again.

### 1.2 Invite the bot to your server

1. Left sidebar **“OAuth2”** → **“URL Generator”**.
2. **Scopes:** tick **“bot”**.
3. **Bot Permissions:** tick **“View Channels”**, **“Read Message History”**, **“Send Messages”** (for DMs). Or tick **“Administrator”** to keep it simple.
4. Copy the **Generated URL**, open it in a browser, choose your server, Authorize.
5. The bot should appear in your server (offline until we run it on the Droplet).

### 1.3 Get IDs you’ll need

- **Guild (server) ID:** Discord → Settings → Advanced → turn **Developer Mode** ON. Right‑click your server name in the left sidebar → **Copy Server ID**.
- **Recap channel ID:** Right‑click the channel where the daily recap is posted → **Copy Channel ID**.
- **Your Discord user ID (for DMs):** Right‑click your name (e.g. in a member list) → **Copy User ID**.

---

## Part 2: “Plan” and where things run

- **Hosting:** Your **Droplet** (same machine as your other bot is fine). One small monthly price, no per‑visit billing.
- **Domain:** You buy a domain (e.g. **thetradingcircle.com**) and point it at the Droplet. ~\$10–15/year.
- **What runs on the Droplet:**  
  - The **website** (HTML/CSS/JS) + **website-bot** (Node app that serves the site, `/api/contact`, `/api/config.json`, and runs the 8:30 job).  
  - Your **existing** Discord bot (welcome/anti-impersonator) can stay as-is on the same Droplet or another; they’re separate processes.

So “plan” = **Droplet** (you have it) + **domain** (you buy it).

---

## Part 3: Put the site and bot in GitHub (“website” repo)

You said you have a repo called **website** on GitHub. We’ll put the **site files** and the **website-bot** in that repo so the Droplet can pull one place.

### 3.1 Repo layout

Either:

- **Option A:** One repo **website** with the site at the **root** and the bot in a folder **bot**:
  ```
  website/
  ├── index.html
  ├── contact.html
  ├── styles.css
  ├── config.js
  ├── panels.js
  ├── script.js
  ├── img/
  ├── content/
  └── bot/
      ├── index.js
      ├── job.js
      ├── package.json
      ├── .env.example
      └── data/
  ```
- **Option B:** Keep the site in a subfolder **site** and the bot in **bot**; on the Droplet you’ll set `SITE_DIR` to the path of **site**.

Use whatever you prefer. Below we assume **Option A** (site at root, bot in `bot/`).

### 3.2 Push to GitHub

1. On your PC, open the folder where you have **the-trading-circle-site** and **website-bot** (e.g. `c:\Website_design`).
2. If you haven’t cloned **website** yet:
   - `git clone https://github.com/YOUR_USERNAME/website.git`
   - `cd website`
3. Copy everything from **the-trading-circle-site** into the repo root (so `index.html`, `contact.html`, `styles.css`, `config.js`, `panels.js`, `script.js`, `img/`, `content/`, `disclaimer.html`, etc.).
4. Copy the **website-bot** folder into the repo as **bot**:
   - So you have `website/bot/index.js`, `website/bot/job.js`, `website/bot/package.json`, `website/bot/.env.example`, `website/bot/data/`.
5. In the repo root add a **.gitignore** (if missing) with:
   ```
   bot/node_modules/
   bot/.env
   bot/data/*.json
   !bot/data/.gitkeep
   ```
6. Commit and push:
   ```bash
   git add .
   git commit -m "Site + website bot"
   git push origin main
   ```
   (Use `master` if your default branch is `master`.)

---

## Part 4: Buy a domain and point it at the Droplet

1. Go to a registrar (e.g. **Namecheap**, **Cloudflare**, **Porkbun**, **Google Domains**).
2. Search for the domain you want (e.g. **thetradingcircle.com**). Buy it.
3. Open the DNS / DNS Management page for that domain.
4. Add an **A record**:
   - **Host:** `@` (or “root”)
   - **Value / Points to:** Your **Droplet’s IP address**
   - TTL: 300 or 3600
5. Optional: add another A record for **www** pointing to the same IP, or a CNAME `www` → `@`.
6. Wait 5–60 minutes (sometimes up to 24h). Then when someone goes to **https://thetradingcircle.com** (or http), the request will hit your Droplet.

---

## Part 5: Droplet setup — run the site and bot

Do this **on the Droplet** (SSH in: `ssh root@YOUR_DROPLET_IP`).

### 5.1 Clone the repo and install the bot

```bash
cd /root
git clone https://github.com/YOUR_USERNAME/website.git
cd website/bot
npm install
```

(Replace `YOUR_USERNAME` with your GitHub username. If the repo is private, use a personal access token or deploy key.)

### 5.2 Create the bot’s .env file

```bash
cd /root/website/bot
cp .env.example .env
nano .env
```

Fill in every value (no quotes needed around the values):

- **DISCORD_BOT_TOKEN** — The token from Part 1.1 (website bot).
- **GUILD_ID** — Your server ID from Part 1.3.
- **RECAP_CHANNEL_ID** — Recap channel ID from Part 1.3.
- **CONTACT_DM_USER_ID** — Your Discord user ID from Part 1.3 (so contact form DMs you).
- **PORT** — e.g. `3000` (the bot will serve the site and API on this port).
- **SITE_DIR** — Full path to the site files. If site is at repo root: `/root/website`. So: `SITE_DIR=/root/website`
- **DATA_DIR** — e.g. `./data` (default; data is stored in `bot/data/`).
- **DISCORD_INVITE_URL** — Your real invite link, e.g. `https://discord.gg/YourCode`.
- **CONTACT_EMAIL** — Your business email (used in the generated config for the site).
- **CRON_DAILY** — `30 20 * * *` = 8:30 PM **UTC**. If you want 8:30 PM in your timezone, change **TZ** (e.g. `TZ=America/New_York`) and keep the same cron, or adjust the numbers (e.g. 8:30 PM Eastern = 00 30 next day UTC in winter, so `30 0 * * *` with `TZ=America/New_York` — or use a site like cron.guru to get the right “minute hour” for your timezone).
- **TZ** — e.g. `UTC` or `America/New_York`.

Save (Ctrl+O, Enter, Ctrl+X).

### 5.3 Run the bot with PM2

So it keeps running and restarts if it crashes:

```bash
cd /root/website/bot
pm2 start index.js --name ttc-website
pm2 save
pm2 startup
```

Check logs:

```bash
pm2 logs ttc-website
```

You should see the bot log in and “Server on port 3000”. Open **http://YOUR_DROPLET_IP:3000** in a browser — you should see your site. Contact form will POST to `/api/contact` and the bot will DM you.

### 5.4 (Optional) Nginx so the site is on port 80/443 and your domain

If you want **https://thetradingcircle.com** (port 80/443) instead of **http://IP:3000**:

1. Install nginx: `apt update && apt install -y nginx`
2. Add a config:
   ```bash
   nano /etc/nginx/sites-available/ttc
   ```
   Paste (replace `YOUR_DROPLET_IP` and domain if needed):

   ```nginx
   server {
       listen 80;
       server_name thetradingcircle.com www.thetradingcircle.com YOUR_DROPLET_IP;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. Enable and reload:
   ```bash
   ln -s /etc/nginx/sites-available/ttc /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```
4. Then **https://thetradingcircle.com** will hit the Droplet and nginx will forward to port 3000. (You can add HTTPS with Let’s Encrypt later: `apt install certbot python3-certbot-nginx` and `certbot --nginx`.)

---

## Part 6: How to push updates (after you change the site or bot)

1. On your PC: edit the site or bot code (in your local clone of **website**).
2. Commit and push to GitHub:
   ```bash
   cd path/to/website
   git add .
   git commit -m "Update contact / bot / whatever"
   git push origin main
   ```
3. On the Droplet:
   ```bash
   cd /root/website
   git pull
   cd bot
   npm install
   pm2 restart ttc-website
   ```

So: **push to GitHub → on Droplet git pull, npm install if needed, pm2 restart**. That’s it.

---

## Part 7: What the 8:30 job does (auto-updates)

Every night at 8:30 (or whatever you set in **CRON_DAILY**):

1. **Traders:** Reads your Discord server’s categories and channels. Finds channels like `dorado-alerts`, `hengy-alerts`, maps them to Options/Stocks/Futures/Crypto. Uses the “analyst” role to get display names and PFPs. So new or deleted alert channels are reflected the next day.
2. **Recap:** Reads the **last message** in the recap channel. Parses “Alert Winrate: 14/15” and “Total Gain: +1559.97%”, adds those to **all-time** wins/losses and total gain.
3. **Config:** Writes **config.json** (win rate %, all-time gain %, trader count, Discord invite, contact email) into `bot/data/`. The site loads this from `/api/config.json` so the home page and Track Record panel stay live.

So: **new/deleted channels, win rate, % gain** all update automatically every night. No manual config edits on the server for those.

---

## Quick checklist

| Step | What you did |
|------|----------------|
| 1 | New Discord app “TTC Website”, bot token, Server Members Intent, invited to server |
| 2 | Got Guild ID, Recap Channel ID, Your User ID |
| 3 | Pushed site + `bot/` to GitHub **website** repo |
| 4 | Bought domain, A record → Droplet IP |
| 5 | On Droplet: clone **website**, `cd bot`, `npm install`, create `.env`, `pm2 start index.js --name ttc-website` |
| 6 | Optional: nginx so thetradingcircle.com goes to port 3000 |
| 7 | Updates: push to GitHub → on Droplet `git pull`, `npm install` (if needed), `pm2 restart ttc-website` |

When someone clicks your link (**https://thetradingcircle.com**), it’s your real site. Contact form DMs you. Every night at 8:30 the bot updates win rate, % gain, and traders from Discord.
