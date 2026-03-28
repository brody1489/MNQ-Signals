'use strict';

/**
 * Local + production server for creator hub.
 * - Serves /public (static)
 * - GET /api/campaigns — public (for site + dashboard read)
 * - Mutating routes require header: X-Admin-Key: <ADMIN_KEY>
 * - Writes data/campaigns.json (commit or rsync this file to go live on static hosts,
 *   or run this same server on the droplet behind nginx)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Strip BOM, quotes, accidental `ADMIN_KEY=` paste from .env values */
function normalizeAdminKey(raw) {
  let s = String(raw ?? '')
    .replace(/\r/g, '')
    .trim()
    .replace(/^\uFEFF/, '');
  if (/^admin_key\s*=/i.test(s)) {
    s = s.replace(/^admin_key\s*=\s*/i, '').trim();
  }
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1).trim();
  return s;
}

const PORT = parseInt(process.env.PORT, 10) || 3333;
const ADMIN_KEY = normalizeAdminKey(process.env.ADMIN_KEY);
/** When set, local dashboard + (by default) campaign reads target this origin (e.g. https://thetradingcircle.org) */
const REMOTE_API_URL = String(process.env.REMOTE_API_URL || '')
  .trim()
  .replace(/\/$/, '');
/** If 1, GET /api/campaigns uses local data/campaigns.json even when REMOTE_API_URL is set (draft testing) */
const LOCAL_CAMPAIGN_DATA =
  process.env.LOCAL_CAMPAIGN_DATA === '1' || process.env.LOCAL_CAMPAIGN_DATA === 'true';
const PROXY_CAMPAIGNS = Boolean(REMOTE_API_URL) && !LOCAL_CAMPAIGN_DATA;

/** Production: comma-separated origins allowed to call your API from a browser (e.g. http://localhost:3333) */
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DATA_PATH = path.join(__dirname, 'data', 'campaigns.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.length === 0) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
    allowedHeaders: ['Content-Type', 'X-Admin-Key'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '512kb' }));

function loadStore() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveStore(store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: 'ADMIN_KEY not set on server' });
  }
  const key = normalizeAdminKey(req.get('x-admin-key') || '');
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid or missing X-Admin-Key' });
  }
  next();
}

/** Verify X-Admin-Key without changing data */
app.get('/api/admin/ping', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

/** Tells the browser admin UI whether to send saves to the live site */
app.get('/api/config', (req, res) => {
  res.json({
    remoteApiBase: REMOTE_API_URL,
    campaignReads: LOCAL_CAMPAIGN_DATA ? 'local' : REMOTE_API_URL ? 'remote' : 'local',
    /** Where /api/admin/ping goes from the dashboard (browser): local origin vs REMOTE_API_URL */
    adminPingIsRemote: Boolean(REMOTE_API_URL),
    /** Safe diagnostics: length only (compare to `npm run check-env`) */
    adminKeyConfigured: ADMIN_KEY.length > 0,
    adminKeyLength: ADMIN_KEY.length,
  });
});

/** Public: full payload — proxies to REMOTE when configured (see .env) */
app.get('/api/campaigns', async (req, res) => {
  if (PROXY_CAMPAIGNS) {
    try {
      const url = `${REMOTE_API_URL}/api/campaigns`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const text = await r.text();
      res.status(r.status).type('application/json').send(text);
    } catch (e) {
      res.status(502).json({
        error: 'Could not reach remote /api/campaigns',
        detail: e.message,
        hint: 'Deploy this app on the domain or unset REMOTE_API_URL to use local data.',
      });
    }
    return;
  }
  try {
    const store = loadStore();
    res.json({
      campaigns: store.campaigns || [],
      meta: store.meta || {},
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not load campaigns', detail: e.message });
  }
});

/** Admin: replace entire campaigns array (dashboard bulk sync) */
app.put('/api/campaigns', requireAdmin, (req, res) => {
  try {
    const store = loadStore();
    if (!Array.isArray(req.body.campaigns)) {
      return res.status(400).json({ error: 'Body must include campaigns: []' });
    }
    store.campaigns = req.body.campaigns;
    if (req.body.meta && typeof req.body.meta === 'object') {
      store.meta = { ...store.meta, ...req.body.meta };
    }
    saveStore(store);
    res.json({ ok: true, campaigns: store.campaigns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/campaigns', requireAdmin, (req, res) => {
  try {
    const store = loadStore();
    const c = req.body;
    if (!c.title || typeof c.budget !== 'number') {
      return res.status(400).json({ error: 'title and budget (number) required' });
    }
    const campaign = {
      id: c.id || crypto.randomUUID(),
      title: String(c.title).trim(),
      status: ['active', 'upcoming', 'completed'].includes(c.status) ? c.status : 'active',
      budget: Math.max(0, Number(c.budget)),
      paid_out: Math.max(0, Number(c.paid_out) || 0),
      expiration: c.expiration || null,
      short_description: String(c.short_description || '').trim(),
      description: String(c.description || '').trim(),
      payout_per_1k_views: Number(c.payout_per_1k_views) || 0,
      join_payout_tiers: Array.isArray(c.join_payout_tiers) ? c.join_payout_tiers : [],
      rules: String(c.rules || '').trim(),
      payment_note: String(c.payment_note || 'Paid out per campaign agreement after verified metrics.').trim(),
    };
    store.campaigns = store.campaigns || [];
    store.campaigns.push(campaign);
    saveStore(store);
    res.status(201).json({ ok: true, campaign });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/campaigns/:id', requireAdmin, (req, res) => {
  try {
    const store = loadStore();
    const idx = store.campaigns.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = store.campaigns[idx];
    const patch = req.body || {};
    const next = {
      ...cur,
      ...patch,
      id: cur.id,
      budget: patch.budget != null ? Math.max(0, Number(patch.budget)) : cur.budget,
      paid_out: patch.paid_out != null ? Math.max(0, Number(patch.paid_out)) : cur.paid_out,
    };
    if (next.paid_out > next.budget) next.paid_out = next.budget;
    store.campaigns[idx] = next;
    saveStore(store);
    res.json({ ok: true, campaign: next });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/campaigns/:id', requireAdmin, (req, res) => {
  try {
    const store = loadStore();
    const before = store.campaigns.length;
    store.campaigns = store.campaigns.filter((x) => x.id !== req.params.id);
    if (store.campaigns.length === before) return res.status(404).json({ error: 'Not found' });
    saveStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Main site nav uses /affiliate.html — same page as affiliates.html (tabs + Become an affiliate) */
app.get('/affiliate.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'affiliates.html'));
});

app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`TTC Creator Hub → http://localhost:${PORT}`);
  console.log(`Admin UI → http://localhost:${PORT}/admin/`);
  console.log(`Proposed home (localhost) → http://localhost:${PORT}/proposed-home.html`);
  console.log(`Proposed affiliates → http://localhost:${PORT}/proposed-affiliates.html`);
  if (!ADMIN_KEY) {
    console.warn('WARN: ADMIN_KEY empty — add ADMIN_KEY=... to .env and restart the server');
  } else {
    console.log(`Admin key loaded (${ADMIN_KEY.length} chars). Restart after any .env change.`);
  }
  if (REMOTE_API_URL) {
    console.log(`REMOTE_API_URL=${REMOTE_API_URL} → dashboard Save/Update from this PC hits that host (CORS must allow this origin).`);
    console.log(
      PROXY_CAMPAIGNS
        ? 'GET /api/campaigns proxies to remote (localhost pages show live campaign data).'
        : 'LOCAL_CAMPAIGN_DATA=1 → GET /api/campaigns uses local data/campaigns.json.'
    );
  }
  if (CORS_ORIGINS.length) {
    console.log(`CORS_ORIGINS: ${CORS_ORIGINS.join(', ')}`);
  }
});
