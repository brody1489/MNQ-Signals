const config = require('../config');
const db = require('./db');
const baseline = require('./baseline');

function matchKindLabel(kind) {
  const k = kind || 'username';
  if (k === 'username') return 'Username similarity';
  if (k === 'display_handle_avatar') return 'Handle + display + same PFP';
  if (k === 'display_exact') return 'Display name (exact copy)';
  if (k === 'display_fuzzy_avatar') return 'Display name (fuzzy + same PFP)';
  if (k === 'bio_avatar') return 'Bio similarity + same PFP';
  return k;
}

async function banAndLog(client, member, result) {
  const logChannelId = config.LOG_CHANNEL_ID;
  const dryRun = db.getSetting('dry_run') === 'true';
  const userId = member.user?.id ?? 'unknown';
  const username = member.user?.username ?? 'unknown';
  const displayName = member.displayName ?? member.user?.username ?? '';
  const kind = result.kind || 'username';
  const fields = [
    { name: 'User', value: `<@${userId}> (` + String(userId) + ')', inline: false },
    { name: 'Match type', value: matchKindLabel(kind), inline: true },
    { name: 'Handle (@username)', value: '`' + String(username).replace(/`/g, '') + '`', inline: true },
    { name: 'Display name (server)', value: '`' + String(displayName).replace(/`/g, '').slice(0, 80) + '`', inline: true },
    { name: 'Matched protected handle', value: '`' + String(result.protectedHandle ?? '').replace(/`/g, '') + '`', inline: true },
    { name: 'Protected user ID', value: result.protectedUserId ? '`' + String(result.protectedUserId) + '`' : '—', inline: true },
    {
      name: 'Edit distance (handle)',
      value: String(result.distance ?? '—'),
      inline: true,
    },
    ...(result.displayDistance != null
      ? [
          {
            name: 'Display name distance',
            value: String(result.displayDistance),
            inline: true,
          },
        ]
      : []),
    { name: 'Action', value: dryRun ? 'Log only (no ban)' : 'Permanent ban', inline: true },
    { name: 'Time', value: new Date().toISOString(), inline: false },
  ];
  if (result.protectedDisplay) {
    fields.splice(4, 0, {
      name: 'Baseline display (protected)',
      value: '`' + String(result.protectedDisplay).replace(/`/g, '').slice(0, 80) + '`',
      inline: true,
    });
  }
  const embed = {
    color: dryRun ? 0xf1c40f : 0xe74c3c,
    title: dryRun ? '[DRY RUN] Impersonation detected' : 'Impersonation — user banned',
    fields,
  };
  const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
  if (logChannel) {
    await logChannel.send({ embeds: [embed] }).catch((e) => console.error('[actions] Log send failed', e));
  }
  if (dryRun) return;
  try {
    const distNote =
      kind === 'display_handle_avatar' && result.displayDistance != null
        ? `handle=${result.distance ?? 'n/a'} display=${result.displayDistance}`
        : `distance=${result.distance ?? 'n/a'}`;
    const reason = `Anti-impersonation: ${matchKindLabel(kind)} (${distNote})`;
    await member.ban({ reason, deleteMessageSeconds: 86400 });
  } catch (e) {
    console.error('[actions] Ban failed', e);
    if (logChannel) await logChannel.send({ content: `⚠️ Ban failed for ${member.user}: ${e.message}` }).catch(() => {});
  }
}

module.exports = { banAndLog };
