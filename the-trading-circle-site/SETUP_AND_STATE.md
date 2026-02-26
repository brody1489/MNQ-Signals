# The Trading Circle — Current State & Setup Plan

**Keep the site exactly as it is now.** This file records that state and the planned setup (hosting, auto-update, Discord, contact).

---

## Current state (frozen)

- **Home:** Hero, four cards (Real-Time Trades, Educating Community, Active Traders, Track Record). Track Record card: “Our analysts have been in the market for years, which has led to this server maintaining a **X**% all-time win rate.” — only the win rate appears on the card (from `config.winRatePercent`). No % gain on the card.
- **Track Record panel (on click):** Live stats only — win rate % and all-time gain % from config (e.g. 92.01%, 56,104.02%); intro line “We track every idea our analysts share. The numbers below are all-time and updated daily from real outcomes.”; no “over ___%”; “Featured trades” carousel.
- **Config (`config.js`):** `discordInviteUrl`, `contactEmail`, `activeTradersCount`, `winRatePercent`, `allTimeGainPercent`. Join Discord buttons use `discordInviteUrl`. Contact uses `contactEmail` (mailto for now).
- **Resources:** Removed from nav; no resources page in current design.
- **Disclaimer:** Loaded from `content/disclaimer.html`.

---

## Hosting

- **Goal:** Cheap/free except for “just hosting”; easy to edit and push (you liked Railway for that).
- **Options:**
  - **Static site only (current build):** Host the HTML/CSS/JS on a **free** static host (Vercel, Netlify, Cloudflare Pages). Connect the repo; push to Git → auto-deploy. No server to maintain. **Cost: $0.** Config can be a built-time `config.js` or a `config.json` the site fetches from a URL that your bot updates.
  - **Railway:** Good DX, push from Git. **Pricing:** Hobby $5/mo gives $5 usage credit; you pay for what you use (RAM, CPU, egress). A static site or tiny Node server is usually well under $5/mo — so effectively flat “a few dollars” unless traffic is huge. Not usage-by-visitor; usage by compute/storage.
  - **Droplet (current bot):** You already use it for the Discord bot. You could serve the static site from the same Droplet (e.g. nginx) or keep the site elsewhere and only use the Droplet for the bot + a small API that serves `config.json` (and maybe trader list). Setup/editing is more manual than Railway/Vercel.
- **Recommendation:** Put the **static site** on **Vercel or Netlify (free)** and connect the repo so “edit and push” updates the site. Keep the **bot on the Droplet**. Have the bot (or a cron job next to it) write the live data (win rate, gain, traders, PFPs) to a **config JSON** that the site fetches (e.g. from the same Droplet or from a small serverless endpoint). That way: free hosting for the site, no extra cost beyond the Droplet you already have.

---

## Auto-update (every night after recap)

- **When:** Right after the nightly recap (e.g. 8:00 or 8:30).
- **What to refresh:**
  - Win rate and all-time gain % (from recap or your tracking).
  - **Traders:** Who’s in each category; add/remove; name changes; PFP changes.
- **How:** Bot (or a script that runs after the recap) computes/reads the new values and writes them to the place the site reads:
  - Option A: Overwrite a `config.json` (or `config.js`) that is deployed with the site or served by a small API.
  - Option B: Bot writes to a file on the Droplet; a tiny HTTP server serves that file; the site fetches it at load (e.g. `fetch('/api/config.json')` or a public URL).  
  So: “recap runs → then script/bot updates win rate, gain, trader list + PFPs → site’s next load gets new data.”

---

## Join Discord

- **Already in place:** All “Join Discord” buttons use `config.discordInviteUrl`.
- **To go live:** Set `discordInviteUrl` in `config.js` (or in the generated config you serve) to your real invite, e.g. `https://discord.gg/YourCode`. No code change needed beyond that.

---

## Contact / business email

- **Current:** Contact page uses `config.contactEmail` with a mailto link (opens the user’s email client).
- **When you have a business email:** Set `contactEmail` in config to that address; mailto will use it. No code change needed.
- **If you want “submit and get an email” without the user opening their client:** Use a form backend (e.g. Formspree, Netlify Forms, or a tiny serverless function) that sends you an email with their message; form posts there instead of mailto. Can be added later without changing the rest of the site.

---

## Categories and analysts (Discord → site)

- **Your structure:** Discord has **categories** (e.g. Options, Stocks, Futures, Crypto). Under each category you have **analyst channels** (e.g. “hengy alerts”, “fomo alerts”). You have an **analyst role**; members with that role are the analysts.
- **Goal on the site:** Show categories, then under each category the list of analysts (name + PFP), with names coming from the analyst role and matched to channels/categories.
- **Logic:**
  1. List Discord categories (or a fixed list: Options, Stocks, Futures, Crypto).
  2. For each category, get the “analyst” channels (e.g. by name pattern or by category id).
  3. Get all members with the **analyst role**.
  4. **Cross-reference:** Match analysts to channels/categories (e.g. by channel name “hengy alerts” → Hengy, or by a role/category mapping you define). So you know: Hengy → Options, Fomo → Stocks, etc.
  5. For each analyst: display name, avatar URL (PFP), “Options analyst” / “Stocks analyst” etc.
  6. Output a JSON the site can use: e.g. `{ "Options": [ { "name": "Hengy", "avatar": "https://...", "role": "Options analyst" } ], ... }`.
- **When to run:** Same nightly job after recap — refresh this list (add/remove people, name changes, PFP changes) and write it to the same place the site gets config (e.g. `traders.json` or inside the main config JSON).

---

## Summary

| Item              | Status / action                                                                 |
|-------------------|-------------------------------------------------------------------------------|
| Site behavior     | Keep as-is; Track Record card = win rate only; panel = live win rate + gain. |
| Hosting           | Prefer static on Vercel/Netlify (free) + bot on Droplet; or Railway if you want one place. |
| Auto-update       | After nightly recap: bot/script updates win rate, gain, traders, PFPs → site fetches updated config/JSON. |
| Join Discord      | Set `discordInviteUrl` in config to real invite.                              |
| Contact           | Set `contactEmail` to business email; optional: add form backend later.       |
| Categories/analysts| Bot: categories → channels → analyst role → cross-reference → output JSON; site reads it for Active Traders. |

**Full walkthrough (hosting, domain, bot, DB, recap math, carousel, contact, responsive):** see **NEXT_STEPS.md**.
