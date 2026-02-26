# One-time February 2025 backfill

Run this **once** to backfill February data from your recap channel. It will:

1. Fetch all messages from the recap channel sent in **February 2025 only** (nothing before Feb).
2. Parse each recap for: Alert Winrate (wins/losses), Total Gain %, and individual trade lines ($TICKER LONG/SHORT +N% or +N pts).
3. Add February’s totals to `totals.json` (win rate and cumulative gain).
4. Build **featured.json** (top 2 trades per category for the carousel) and **realtimeHighlights** (one highlight per category for Real-Time Trades panel).
5. Run the normal job to refresh **traders.json** (names + PFPs from Discord) and **config.json** (win rate, gain, trader count).

**On the Droplet** (SSH in, then):

```bash
cd /root/website/bot
node backfill-february.js
```

Use the same `.env` as the main bot (DISCORD_BOT_TOKEN, GUILD_ID, RECAP_CHANNEL_ID, etc.). After it finishes, restart the site so it picks up the new files:

```bash
pm2 restart ttc-website
```

Going forward, the 8:30 daily job handles new recaps; this script is for the one-time February backfill only.
