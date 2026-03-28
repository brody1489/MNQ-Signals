# Deploy TTC Creator Hub to your DigitalOcean droplet (PowerShell + SSH)

This app serves **HTML + `/api/campaigns` + `/admin`** on one Node process. Campaign **Save** updates `data/campaigns.json` on the server — no git step for each campaign edit **after** this is live.

---

## A) Production configuration (must be correct)

### On the **droplet** — `/root/ttc-creator-hub/.env` (or your install path)

| Variable | Value |
|----------|--------|
| `PORT` | `3334` (or any free port; avoid clashing with other apps) |
| `ADMIN_KEY` | Long random secret — **same value** you’ll use in the admin UI |
| `REMOTE_API_URL` | **Leave unset / empty** on the server (do not point the server at itself). |
| `CORS_ORIGINS` | `http://localhost:3333,http://127.0.0.1:3333` — lets your **PC** browser call the live API when you add `REMOTE_API_URL` locally. |

Optional:

| Variable | When |
|----------|------|
| `LOCAL_CAMPAIGN_DATA` | Not needed on production. |

### On **your PC** — `c:\Website_design\ttc-creator-hub\.env` (after production works)

To **Save** campaigns from localhost to the live site:

| Variable | Value |
|----------|--------|
| `REMOTE_API_URL` | `https://hub.thetradingcircle.org` **or** `https://thetradingcircle.org` — **exactly** the public URL nginx uses for this app (HTTPS, no trailing slash). |
| `ADMIN_KEY` | **Identical** to the droplet’s `ADMIN_KEY`. |

If you **don’t** set `REMOTE_API_URL` on your PC, admin only updates **local** `data/campaigns.json`.

---

## B) Push code from Windows (PowerShell)

Run from the folder that is actually **committed** to git (monorepo root or this folder if it has its own repo).

### If `ttc-creator-hub` is inside `Website_design` and you push that repo:

```powershell
cd c:\Website_design
git status
git add ttc-creator-hub
git commit -m "Deploy TTC creator hub: pages + campaign API"
git push origin main
```

Adjust `main` / remote if yours differs.

### If `ttc-creator-hub` is its own repo:

```powershell
cd c:\Website_design\ttc-creator-hub
git add -A
git status
git commit -m "Deploy creator hub"
git push origin main
```

---

## C) SSH into the droplet

Use **your** droplet IP or hostname (example replaces with yours):

```powershell
ssh root@YOUR_DROPLET_IP
```

Or:

```powershell
ssh root@thetradingcircle.org
```

First-time: accept host key. Use your SSH key or password per DO setup.

---

## D) On the server — first-time install (bash, once)

```bash
# Node 18+ (if not installed — Ubuntu example)
# curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
# apt-get install -y nodejs

mkdir -p /root/ttc-creator-hub
cd /root/ttc-creator-hub
```

**Git clone** (if you use a separate repo):

```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git .
# or clone only if empty; or pull from monorepo into a subfolder — match how you pushed from Windows
```

**Or** if the code lives in a **monorepo** on GitHub:

```bash
cd /root
git clone https://github.com/YOUR_USER/Website_design.git
cd Website_design/ttc-creator-hub
```

Then:

```bash
npm install
nano .env
```

Paste (edit `ADMIN_KEY` and `PORT`):

```env
PORT=3334
ADMIN_KEY=your-long-secret-same-as-you-will-type-in-admin
CORS_ORIGINS=http://localhost:3333,http://127.0.0.1:3333
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

```bash
npm install -g pm2
pm2 start server.js --name ttc-creator-hub
pm2 save
pm2 startup
```

Check:

```bash
curl -s http://127.0.0.1:3334/api/campaigns | head -c 200
```

You should see JSON. If `401` on ping, that’s normal without header; campaigns GET is public.

---

## E) Nginx + HTTPS (so the public URL works)

**Recommended:** a **subdomain** only for this app (simplest nginx):

- Example: `hub.thetradingcircle.org` → `proxy_pass http://127.0.0.1:3334;`

Example server block (after DNS A record points to the droplet):

```nginx
server {
    listen 80;
    server_name hub.thetradingcircle.org;
    location / {
        proxy_pass http://127.0.0.1:3334;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then:

```bash
certbot --nginx -d hub.thetradingcircle.org
nginx -t && systemctl reload nginx
```

**Your PC `.env` should use:**

`REMOTE_API_URL=https://hub.thetradingcircle.org`

(Match the real hostname you chose.)

---

## F) Every deploy after you change **code** (HTML/CSS/server)

**PowerShell (PC):**

```powershell
cd c:\Website_design
git add ttc-creator-hub
git commit -m "Update creator hub"
git push origin main
```

**SSH (droplet):**

```bash
cd /root/Website_design/ttc-creator-hub
git pull
npm install
pm2 restart ttc-creator-hub
```

(Adjust paths if your clone is `/root/ttc-creator-hub` only.)

---

## G) Campaign updates (no deploy)

- **Browser:** `https://YOUR_PUBLIC_URL/admin/` → Unlock → Save.  
- **From your PC** (optional): set `REMOTE_API_URL` + same `ADMIN_KEY`, run `npm run start-fresh` locally, open `http://localhost:3333/admin/`, Save — updates **production** `campaigns.json`.

---

## H) Quick verification

| Check | Command / URL |
|-------|----------------|
| API on droplet | `curl http://127.0.0.1:3334/api/campaigns` |
| Public | `https://your-subdomain/campaigns.html` |
| Admin | `https://your-subdomain/admin/` |
| PM2 | `pm2 logs ttc-creator-hub --lines 50` |

---

## I) If campaign Save does nothing on the public site

1. Nginx must proxy **`/api/`** and **`/admin/`** to Node (subdomain proxying `/` does this).  
2. Droplet `.env`: **`ADMIN_KEY` set**, **`REMOTE_API_URL` unset**.  
3. Restart: `pm2 restart ttc-creator-hub`.  
4. From PC: `REMOTE_API_URL` must match the **exact** HTTPS URL (and CORS on server must list your localhost origins).
