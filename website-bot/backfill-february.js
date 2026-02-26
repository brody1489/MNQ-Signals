'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const { runJob } = require('./job.js');

const GUILD_ID = process.env.GUILD_ID;
const RECAP_CHANNEL_ID = process.env.RECAP_CHANNEL_ID;
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

const FEB_START = new Date(Date.UTC(2025, 1, 1, 0, 0, 0));
const FEB_END = new Date(Date.UTC(2025, 2, 0, 23, 59, 59));

const TRADER_TO_CATEGORY = {
  cashout: 'Crypto', timm: 'Crypto',
  dorado: 'Options', pvp: 'Options',
  hengy: 'Stocks', luxe: 'Stocks', fomo: 'Stocks',
  mitro: 'Futures', viper: 'Futures', stormzyy: 'Futures', toph: 'Futures',
};

function parseRecapMessage(content) {
  const result = { wins: 0, losses: 0, gainPercent: 0, trades: [] };
  let currentCategory = null;
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const t = line.trim();
    const sectionMatch = t.match(/^([A-Za-z0-9]+)\s+Alerts?\s*(?:\s|$|💸|🐟|📊|🔥|🐍|⚡|🐻|🏆|👑|🔑|💰)/i);
    if (sectionMatch) {
      const name = sectionMatch[1].toLowerCase();
      currentCategory = TRADER_TO_CATEGORY[name] || null;
      continue;
    }
    const tradeMatch = t.match(/^\$?([A-Z0-9]+)\s+(LONG|SHORT)\s+(?:\+?([\d,.]+)\s*%|\+?([\d,.]+)\s*(?:points?|pts))/i);
    if (tradeMatch && currentCategory) {
      const ticker = tradeMatch[1].toUpperCase();
      const pct = tradeMatch[3];
      const points = tradeMatch[4];
      const resultStr = pct != null ? '+' + parseFloat(String(pct).replace(/,/g, '')) + '%' : '+' + (points || '0') + ' pts';
      const value = pct != null ? parseFloat(String(pct).replace(/,/g, '')) : parseFloat(String(points).replace(/,/g, '')) || 0;
      result.trades.push({ category: currentCategory, ticker, resultStr, value, isPoints: points != null });
      continue;
    }
    const wrMatch = t.match(/Alert\s+Winrate:\s*(\d+)\/(\d+)/i) || t.match(/(\d+)\/(\d+)\s*\d*\s*%/);
    if (wrMatch) {
      const w = parseInt(wrMatch[1], 10);
      const total = parseInt(wrMatch[2], 10);
      result.wins = w;
      result.losses = total - w;
      continue;
    }
    const gainMatch = t.match(/Total\s+Gain:\s*\+?([\d,.]+)\s*%/i) || t.match(/\+?([\d,.]+)\s*%\s*🚀/);
    if (gainMatch) {
      result.gainPercent = parseFloat(String(gainMatch[1]).replace(/,/g, ''));
      if (isNaN(result.gainPercent)) result.gainPercent = 0;
    }
  }
  return result;
}

function buildFeatured(tradesByCategory) {
  const featured = [];
  const order = ['Options', 'Stocks', 'Futures', 'Crypto'];
  for (const cat of order) {
    const list = (tradesByCategory[cat] || []).sort((a, b) => b.value - a.value);
    const top2 = [];
    for (const t of list) {
      if (top2.length >= 2) break;
      if (cat === 'Futures') {
        top2.push(t);
      } else {
        if (top2.length === 0) top2.push(t);
        else if (top2.length === 1 && top2[0].ticker !== t.ticker) top2.push(t);
      }
    }
    for (const t of top2) {
      const meta = cat + ' · Feb 2025';
      featured.push({ ticker: t.ticker, meta, result: t.resultStr });
    }
  }
  return featured;
}

function buildRealtimeHighlights(tradesByCategory) {
  const order = ['Options', 'Stocks', 'Futures', 'Crypto'];
  return order.map(cat => {
    const list = (tradesByCategory[cat] || []).sort((a, b) => b.value - a.value);
    const top = list[0];
    return top ? { category: cat, ticker: top.ticker, result: top.resultStr } : { category: cat, ticker: '—', result: '—' };
  });
}

async function run() {
  if (!RECAP_CHANNEL_ID || !GUILD_ID) {
    console.error('Set RECAP_CHANNEL_ID and GUILD_ID in .env');
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.login(process.env.DISCORD_BOT_TOKEN).catch(reject);
  });

  const channel = await client.channels.fetch(RECAP_CHANNEL_ID);
  let allMessages = [];
  let lastId = null;
  let done = false;
  while (!done) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    const sorted = Array.from(batch.values()).sort((a, b) => b.createdAt - a.createdAt);
    for (const m of sorted) {
      if (m.createdAt < FEB_START) { done = true; break; }
      if (m.createdAt <= FEB_END) allMessages.push(m);
      lastId = m.id;
    }
    if (done || batch.size < 100) break;
  }

  let totalWins = 0, totalLosses = 0, totalGain = 0;
  const allTrades = [];

  for (const msg of allMessages) {
    if (!msg.content) continue;
    const parsed = parseRecapMessage(msg.content);
    totalWins += parsed.wins;
    totalLosses += parsed.losses;
    totalGain += parsed.gainPercent;
    allTrades.push(...parsed.trades);
  }

  const dataPath = DATA_DIR;
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });

  const totalsPath = path.join(dataPath, 'totals.json');
  let totals = { wins: 0, losses: 0, totalGainPercent: 0, lastRecapDate: '2025-02-28' };
  if (fs.existsSync(totalsPath)) {
    try {
      totals = JSON.parse(fs.readFileSync(totalsPath, 'utf8'));
    } catch (_) {}
  }
  totals.wins += totalWins;
  totals.losses += totalLosses;
  totals.totalGainPercent += totalGain;
  fs.writeFileSync(totalsPath, JSON.stringify(totals, null, 2));

  const tradesByCategory = { Options: [], Stocks: [], Futures: [], Crypto: [] };
  for (const t of allTrades) {
    if (tradesByCategory[t.category]) tradesByCategory[t.category].push(t);
  }

  const featured = buildFeatured(tradesByCategory);
  const realtimeHighlights = buildRealtimeHighlights(tradesByCategory);

  await runJob(client, {
    guildId: GUILD_ID,
    recapChannelId: null,
    dataDir: DATA_DIR,
    analystRoleName: process.env.ANALYST_ROLE_NAME || 'analyst',
  });

  const configPath = path.join(dataPath, 'config.json');
  let config = {};
  if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.realtimeHighlights = realtimeHighlights;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  fs.writeFileSync(path.join(dataPath, 'featured.json'), JSON.stringify(featured, null, 2));

  console.log('[backfill] February done. Messages:', allMessages.length, 'Wins:', totalWins, 'Losses:', totalLosses, 'Gain:', totalGain.toFixed(2) + '%');
  console.log('[backfill] Featured trades:', featured.length, 'Realtime highlights:', realtimeHighlights.length);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
