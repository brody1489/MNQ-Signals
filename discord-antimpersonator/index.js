const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./src/db');
const baseline = require('./src/baseline');
const { getHandle, checkSimilarity } = require('./src/detect');
const { banAndLog } = require('./src/actions');
const { registerCommands, handleInteraction } = require('./src/commands');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

let enforce = () => db.getSetting('enforce') !== 'false';
let threshold = () => db.getSetting('threshold') || '1';

function shouldSkipMember(member) {
  if (!member || !member.guild) return true;
  if (member.guild.id !== config.GUILD_ID) return true;
  if (member.user.bot) return true;
  if (baseline.isProtectedUserId(member.id)) return true;
  if (member.permissions.has('Administrator')) return true;
  const ignoredRoles = db.getIgnoredRoleIds();
  if (ignoredRoles.length && member.roles.cache.some((r) => ignoredRoles.includes(r.id))) return true;
  return false;
}

async function runDetection(client, member) {
  if (shouldSkipMember(member)) return;
  if (!enforce()) return;

  const handle = getHandle(member.user);
  const protectedHandles = baseline.getProtectedHandles();
  const result = checkSimilarity(handle, protectedHandles, threshold());
  if (!result.match) return;

  await banAndLog(client, member, result);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (guild) {
    const me = await guild.members.fetchMe().catch(() => null);
    if (me && !me.permissions.has('BanMembers')) {
      console.error('Bot does not have Ban Members permission. Grant it in Server Settings → Roles.');
    }
  }
  try {
    await registerCommands(client);
  } catch (err) {
    console.error('Slash command registration failed:', err.message);
  }
  baseline.startScheduledRefresh(client);
});

client.on('error', (err) => {
  console.error('Discord client error:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});

client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== config.GUILD_ID) return;
  await runDetection(client, member);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.guild.id !== config.GUILD_ID) return;
  const hadRole = oldMember.roles.cache.has(config.OWNER_ROLE_ID) || oldMember.roles.cache.has(config.DEVELOPER_ROLE_ID) || oldMember.roles.cache.has(config.ANALYST_ROLE_ID);
  const hasRole = newMember.roles.cache.has(config.OWNER_ROLE_ID) || newMember.roles.cache.has(config.DEVELOPER_ROLE_ID) || newMember.roles.cache.has(config.ANALYST_ROLE_ID);
  if (hadRole !== hasRole) await baseline.refresh(client);
  if (oldMember.user.username !== newMember.user.username) await runDetection(client, newMember);
});

client.on('userUpdate', async (oldUser, newUser) => {
  if (oldUser.username === newUser.username) return;
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (!guild) return;
  const member = await guild.members.fetch(newUser.id).catch(() => null);
  if (!member) return;
  await runDetection(client, member);
});

client.on('interactionCreate', (interaction) => handleInteraction(client, interaction));

client.login(config.DISCORD_BOT_TOKEN).catch((e) => {
  console.error('Login failed', e);
  process.exit(1);
});

const app = express();
app.get('/', (req, res) => res.status(200).send('ok'));
app.get('/health', (req, res) => res.status(200).json({ ok: true, bot: client.user?.tag || 'starting' }));
const port = config.PORT;
app.listen(port, () => console.log(`Health server on port ${port}`));
