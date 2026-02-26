try { require('dotenv').config({ path: require('path').join(process.cwd(), '.env') }); } catch (_) {}

const required = ['DISCORD_BOT_TOKEN', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error('[welcome] Missing env: ' + key);
    process.exit(1);
  }
}

const DEFAULT_MESSAGE = [
  'Welcome **{name}** to The Trading Circle.',
  '',
  "We're committed to making this a solid place for discussion and growth. If you have questions or ideas, please let us know.",
  '',
  '**Important:** There are a lot of impersonators and scammers out there. My staff and I will never DM you first. Please stay safe and never give out personal information to anyone.',
].join('\n');

module.exports = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || DEFAULT_MESSAGE,
  // Daily member-count report (optional). Channel to post to; cron = "minute hour * * *".
  STATS_CHANNEL_ID: process.env.STATS_CHANNEL_ID || null,
  STATS_DAILY_CRON: process.env.STATS_DAILY_CRON || '0 20 * * *', // default 8pm daily
  STATS_CRON_TZ: process.env.STATS_CRON_TZ || 'America/New_York',   // 8pm EST
};
