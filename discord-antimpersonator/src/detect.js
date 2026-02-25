/**
 * Levenshtein distance (edit distance). Used for handle comparison only.
 * Case-insensitive; we compare the global username (user.username), not nicknames.
 */
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
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Get the account's unique handle (username). Do NOT use nickname or displayName.
 */
function getHandle(user) {
  return user?.username ?? '';
}

/**
 * Check if member's handle is within threshold of any protected handle.
 * Returns { match: true, protectedHandle, protectedUserId, distance } or { match: false }.
 * Optimisation: only compare handles with length within ±threshold to avoid unnecessary work.
 */
function checkSimilarity(memberHandle, protectedList, threshold) {
  const handle = (memberHandle || '').trim();
  const th = Math.max(0, parseInt(threshold, 10) || 1);
  const len = handle.length;

  for (const { handle: protectedHandle, userId: protectedUserId } of protectedList) {
    const p = (protectedHandle || '').trim();
    if (Math.abs(p.length - len) > th) continue;
    const distance = levenshtein(handle, p);
    if (distance <= th) {
      return { match: true, protectedHandle: p, protectedUserId, distance };
    }
  }
  return { match: false };
}

module.exports = {
  levenshtein,
  getHandle,
  checkSimilarity,
};
