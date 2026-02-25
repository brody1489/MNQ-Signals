const config = require('../config');
const db = require('./db');
const baseline = require('./baseline');

/**
 * Ban user, log to LOG_CHANNEL, optionally delete their recent messages.
 */
async function banAndLog(client, member, result) {
  const logChannelId = config.LOG_CHANNEL_ID;
  const guild = member.guild;
  const dryRun = db.getSetting('dry_run') === 'true';

  const userId = member.user?.id ?? 'unknown';
  const username = member.user?.username ?? 'unknown';
  const embed = {
    color: dryRun ? 0xf1c40f : 0xe74c3c,
    title: dryRun ? '[DRY RUN] Impersonation detected' : 'Impersonation — user banned',
    fields: [
      { name: 'User', value: `<@${userId}> (` + String(userId) + ')', inline: false },
      { name: 'Handle (username)', value: '`' + String(username).replace(/`/g, '') + '`', inline: true },
      { name: 'Matched protected handle', value: '`' + String(result.protectedHandle ?? '').replace(/`/g, '') + '`', inline: true },
      { name: 'Protected user ID', value: result.protectedUserId ? '`' + String(result.protectedUserId) + '`' : '—', inline: true },
      { name: 'Edit distance', value: String(result.distance), inline: true },
      { name: 'Action', value: dryRun ? 'Log only (no ban)' : 'Permanent ban', inline: true },
      { name: 'Time', value: new Date().toISOString(), inline: false },
    ],
  };

  const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
  if (logChannel) {
    await logChannel.send({ embeds: [embed] }).catch((e) => console.error('[actions] Log send failed', e));
  }

  if (dryRun) return;

  try {
    await member.ban({ reason: `Anti-impersonation: handle similar to protected user (distance=${result.distance})`, deleteMessageSeconds: 86400 });
  } catch (e) {
    console.error('[actions] Ban failed', e);
    if (logChannel) {
      await logChannel.send({ content: `⚠️ Ban failed for ${member.user}: ${e.message}` }).catch(() => {});
    }
    return;
  }

  // Optionally delete recent messages (last 24h worth) — we already passed deleteMessageSeconds above for 1 day
  // So Discord will delete up to 1 day of messages. No extra loop needed unless we want more.
}

/**
 * Delete recent messages by this user in the guild (optional extra cleanup).
 */
async function deleteRecentMessages(client, guildId, userId) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return;
  let deleted = 0;
  for (const [, ch] of channels) {
    if (!ch.isTextBased() || ch.isDMBased()) continue;
    const messages = await ch.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) continue;
    for (const [, msg] of messages) {
      if (msg.author.id === userId) {
        await msg.delete().catch(() => {});
        deleted++;
      }
    }
  }
  if (deleted > 0) console.log(`[actions] Deleted ${deleted} messages from user ${userId}`);
}

module.exports = {
  banAndLog,
  deleteRecentMessages,
};
