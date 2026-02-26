# The Trading Circle — Website Bot

Separate Discord bot for the website:

- **Contact form** → POST to `/api/contact` → bot DMs you (email + message).
- **8:30 PM daily job** → reads Discord (categories, channels, recap) → updates win rate, % gain, traders → writes `config.json`, `traders.json` for the site.
- **Serves** the static site and `/api/config.json`, `/api/traders.json`, `/api/featured.json`.

Use a **new** Discord application (new token) so you don’t touch your existing bot.

See **DEPLOY_WALKTHROUGH.md** (in the repo root) for full setup: Discord app, GitHub, domain, Droplet, PM2.

## Quick run (local)

```bash
cp .env.example .env
# Edit .env with your token, GUILD_ID, RECAP_CHANNEL_ID, CONTACT_DM_USER_ID, SITE_DIR, etc.
npm install
npm start
```

Site at http://localhost:3000. Contact form POSTs to /api/contact and will DM CONTACT_DM_USER_ID.
