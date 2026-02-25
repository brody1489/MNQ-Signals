# Discord Bots Unified (Trading Circle)

Runs the **anti-impersonator** and **welcome** (DM + tracking) bots in one Node process. Deploy once with PM2; both bots share the same health server.

## Setup

1. Copy `.env.example` to `.env` and fill in tokens and IDs.
2. `npm install`
3. `npm start` (or use PM2 on the server).

## Env (see `.env.example`)

- **Anti-impersonator:** `DISCORD_BOT_TOKEN_ANTI`, `GUILD_ID`, `LOG_CHANNEL_ID`, role IDs.
- **Welcome:** `DISCORD_BOT_TOKEN_WELCOME`. Optional: `STATS_CHANNEL_ID`, `STATS_DAILY_CRON`.
- **Daily member report:** Set `STATS_CHANNEL_ID=1476080187669086331` (or your channel). Cron default: `0 20 * * *` (8pm UTC daily). Use `STATS_DAILY_CRON` to change (e.g. `0 21 * * *` for 4pm ET ≈ 9pm UTC in winter).
- **Health server:** `PORT` (default 3000).

## How to push updates

After you change code or config:

1. **From your machine:** Commit and push to Git (if you use it), or copy updated files to the server (e.g. `scp`).
2. **On the Droplet (or wherever the app runs):**
   - `cd /root/discord-bots-unified` (or your app path)
   - `git pull` if you use Git, or overwrite the changed files
   - If you changed `package.json`: `npm install`
   - Restart: `pm2 restart trading-circle-bots`
   - Optional: `pm2 logs trading-circle-bots` to confirm the member report runs at the set time

The daily member-count report runs in the welcome bot at the time set by `STATS_DAILY_CRON` (UTC). Previous day’s count is stored in `data/member_count.json` so the “up/down from previous day” stays correct across restarts.
