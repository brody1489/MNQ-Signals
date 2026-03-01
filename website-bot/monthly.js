'use strict';

/**
 * Monthly update: always uses the CURRENT date to compute "last month".
 * So in March 2026 → last month = February 2026. No hardcoded years.
 * Runs on every job (including on startup), so after deploy/restart it immediately
 * backfills last month's top plays and featured trades.
 */

const fs = require('fs');
const path = require('path');
const { lastDayOfMonth, subMonths } = require('date-fns');

const TRADER_TO_CATEGORY = {
  cashout: 'Crypto', timm: 'Crypto',
  dorado: 'Options', pvp: 'Options',
  hengy: 'Stocks', luxe: 'Stocks', fomo: 'Stocks',
  mitro: 'Futures', viper: 'Futures', stormzyy: 'Futures', toph: 'Futures',
};

/**
 * Get start and end of "last calendar month" from today's date.
 * E.g. when run in March 2026 → February 2026. Set TZ=America/New_York so "today" is correct.
 * Leap years handled via lastDayOfMonth (e.g. Feb 29 when applicable).
 */
function getLastMonthRange() {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const y = lastMonth.getFullYear();
  const m = lastMonth.getMonth() + 1;
  const lastDay = lastDayOfMonth(lastMonth).getDate();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = monthNames[m - 1] + ' ' + y;

  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m - 1, lastDay, 23, 59, 59, 999);

  return { start, end, year: y, month: m, monthLabel };
}

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
  }
  return result;
}

function buildFeatured(tradesByCategory, monthLabel) {
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
      featured.push({ ticker: t.ticker, meta: cat + ' · ' + monthLabel, result: t.resultStr });
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

/**
 * Fetch recap messages in a date range and build featured + realtimeHighlights.
 * Writes config.json (with realtimeHighlights) and featured.json.
 */
async function runMonthlyUpdate(client, options) {
  const { recapChannelId, dataDir } = options;
  const dataPath = path.resolve(dataDir || './data');

  if (!recapChannelId) {
    console.log('[monthly] No RECAP_CHANNEL_ID — skipping monthly highlights');
    return;
  }

  const { start, end, monthLabel } = getLastMonthRange();
  console.log('[monthly] Last month:', monthLabel, '(', start.toISOString(), 'to', end.toISOString(), ')');

  const channel = await client.channels.fetch(recapChannelId).catch(() => null);
  if (!channel) {
    console.warn('[monthly] Recap channel not found');
    return;
  }

  let allMessages = [];
  let lastId = null;
  let done = false;
  while (!done) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    const sorted = Array.from(batch.values()).sort((a, b) => b.createdAt - a.createdAt);
    for (const m of sorted) {
      if (m.createdAt < start) { done = true; break; }
      if (m.createdAt <= end) allMessages.push(m);
      lastId = m.id;
    }
    if (done || batch.size < 100) break;
  }

  const tradesByCategory = { Options: [], Stocks: [], Futures: [], Crypto: [] };
  for (const msg of allMessages) {
    if (!msg.content) continue;
    const parsed = parseRecapMessage(msg.content);
    for (const t of parsed.trades) {
      if (tradesByCategory[t.category]) tradesByCategory[t.category].push(t);
    }
  }

  const featured = buildFeatured(tradesByCategory, monthLabel);
  const realtimeHighlights = buildRealtimeHighlights(tradesByCategory);

  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });

  const configPath = path.join(dataPath, 'config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (_) {}
  }
  config.realtimeHighlights = realtimeHighlights;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  fs.writeFileSync(path.join(dataPath, 'featured.json'), JSON.stringify(featured, null, 2));

  console.log('[monthly] Updated realtimeHighlights and featured.json for', monthLabel, '—', featured.length, 'featured,', allMessages.length, 'recap messages');
}

module.exports = { runMonthlyUpdate, getLastMonthRange };
