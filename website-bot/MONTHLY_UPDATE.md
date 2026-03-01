# Monthly auto-update (Last month's top plays + Featured trades)

**No hardcoded years.** The bot always uses the current date: in March 2026, "last month" = **February 2026**. Your Feb 2026 recap data is what gets loaded.

**Backfill on deploy:** The job runs **on startup** as well as on the cron schedule. So when you push and restart (e.g. `pm2 restart website-bot`), it immediately fetches last month’s recaps and writes realtimeHighlights + featured.json. You don’t have to wait until 8:30 PM.

## What runs

Every time the daily job runs (startup + default **8:30 PM America/New_York** via cron), the bot now:

1. **Daily job** — Updates `config.json` (win rate, all-time gain, trader count) from the recap channel and Discord guild; writes `traders.json`.
2. **Monthly job** — Computes **last calendar month** (e.g. February when we're in March), fetches all recap messages from the recap channel in that date range, parses trades by category (Options, Stocks, Futures, Crypto), then:
   - Writes **realtimeHighlights** (top 1 per category) into `config.json` → used by the **Real-Time Trades** panel (top bar).
   - Writes **featured.json** (top 2 per category for the carousel) → used by the **Track Record** panel (bottom carousel).

So on **March 1** (after the job runs that day), "Last month's top plays" and "Featured trades" will show **February** data.

## Timezone and leap years

- Cron uses **TZ** (default `America/New_York`) so the job runs at the same clock time in your timezone.
- "Last month" is computed from the **server date** when the job runs. So run the job at least once in the new month (e.g. 8:30 PM Eastern on March 1) and you get February's data. Set **TZ=America/New_York** in your process environment so the server date aligns with Eastern when you run manually or use other date logic.
- Leap years are handled: last day of month is from `date-fns` `lastDayOfMonth` (e.g. Feb 29 in leap years).

## Env

- **TZ** — Optional. Default `America/New_York`. Used for cron schedule and for consistent "today" when the job runs.
- **RECAP_CHANNEL_ID** — Required for monthly update. Same channel the daily recap bot posts to; we read past messages in that channel for the date range.
- **CRON_DAILY** — Optional. Default `30 20 * * *` (8:30 PM in TZ).

## Manual run

To refresh monthly data immediately (e.g. after deploy):

1. Restart the bot (so the next cron run will happen), or
2. Trigger the job once: the job runs on startup, so `pm2 restart website-bot` will run it once and then on schedule.
