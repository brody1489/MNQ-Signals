# The Trading Circle — Website

Black background, white text, gold accents. Run locally and test as a normal user (no admin or edit UI).

## 1. Add your logo

Put your logo image in the **`img`** folder and name it **`logo.png`** (or edit `index.html`, `contact.html`, `resources.html`, and `disclaimer.html` and change `img/logo.png` to your filename, e.g. `img/logo.svg`).  
If the image is missing, the header shows a “TTC” fallback.

## 2. Set your links and contact

Edit **`config.js`** in the project root:

- **discordInviteUrl** — Your Discord invite (e.g. `https://discord.gg/xxxxx`).
- **contactEmail** — Email used for the contact form and “email us” link.
- **activeTradersCount**, **winRatePercent**, **cumulativeGainPercent** — Numbers shown on the homepage (“12 active traders”, “over 90% win rate”, “over 10,000% cumulative”). Change these anytime; no other code edits needed.

## 3. Run locally (CMD)

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

## Pages

- **Home** — Hero, “Join Discord”, four cards that slide up on scroll (Real-Time Trades, Educating Community, Active Traders, Track Record), Resources link, Disclaimer link.
- **Contact** — Form that opens your email client (mailto) with the message; plus direct email link.
- **Resources** — List of your resource links (Stock/Options/Futures/Forex/Crypto terms, Trading Basics, Taxes, Psychology, etc.); opens in new tabs.
- **Disclaimer** — Full disclaimer and terms (on-site). Your Google Doc disclaimer is at: https://docs.google.com/document/d/1EL6nFwdvNx_Zg0hUNZlX5Wkln1GWEaATa5ekhbsWE9A/edit — this page mirrors that style; you can replace the text here with a copy from the doc if you prefer.

All “Join Discord” buttons use the URL from `config.js`. Footer links go to Resources and Disclaimer. No one can edit the site from the browser; only you by changing files and config.
