# Welcome Message Bot (The Trading Circle)

Sends **one** welcome DM to new members when they join your server. Same server as your anti-impersonator (same `GUILD_ID`).

## Discord bot setup

1. **Create the bot** – [Discord Developer Portal](https://discord.com/developers/applications) → New Application (e.g. "The Trading Circle" or "Welcome Bot") → Bot → Create bot.

2. **Enable intent** – Bot → **Privileged Gateway Intents** → turn **Server Members Intent** **ON**. (Required so the bot receives join events.)

3. **Invite the bot** – OAuth2 → URL Generator:
   - **Scopes:** `bot`
   - **Bot permissions:** none required for DMs. If the generator forces a permission, pick **View Channel** only so it stays minimal.
   - Use the generated URL, open it in a browser, select your server, authorize. The bot only needs to be in the server; it doesn’t need to read or send messages in channels.

4. **Copy the bot token** – Bot → Reset/Copy token. Use this as `DISCORD_BOT_TOKEN` in Railway (never commit it).

## Permissions summary

| What              | Needed? |
|-------------------|--------|
| Server Members Intent | **Yes** (Developer Portal) |
| Ban Members        | No |
| Send Messages (in channels) | No |
| Read Messages      | No |
| View Channel       | Only if invite UI requires a permission |

The bot only sends a **DM** to the user on join; that doesn’t use any server channel permissions. One join = one DM. If a user has DMs disabled, the bot logs it and continues.

## Environment variables (Railway)

| Variable | Example | Required |
|----------|---------|----------|
| `DISCORD_BOT_TOKEN` | (your bot token) | Yes |
| `GUILD_ID` | 1420529407524606044 | Yes |
| `PORT` | (Railway sets this) | Auto |

Optional: `WELCOME_MESSAGE` – full message text; use `{username}` for their name and `\n` for new lines. If not set, the default Trading Circle message is used.

## Run locally

```bash
cd welcome-message
cp .env.example .env
# Edit .env: set DISCORD_BOT_TOKEN and GUILD_ID
npm install
npm start
```

## Deploy on Railway

1. New Project → Deploy from GitHub repo → select your **welcome message** repo.
2. Variables: add `DISCORD_BOT_TOKEN` and `GUILD_ID`.
3. Deploy. No Root Directory needed if the repo root is this folder.

## Default message (with spacing)

```
Welcome **{username}** to The Trading Circle.

We're committed to making this a solid place for discussion and growth. If you have questions or ideas, please let us know.

**Important:** There are a lot of impersonators and scammers out there. My staff and I will never DM you first. Please stay safe and never give out personal information to anyone.
```

To change it, set `WELCOME_MESSAGE` in Railway (use `\n` for new lines).
