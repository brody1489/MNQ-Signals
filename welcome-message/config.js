try { require('dotenv').config({ path: '.env' }); } catch (_) {}

const required = ['DISCORD_BOT_TOKEN', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

// Default message (use \n for newlines). {username} is replaced with the member's username.
const DEFAULT_MESSAGE = [
  'Welcome **{username}** to The Trading Circle.',
  '',
  "We're committed to making this a solid place for discussion and growth. If you have questions or ideas, please let us know.",
  '',
  '**Important:** There are a lot of impersonators and scammers out there. My staff and I will never DM you first. Please stay safe and never give out personal information to anyone.',
].join('\n');

module.exports = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  PORT: parseInt(process.env.PORT || '3000', 10),
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || DEFAULT_MESSAGE,
};
