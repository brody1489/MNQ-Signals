'use strict';
/**
 * With `npm start` running in another window, run:
 *   npm run test-login
 * Confirms the *running* Node process accepts your .env ADMIN_KEY (same as Unlock).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeAdminKey(raw) {
  let s = String(raw ?? '')
    .replace(/\r/g, '')
    .trim()
    .replace(/^\uFEFF/, '');
  if (/^admin_key\s*=/i.test(s)) s = s.replace(/^admin_key\s*=\s*/i, '').trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1).trim();
  return s;
}

const key = normalizeAdminKey(process.env.ADMIN_KEY);
const port = parseInt(process.env.PORT, 10) || 3333;
const base = `http://127.0.0.1:${port}`;

if (!key) {
  console.error('ADMIN_KEY empty in .env');
  process.exit(1);
}

async function main() {
  const url = `${base}/api/admin/ping`;
  const r = await fetch(url, { headers: { 'X-Admin-Key': key } });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (r.ok) {
    console.log('OK: running server at ' + base + ' accepted your ADMIN_KEY (Unlock should work).');
    process.exit(0);
  }
  console.error('FAIL: HTTP ' + r.status, body);
  if (r.status === 401) {
    console.error('The running server rejected the key. Restart: Ctrl+C the server, then npm start again.');
  }
  if (r.status === 503) {
    console.error('Server has no ADMIN_KEY loaded — wrong folder or .env not read. Start server from ttc-creator-hub folder.');
  }
  process.exit(1);
}

main().catch((e) => {
  const code = e && e.cause && e.cause.code ? e.cause.code : e && e.code;
  console.error('Cannot reach ' + base + (code ? ' — ' + code : '') + '. ' + (e && e.message ? e.message : ''));
  console.error('');
  console.error('Nothing answered on port ' + port + '. Start the server first, then run this again:');
  console.error('  Window A:  npm run start-fresh   (or npm start)  — leave it running');
  console.error('  Window B:  npm run test-login');
  process.exit(1);
});
