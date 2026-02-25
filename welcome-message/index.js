const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const express = require('express');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== config.GUILD_ID) return;
  if (member.user.bot) return;

  const text = config.WELCOME_MESSAGE.replace(/\{username\}/gi, member.user.username || 'there');

  try {
    await member.send(text);
  } catch (e) {
    if (e.code === 50007) {
      console.log(`[welcome] Could not DM ${member.user.tag} (DMs closed)`);
    } else {
      console.error('[welcome] DM failed:', e.message);
    }
  }
});

client.login(config.DISCORD_BOT_TOKEN).catch((e) => {
  console.error('Login failed', e);
  process.exit(1);
});

const app = express();
app.get('/', (req, res) => res.status(200).send('ok'));
app.get('/health', (req, res) => res.status(200).json({ ok: true, bot: client.user?.tag || 'starting' }));
app.listen(config.PORT, () => console.log(`Health server on port ${config.PORT}`));
