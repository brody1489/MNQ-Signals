# Project

This repo is your main workspace. For **Railway**, each bot or app is meant to be its **own GitHub repo** so you get a clean list: click one → launch that one (no MNQ, no mixing).

## Bots / apps (each = separate repo when deployed)

| App | In this repo | Deploy as |
|-----|--------------|-----------|
| **Discord anti-impersonator** | [`discord-antimpersonator/`](discord-antimpersonator/) | Its own repo → Railway. See [discord-antimpersonator/PUBLISH_AS_OWN_REPO.md](discord-antimpersonator/PUBLISH_AS_OWN_REPO.md). |
| **Bot 2** (later) | New folder when you build it | New repo → Railway. Same idea. |
| **Bot 3** (later) | New folder when you build it | New repo → Railway. Same idea. |

## How to get the “list” in Railway

1. **Anti-impersonator** – Publish it as its own repo (one-time), then Railway → New Project → Deploy from GitHub → pick **discord-antimpersonator**.
2. **Future bots** – Create a new folder here, build the bot, then create a new GitHub repo and push that folder as the repo root. It will show up in Railway’s list; click it and launch.

Separate repo per bot = separate tracking, names, and files. No MNQ, no shared deploy config.

## Other code in this repo (local only)

- **orderflow_strategy/** — Python backtesting (run locally).
- **swing_screener/** — Python screener (run locally).
- **app/, components/, etc.** — Next.js site (deploy separately if you host it).
