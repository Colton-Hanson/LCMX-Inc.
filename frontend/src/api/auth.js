// Backend calls for signing in, accounts and the profile. Pages import the small functions at the bottom and
// never call fetch directly, so a route change only has to be made here.
//
// Every function resolves to { ok, status, data?, network? }:
//   ok       true for a 2xx response
//   status   HTTP status code (0 when the request never reached the server)
//   data     parsed JSON body, or null when there is none
//   network  true when the server could not be reached at all
//
// Routes used:
//   POST /auth/register   POST /auth/login   GET /auth/me   POST /auth/logout   POST /auth/change-password
//   GET /profile   PATCH /profile   POST /profile/email-change   POST /profile/email-change/confirm
//
// Requests use the /api prefix. In development, vite.config.js strips it and forwards the call to the
// backend, so the browser only talks to its own origin and the httpOnly session cookie is sent automatically.
// The shared request helper lives in http.js, and the group and event calls live in groups.js.

import { API_PREFIX, normalizeEmail, request } from './http.js';

const REGISTER_PATH = `${API_PREFIX}/auth/register`;
const LOGIN_PATH = `${API_PREFIX}/auth/login`;
const ME_PATH = `${API_PREFIX}/auth/me`;
const LOGOUT_PATH = `${API_PREFIX}/auth/logout`;
const CHANGE_PASSWORD_PATH = `${API_PREFIX}/auth/change-password`;
const PROFILE_PATH = `${API_PREFIX}/profile`;

// Creates an account. This does not start a session; call loginUser afterwards.
export const registerUser = ({ email, password }) =>
  request('POST', REGISTER_PATH, { email: normalizeEmail(email), password });

// Logs in. On success the server sets the session cookie.
export const loginUser = ({ email, password }) =>
  request('POST', LOGIN_PATH, { email: normalizeEmail(email), password });

// Returns { id, email } for a valid session, or 401 when nobody is logged in.
export const getCurrentUser = () => request('GET', ME_PATH);

// Ends the session (the server clears the cookie).
export const logoutUser = () => request('POST', LOGOUT_PATH);

// Returns { id, name, email, photo_url, notify_*, email_verified, pending_email }.
export const getProfile = () => request('GET', PROFILE_PATH);

// Updates any of: name, photo_url, notify_group_invite, notify_new_expense, notify_settlement,
// notify_removed_from_group. Fields that are left out stay unchanged. Email is changed separately.
export const updateProfile = (fields) => request('PATCH', PROFILE_PATH, fields);

// Starts an email change. The response includes a verification_token until real email delivery exists.
export const requestEmailChange = (newEmail) =>
  request('POST', `${PROFILE_PATH}/email-change`, { new_email: normalizeEmail(newEmail) });

// Completes an email change with the verification token.
export const confirmEmailChange = (token) =>
  request('POST', `${PROFILE_PATH}/email-change/confirm`, { token: String(token ?? '').trim() });

// Changes the password. On success the server ends every session, so the user must log in again.
export const changePassword = ({ currentPassword, newPassword }) =>
  request('POST', CHANGE_PASSWORD_PATH, { current_password: currentPassword, new_password: newPassword });
