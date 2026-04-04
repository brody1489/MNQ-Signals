const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const db = require('./src/db');
const baseline = require('./src/baseline');
const {
  getHandle,
  checkSimilarity,
  checkDisplayNameImpersonation,
  getEffectiveDisplayName,
  getGlobalDisplayName,
} = require('./src/detect');
const { banAndLog } = require('./src/actions');
const { registerCommands, handleInteraction } = require('./src/commands');
let runMessageMod = async () => {};
try {
  const mod = require('./src/messageMod');
  runMessageMod = mod.runMessageMod;
} catch (e) {
  console.warn('[anti-impersonator] messageMod not loaded (file missing?), message moderation disabled');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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

async function runDetection(member) {
  if (shouldSkipMember(member)) return;
  if (!enforce()) return;
  const handle = getHandle(member.user);
  const avatarUrl = member.user?.displayAvatarURL?.({ size: 128 })?.replace(/\?.*$/, '') ?? '';
  const protectedHandles = baseline.getProtectedHandles();
  const result = checkSimilarity(handle, avatarUrl, protectedHandles, threshold());
  if (result.match) {
    await banAndLog(client, member, { ...result, kind: 'username' });
    return;
  }
  if (db.getSetting('display_match') !== 'false') {
    let bio = '';
    try {
      const fu = await member.user.fetch({ force: true });
      bio = typeof fu.bio === 'string' ? fu.bio : '';
    } catch (_) {}
    const displayRes = checkDisplayNameImpersonation(
      {
        handle,
        displayName: getEffectiveDisplayName(member),
        globalName: getGlobalDisplayName(member.user),
        avatarUrl,
        bio,
      },
      protectedHandles,
      {
        displayThreshold: db.getSetting('display_threshold') || '1',
        displayMinLen: db.getSetting('display_min_len') || '5',
        displayHandleMax: db.getSetting('display_handle_max') || '3',
      }
    );
    if (displayRes.match) await banAndLog(client, member, displayRes);
  }
}

client.once('ready', async () => {
  console.log(`[anti-impersonator] Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (guild) {
    const me = await guild.members.fetchMe().catch(() => null);
    if (me && !me.permissions.has('BanMembers')) {
      console.error('[anti-impersonator] Bot does not have Ban Members permission.');
    }
  }
  try {
    await registerCommands(client);
  } catch (err) {
    console.error('[anti-impersonator] Slash command registration failed:', err.message);
  }
  baseline.startScheduledRefresh(client);
});

client.on('error', (err) => console.error('[anti-impersonator]', err.message));
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== config.GUILD_ID) return;
  await runDetection(member);
});
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.guild.id !== config.GUILD_ID) return;
  const prot = new Set(config.PROTECTED_ROLE_IDS);
  const hadProtected = [...oldMember.roles.cache.keys()].some((id) => prot.has(id));
  const hasProtected = [...newMember.roles.cache.keys()].some((id) => prot.has(id));
  if (hadProtected !== hasProtected) await baseline.refresh(client);

  const isProt = baseline.isProtectedUserId(newMember.id);
  const identityChanged =
    oldMember.displayName !== newMember.displayName ||
    oldMember.nickname !== newMember.nickname ||
    oldMember.user.avatar !== newMember.user.avatar ||
    oldMember.user.globalName !== newMember.user.globalName ||
    oldMember.user.username !== newMember.user.username;

  if (isProt && identityChanged) {
    await baseline.refresh(client);
    return;
  }
  if (!isProt && identityChanged) await runDetection(newMember);
});
client.on('userUpdate', async (oldUser, newUser) => {
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (!guild) return;
  const member = await guild.members.fetch(newUser.id).catch(() => null);
  if (!member) return;
  const changed =
    oldUser.username !== newUser.username ||
    oldUser.avatar !== newUser.avatar ||
    oldUser.globalName !== newUser.globalName;
  if (!changed) return;
  if (baseline.isProtectedUserId(newUser.id)) {
    await baseline.refresh(client);
    return;
  }
  await runDetection(member);
});
client.on('interactionCreate', (interaction) => handleInteraction(client, interaction));
client.on('messageCreate', async (msg) => {
  if (msg.guild?.id !== config.GUILD_ID) return;
  runMessageMod(client, msg).catch((e) => console.error('[messageMod]', e.message));
});

function start() {
  const tryLogin = () => {
    client.login(config.DISCORD_BOT_TOKEN).catch((e) => {
      console.error('[anti-impersonator] Login failed', e.message || e);
      setTimeout(tryLogin, 60_000);
    });
  };
  tryLogin();
}

module.exports = { client, start };
