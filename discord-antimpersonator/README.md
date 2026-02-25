# Discord Anti-Impersonation Bot

Runs 24/7 on Railway. Bans users whose **Discord username (handle)** is within 1 character of any protected member (Owner / Developer / Analyst). Uses only the global username, not server nicknames.

## What you need before deploy

1. **Bot token** – [Discord Developer Portal](https://discord.com/developers/applications) → your app → Bot → Reset/Copy token.
2. **Server (guild) ID** – Right‑click your server icon → Copy Server ID (Developer Mode on).
3. **Log channel ID** – Right‑click your `#security-logs` channel → Copy Channel ID.
4. **Role IDs** – Owner, Developer, Analyst (right‑click role → Copy Role ID).

## Discord Developer Portal

- **Bot** → Enable **Server Members Intent** (required for `GuildMembers`).
- **OAuth2 → URL Generator** → Scopes: `bot`, `applications.commands`; Permissions: **Ban Members**, **View Channels**, **Read Message History** (optional, for message deletion).

Invite the bot with that URL.

## Environment variables (Railway)

Set these in your Railway project → Variables:

| Variable | Example | Required |
|----------|---------|----------|
| `DISCORD_BOT_TOKEN` | (your bot token) | Yes |
| `GUILD_ID` | 1420529407524606044 | Yes |
| `LOG_CHANNEL_ID` | 1476006615646998619 | Yes |
| `OWNER_ROLE_ID` | 1443415927981867149 | Yes |
| `DEVELOPER_ROLE_ID` | 1464373846155985138 | Yes |
| `ANALYST_ROLE_ID` | 1443403865415487538 | Yes |
| `PORT` | (Railway sets this) | Auto |

## Run locally

```bash
cd discord-antimpersonator
cp .env.example .env
# Edit .env and set DISCORD_BOT_TOKEN and IDs
npm install
npm start
```

## Deploy on Railway

1. In [Railway](https://railway.app), **New Project** → **Deploy from GitHub repo**.
2. Select the repo and set **Root Directory** to `discord-antimpersonator` (or deploy from a repo that contains only this folder).
3. Add all variables above in the **Variables** tab.
4. Deploy. The bot starts with `node index.js`. Health: `GET /` or `GET /health` on the assigned URL.

## Behavior

- **Protected baseline**: Everyone with Owner, Developer, or Analyst is “safe.” Their current **usernames** are the protected handles. Baseline updates on startup, on role changes, and every 10 minutes.
- **Detection**: On join or username change, if a non‑protected user’s handle is within **edit distance 1** of any protected handle → **permanent ban** and log to `#security-logs`.
- **Safety**: Bots, users with Administrator, and protected-role members are never actioned. You can add **ignore roles** (e.g. Carl-bot) via slash command.

## Slash commands (Owner / Owner role only)

- `/impersonation status` – threshold, enforce on/off, dry run, counts.
- `/impersonation threshold <1–10>` – edit distance (default 1).
- `/impersonation enforce on|off` – turn enforcement on or off.
- `/impersonation dryrun on|off` – log only, no ban (for testing).
- `/impersonation refresh` – force refresh protected list.
- `/impersonation protect add|remove <user ID>` – manually add/remove protected user.
- `/impersonation ignore-role add|remove <role ID>` – roles to never action (e.g. bot roles).

Bans are posted in your `#security-logs` channel with user, handle, matched handle, distance, and action.
