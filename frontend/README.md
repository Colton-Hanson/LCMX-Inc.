# Shared Expense Management Tool — Frontend
Sprint 1: SCRUM-11 Register, SCRUM-12 Login.

Sprint 2: SCRUM-38 Settings page, SCRUM-39 Route guards, SCRUM-40 Inline validation errors, SCRUM-41 Responsive and screen-reader pass.

React + Vite. Lives in the `frontend/` folder. For the database and backend setup, follow the main README.

## Quick start
Needs Node.js 20 or newer. Run these from the `frontend/` folder:
```
npm install     # downloads the libraries listed in package.json (one time)
npm test        # automated tests (the tests don't need the backend running)
npm run dev     # starts the app at http://localhost:5173
```
**Does the backend need to be running?** For most things, yes. The login and register pages open without it, but logging in, registering, and the home and settings pages won't work until it's up (set it up with the main README).

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
| `/home` | `HomePage.jsx` | Temporary page under the signed-in top bar, to be replaced by the real dashboard |
| `/settings` | `SettingsPage.jsx` (SCRUM-38, SCRUM-40) | Three cards: Profile, Password and Notifications. Errors show under the field they belong to. |
| | Profile card | Name and email. Changing the email asks for a verification code first. |
| | Password card | Hidden until "Change password" is pressed. A change logs the user out everywhere, so they log in again. |
| | Notifications card | Four checkboxes for which notifications to get |
| anything else | — | Redirects to `/login` |

**Route guard (SCRUM-39).** `RequireAuth.jsx` is a wrapper that protects the pages inside it (`/home` and `/settings`). When one of them opens, it checks with the backend that the user has a valid session, and only then shows the page along with the signed-in top bar and the user's profile.
- Guests get redirected to `/login` with a "Log in to continue." message.
- If a session expires while a page is open, the user is sent to `/login` with "Your session ended. Log in to continue." This happens on the next request the server rejects with a 401, or when they switch back to the browser tab.
- Adding a page that needs a login later? In `App.jsx`, list it with the other protected pages (the group that already holds `/home` and `/settings`). It gets the login check automatically.

## Files
| File | What it does |
|---|---|
| `index.html` | The one HTML page. React draws the app into it. |
| `src/main.jsx` | Starts the app and loads the fonts, Bootstrap and `styles.css` |
| `src/App.jsx` | Which page shows at which URL, and which pages need a login |
| `src/pages/` | The four pages: Register, Login, Home, Settings |
| `src/components/AppHeader.jsx` | The top bar: logo, app name, and when signed in, the Home link and account menu |
| `src/components/RequireAuth.jsx` | The route guard described above |
| `src/components/` (others) | Logo, text box, email box, password box, and the checklist that shows the password rules as you type |
| `src/lib/validators.js` | Where the rules for emails, passwords and names are defined. The forms and the password checklist both use them. |
| `src/lib/apiErrors.js` | Turns a failed backend reply into a message for the user |
| `src/lib/initials.js` | The letters shown in the round profile circle |
| `src/lib/usePageTitle.js` | Sets the browser tab title for each page |
| `src/api/auth.js` | **The only file that talks to the backend.** Every request lives here as a small function (like `loginUser`), and the pages just call those functions. If a backend route changes, this is the one file to update. |
| `src/styles.css` | Our CSS (dark teal theme). Everything else comes from Bootstrap. |
| `vite.config.js` | Dev-server settings, including the `/api` forwarding |
| `tests/` | Automated tests for the forms, pages, route guard, validators and `auth.js` |

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

---
Formatted with AI, all information is original and did not change.
