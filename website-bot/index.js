'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { Client, GatewayIntentBits } = require('discord.js');
const { runJob } = require('./job.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const SITE_DIR = process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : null;
const CONTACT_DM_USER_ID = process.env.CONTACT_DM_USER_ID;
const GUILD_ID = process.env.GUILD_ID;
const RECAP_CHANNEL_ID = process.env.RECAP_CHANNEL_ID;
const CRON_DAILY = process.env.CRON_DAILY || '30 20 * * *';
const TZ = process.env.TZ || 'UTC';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length < 254;
}

let discordClient = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', () => {
  discordClient = client;
  console.log('[website-bot] Logged in as', client.user.tag);

  app.post('/api/contact', async (req, res) => {
    const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
    const message = (req.body && req.body.message) ? String(req.body.message).trim() : '';
    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email' });
    }
    if (!CONTACT_DM_USER_ID) {
      return res.status(500).json({ ok: false, error: 'contact_not_configured' });
    }
    try {
      const user = await client.users.fetch(CONTACT_DM_USER_ID);
      await user.send(
        `**Contact form — The Trading Circle**\n\n**Email:** ${email}\n\n**Message:**\n${message || '(no message)'}`
      );
      res.json({ ok: true });
    } catch (e) {
      console.error('[contact] DM failed:', e.message);
      res.status(500).json({ ok: false, error: 'send_failed' });
    }
  });

  app.get('/api/config.json', (req, res) => {
    const p = path.join(DATA_DIR, 'config.json');
    if (!fs.existsSync(p)) return res.status(404).json({});
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  });

  app.get('/api/traders.json', (req, res) => {
    const p = path.join(DATA_DIR, 'traders.json');
    if (!fs.existsSync(p)) return res.status(404).json({ list: [] });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  });

  app.get('/api/featured.json', (req, res) => {
    const p = path.join(DATA_DIR, 'featured.json');
    if (!fs.existsSync(p)) return res.status(404).json([]);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  });

  if (SITE_DIR && fs.existsSync(SITE_DIR)) {
    app.use(express.static(SITE_DIR));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const file = path.join(SITE_DIR, req.path === '/' ? 'index.html' : req.path);
      if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) return res.sendFile(file);
      res.sendFile(path.join(SITE_DIR, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log('[website-bot] Server on port', PORT);
  });

  const runDaily = () => runJob(client, {
    guildId: GUILD_ID,
    recapChannelId: RECAP_CHANNEL_ID,
    dataDir: DATA_DIR,
    analystRoleName: process.env.ANALYST_ROLE_NAME || 'analyst',
  }).catch(e => console.error('[job]', e));

  runDaily();
  cron.schedule(CRON_DAILY, runDaily, { timezone: TZ });
  console.log('[website-bot] Daily job scheduled:', CRON_DAILY, 'timezone:', TZ);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(e => {
  console.error('Discord login failed:', e.message);
  process.exit(1);
});
