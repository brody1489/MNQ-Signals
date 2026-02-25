const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');

const DATA_DIR = path.join(process.cwd(), 'data');
const MEMBER_COUNT_FILE = path.join(DATA_DIR, 'member_count.json');

function loadPreviousCount() {
  try {
    const raw = fs.readFileSync(MEMBER_COUNT_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { count: Number(data.count) || 0, date: data.date || '' };
  } catch {
    return { count: null, date: '' };
  }
}

function saveCount(count) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      MEMBER_COUNT_FILE,
      JSON.stringify({ count, date: new Date().toISOString().slice(0, 10) }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error('[welcome] Failed to save member count:', e.message);
  }
}

async function sendDailyMemberStats() {
  if (!config.STATS_CHANNEL_ID) return;
  const channel = await client.channels.fetch(config.STATS_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error('[welcome] Stats channel not found:', config.STATS_CHANNEL_ID);
    return;
  }
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (!guild) {
    console.error('[welcome] Guild not found for member count');
    return;
  }
  const total = guild.memberCount;
  const prev = loadPreviousCount();
  let changeText = '';
  if (prev.count != null && prev.date) {
    const diff = total - prev.count;
    if (diff > 0) changeText = ` (↑ +${diff} from previous day)`;
    else if (diff < 0) changeText = ` (↓ ${diff} from previous day)`;
    else changeText = ' (no change from previous day)';
  }
  saveCount(total);
  const message = `**Member count:** ${total.toLocaleString()}${changeText}`;
  await channel.send(message).catch((e) => console.error('[welcome] Stats send failed:', e.message));
  console.log('[welcome] Daily member stats sent');
}

// Profile display name for personal touch; fallback to username
function getName(member) {
  const u = member.user;
  return (u?.globalName || u?.username || 'there').trim() || 'there';
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', () => {
  console.log(`[welcome] Logged in as ${client.user.tag}`);
  if (config.STATS_CHANNEL_ID) {
    const cron = require('node-cron');
    cron.schedule(config.STATS_DAILY_CRON, () => sendDailyMemberStats(), { timezone: 'UTC' });
    console.log('[welcome] Daily member stats scheduled:', config.STATS_DAILY_CRON);
  }
});

client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== config.GUILD_ID) return;
  if (member.user.bot) return;
  const name = getName(member);
  const text = config.WELCOME_MESSAGE
    .replace(/\{username\}/gi, member.user.username || 'there')
    .replace(/\{name\}/gi, name);
  try {
    await member.send(text);
  } catch (e) {
    if (e.code === 50007) console.log(`[welcome] Could not DM ${member.user.tag} (DMs closed)`);
    else console.error('[welcome] DM failed:', e.message);
  }
});

function start() {
  client.login(config.DISCORD_BOT_TOKEN).catch((e) => {
    console.error('[welcome] Login failed', e);
    process.exit(1);
  });
}

module.exports = { client, start };
