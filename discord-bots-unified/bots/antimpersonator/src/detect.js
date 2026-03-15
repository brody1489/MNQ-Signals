function levenshtein(a, b) {
  const aLower = (a || '').toLowerCase();
  const bLower = (b || '').toLowerCase();
  const m = aLower.length;
  const n = bLower.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function normalizeHandle(raw) {
  // Normalize common impersonation padding:
  // - lowercase
  // - remove punctuation/whitespace (., _, -, etc.)
  // - keep only a-z0-9
  // - collapse to max 32 for sanity
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
}

function getHandle(user) {
  // username is the most stable identifier; globalName is display-only and easy to spoof
  return user?.username ?? '';
}

// When avatar matches a protected user, allow up to this many character differences and still ban
const AVATAR_MATCH_MAX_DISTANCE = 4;

function checkSimilarity(memberHandle, memberAvatarUrl, protectedList, threshold) {
  const handleRaw = (memberHandle || '').trim();
  const handle = normalizeHandle(handleRaw);
  const th = Math.max(0, parseInt(threshold, 10) || 2);
  const len = handle.length;
  for (const entry of protectedList) {
    const { handle: protectedHandle, userId: protectedUserId, avatarUrl: protectedAvatarUrl } = entry;
    const pRaw = (protectedHandle || '').trim();
    const p = normalizeHandle(pRaw);
    if (!p || !handle) continue;

    const avatarMatch = Boolean(
      memberAvatarUrl &&
      protectedAvatarUrl &&
      memberAvatarUrl.replace(/\?.*$/, '') === protectedAvatarUrl.replace(/\?.*$/, '')
    );

    // Strong match: exact prefix + only digits added (e.g. brody80085, brody_80056 -> brody80056)
    if (p.length >= 3 && handle.startsWith(p) && /^\d+$/.test(handle.slice(p.length))) {
      return { match: true, protectedHandle: pRaw, protectedUserId, distance: 0 };
    }

    const distance = levenshtein(handle, p);

    // Same PFP + username within a few chars = impersonation (e.g. 3–4 chars off)
    if (avatarMatch && distance <= AVATAR_MATCH_MAX_DISTANCE) {
      return { match: true, protectedHandle: pRaw, protectedUserId, distance };
    }

    // Standard edit-distance match on normalized handles (threshold from settings, default 2)
    if (Math.abs(p.length - len) > th) continue;
    if (distance <= th) return { match: true, protectedHandle: pRaw, protectedUserId, distance };
  }
  return { match: false };
}

module.exports = { levenshtein, normalizeHandle, getHandle, checkSimilarity, AVATAR_MATCH_MAX_DISTANCE };
