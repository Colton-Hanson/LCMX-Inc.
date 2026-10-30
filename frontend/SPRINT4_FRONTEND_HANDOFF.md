# Sprint 4 Frontend Handoff

This doc covers where the frontend stands after Sprint 4, what is saved in the browser for now, and what front end needs from backend to complete wiring of certain UI features thus far. The sections are listed below.

## Contents

1. What is done
2. What is saved in browser for now, but needs backend routes
3. Other features that need backend support to be completed
4. Future Frontend work
5. Questions for the team
6. Notes

## 1. What is done

- SCRUM-83 Add expense: done.
- SCRUM-84 Split picker (Even, Custom, Percentage, live preview): done.
- SCRUM-85 Balances: done, but need additions to `GET /balances`. (See section 3)
- Also built: a default split per group, set in Group settings. Add expense will open on each
  group's default split, but it can still be changed per expense. (need backend wiring, see
  section 2)

Tests: 22 files, 302 tests pass. The build passes.

To run it, from `frontend/`: `npm install`, then `npm test` or `npm run dev`.

## 2. What is saved in browser for now, but needs backend routes

These three features work, but the data is kept only in the browser that created it, so
another browser or person will not see it. It also disappears if the browser's saved site
data (cache) is cleared. Each is marked `WORKAROUND(...)` in the code, with removal steps
at the top of its file.

1. My groups list (Home, Groups page, Add expense dropdown, group names)
   - Now: remembers the groups created or joined in this browser. With the route: the list
     comes from the server and works in any browser.
   - Currently saved in: `src/lib/groupCache.js`
   - Needs from backend: `GET /groups` (id, name, type, members) and `GET /groups/{id}`.

2. Events list on the group page
   - Now: shows only events created in this browser. With the route: shows every event in
     the group to every member.
   - Currently saved in: `src/lib/eventCache.js`
   - Needs from backend: `GET /groups/{id}/events` (id, name, member ids).

3. Default split per group
   - Now: Group settings saves it in this browser and Add expense reads it from there. With
     the route: the whole group shares one default, in any browser.
   - Currently saved in: `src/lib/splitDefault.js`
   - Needs from backend: a way to read and save it. The column
     `user_groups.split_percentage` already exists. For example, add a field for it to the
     members list, and add `PUT /groups/{id}/split-default` to save it.

## 3. Other features that need backend support to be completed

1. Names: add `name` to the `GET /groups/{id}/members` reply and to each entry in
   `GET /balances`. This lets every page show names. Currently only the email comes back,
   so every page shows emails.

2. Additional balance details: an add `group_name`, `other_user_name` and an `expenses` list
   (id, description, amount, paid_by, your share) to each entry in `GET /balances`. This
   lets the page show names and the expenses behind each amount from one call, and allows
   itemizing and tracking every user's balance on the Balances page. Currently the
   workaround is two extra calls per group and a group name from the browser-saved list.
   Balances are also netted, which makes the UI confusing when showing the full list of what
   you owe or what is owed to you for another user.

3. Events with expenses: an optional `event_id` on `POST /expenses`, `GET /events/{id}`,
   `GET /events/{id}/expenses`, and a balance filter by event (for example
   `GET /balances?event_id=`). An event expense still shows in the group's expense list,
   and the event card and page show only that event's expenses.

4. More expense fields: category, date, location and items on `POST /expenses`, plus
   `GET /expenses/{id}`. These have not been added to the expense form yet since there is
   no way to send them to the backend.

5. Settle up (likely a future sprint): three routes and a table to store settlements (there
   is none yet). The Balances page has no Settle up button yet. For example:
   - `POST /groups/{id}/settlements` to record a payment. A full or partial payment is the
     same route, only the amount differs.
   - `GET /groups/{id}/settlements` for the settlement history.
   - `PATCH /settlements/{id}` to confirm the payment was received.

6. Former members: a route for an admin to mark a former member's expenses complete. Today
   they only show as "Former member."

7. Make admin: `PATCH /groups/{id}/members/{uid}`. I turned the Make admin button off in
   Group settings until this route exists.

8. Invites: add the inviter's name as `invited_by` to `GET /groups/invitations/pending`.
   With no name, the invite card cannot say who sent it, for example: "John" invited you to
   join Group. It says "You're invited to join" with no name.

9. Profile photo (likely a future sprint): an upload route. I turned the Upload a photo
   button off in Settings until this route exists.

## 4. Future Frontend work

These may already be planned in later sprints. They are listed here so I dont forget.

1. Expense Added confirmation page.
2. Settle up screens and history.
3. Recent activity on Home.
4. Small polish: a shorter Balances layout on phones, and sending `/` to `/home`.

## 5. Questions for the team

1. What does "every It4-5 field" in SCRUM-83 cover?
2. Should only admins set the group default split? Anyone can for now.
3. Possible un-netting of balances between two people, so the expense history can show each
   debt on its own and not only the net.

## 6. Notes

1. The production server needs to send `index.html` for deep links such as `/groups/1`.
2. Noticed the group type changed from `roommate` to `roommates` on `main`.
   Will make sure the two match in future sprints.
