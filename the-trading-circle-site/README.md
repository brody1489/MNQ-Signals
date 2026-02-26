# The Trading Circle — Website

Black background, white text, gold accents. Run locally and test as a normal user (no admin or edit UI).

## 1. Add your logo

Put your logo image in the **`img`** folder and name it **`logo.png`** (or edit `index.html`, `contact.html`, `resources.html`, and `disclaimer.html` and change `img/logo.png` to your filename, e.g. `img/logo.svg`).  
If the image is missing, the header shows only the text "The Trading Circle" (no yellow box); previously the "TTC" box was shown “TTC” fallback.

## 2. Set your links and contact

Edit **`config.js`** in the project root:

- **discordInviteUrl** — Your Discord invite (e.g. `https://discord.gg/xxxxx`).
- **contactEmail** — Email used for the contact form and “email us” link.
- **activeTradersCount** — Shown on the homepage (“X active traders”).
- **winRatePercent** — Shown on the Track Record card and in the Track Record panel (e.g. 90 or 92.01).
- **allTimeGainPercent** — Shown only in the Track Record panel when you click the card (live). Change these anytime; no other code edits needed.

## 3. Your content (no Google Docs)

Paste your disclaimer and resource text in the **`content`** folder so the site shows it on the page (no links to external docs). See **`content/README.txt`** for where to paste what. Run with `npx serve` so those files load.

## 4. Run locally (CMD)

In a terminal, from this folder:

```cmd
cd c:\Website_design\the-trading-circle-site
npx serve -l 3000
```

Or with Python:

```cmd
cd c:\Website_design\the-trading-circle-site
python -m http.server 3000
```

Then open **http://localhost:3000** in your browser. You’re viewing as a normal user; there is no dev-only or edit UI.

## 5. Pages

- **Home** — Hero, “Join Discord”, four cards that slide up on scroll (Real-Time Trades, Educating Community, Active Traders, Track Record). Track Record card shows only win rate %; full stats (win rate + all-time gain) in the panel when you click. Disclaimer link.
- **Contact** — Form that opens your email client (mailto) using **contactEmail** from config.
- **Disclaimer** — Loaded from **content/disclaimer.html**. Paste your full disclaimer there (word for word). See **content/README.txt**.

All “Join Discord” buttons use the URL from `config.js`. Run with **npx serve -l 3000** so content loads from the `content/` folder. No one can edit the site from the browser; only you by changing files. See **SETUP_AND_STATE.md** for hosting, auto-update, Discord/contact, and category→analyst setup.
