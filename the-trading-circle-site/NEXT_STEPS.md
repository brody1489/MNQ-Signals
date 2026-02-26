# The Trading Circle — Full Setup Walkthrough

This doc ties everything together: hosting, domain, bot, database, recap math, carousel logic, contact form, and responsive. Use it as the single checklist.

---

## 1. Hosting & domain

**Where to host**

- **Droplet (recommended for you):** Flat rate, you already use it for the bot, sustainable. Put the **website** and the **bot** on the same Droplet: nginx (or a small Node server) serves the static site + an API that returns `config.json` / `traders.json` that the bot writes. One machine, one bill.
- **Alternative:** Static site on **Vercel or Netlify (free)** with custom domain; bot + small API on Droplet. Site fetches config from the Droplet API. Cost: domain + Droplet only.

**Your own domain**

- Buy the domain (e.g. **thetradingcircle.com**) from any registrar: Namecheap, Cloudflare, Google Domains, Porkbun, etc. ~$10–15/year.
- Point it to your host:
  - **If site on Droplet:** Create an **A record** for `@` (and optionally `www`) to your Droplet’s IP. Done.
  - **If site on Vercel/Netlify:** Add the domain in their dashboard; they’ll show you what to set (usually CNAME for `www`, A or CNAME for root). 24/7 availability is normal once DNS propagates.

**Wix / Webflow**

- Those are all‑in‑one builders. Your site is **custom HTML/CSS/JS** that needs to **fetch live data** (win rate, gain, traders, featured trades) from a backend. So you need either (a) custom hosting (Droplet, Vercel, etc.) that serves your files + API, or (b) Wix/Webflow only if you re‑build the site inside their editor and use their integrations for data — which is a different path. **Recommendation:** Keep the current codebase and host it on Droplet (or static host + Droplet API).

---

## 2. Bot: what it can see and what you need

**From your Discord (image 1):**

- **Categories:** "option alerts", "stock alerts", "future alerts", "crypto".
- **Channels:** Under each category, channels like `# 🐠 | dorado-alerts`, `# 🔑 | hengy-alerts`. Format: `emoji | name-alerts`.

**Yes, a bot can:**

- List **all categories** and **all channels** in the server (with permission to view channel list).
- **Infer traders from channel names:** Split on `|`, take the right part, remove `-alerts` → e.g. `dorado`, `hengy`. Title-case for display (Dorado, Hengy). Map category name to site label: "option alerts" → Options, "stock alerts" → Stocks, "future alerts" → Futures, "crypto" → Crypto. So the bot **can** auto-determine “who’s a crypto trader” etc. from structure alone.
- Get **member list** and **roles** (with Server Members Intent): find everyone with the “analyst” role, get **display name** and **avatar URL** (PFP). Cross-reference: channel `hengy-alerts` → find a member whose username/display name matches “Hengy” (or similar) and has analyst role → use that PFP and name.

**What bot to use**

- **One bot** (your existing **discord-bots-unified** or a new app in the Discord Developer Portal). No need for a second “website bot”; extend the one you have.
- **Permissions:** At least **View Channels**, **Read Message History** (to read the recap channel), and **Manage Channels** (or **View Channel** list so it can list categories/channels). For PFPs and display names you need **Server Members Intent** enabled in the Developer Portal (Bot → Privileged Gateway Intents).
- **Administrator** is enough but broader than needed; the above is the minimal set.

**Recap (image 2)**

- Recap format: sections like "Cashout Alerts 💸", "Dorado Alerts 🐟", then lines like `$ETH LONG +127.53%` with a green circle (win), and at the bottom **"Alert Winrate: 14/15 93%"** and **"Total Gain: +1559.97%"**.
- **Option A — Bot reads recap:** When the recap is **posted** (by you or another bot) in a designated channel, the bot **reads that message** at a fixed time (e.g. 8:30 PM). It parses:
  - Last line (or block): `Alert Winrate: 14/15 93%` → extract **14** (wins), **15** (total), so **1** loss.
  - `Total Gain: +1559.97%` → extract **1559.97** (daily gain %).
- **Option B — Bot builds recap:** Bot already has the day’s trades (e.g. from the same channel or a DB). It **computes** 14/15 and +1559.97% and **posts** the recap, then uses those numbers for the DB. Either way, the bot ends up with **daily wins, daily losses, daily gain %** to add to all-time totals.

---

## 3. Database: small and simple

**Goal:** Minimal storage, clear when to prune, enough for:

- All-time win rate and all-time gain % (for the site).
- “Last month” highlights and “featured trades” carousel (top 2 per category, etc.).

**Suggested schema (e.g. SQLite or JSON files on Droplet):**

| What | Where | When to clear |
|------|--------|----------------|
| **All-time totals** | `totals`: `wins`, `losses`, `totalGainPercent` | Never clear; only add. |
| **Per-day summary** | Optional: `daily`: date, wins, losses, gainPercent | Keep last 90 days; delete older. |
| **Per-trade records** | `trades`: date, category, ticker, side (LONG/SHORT), result (% or points), traderLabel | Keep last 90 days (or last 500 trades); delete older. Used for “last month” and carousel. |

**Win rate (accurate over time):**

- **All-time win rate** = `totals.wins / (totals.wins + totals.losses)`.
- Each night after recap: add that day’s wins to `totals.wins`, that day’s losses to `totals.losses`. No “average of averages”; it’s always total wins / total count. So week1 90%, week2 90% → if both are 9/10, you have 18/20 = 90% all-time.

**All-time gain %:**

- Each night add the recap’s “Total Gain” (e.g. +1559.97%) to `totals.totalGainPercent`. That’s the live number (can be 56,104.02% etc.). Site reads it from config/API.

**Pruning:**

- Cron or bot job: once a week (or daily), delete from `trades` and `daily` where `date` older than 90 days. Totals stay forever.

---

## 4. Auto-update at 8:30 PM

**Flow:**

1. **8:00 PM (or whenever):** Recap is posted (or bot generates it and posts).
2. **8:30 PM:** Bot (or cron-triggered script) runs:
   - **Recap:** Read the recap message (or use the numbers it just posted). Parse wins, losses, daily gain %. Update `totals` (add wins, losses, add gain %). Optionally append to `trades` from the recap lines (ticker, category, %, points) for carousel/highlights.
   - **Traders:** List categories → list channels per category → parse `name-alerts` → get analyst-role members → match name, get PFP. Build `traders.json` (or section in config): `{ "Options": [ { "name": "Dorado", "avatar": "https://...", "role": "Options analyst" } ], ... }`.
   - **Config:** Write `config.json`: `winRatePercent`, `allTimeGainPercent`, `activeTradersCount`, `discordInviteUrl`, etc. Use current `totals` for win rate and gain.
   - **Featured trades:** From `trades` (last 30 days), run carousel logic (below); write `featured.json` or embed in config.
3. **Site:** Serves static HTML/CSS/JS; on load it `fetch()`es `config.json` (and `traders.json`, `featured.json` if separate). So every page load after 8:30 gets that night’s data.

---

## 5. Carousel / “featured trades” logic

**Goal:** Top 2 (or 3) trades per category by % or points, for the rotating strip. Avoid same ticker twice in a row when it looks weird.

**Rules:**

- **Options, Stocks, Crypto:** By **%** (or by points if you ever store points for these). Pick **top 2** per category. **2nd trade must be a different ticker** than the 1st in that category (next highest % with different ticker).
- **Futures:** By **points**. Top 2 per category; **allow same ticker** (NQ, ES, etc. — only a few tickers, so repetition is fine).
- **Output:** List of trades (ticker, category, result string like "+12%" or "+24 pts", optional date). Bot writes this to `featured.json` or into config. Site carousel rotates through them. “Last month” highlights can use the same data source (e.g. top 1 per category for the Real-Time panel).

---

## 6. Contact form: validation + delivery to you

**Behavior:**

- User enters **email** and **message**.
- **Validation:** Use a proper email regex/validator. **On Submit:** If invalid, don’t send; show error (e.g. input border red + “Not a valid email” under the field). Only when they click Submit (not on every keystroke or on blur while typing). Professional, no flashing while typing.
- **If valid:** POST to your backend (e.g. `https://yourdomain.com/api/contact` or a serverless function). Backend:
  - Validates again (server-side).
  - Sends the submission to **you** via:
    - **Discord:** Webhook to a private channel, or bot DMs you with “Email: … Message: …”. You reply to the user from your business email.
    - **Email:** Backend sends an email to your business address with their email and message (e.g. Nodemailer + SMTP, or SendGrid, Resend, etc.).
  - Returns success; form shows “Message sent” (no exposure of secrets).

**Security:** No API keys or secrets in the frontend. Backend uses env vars (Discord webhook URL, or SMTP credentials). Rate-limit the contact endpoint (e.g. 5 per IP per hour) to avoid abuse.

---

## 7. Join Discord link

- Already in code: all “Join Discord” buttons use `config.discordInviteUrl`.
- In the JSON the bot writes (or in `config.js` if you build at deploy time), set `discordInviteUrl` to your real invite (e.g. `https://discord.gg/YourCode`). No code change; just config.

---

## 8. Responsive (phone, tablet, desktop)

**Goal:** Same site looks good and works on small phone, large phone, iPad, MacBook, PC, etc. — no horizontal scroll, readable text, buttons that work with touch.

**What’s already there:**

- Viewport meta tag, flexible layout (grid/flex), cards go 2x2 on small screens, 4 columns on large.
- Panels (Track Record, etc.) and carousel are in the same CSS; some media queries exist.

**What to do:**

- **Audit breakpoints:** Test at 320px, 375px, 414px (phones), 768px (tablet), 1024px, 1280px (desktop). Check: header (logo + nav), hero, cards, panels, contact form, footer.
- **Touch:** Buttons and cards have enough padding; no hover-only actions that block mobile users.
- **Text:** No tiny fixed font sizes; use rem/clamp so it scales. Already using rem in places; ensure nothing is under ~14px equivalent on mobile.
- **Optional:** Add or tweak media queries so nav doesn’t overflow on small phones (e.g. hamburger or shorter labels). Document breakpoints in a short comment in `styles.css` or in this file.

---

## 9. Checklist summary

| Step | Action |
|------|--------|
| **Hosting** | Use Droplet for site + bot + API (or site on Vercel/Netlify, API on Droplet). |
| **Domain** | Buy domain (e.g. thetradingcircle.com); A record to Droplet (or add domain in Vercel/Netlify). |
| **Bot** | One bot, Server Members Intent + read channels + read recap channel. List categories/channels → traders + PFPs; read or post recap → parse wins, losses, daily gain. |
| **DB** | Totals (wins, losses, totalGainPercent); trades table for last 90 days; prune older. |
| **8:30 job** | Update totals from recap; rebuild traders list; build featured list (carousel logic); write config + traders + featured JSON for site. |
| **Carousel** | Top 2 per category; 2nd different ticker for Options/Stocks/Crypto; Futures can repeat ticker. |
| **Contact** | Validate email on submit; red + “Not a valid email” if invalid; backend posts to Discord or email to you; secrets in env only. |
| **Discord link** | Set `discordInviteUrl` in config/JSON. |
| **Responsive** | Test phone/tablet/desktop; fix overflow and touch targets; document breakpoints. |

Once this is in place, the site is live on your domain, updates every night after recap, shows live win rate and gain, correct traders and PFPs, featured trades with your logic, and a contact form that reaches you securely.
