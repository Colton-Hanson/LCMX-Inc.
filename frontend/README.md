# Shared Expense Management Tool â€” Frontend

## How to run it

You need Node.js 22 or newer. The backend must already be running (see the main README).

### The frontend

Open a terminal in the `frontend/` folder and run:

```
npm install     # one time
npm run dev     # starts the app at http://localhost:5173
npm test        # runs the automated tests
npm run build   # only needed for deployment
```

Two Windows tips:
- If PowerShell blocks `npm`, type `npm.cmd` instead.
- Run the tests from a terminal whose folder path starts with an upper-case drive letter (`C:\...`, not `c:\...`). Otherwise hundreds of tests can fail with "Invalid Chai property".

### The temporary receipt reader

Only needed to read receipts you upload. Without it, an upload stays at "uploaded". It lives in the `temporary-reader` folder at the top of the repo, and it needs Python 3.12.

1. Double-click `temporary-reader\Start_Receipt_Reader.bat`.
2. The first time only: wait about a minute while it sets itself up, then paste the API key you were given. It saves the key in `temporary-reader\.env`. Git ignores that file. Never commit it.
3. Leave the window open. Close it to stop the reader.
4. Upload a receipt in the app. Within a few seconds it goes from "uploaded" to "reading" to "read", and the review screen opens.

Good to know:
- The key stops working on Nov 23.
- The reader never changes the backend. It only reads `backend/.env` to find the database.
- Delete the whole `temporary-reader` folder when the real reader is built into the backend.
- Its own tests (no network): run `.venv\Scripts\python.exe -m pytest` from that folder.

## What the frontend covers, by sprint

Sprint 1: SCRUM-11 Register, SCRUM-12 Login.

Sprint 2: SCRUM-38 Settings page, SCRUM-39 Route guards, SCRUM-40 Inline validation errors, SCRUM-41 Responsive and screen-reader pass.

Sprint 3: SCRUM-71 Pending invites on Home, SCRUM-68 Create group, SCRUM-70 Create event, SCRUM-69 Group settings.

Sprint 4: SCRUM-83 Add expense, SCRUM-84 Split picker, SCRUM-85 Balances.

Sprint 5: demo week, no frontend tickets.

Sprint 6: SCRUM-112 Receipt upload screen, SCRUM-114 Reading screen and summary, SCRUM-115 Error screens, SCRUM-116 Check the items placeholder.

Sprint 7: SCRUM-134 Check and assign (receipt review), SCRUM-135 Edit and delete expense, SCRUM-136 Settle up, SCRUM-137 Delete receipt picture. (SCRUM-133, the receipt reader, is the stand-in in `temporary-reader/` until the real one is in the backend.)

React + Vite. Lives in the `frontend/` folder. For the database and backend setup, follow the main README. For what the frontend still needs from the backend, see `SPRINT7_FRONTEND_HANDOFF.md` (latest), `SPRINT6_FRONTEND_HANDOFF.md`, `SPRINT4_FRONTEND_HANDOFF.md` and `BACKEND_NOTES.md`.

## More about running it
**Does the backend need to be running?** For most things, yes. The login and register pages open without it, but logging in, registering, and the home and settings pages won't work until it's up (set it up with the main README). Add expense and Balances also need the Sprint 4 database migrations: run `alembic upgrade head` from `backend/` once.

**`npm run build`** isn't needed while developing. It's for deployment: it packs the app into plain files in a `dist/` folder that a web server can hand out.

Windows PowerShell blocking `npm`? Use `npm.cmd` instead, or run this once in the VS Code terminal (or any PowerShell window): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**Backend on a different port?** You only need this if you started the backend on a port other than 8000, for example with `uvicorn app.main:app --reload --port 9000`. In that case, start the frontend with the same number. In the commands below, 9000 is just the example, so type the port you used there instead:
- Windows (PowerShell / VS Code terminal): `$env:BACKEND_URL="http://localhost:9000"; npm run dev`
- Mac/Linux: `BACKEND_URL=http://localhost:9000 npm run dev`

**How the frontend and backend connect:** the browser only talks to the frontend (`http://localhost:5173`). Any request starting with `/api` gets passed along to the backend by the dev server in `vite.config.js`, which drops the `/api` part first (`/api/auth/login` reaches the backend as `/auth/login`).

## Pages
| URL | Page | What it does |
|---|---|---|
| `/register` | `RegisterPage.jsx` (SCRUM-11) | Email and password checks, then logs the user in and goes to `/home` |
| `/login` | `LoginPage.jsx` (SCRUM-12) | One generic message for a wrong email or password |
| `/home` | `HomePage.jsx` (SCRUM-71) | Greeting, "Your groups", and "Pending invites" with Accept and Decline. An accepted group appears right away, no refresh. |
| `/groups` | `GroupsPage.jsx` | Pending invites at the top, then cards for your groups from the server (three per row on wide screens), and a Create group button |
| `/groups/new` | `CreateGroupPage.jsx` (SCRUM-68) | Group name, type, and people to invite by email. Cancel saves nothing. Success opens the group page. |
| `/groups/:groupId` | `GroupPage.jsx` | The group's name, type, events, members and recent expenses, with buttons for Add expense, New event and Group settings. Each event shows the pie logo and a "Split between N people" caret that opens the people in it with their share, plus the expenses that belong to it. Recent expenses and Events each have an Expand all / Collapse all button. |
| `/groups/:groupId/events/new` | `CreateEventPage.jsx` (SCRUM-70) | Event name, then All members or Pick members (shown by short name, like "Alice R."). Create event stays off while nobody is selected. |
| `/groups/:groupId/settings` | `GroupSettingsPage.jsx` (SCRUM-69) | Member list with Admin, Member and Pending, add a member, remove with a balance warning. A Default split card sets how new expenses in the group start (Even, or a percentage for each member). Make admin is turned off for now. |
| `/expenses/new` and `/groups/:groupId/expenses/new` | `AddExpensePage.jsx` (SCRUM-83, SCRUM-84) | Title, total, group, who paid, an optional event, and who is in the split (Even, Custom or Percentage), with each person's share shown live and a colour bar. The "Who is in this expense?" box is a button that puts everyone in or takes everyone out. Choosing "No event" keeps the people already picked. Save is blocked until the amounts add up. The group's default split is the starting choice and can be changed. Cancel discards the form. A user with no group sees a prompt to create one. |
| `/balances` | `BalancesPage.jsx` (SCRUM-85, SCRUM-136) | Two totals, then the lists "Who owes you" and "Who you owe", with one row per person per group (newest first) and the expenses behind each amount. Pay and Mark received open a dialog. Settlement history is below. The green paid message has a grey X. |
| `/settings` | `SettingsPage.jsx` (SCRUM-38, SCRUM-40) | A "â† Home" link, then three cards: Profile, Password and Notifications. Errors show under the field they belong to. |
| | Profile card | Name and email. Changing the email asks for a verification code first. |
| | Password card | Hidden until "Change password" is pressed. A change logs the user out everywhere, so they log in again. |
| | Notifications card | Four checkboxes for which notifications to get |
| anything else | â€” | Redirects to `/login` |

**Route guard (SCRUM-39).** `RequireAuth.jsx` is a wrapper that protects the pages inside it (every page except `/login` and `/register`). When one of them opens, it checks with the backend that the user has a valid session, and only then shows the page along with the signed-in top bar and the user's profile.
- Guests get redirected to `/login` with a "Log in to continue." message.
- If a session expires while a page is open, the user is sent to `/login` with "Your session ended. Log in to continue." This happens on the next request the server rejects with a 401, or when they switch back to the browser tab.
- Adding a page that needs a login later? In `App.jsx`, list it with the other protected pages (the group that already holds `/home`, `/settings` and the group pages). It gets the login check automatically.

## Files
| File | What it does |
|---|---|
| `index.html` | The one HTML page. React draws the app into it. |
| `src/main.jsx` | Starts the app and loads the fonts, Bootstrap and `styles.css` |
| `src/App.jsx` | Which page shows at which URL, and which pages need a login |
| `src/pages/` | The pages in the table above |
| `src/components/AppHeader.jsx` | The top bar: logo, app name, and when signed in, the Home, Groups and Balances links, the Add expense button and the account menu |
| `src/components/RequireAuth.jsx` | The route guard described above |
| `src/components/` (others) | Logo, text box, email box, password box, the password rules checklist, and for groups: the avatar, boxed messages, the invite-by-email row and the pop-up dialog. Sprint 4 added the invite cards (`PendingInvites.jsx`), the recent expenses card (`RecentExpenses.jsx`), the split rows (`SplitWho.jsx`) and the Default split card (`SplitDefaultPanel.jsx`). |
| `src/lib/splitDefault.js` | Helpers for a group's default split (equal shares, scaling to the people in an expense, checking typed percentages). The default itself is read and saved through the backend. |
| `src/lib/groupHooks.js` | Loads a group's members and finds a group's name for the pages |
| `src/lib/groupTypes.js` | The four group types (roommate, partner, outing, family) and their labels |
| `src/lib/validators.js` | Where the rules for emails, passwords and names are defined. The forms and the password checklist both use them. |
| `src/lib/splits.js` | The split math for Add expense, in whole cents and basis points (33.33% is 3333). Same rules as the backend's split calculator. |
| `src/lib/expenseValidators.js` | The rules for the Add expense title and total |
| `src/lib/balances.js` | Turns the `GET /balances` reply into the rows and totals the Balances page shows. Rows go newest first, using the dates of each person's expenses. |
| `src/components/receipt/PictureViewer.jsx` | The pop-up that shows the receipt picture big. Zoom with the buttons, the + and - keys, or a double click on the spot you want; drag to move around. |
| `src/lib/useOpenSet.js` | Remembers which "Split between N people" rows are open, so one Expand all / Collapse all button can open or close them all |
| `src/lib/people.js` | Short names for people: "Alice R." from a name, or from the start of the email when there is no name. `PersonName.jsx` shows one, and a tap shows the email under it. |
| `src/lib/apiErrors.js` | Turns a failed backend reply into a message for the user |
| `src/lib/initials.js` | The letters shown in the round profile circle |
| `src/components/Avatar.jsx` | The round avatar: two initials ("CH"), one letter for a group or event. The colour comes from the initials, so a person is the same colour everywhere (top bar, lists, split bar). |
| `src/lib/usePageTitle.js` | Sets the browser tab title for each page |
| `src/api/http.js` | The one place that calls `fetch`. It sends the cookie and turns every reply into `{ok, status, data}`. |
| `src/api/auth.js` | Sign-in, account and profile requests as small functions (like `loginUser`). Pages call these functions and never `fetch` directly. |
| `src/api/groups.js` | Group, invitation, member and event requests, the same way. If a backend route changes, update the matching file in `src/api/`. |
| `src/api/expenses.js` | Expense and balance requests as small functions (`createExpense`, `getGroupExpenses`, `getBalances`) |
| `src/styles.css` | Our CSS (dark teal theme). Everything else comes from Bootstrap. |
| `src/addExpense.css`, `balances.css`, `groupExpenses.css`, `invites.css`, `topbar.css` | The CSS for the Sprint 4 screens |
| `vite.config.js` | Dev-server settings, including the `/api` forwarding |
| `tests/` | Automated tests (37 files, 587 tests) for the forms, pages, route guard, validators, `auth.js`, `groups.js`, the group screens, expenses, split math, balances, settle up, receipts, avatars and the default split |

**Groups and default split come from the server.** The group list (`GET /groups`), one group (`GET /groups/{id}`), its events (`GET /groups/{id}/events`) and its default split (`GET` and `PUT /groups/{id}/split-default`) are all real backend routes. Nothing about groups is saved in the browser, so a new computer, browser or profile shows the same groups.

## Backend routes this frontend uses
| Call | Route | Success | Failures the UI handles |
|---|---|---|---|
| `registerUser` | `POST /auth/register` `{email, password}` | 201 | 409 duplicate email, 422 rejected data |
| `loginUser` | `POST /auth/login` `{email, password}` | 200 + `access_token` httpOnly cookie | 401 (same reply for bad email or bad password) |
| `getCurrentUser` | `GET /auth/me` | 200 `{id, email}` | 401 not logged in |
| `logoutUser` | `POST /auth/logout` | 200 | network failure |
| `getProfile` | `GET /profile` | 200 profile | 401 sends the user to login |
| `updateProfile` | `PATCH /profile` (name, photo_url, `notify_*`) | 200 profile | 422 blank or too long name, 401 |
| `requestEmailChange` | `POST /profile/email-change` `{new_email}` | 200 `{message, verification_token}` | 400 same email, 409 already in use, 422 not an email |
| `confirmEmailChange` | `POST /profile/email-change/confirm` `{token}` | 200 | 400 wrong or expired code, 409 |
| `changePassword` | `POST /auth/change-password` `{current_password, new_password}` | 200 (all sessions end) | 400 wrong current password, 422 weak new password |
| `createGroup` | `POST /groups` `{name, group_type}` | 201 group | 422 blank name or bad type, 401 |
| `inviteMember` | `POST /groups/{id}/invitations` `{email}` | 201 `status: pending`, or `registration_required` (nothing sent) | 409 already invited or a member, 403 not a member, 404 |
| `getPendingInvitations` | `GET /groups/invitations/pending` | 200 `[{group_id, group_name, group_type}]` | 401 |
| `acceptInvitation`, `declineInvitation` | `POST /groups/{id}/invitations/accept` and `/decline` | 200 | 404 invitation already gone |
| `getMembers` | `GET /groups/{id}/members` | 200 `[{user_id, email, is_admin}]` (accepted members only) | 403 or 404 not a member |
| `removeMember` | `DELETE /groups/{id}/members/{userId}` (`?confirm=true` after the warning) | 200 | 409 balance warning (asks to confirm) or only admin, 403 not an admin |
| `createEvent` | `POST /events` `{name, group_id, member_ids}` | 201 event | 422 nobody picked or someone outside the group, 403 |
| `createExpense` | `POST /expenses` `{group_id, description, amount, paid_by, participant_ids, split_method, split_values}` | 201 expense with each person's `shares` | 422 a split that does not add up (the server's sentence is shown), 403 not an accepted member |
| `getGroupExpenses` | `GET /groups/{id}/expenses` | 200 `[{id, group_id, description, amount, paid_by, created_at, shares}]`, newest first | 403 not an accepted member |
| `getBalances` | `GET /balances` | 200 `{group_balances, overall_balances, total_net}` (ids and amounts only) | 401 sends the user to login |
| `reassignAdmin` | none yet | placeholder | the backend has no route, so Make admin is turned off |

---
Formatted with AI, all information is original and did not change.
