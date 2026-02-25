const db = require('./db');
const { getHandle } = require('./detect');
const config = require('../config');

let protectedUserIds = new Set();
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

async function refresh(client) {
  const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
  if (!guild) return;
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

function startScheduledRefresh(client) {
  refresh(client);
  setInterval(() => refresh(client), 10 * 60 * 1000);
}

module.exports = { isProtectedUserId, getProtectedHandles, getProtectedUserIds, refresh, startScheduledRefresh };
