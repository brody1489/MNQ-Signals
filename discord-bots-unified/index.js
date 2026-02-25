/**
 * One deployment: runs anti-impersonator + welcome bots in one process.
 * Single health server. Set all vars in .env (see .env.example).
 */
try { require('dotenv').config({ path: '.env' }); } catch (_) {}

const express = require('express');

// Set token env names each bot expects (they read DISCORD_BOT_TOKEN)
process.env.DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN_ANTI;
const anti = require('./bots/antimpersonator');
process.env.DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN_WELCOME;
const welcome = require('./bots/welcome');

// Start both bots (each calls client.login)
anti.start();
welcome.start();

// One health server
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.get('/', (req, res) => res.status(200).send('ok'));
app.get('/health', (req, res) =>
  res.status(200).json({
    ok: true,
    anti: anti.client?.user?.tag || 'starting',
    welcome: welcome.client?.user?.tag || 'starting',
  })
);
app.listen(PORT, () => console.log(`Health server on port ${PORT}`));
