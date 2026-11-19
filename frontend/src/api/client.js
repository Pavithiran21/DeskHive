// The one place that talks to the backend. Every call goes to /api on the same origin (Vite forwards
// it to the backend), so the HttpOnly refresh cookie dh_refresh (path /api/auth) is sent too.
const BASE_URL = '/api';

/**
 * An error answer in the shared format { error: { code, message, details: [{ field, message }], requestId } }.
 * status is 0 when the server could not be reached at all.
 */
export class ApiError extends Error {
  constructor(status, code, message, details = [], requestId = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** The message of one entry in details, for example detail('suggestedLabel'). */
  detail(field) {
    return this.details.find((entry) => entry.field === field)?.message ?? null;
  }
}

// The access token lives only in memory (never localStorage, where an injected script could read it).
// After a reload, POST /auth/refresh with the cookie gets a new one.
let accessToken = null;
let refreshPromise = null;
let onSessionEnded = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

/** Called when a logged-in request gets 401 and the session can't be refreshed. */
export function setSessionEndedHandler(handler) {
  onSessionEnded = handler;
}

async function send(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  try {
    return await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', "Couldn't reach DeskHive. Check your connection and try again.");
  }
}

async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON, for example the dev proxy's page while the backend is down.
  }
  const error = body?.error;
  return new ApiError(
    response.status,
    error?.code ?? (response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN_ERROR'),
    error?.message ?? "Something went wrong. It's not you. Try again in a moment.",
    error?.details ?? [],
    error?.requestId ?? null,
  );
}

/**
 * Gets a new access token with the refresh cookie: { user, accessToken }, or null with no valid session.
 * Only one refresh runs at a time: the backend rotates the cookie on every use, so a second refresh
 * sent in parallel would carry the old cookie and be refused.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await send('/auth/refresh', { method: 'POST', auth: false });
        if (!response.ok) {
          accessToken = null;
          return null;
        }
        const session = await response.json();
        accessToken = session.accessToken;
        return session;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * Sends a request and returns the parsed JSON body (undefined for 204).
 * A logged-in request that gets 401 (usually the 15-minute token ran out) refreshes once and retries;
 * if that fails too, the session has ended and the app logs out. Requests with auth: false (log in,
 * reset password...) never do this, so a wrong password stays a normal error. WRONG_PASSWORD is a 400
 * on purpose, so it never logs anyone out.
 */
export async function apiRequest(path, options = {}) {
  const auth = options.auth ?? true;
  let response = await send(path, options);

  if (response.status === 401 && auth) {
    const session = await refreshSession();
    if (session) {
      response = await send(path, options);
    }
    if (!session || response.status === 401) {
      onSessionEnded();
      throw new ApiError(401, 'SESSION_ENDED', 'Your session ended. Log in again to carry on.');
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

/** "?a=1&b=x" from an object, leaving out empty values. */
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}
