const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let accessToken = null;
let refreshToken = null;
let onAuthLost = () => {};

/** Called once at app startup (see AuthContext) to wire session state in. */
function configure({ accessToken: at, refreshToken: rt, onAuthLostCallback }) {
  accessToken = at;
  refreshToken = rt;
  if (onAuthLostCallback) onAuthLost = onAuthLostCallback;
}

function setTokens(tokens) {
  accessToken = tokens.accessToken ?? accessToken;
  refreshToken = tokens.refreshToken ?? refreshToken;
  if (tokens.refreshToken) {
    localStorage.setItem('vaultkey_refresh_token', tokens.refreshToken);
  }
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('vaultkey_refresh_token');
}

/**
 * Decodes the (unverified) payload of a JWT purely for display
 * purposes (identity name/role in the UI). This is NOT a security
 * check — every real authorization decision happens server-side on
 * every request, regardless of what this decodes to.
 */
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function rawRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: res.status, ok: res.ok, data };
}

/**
 * Tries the request. If it comes back 401 and we have a refresh
 * token, attempts exactly one silent refresh, then retries the
 * original request once with the new access token. If the refresh
 * itself fails, the session is considered lost.
 */
async function request(path, options = {}) {
  const first = await rawRequest(path, options);

  if (first.status !== 401 || options.auth === false || !refreshToken) {
    return first;
  }

  const refreshResult = await rawRequest('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });

  if (!refreshResult.ok) {
    clearTokens();
    onAuthLost();
    return first;
  }

  setTokens(refreshResult.data);
  return rawRequest(path, options);
}

/**
 * Used on app startup: exchanges whatever refresh token is stored
 * for a fresh access token, restoring the session without asking
 * the person to log in again. Returns { ok, identity } where
 * identity is decoded from the new access token.
 */
async function refreshSession() {
  if (!refreshToken) return { ok: false };

  const result = await rawRequest('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });

  if (!result.ok) {
    clearTokens();
    return { ok: false };
  }

  setTokens(result.data);
  const payload = decodeJwtPayload(result.data.accessToken);
  return { ok: true, identity: payload ? { name: payload.name, role: payload.role } : null };
}

const api = {
  configure,
  setTokens,
  clearTokens,
  decodeJwtPayload,
  refreshSession,
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

  login: (name, credential) =>
    rawRequest('/api/auth/login', { method: 'POST', body: { name, credential }, auth: false }),
  logout: () =>
    rawRequest('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),

  listSecrets: () => request('/api/secrets'),
  getSecret: (id) => request(`/api/secrets/${id}`),
  createSecret: (payload) => request('/api/secrets', { method: 'POST', body: payload }),
  updateSecret: (id, payload) => request(`/api/secrets/${id}`, { method: 'PATCH', body: payload }),
  rotateSecret: (id) => request(`/api/secrets/${id}/rotate`, { method: 'POST' }),
  deleteSecret: (id) => request(`/api/secrets/${id}`, { method: 'DELETE' }),

  listPolicies: () => request('/api/policies'),
  createPolicy: (payload) => request('/api/policies', { method: 'POST', body: payload }),
  deletePolicy: (id) => request(`/api/policies/${id}`, { method: 'DELETE' }),

  listIdentities: () => request('/api/identities'),
  createIdentity: (payload) => request('/api/identities', { method: 'POST', body: payload, auth: false }),

  listAudit: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/audit${qs ? `?${qs}` : ''}`);
  },
};

export default api;
