# VPS Setup Walkthrough — One Deployment, Both Bots

Run both Discord bots (anti-impersonator + welcome) on a **single $6/mo server**. Flat rate, no per-use billing.

---

## Part 1: Where to Go & Create the Server

### 1. Sign up and create a Droplet (DigitalOcean)

1. Go to **[digitalocean.com](https://www.digitalocean.com)** → **Sign Up** (or Log In).
2. **Create** → **Droplets**.
3. Choose:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic → **Regular** → **$6/mo** (1 GB RAM / 1 vCPU)
   - **Datacenter:** Pick one close to you (e.g. New York, San Francisco)
   - **Authentication:** 
     - **SSH key** (recommended): Add your PC’s public key so you can log in without a password.  
       On Windows (PowerShell): `Get-Content $env:USERPROFILE\.ssh\id_rsa.pub` — copy that line into DigitalOcean “New SSH key”.  
       If you don’t have a key: `ssh-keygen -t ed25519 -N "" -f $env:USERPROFILE\.ssh\id_ed25519` then add the `.pub` content.
     - Or **Password**: You’ll get an email with a root password (change it after first login).
4. Click **Create Droplet**. Wait ~1 minute. Note the **IP address** (e.g. `164.92.xxx.xxx`).

---

## Part 2: Connect and Install Node

### 2. SSH into the server

From your PC (PowerShell or Terminal):

```bash
ssh root@YOUR_DROPLET_IP
```

Replace `YOUR_DROPLET_IP` with the IP from the DigitalOcean dashboard. Accept the “fingerprint” prompt (type `yes`). Use your SSH key or the password from the email.

### 3. Install Node.js 20

On the server (you’re now in a Linux shell):

```bash
apt update && apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```

You should see `v20.x.x`. Then install PM2 (keeps the bots running and restarts them on reboot):

```bash
npm install -g pm2
```

---

## Part 3: Put Your Code and Keys on the Server

### Option A — You have the unified project on GitHub

1. On GitHub, create a new repo (e.g. `discord-bots-unified`).
2. On your PC, in the `discord-bots-unified` folder:
   ```powershell
   cd c:\Website_design\discord-bots-unified
   git init
   git add -A
   git commit -m "Unified bots"
   git remote add origin https://github.com/YOUR_USERNAME/discord-bots-unified.git
   git branch -M main
   git push -u origin main
   ```
3. On the **VPS** (SSH’d in):
   ```bash
   cd /root
   git clone https://github.com/YOUR_USERNAME/discord-bots-unified.git
   cd discord-bots-unified
   ```

### Option B — Copy folder from your PC (no GitHub)

From your PC (PowerShell), with the VPS IP set:

```powershell
scp -r c:\Website_design\discord-bots-unified root@YOUR_DROPLET_IP:/root/
```

Then on the VPS:

```bash
cd /root/discord-bots-unified
```

### 4. Create the `.env` file with all keys

On the VPS, in the project folder:

```bash
nano .env
```

Paste the following and **replace the placeholder values** with your real tokens and IDs (same as you used on Railway):

```env
# Anti-impersonator bot token (from Discord Developer Portal — Anti Impersonation app)
DISCORD_BOT_TOKEN_ANTI=your_anti_bot_token_here

# Welcome bot token (from Discord Developer Portal — Welcome / The Trading Circle app)
DISCORD_BOT_TOKEN_WELCOME=your_welcome_bot_token_here

# Server (same for both)
GUILD_ID=1420529407524606044
LOG_CHANNEL_ID=1476006615646998619
OWNER_ROLE_ID=1443415927981867149
DEVELOPER_ROLE_ID=1464373846155985138
ANALYST_ROLE_ID=1443403865415487538

PORT=3000
```

Save and exit: **Ctrl+O**, Enter, **Ctrl+X**.

---

## Part 4: Install Dependencies and Run

Still in `/root/discord-bots-unified` (or `/root/discord-bots-unified` if you cloned):

```bash
npm install
pm2 start index.js --name trading-circle-bots
pm2 save
pm2 startup
```

When `pm2 startup` prints a command (e.g. `sudo env PATH=...`), **copy and run that line** so the bots start again after a server reboot.

Check status:

```bash
pm2 status
pm2 logs trading-circle-bots
```

You should see both bots log in (e.g. `[anti-impersonator] Logged in as ...` and `[welcome] Logged in as ...`). In Discord, both bots should show **Online**.

---

## Part 5: Stop Railway (So You’re Not Double-Billing)

1. Open **Railway** → your project(s).
2. For **anti-impersonator** and **welcome** (or the two separate services), **delete the services** or **pause** them so they’re no longer running.
3. Your Discord server will now be served only by the single VPS. No more Railway usage for these bots.

---

## Quick Reference

| What | Command |
|------|--------|
| View logs | `pm2 logs trading-circle-bots` |
| Restart bots | `pm2 restart trading-circle-bots` |
| Stop bots | `pm2 stop trading-circle-bots` |
| Status | `pm2 status` |
| Update code (if you use Git) | `cd /root/discord-bots-unified && git pull && npm install && pm2 restart trading-circle-bots` |

---

## Adding More Bots Later

To run another bot in the **same** deployment (same server, same process or same machine):

- **Same Node process:** Add a new folder under `bots/` (e.g. `bots/imagescan/`), require it from `index.js`, and start it the same way. One `npm start` or one PM2 process runs everything.
- **Same server, different process:** Use PM2 to start another script, e.g. `pm2 start other-bot/index.js --name other-bot`. You still pay only the one $6/mo (or whatever plan you have).

You now have one deployment, all keys and code in one place, and a flat monthly cost.
