// The backend has no "list my groups" route yet, so this browser remembers the groups the user created or joined.
// Stored per user in localStorage as [{ id, name, type }]. Storage can be blocked or empty (private windows,
// cleared site data), so every read and write is wrapped and the pages still work without it.

// =====================================================================================================
// WORKAROUND(no list routes)  --  START of the "my groups" workaround
//
// THE PROBLEM
//   The backend has no route that lists "the groups I belong to" (no GET /groups). The backend handoff notes this in
//   backend/SPRINT3_TEAM_HANDOFF.md: "There is no GET /groups or group-detail endpoint ... A dashboard showing all
//   of a user's groups will need an additional backend endpoint."
//
// THE WORKAROUND (this file)
//   This browser keeps its own list of groups in localStorage, one list per signed-in user:
//     - a group is ADDED when the user creates it (CreateGroupPage) or accepts an invite (HomePage),
//     - a group is DROPPED when the server says the user can't open it any more (groupHooks.js).
//   The Home page, the Groups page and the group page's title read this list.
//
// WHAT IT CANNOT DO (known limits, on purpose)
//   - It lives in ONE browser. Sign in on another computer, another browser, or after clearing site data, and
//     the list starts empty. The groups still exist on the server; the page just can't list them.
//   - A group made or joined somewhere else never appears here.
//
// HOW TO REMOVE IT (when the backend adds GET /groups)
//   1. In api/groups.js add:  export const getMyGroups = () => request('GET', GROUPS_PATH);
//   2. HomePage.jsx and GroupsPage.jsx: load the groups with getMyGroups() instead of getKnownGroups().
//   3. Delete the rememberGroup / forgetGroup / useKnownGroup calls (search this repo for "WORKAROUND(no list routes)").
//   4. Delete this file and lib/eventCache.js, and their lines in README.md.
// =====================================================================================================

const keyFor = (userId) => `groups:${userId}`;

const isGroup = (g) => g && Number.isInteger(g.id) && typeof g.name === 'string' && typeof g.type === 'string';

// Groups remembered for this user, oldest first. Returns [] when nothing is stored or storage is unavailable.
export function getKnownGroups(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(keyFor(userId)));
    return Array.isArray(list) ? list.filter(isGroup) : [];
  } catch {
    return [];
  }
}

// Adds a group (or updates it if the id is already there) and returns the new list.
export function rememberGroup(userId, group) {
  const next = [...getKnownGroups(userId).filter((g) => g.id !== group.id), { id: group.id, name: group.name, type: group.type }];
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Storage unavailable: the list still works for this visit through the returned value.
  }
  return next;
}

// Drops a group the user can no longer open (removed from it, or it no longer exists).
export function forgetGroup(userId, groupId) {
  const next = getKnownGroups(userId).filter((g) => g.id !== groupId);
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Same as above.
  }
  return next;
}

// WORKAROUND(no list routes)  --  END of the "my groups" workaround (see the banner at the top of this file)
