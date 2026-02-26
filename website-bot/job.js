'use strict';

const fs = require('fs');
const path = require('path');

const CATEGORY_MAP = {
  'option alerts': 'Options',
  'stock alerts': 'Stocks',
  'future alerts': 'Futures',
  'futures alerts': 'Futures',
  'crypto': 'Crypto',
};

function parseChannelName(name) {
  const match = name.match(/\|\s*([a-z0-9]+)-alerts/i) || name.match(/([a-z0-9]+)-alerts/i);
  return match ? match[1].toLowerCase() : null;
}

function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function runJob(client, options) {
  const { guildId, recapChannelId, dataDir, analystRoleName } = options;
  const dataPath = path.resolve(dataDir || './data');
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });

  const totalsPath = path.join(dataPath, 'totals.json');
  let totals = { wins: 0, losses: 0, totalGainPercent: 0, lastRecapDate: null };
  if (fs.existsSync(totalsPath)) {
    try {
      totals = JSON.parse(fs.readFileSync(totalsPath, 'utf8'));
    } catch (_) {}
  }
  const today = new Date().toISOString().slice(0, 10);

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    console.error('[job] Guild not found');
    return;
  }

  const tradersByCategory = { Options: [], Stocks: [], Futures: [], Crypto: [] };
  const categoryChannels = guild.channels.cache.filter(c => c.type === 4);
  const textChannels = guild.channels.cache.filter(c => c.type === 0);

  for (const [catId, cat] of categoryChannels) {
    const catName = (cat.name || '').toLowerCase();
    const siteLabel = CATEGORY_MAP[catName] || (catName.includes('option') ? 'Options' : catName.includes('stock') ? 'Stocks' : catName.includes('future') ? 'Futures' : catName.includes('crypto') ? 'Crypto' : null);
    if (!siteLabel || !tradersByCategory[siteLabel]) continue;

    const children = textChannels.filter(c => c.parentId === catId);
    for (const ch of children.values()) {
      const traderSlug = parseChannelName(ch.name || '');
      if (!traderSlug) continue;
      const displayName = titleCase(traderSlug);
      tradersByCategory[siteLabel].push({
        name: displayName,
        avatar: null,
        role: siteLabel + ' analyst',
      });
    }
  }

  const role = guild.roles.cache.find(r => (r.name || '').toLowerCase() === (analystRoleName || 'analyst').toLowerCase());
  if (role) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    for (const m of members.values()) {
      if (!m.roles.cache.has(role.id)) continue;
      const nick = (m.displayName || m.user.username || '').toLowerCase().replace(/\s/g, '');
      for (const label of Object.keys(tradersByCategory)) {
        const list = tradersByCategory[label];
        for (const t of list) {
          const nameSlug = t.name.toLowerCase().replace(/\s/g, '');
          if (nick === nameSlug || nick.includes(nameSlug) || nameSlug.includes(nick)) {
            t.avatar = m.user.displayAvatarURL({ size: 128 });
            break;
          }
        }
      }
    }
  }

  const flatTraders = [];
  for (const arr of Object.values(tradersByCategory)) flatTraders.push(...arr);
  const activeTradersCount = flatTraders.length;

  if (recapChannelId && totals.lastRecapDate !== today) {
    try {
      const channel = await client.channels.fetch(recapChannelId);
      const messages = await channel.messages.fetch({ limit: 5 });
      const last = messages.first();
      if (last && last.content) {
        const wrMatch = last.content.match(/Alert\s+Winrate:\s*(\d+)\/(\d+)/i) || last.content.match(/(\d+)\/(\d+)\s*(\d+)?\s*%/);
        const gainMatch = last.content.match(/Total\s+Gain:\s*\+?([\d,.]+)\s*%/i) || last.content.match(/\+?([\d,.]+)\s*%\s*🚀/);
        if (wrMatch) {
          const wins = parseInt(wrMatch[1], 10);
          const total = parseInt(wrMatch[2], 10);
          const losses = total - wins;
          totals.wins += wins;
          totals.losses += losses;
        }
        if (gainMatch) {
          const gain = parseFloat(String(gainMatch[1]).replace(/,/g, ''), 10);
          if (!isNaN(gain)) totals.totalGainPercent += gain;
        }
        totals.lastRecapDate = today;
      }
    } catch (e) {
      console.error('[job] Recap read failed:', e.message);
    }
  }

  fs.writeFileSync(totalsPath, JSON.stringify(totals, null, 2));

  const totalCount = totals.wins + totals.losses;
  const winRatePercent = totalCount > 0 ? Math.round((totals.wins / totalCount) * 1000) / 10 : 90;
  const allTimeGainPercent = Math.round(totals.totalGainPercent * 100) / 100;

  const configPath = path.join(dataPath, 'config.json');
  const config = {
    discordInviteUrl: process.env.DISCORD_INVITE_URL || 'https://discord.gg/YOUR_INVITE_CODE',
    activeTradersCount,
    winRatePercent,
    allTimeGainPercent,
  };
  if (process.env.CONTACT_EMAIL) config.contactEmail = process.env.CONTACT_EMAIL;
  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (existing.realtimeHighlights && Array.isArray(existing.realtimeHighlights)) config.realtimeHighlights = existing.realtimeHighlights;
    } catch (_) {}
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(dataPath, 'traders.json'), JSON.stringify({ byCategory: tradersByCategory, list: flatTraders }, null, 2));

  const featuredPath = path.join(dataPath, 'featured.json');
  if (!fs.existsSync(featuredPath)) {
    fs.writeFileSync(featuredPath, JSON.stringify([], null, 2));
  }

  console.log('[job] Updated config.json, traders.json, totals. Win rate:', winRatePercent + '%', 'Gain:', allTimeGainPercent + '%', 'Traders:', activeTradersCount);
}

module.exports = { runJob };
