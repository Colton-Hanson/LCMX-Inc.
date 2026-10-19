// The one place that talks to the backend with fetch. auth.js and groups.js build their calls on top of it.
//
// Every call resolves to { ok, status, data?, network? }:
//   ok       true for a 2xx response
//   status   HTTP status code (0 when the request never reached the server)
//   data     parsed JSON body, or null when there is none
//   network  true when the server could not be reached at all

export const API_PREFIX = '/api'; // must match the proxy in vite.config.js

// Emails are sent trimmed and lowercase so one person cannot end up with two accounts.
export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// Shared request helper. `body` is optional (GET, DELETE and the accept/decline calls send none).
export async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'include', // sends the session cookie
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only throws when the request never completed (server down, offline, blocked).
    return { ok: false, status: 0, network: true };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Empty or non-JSON body: data stays null.
  }
  return { ok: res.ok, status: res.status, data };
}
