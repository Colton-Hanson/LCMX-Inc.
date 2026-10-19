// Backend calls for groups, invitations, members and events. Pages import these small functions and never call
// fetch directly. Every function resolves to { ok, status, data?, network? } (see http.js).
//
// Routes used:
//   POST /groups   POST /groups/{id}/invitations   GET /groups/invitations/pending
//   POST /groups/{id}/invitations/accept   POST /groups/{id}/invitations/decline
//   GET /groups/{id}/members   DELETE /groups/{id}/members/{userId}[?confirm=true]
//   POST /events

import { API_PREFIX, normalizeEmail, request } from './http.js';

const GROUPS_PATH = `${API_PREFIX}/groups`;
const EVENTS_PATH = `${API_PREFIX}/events`;

// Creates a group; the signed-in user becomes its admin. groupType is one of: roommate, partner, family, outing.
// Returns { id, name, group_type, created_by }.
export const createGroup = ({ name, groupType }) =>
  request('POST', GROUPS_PATH, { name: String(name ?? '').trim(), group_type: groupType });

// Invites a registered user by email. data.status is 'pending' (invite saved) or 'registration_required'
// (no account with that email, so nothing was saved or sent). 409 means already invited or already a member.
export const inviteMember = (groupId, email) =>
  request('POST', `${GROUPS_PATH}/${groupId}/invitations`, { email: normalizeEmail(email) });

// The signed-in user's pending invitations: [{ group_id, group_name, group_type }].
export const getPendingInvitations = () => request('GET', `${GROUPS_PATH}/invitations/pending`);

// The signed-in user answers one of their own pending invitations.
export const acceptInvitation = (groupId) => request('POST', `${GROUPS_PATH}/${groupId}/invitations/accept`);
export const declineInvitation = (groupId) => request('POST', `${GROUPS_PATH}/${groupId}/invitations/decline`);

// Accepted members only: [{ user_id, email, is_admin }].
export const getMembers = (groupId) => request('GET', `${GROUPS_PATH}/${groupId}/members`);

// Removes a member (admins only). A member with an unsettled balance comes back as a 409 whose
// data.detail is { message, balance, confirmation_required: true }; call again with confirm = true to go ahead.
export const removeMember = (groupId, userId, confirm = false) =>
  request('DELETE', `${GROUPS_PATH}/${groupId}/members/${userId}${confirm ? '?confirm=true' : ''}`);

// Creates an event for a subset of the group. memberIds must be accepted members, at least one.
// Returns { id, group_id, name, member_ids }.
export const createEvent = ({ name, groupId, memberIds }) =>
  request('POST', EVENTS_PATH, { name: String(name ?? '').trim(), group_id: groupId, member_ids: memberIds });

// Placeholder: the backend has no route for handing the admin role to someone else yet.
// When it exists, replace the body with a request and the Group settings page will start using it.
export const reassignAdmin = async () => ({
  ok: false,
  status: 501,
  data: { detail: 'Reassigning the admin role isn’t available yet.' },
});
