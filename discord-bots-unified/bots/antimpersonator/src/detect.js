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

/** Effective server-visible name (nickname > global display > username). */
function getEffectiveDisplayName(member) {
  if (!member) return '';
  return member.displayName ?? member.user?.username ?? '';
}

/** Global display name (Profile “Display Name”), if set. */
function getGlobalDisplayName(user) {
  return user?.globalName ?? '';
}

function normalizeBio(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// When avatar matches a protected user, allow up to this many character differences and still ban
const AVATAR_MATCH_MAX_DISTANCE = 4;

function avatarUrlsMatch(a, b) {
  if (!a || !b) return false;
  return String(a).replace(/\?.*$/, '') === String(b).replace(/\?.*$/, '');
}

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

    const avatarMatch = avatarUrlsMatch(memberAvatarUrl, protectedAvatarUrl);

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

/**
 * Display-name “clone” path — never bans on display alone (avoids “anyone named Brody”).
 *
 * Requires ALL of:
 * - @username (normalized) within `displayHandleMax` edit distance of protected handle (e.g. brody_90095 vs brody_80085).
 * - Same profile picture as that protected user.
 * - Server/global display name similar to baseline (≤ displayThreshold), with min length.
 *
 * Bio + PFP path unchanged below.
 */
function checkDisplayNameImpersonation(candidate, protectedList, options) {
  const displayTh = Math.max(0, parseInt(options.displayThreshold, 10) || 1);
  const minLen = Math.max(3, parseInt(options.displayMinLen, 10) || 5);
  const handleMax = Math.max(1, parseInt(options.displayHandleMax, 10) || 3);
  const {
    displayName: candDispRaw,
    globalName: candGlobRaw,
    avatarUrl: candAvatar,
    bio: candBioRaw,
    handle: candHandleRaw,
  } = candidate;

  const candHandle = normalizeHandle(candHandleRaw || '');
  const candDisp = normalizeHandle(candDispRaw || '');
  const candGlob = normalizeHandle(candGlobRaw || '');
  const candBio = normalizeBio(candBioRaw || '');

  if (!candHandle) return { match: false };

  for (const entry of protectedList) {
    const pDisp = normalizeHandle(entry.displayName || '');
    const pGlob = normalizeHandle(entry.globalName || '');
    const pBio = normalizeBio(entry.bio || '');
    const pAvatar = entry.avatarUrl || '';
    const protectedUserId = entry.userId;
    const protectedHandle = entry.handle || '';
    const pHandleNorm = normalizeHandle(protectedHandle || '');

    if (!pHandleNorm) continue;

    const handleDist = levenshtein(candHandle, pHandleNorm);
    if (handleDist > handleMax) continue;

    if (!avatarUrlsMatch(candAvatar, pAvatar)) continue;

    const pairs = [
      [candDisp, pDisp],
      [candGlob, pGlob],
      [candDisp, pGlob],
      [candGlob, pDisp],
    ];

    for (const [cStr, pStr] of pairs) {
      if (!cStr || !pStr) continue;
      if (pStr.length < minLen || cStr.length < minLen) continue;

      const displayDist = levenshtein(cStr, pStr);
      if (displayDist > displayTh) continue;

      return {
        match: true,
        kind: 'display_handle_avatar',
        protectedUserId,
        protectedHandle,
        protectedDisplay: entry.displayName || '',
        distance: handleDist,
        displayDistance: displayDist,
      };
    }

    // Copied “About me” + same PFP (rare; strong signal when API exposes bio)
    if (pBio.length >= 35 && candBio.length >= 35 && avatarUrlsMatch(candAvatar, pAvatar)) {
      const bdist = levenshtein(candBio, pBio);
      if (bdist <= 2) {
        return {
          match: true,
          kind: 'bio_avatar',
          protectedUserId,
          protectedHandle,
          protectedDisplay: entry.displayName || '',
          distance: bdist,
        };
      }
    }
  }

  return { match: false };
}

module.exports = {
  levenshtein,
  normalizeHandle,
  normalizeBio,
  getHandle,
  getEffectiveDisplayName,
  getGlobalDisplayName,
  checkSimilarity,
  checkDisplayNameImpersonation,
  avatarUrlsMatch,
  AVATAR_MATCH_MAX_DISTANCE,
};
