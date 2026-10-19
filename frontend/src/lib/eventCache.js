// The backend has no "list events" route yet, so this browser remembers the events the user created in each group.
// Stored per user and group in localStorage as [{ id, name, count, all }] (count = people in the event, all = it
// was made for every member). Storage can be blocked or empty, so every read and write is wrapped and the pages
// still work without it.

// =====================================================================================================
// WORKAROUND(no list routes)  --  START of the "events in a group" workaround
//
// THE PROBLEM
//   The backend can CREATE an event (POST /events) but has no route that LISTS the events in a group.
//   The backend docs (backend/SPRINT3_TEAM_HANDOFF.md) don't mention an events list route either.
//
// THE WORKAROUND (this file)
//   When the user creates an event, this browser remembers it in localStorage (one list per user and group),
//   and the group page's Events card reads that list. Each entry is { id, name, count, all }.
//
// WHAT IT CANNOT DO (known limits, on purpose)
//   - Only the browser that CREATED the event shows it. A member who was put in the event, signing in on their
//     own browser, will NOT see it, even though the server saved them as a participant.
//   - Clearing site data, or using another computer, loses the list. The events are still on the server.
//
// HOW TO REMOVE IT (when the backend adds something like GET /groups/{id}/events)
//   1. In api/groups.js add:  export const getEvents = (groupId) => request('GET', `${GROUPS_PATH}/${groupId}/events`);
//   2. GroupPage.jsx: load events with getEvents(groupId) instead of getKnownEvents().
//   3. CreateEventPage.jsx: delete the rememberEvent(...) call (search this repo for "WORKAROUND(no list routes)").
//   4. Delete this file and its line in README.md.
// =====================================================================================================

const keyFor = (userId, groupId) => `events:${userId}:${groupId}`;

const isEvent = (e) => e && Number.isInteger(e.id) && typeof e.name === 'string' && Number.isInteger(e.count);

// Events remembered for this group, newest first. Returns [] when nothing is stored or storage is unavailable.
export function getKnownEvents(userId, groupId) {
  try {
    const list = JSON.parse(localStorage.getItem(keyFor(userId, groupId)));
    return Array.isArray(list) ? list.filter(isEvent) : [];
  } catch {
    return [];
  }
}

// Adds an event (or updates it if the id is already there) and returns the new list.
export function rememberEvent(userId, groupId, event) {
  const entry = { id: event.id, name: event.name, count: event.count, all: Boolean(event.all) };
  const next = [entry, ...getKnownEvents(userId, groupId).filter((e) => e.id !== entry.id)];
  try {
    localStorage.setItem(keyFor(userId, groupId), JSON.stringify(next));
  } catch {
    // Storage unavailable: the page still shows the event through the confirmation message.
  }
  return next;
}

// WORKAROUND(no list routes)  --  END of the "events in a group" workaround (see the banner at the top of this file)
