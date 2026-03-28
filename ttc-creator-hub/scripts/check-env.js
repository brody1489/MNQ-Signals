'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const remote = String(process.env.REMOTE_API_URL || '')
  .trim()
  .replace(/\/$/, '');
const k = process.env.ADMIN_KEY;

if (!k || !String(k).trim()) {
  console.error('ADMIN_KEY is missing or empty in .env');
  process.exit(1);
}

const len = String(k).trim().length;
console.log('OK: ADMIN_KEY is set in .env (length ' + len + ').');
console.log('PORT=' + (process.env.PORT || '3333'));

if (remote) {
  console.log('');
  console.log('>>> IMPORTANT: REMOTE_API_URL is set to: ' + remote);
  console.log('>>> The admin "Unlock" button checks /api/admin/ping on THAT host, not only this PC.');
  console.log('>>> Paste the ADMIN_KEY from the SERVER\'s .env on ' + remote + ' — your local ADMIN_KEY here only matches if you made them identical.');
  console.log('>>> To log in using ONLY this folder\'s .env key: remove or comment REMOTE_API_URL, save .env, restart (Ctrl+C then npm start), try Unlock again.');
  console.log('');
} else {
  console.log('REMOTE_API_URL is not set — Unlock uses this machine\'s ADMIN_KEY only.');
}
