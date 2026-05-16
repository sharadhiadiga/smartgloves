/**
 * In-memory push token cache — used when MongoDB is down or save-token ran before DB connected.
 * Survives for the lifetime of the Node process (Render instance).
 */
const tokensByUserId = new Map();

function setToken(userId, token) {
  const uid = String(userId || '').trim();
  const t = String(token || '').trim();
  if (!uid || !t) return;
  tokensByUserId.set(uid, t);
  console.log('[PushStore] Cached token for', uid);
}

function getToken(userId) {
  return tokensByUserId.get(String(userId || '').trim()) || null;
}

function getAnyToken() {
  const values = [...tokensByUserId.values()];
  return values.length > 0 ? values[values.length - 1] : null;
}

function getAllTokens() {
  return Object.fromEntries(tokensByUserId);
}

module.exports = {
  setToken,
  getToken,
  getAnyToken,
  getAllTokens,
};
