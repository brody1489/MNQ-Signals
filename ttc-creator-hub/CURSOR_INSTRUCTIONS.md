# Instructions for Cursor (TTC Creator Hub)

## Scope

- Work **only** inside **`Website_design/ttc-creator-hub/`** unless the user explicitly asks to merge into `website/` or the droplet.
- Do **not** delete `data/campaigns.json` without backup; it holds live campaign data in production.

## Architecture (short)

| Piece | Role |
|--------|------|
| `server.js` | Express: static files from `public/`, JSON API, writes `data/campaigns.json` |
| `data/campaigns.json` | Campaign list + `meta` (e.g. form URL) |
| `public/*.html` | Creator-facing pages (`noindex`) |
| `public/admin/index.html` | Dashboard (session key in `sessionStorage`) |

## API

- **GET `/api/campaigns`** — public read.
- **GET `/api/admin/ping`** — requires header **`X-Admin-Key`**: validates key.
- **POST `/api/campaigns`** — create (requires key).
- **PATCH `/api/campaigns/:id`** — update (requires key).
- **DELETE `/api/campaigns/:id`** — delete (requires key).
- **PUT `/api/campaigns`** — bulk replace `campaigns` array (optional; advanced).
- **GET `/api/config`** — `{ remoteApiBase, campaignReads }` for the admin UI (which API origin to use).

## Env (important)

- **`REMOTE_API_URL`** (e.g. `https://thetradingcircle.org`) — when set **on the developer’s PC**, the admin dashboard sends all reads/writes to that origin so **Save** updates production without git. **Do not** set this on the production server to point at itself (avoid a proxy loop).
- **`LOCAL_CAMPAIGN_DATA=1`** — force `GET /api/campaigns` on localhost to read `data/campaigns.json` while still using `REMOTE_API_URL` for admin (draft testing).
- **`CORS_ORIGINS`** — on **production**, list `http://localhost:3333` (and `http://127.0.0.1:3333`) so browsers allow local admin → live API.

## Campaign object (shape)

```json
{
  "id": "uuid",
  "title": "",
  "status": "active | upcoming | completed",
  "budget": 1000,
  "paid_out": 0,
  "expiration": "2026-12-31T23:59:59.000Z",
  "short_description": "",
  "description": "",
  "payout_per_1k_views": 0,
  "join_payout_tiers": [{ "label": "", "amount": 100 }],
  "rules": "",
  "payment_note": ""
}
```

## UX rules the user cares about

- Dark theme, **gold `#c9a227`**, match The Trading Circle feel (`public/css/theme.css`).
- **Affiliates** page: segmented control — **Our partners** (default) | **Become an affiliate**.
- **Become** section: hooky but honest copy; **Apply** → Google Form; **View current campaigns** → `/campaigns.html`.
- **Campaigns**: cards with **progress bar** = `paid_out / budget`; handle empty, expired, completed, budget full.
- **Mobile**: responsive grids and header.

## “Auto push to production”

Out of the box, **Save** updates **only the JSON on the machine running Node**. To update the public server **without manual SSH**:

1. **Same host:** dashboard and site already share one `campaigns.json` — **instant**.
2. **Remote host:** add a small **CI/webhook** or **scheduled rsync** of `data/campaigns.json` from admin host to droplet, **or** run the **dashboard only** on the droplet (Option A in README).

Cursor should not promise “git push from browser” without implementing a webhook — describe honestly if asked.

## Common tasks

| Task | Where to edit |
|------|----------------|
| Copy / tone on landing | `public/index.html`, `public/affiliates.html` |
| Partner links (mirror .com affiliates) | `public/affiliates.html` panel-partners |
| Form URL default | `data/campaigns.json` → `meta.apply_form_url` |
| Card layout / bars | `public/css/theme.css`, `public/campaigns.html` |
| Admin fields | `public/admin/index.html` + `server.js` POST/PATCH validation |
| New API field | Extend `server.js` persistence + admin form + detail page `campaign.html` |

## Testing

```powershell
cd ttc-creator-hub
npm start
# Visit /campaigns.html, /admin/, create test campaign, verify JSON file updates
```
