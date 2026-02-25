/**
 * Config from environment. Set these in Railway (or .env locally).
 */
try { require('dotenv').config({ path: '.env' }); } catch (_) { /* dotenv optional */ }

const required = [
  'DISCORD_BOT_TOKEN',
  'GUILD_ID',
  'LOG_CHANNEL_ID',
  'OWNER_ROLE_ID',
  'DEVELOPER_ROLE_ID',
  'ANALYST_ROLE_ID',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  OWNER_ROLE_ID: process.env.OWNER_ROLE_ID,
  DEVELOPER_ROLE_ID: process.env.DEVELOPER_ROLE_ID,
  ANALYST_ROLE_ID: process.env.ANALYST_ROLE_ID,
  PORT: parseInt(process.env.PORT || '3000', 10),
  PROTECTED_ROLE_IDS: [
    process.env.OWNER_ROLE_ID,
    process.env.DEVELOPER_ROLE_ID,
    process.env.ANALYST_ROLE_ID,
  ],
};
