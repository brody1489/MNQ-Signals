# TTC Creator Hub (standalone)

Private creator-campaign mini-site for **thetradingcircle.org** (or any URL). **Does not modify** `website/`.

### The workflow you described (preview → dashboard → live without PowerShell each time)

1. **Proposed update (looks like the live site + new “Become an affiliate”; campaigns not in the top bar)**  
   Run `npm start`, then open **http://localhost:3333/proposed-home.html** (Home) and **http://localhost:3333/proposed-affiliates.html** (Affiliate). **Home** and **Affiliate** stay on localhost — **Campaigns** is only reached from Affiliate → Become an affiliate → **View current campaigns**. Compare with https://thetradingcircle.org/ .

2. **Dashboard (create / edit / delete campaigns, dollar amounts)**  
   **http://localhost:3333/admin/** — unlock with `ADMIN_KEY`.

3. **Push campaign changes to the public site from your PC (no git for every edit)**  
   - Deploy this Node app to **thetradingcircle.org** once (see **Go live** below).  
   - On **the server**, `.env` has `ADMIN_KEY` (and **do not** set `REMOTE_API_URL` there).  
   - On **your PC**, in `ttc-creator-hub/.env`, add **`REMOTE_API_URL=https://thetradingcircle.org`** and the **same** `ADMIN_KEY` as production.  
   - On **the server**, set **`CORS_ORIGINS=http://localhost:3333,http://127.0.0.1:3333`** and restart Node/PM2 so your browser may call the live API from localhost.  
   - Then **Save** in the local admin hits **the live API** — **thetradingcircle.org** updates immediately. No PowerShell for each campaign change.

**Code** changes (HTML/CSS/server) still use **git push + pull + restart** when you want to ship a new version of the app.

---

## Windows CMD — from scratch (copy-paste)

**You need [Node.js LTS](https://nodejs.org/) installed.** In CMD, check:

```bat
node -v
npm -v
```

### A) First time only — project + admin secret

Open **Command Prompt** (not required to be Admin). Run:

```bat
cd /d c:\Website_design\ttc-creator-hub
```

If `.env` does not exist yet:

```bat
copy /Y .env.example .env
notepad .env
```

In Notepad, set **one line** like `ADMIN_KEY=YourLongSecretPhraseHere` (only the part after `=` is what you paste into the admin login). Save and close.

Install dependencies **once** (or after `package.json` changes):

```bat
npm install
```

### B) Every time you want to run the site on this PC

```bat
cd /d c:\Website_design\ttc-creator-hub
npm start
```

Leave that window open. To stop the server: **Ctrl+C** in that window.

If you **change `.env`**, you must **Ctrl+C**, then run `npm start` again.

### C) See the full product in the browser (local)

With `npm start` running, open these (bookmark them):

| Page | Address |
|------|--------|
| Full flow start | http://localhost:3333/ |
| Affiliates + Become an affiliate + links | http://localhost:3333/affiliates.html |
| **Proposed** Home (localhost — use this instead of the live Home link) | http://localhost:3333/proposed-home.html |
| **Proposed** Affiliates (tabs + View campaigns in Become panel only) | http://localhost:3333/proposed-affiliates.html |
| Campaigns | http://localhost:3333/campaigns.html |
| Admin dashboard | http://localhost:3333/admin/ |

Single campaign details use links from the campaigns page (or `campaign.html?id=...`).

### D) “Push updates” — two different things

**1) Campaigns / budgets / paid-out (no CMD after setup)**

- With this app running **on the server** that serves your domain: open **`https://your-domain/admin/`**, unlock with your **`ADMIN_KEY`**, click **Save**. That **already updates** the live site — **no git, no CMD** for each campaign change.
- **From your PC to the live site (no PowerShell on each save):** set **`REMOTE_API_URL=https://thetradingcircle.org`** in your **local** `ttc-creator-hub/.env` (same **`ADMIN_KEY`** as production) and **`CORS_ORIGINS=...`** on the server — see the top of this README. Then **`http://localhost:3333/admin/`** → **Save** writes to **production**.
- **Local-only** (no `REMOTE_API_URL`): **`http://localhost:3333/admin/`** saves **`data/campaigns.json` on your PC** only.

**2) Code changes (HTML, CSS, `server.js`, etc.)**

On **your PC** (from the repo folder):

```bat
cd /d c:\Website_design\ttc-creator-hub
git status
git add -A
git commit -m "Describe what you changed"
git push
```

On the **droplet** (SSH session — use your real path and branch):

```bash
cd /path/to/ttc-creator-hub
git pull
npm install
pm2 restart ttc-creator-hub
```

If you do **not** use PM2 yet, restart however you run Node (e.g. stop the process and `node server.js` again).

### E) Optional — save `campaigns.json` with git (backup)

Campaign data lives in **`data/campaigns.json`**. To back it up with the repo:

```bat
cd /d c:\Website_design\ttc-creator-hub
git add data\campaigns.json
git commit -m "Backup campaigns"
git push
```

(Only do this if you are okay committing that file; otherwise back up the file elsewhere.)

---

## Run locally (Windows) — short recap

Same steps as **§A** and **§B** above: `.env` with `ADMIN_KEY=...`, then `npm install` once, then `npm start`.

Admin login: paste **only** the secret **after** `ADMIN_KEY=` into http://localhost:3333/admin/ → **Unlock**. **Save** in the dashboard writes `data/campaigns.json` on this machine immediately.

## What “auto push” means

- **While testing locally:** there is no separate “live website” yet. The dashboard and the public pages both talk to **this** running server. Saving in the dashboard updates the JSON **instantly** for http://localhost:3333 — nothing else to run.
- **When you put this app on your droplet:** run the **same** Node app there. You open **`https://your-domain/admin/`** (whatever URL you set up), unlock with **the `ADMIN_KEY` in the server’s `.env` on the droplet**, and every save updates **`data/campaigns.json` on the droplet**. Your visitors load the same host, so they see updates immediately — **no PowerShell git push for campaign edits** after that.

If the live site today is **only static files** without this server, campaign changes from a **local-only** dashboard will **not** appear on the internet until you either **deploy this Node app** on the droplet or **sync** `data/campaigns.json` + change the front end to read that file from somewhere public.

## Verify `ADMIN_KEY` before opening `/admin/`

From `c:\Website_design\ttc-creator-hub`:

```bat
npm run check-env
```

If it prints **`OK: ADMIN_KEY is set`**, the file is loading. Use **exactly** that secret (the characters after `ADMIN_KEY=` in `.env`) in the dashboard. Then:

```bat
npm start
```

```bat
start http://localhost:3333/admin/
```

If **`check-env` fails**, fix `.env` (name is `.env` not `.env.txt`), save, run `check-env` again, then `npm start`.

If **`check-env` says OK** but **Unlock** still fails, read the full `check-env` output: if **`REMOTE_API_URL`** is set, login is checked against **that website’s** server — you must use the **`ADMIN_KEY` on the droplet** (or remove `REMOTE_API_URL` from your PC’s `.env` to use only your local key).

**Prove the running server accepts your key** (with `npm start` already running in another window):

```bat
npm run test-login
```

If this prints **`OK`**, the browser Unlock should work too — use **`http://localhost:3333/admin/`** (same port as `PORT` in `.env`).

**`EADDRINUSE` or `401` while `check-env` is OK:** another `node` process is still bound to port **3333** (often an old server from before you edited `.env`). Free the port, then start again:

```bat
cd /d c:\Website_design\ttc-creator-hub
npm run free-port
npm start
```

Or one step: **`npm run start-fresh`** (frees 3333 then runs the server). After it is listening, run **`npm run test-login`** again.

## Admin login fails (“invalid key”)

1. **Restart Node after editing `.env`** — env is read only at startup. `Ctrl+C` in the terminal, then `npm start` again.
2. **Open the dashboard through this app:** `http://localhost:3333/admin/` — not VS Code “Live Server”, not double-clicking the HTML file (`file://` cannot call `/api/...`).
3. **In the login box, paste only the secret** — the part *after* `ADMIN_KEY=` in `.env`, not the name `ADMIN_KEY`.
4. **File name is exactly `.env`** — in Windows, “`.env.txt`” will not load; turn on “file name extensions” and fix it.
5. **One line, no accidental quotes** — prefer `ADMIN_KEY=MySecret123` over wrapping in extra characters. The server now trims spaces; if it still fails, read the new error line (e.g. `ADMIN_KEY not set on server` means `.env` was not loaded).

## Where the “Affiliates / Become an affiliate / form” pages live

This project is a **copy** for testing. It is **not** on `thetradingcircle.org` until you deploy it.

| What | Local URL (with `npm start`) |
|------|-------------------------------|
| Home | http://localhost:3333/ |
| Affiliates + **Our partners** / **Become an affiliate** (tabs, form link, campaigns button) | http://localhost:3333/affiliates.html |
| **Proposed** Home (localhost preview) | http://localhost:3333/proposed-home.html |
| **Proposed** Affiliates | http://localhost:3333/proposed-affiliates.html |
| Current & past campaigns | http://localhost:3333/campaigns.html |
| Admin dashboard | http://localhost:3333/admin/ |

## Data

- **`data/campaigns.json`** — source of truth. The API reads/writes this file on every save in the dashboard.
- **`meta.apply_form_url`** — optional override for the Google Form link (default in JSON matches your form).

## Go live (thetradingcircle.org)

**Option A — same droplet, second PM2 app (recommended)**

1. Push this folder to git (new repo or monorepo path).
2. On the server: `git clone` / `git pull` into e.g. `/root/ttc-creator-hub`.
3. `cd /root/ttc-creator-hub && npm install`
4. Create `.env` with `PORT=3334`, `ADMIN_KEY=...` — **leave `REMOTE_API_URL` unset** on the server (you are already on the live host).
5. Add **`CORS_ORIGINS=http://localhost:3333,http://127.0.0.1:3333`** so your **local** dashboard can call the live API when `REMOTE_API_URL` is set on your PC.
6. `pm2 start server.js --name ttc-creator-hub --cwd /root/ttc-creator-hub`
7. Point **Nginx** so **`/api`** and **`/admin`** (and the rest of this app) hit Node: `proxy_pass http://127.0.0.1:3334;` (not only static files — the campaign API must reach Express).
8. TLS via Certbot as usual.

**Option B — merge into existing Node host**

Mount this app under a path or subdomain from your current stack (reuse PM2 + reverse proxy).

**Important:** The “public” pages call **`/api/campaigns` on the same origin**. Whatever serves HTML must also serve the API (this server), unless you change `common.js` to a full API URL.

## Security

- **Admin** is protected by **`X-Admin-Key`** (header). Do not expose `/admin/` without HTTPS and a strong key.
- Pages use **`noindex`** meta — add auth at the edge (HTTP basic, Cloudflare Access, or firewall allowlist) if you want stricter obscurity.

## Deploy to DigitalOcean (PowerShell + SSH + nginx)

See **`DEPLOY-DROPLET.md`** — production `.env`, git push, `ssh`, `git pull`, `pm2 restart`, nginx/Certbot, and campaign updates on the live URL.

## For Cursor / future edits

See **`CURSOR_INSTRUCTIONS.md`**.
