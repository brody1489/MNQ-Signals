const db = require('./db');
const { getHandle } = require('./detect');
const config = require('../config');

/** In-memory: Set of user IDs that are protected (have one of the 3 roles or manual). */
let protectedUserIds = new Set();
/** In-memory: List of { userId, handle } for comparison. Handles only (unique usernames). */
let protectedHandles = [];

function isProtectedUserId(id) {
  return protectedUserIds.has(id);
}

function getProtectedHandles() {
  return protectedHandles;
}

function getProtectedUserIds() {
  return new Set(protectedUserIds);
}

/**
 * Refresh protected list from guild: everyone with OWNER/DEVELOPER/ANALYST role + manual list.
 * Uses global username (user.username) only.
 */
async function refresh(client) {
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (!guild) {
    console.warn('[baseline] Guild not found');
    return;
  }

  const manual = new Set(db.getManualProtectedIds());
  const protectedRoleIds = new Set(config.PROTECTED_ROLE_IDS);
  const newProtectedIds = new Set(manual);
  const newHandles = [];

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;

  for (const [, member] of members) {
    const hasProtectedRole = member.roles.cache.some((r) => protectedRoleIds.has(r.id));
    if (hasProtectedRole || manual.has(member.id)) {
      newProtectedIds.add(member.id);
      const handle = getHandle(member.user);
      if (handle) newHandles.push({ userId: member.id, handle });
    }
  }

  protectedUserIds = newProtectedIds;
  protectedHandles = newHandles;
  db.saveProtectedCache(newHandles);
  console.log(`[baseline] Refreshed: ${protectedUserIds.size} protected users, ${protectedHandles.length} handles.`);
}

/**
 * Run refresh on interval (e.g. every 10 minutes).
 */
function startScheduledRefresh(client) {
  refresh(client);
  setInterval(() => refresh(client), 10 * 60 * 1000);
}

module.exports = {
  isProtectedUserId,
  getProtectedHandles,
  getProtectedUserIds,
  refresh,
  startScheduledRefresh,
};
