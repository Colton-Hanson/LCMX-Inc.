// =====================================================================================
// auth.js — THE ONLY FILE THAT TALKS TO THE BACKEND.
// Every page calls the small functions at the bottom (registerUser, loginUser, ...) and never
// uses fetch() directly, so if a route changes you fix it HERE and nothing else.
//
// CONFIRMED AGAINST LUKAS'S BACKEND (FastAPI, repo commit 1a49ffc, backend/app/api/routes/auth.py):
//   POST /auth/register  { email, password }  -> 201 { id, email }
//                                                409 duplicate email | 422 invalid body
//   POST /auth/login     { email, password }  -> 200 { message, user: { id, email } } + sets cookie
//                                                401 bad email OR bad password (same message for both)
//   GET  /auth/me                             -> 200 { id, email } | 401 not logged in
//   POST /auth/logout                         -> 200 { message } (clears the cookie)
//   Session = an httpOnly cookie named "access_token" (JWT, 8 hours). JavaScript can't read it —
//   that's the point — so the browser just attaches it for us (see `credentials: 'include'`).
//
// WHAT EVERY FUNCTION BELOW RETURNS: { ok, status, data?, network? }
//   ok       true when the HTTP status was 2xx
//   status   the HTTP status code (0 if the request never reached the server)
//   data     the parsed JSON body, or null if there wasn't one
//   network  true when the server could not be reached at all (offline / server not running)
//
// WHY THE "/api" PREFIX?
//   The browser calls /api/auth/login on the SAME address as the page (http://localhost:5173).
//   In development, vite.config.js strips "/api" and forwards the call to the backend
//   (default http://localhost:8000), so the backend itself still sees plain /auth/login.
//   Same address = no CORS problems and the login cookie just works.
//   For a real deployment, put a reverse proxy in front that does the same thing.
// =====================================================================================

// All backend paths live here, in one place.
const API_PREFIX = '/api'; // BACKEND HOOK: must match the proxy in vite.config.js
const REGISTER_PATH = `${API_PREFIX}/auth/register`;
const LOGIN_PATH = `${API_PREFIX}/auth/login`;
const ME_PATH = `${API_PREFIX}/auth/me`;
const LOGOUT_PATH = `${API_PREFIX}/auth/logout`;

// The backend compares emails exactly as typed, so "Cole@UMKC.edu" and "cole@umkc.edu" would be treated
// as two different people. We always send trimmed, lowercase emails so the same person can't end up with
// two accounts, and so logging in never depends on remembering capital letters.
// (Flagged for the backend: normalise emails on the server too — see README "Notes for the team".)
const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// One shared helper for every request. `body` is optional (GET and logout send none).
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      // Only say "this is JSON" when we actually send JSON.
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'include', // keeps the httpOnly session cookie (needed for login, /me and logout)
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch() only throws when the request never completed (server down, offline, blocked).
    return { ok: false, status: 0, network: true };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body — that's fine, data stays null */
  }
  return { ok: res.ok, status: res.status, data };
}

// SCRUM-13 (Lukas): create an account. The "confirm password" box is checked in the browser only and is NOT sent.
// NOTE: registering does NOT log you in (the backend sets no cookie here) — RegisterPage logs in right after.
export const registerUser = ({ email, password }) =>
  request('POST', REGISTER_PATH, { email: normalizeEmail(email), password });

// SCRUM-15 (Lukas): log in. On success the backend sets the session cookie.
// On failure it answers 401 with the same message whether the email or the password was wrong.
export const loginUser = ({ email, password }) =>
  request('POST', LOGIN_PATH, { email: normalizeEmail(email), password });

// Who is logged in right now? 200 { id, email } if the cookie is valid, 401 if not. Used by the Home page.
export const getCurrentUser = () => request('GET', ME_PATH);

// Ends the session: the backend deletes the cookie.
export const logoutUser = () => request('POST', LOGOUT_PATH);
