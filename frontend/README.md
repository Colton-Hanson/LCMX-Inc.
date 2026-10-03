# Group Budget Tracker — frontend (Sprint 1: SCRUM-11 Register, SCRUM-12 Login)

React + Vite. Where it goes in the group repo: the `frontend/` folder (the main README's project structure already expects it).

## Quick start — frontend only (copy and paste)
Needs Node.js 20 or newer. Run these from the `frontend/` folder:
```
npm install     # downloads the libraries listed in package.json (one time)
npm test        # automated tests (no backend needed — the server is faked in tests)
npm run dev     # starts the app at http://localhost:5173
```
Open http://localhost:5173. The pages load without a backend, but registering and logging in need the backend below.
Other command: `npm run build` makes a production build in `dist/`.

Windows PowerShell blocking `npm`? Use `npm.cmd`, or run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Quick start — the whole app with the backend (register / log in for real)
Three things have to be running: **Postgres**, the **backend**, then the **frontend**. Use two terminals.
Steps below are for Windows PowerShell; on Mac/Linux the commands are the same except where noted.

**Step 1 — database.** Install and start PostgreSQL, then create the database:
```
createdb shared_expense_dev
```
(If it says the password is wrong, add `-U postgres`: `createdb -U postgres shared_expense_dev`.)

**Step 2 — backend, terminal 1.** From the repo root:
```
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1                 # Mac/Linux: source .venv/bin/activate
```
Install the libraries. On Windows, skip `uvloop` (it only works on Mac/Linux, and the backend runs fine without it):
```
Get-Content requirements.txt | Where-Object { $_ -notmatch '^uvloop' } | Out-File $env:TEMP\req.txt -Encoding ascii
pip install -r $env:TEMP\req.txt           # Mac/Linux: pip install -r requirements.txt
```
Create your private settings file, then open `backend/.env` and fill in the two values (see `.env.example`):
```
copy .env.example .env                     # Mac/Linux: cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"   # prints a random value to use as JWT_SECRET
```
- `DATABASE_URL` — your Postgres username, password and port (usually 5432), for example `postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/shared_expense_dev`
- `JWT_SECRET` — the random value printed above

`.env` is git-ignored, so your values stay on your machine. Then build the tables and start the backend:
```
alembic upgrade head
uvicorn app.main:app --reload
```
Check http://localhost:8000/health — it should show `{"status":"ok"}`. Leave this terminal running.

**Step 3 — frontend, terminal 2.** From the repo root:
```
cd frontend
npm install
npm run dev
```
**Step 4 — try it.** Open http://localhost:5173, register an account. You're logged in automatically and land on a page that says **YOU HAVE SUCCESSFULLY LOGGED IN!** with a **LOG OUT** button.

Backend on a different port? `BACKEND_URL=http://localhost:9000 npm run dev` (PowerShell: `$env:BACKEND_URL="http://localhost:9000"; npm run dev`).

**How the two connect:** the browser calls `/api/auth/login` on the frontend's own address (:5173). In development `vite.config.js` strips `/api` and forwards it to the backend, so the backend sees `/auth/login`. One address means no CORS setup and the login cookie just works. A real deployment needs a reverse proxy doing the same.

## What each page does
| URL | Page | Notes |
|---|---|---|
| `/register` | `RegisterPage.jsx` (SCRUM-11) | email check, masked password with live rules checklist, confirm-password check. After the account is created it logs the user in automatically (the backend's register endpoint doesn't), then goes to `/home`. |
| `/login` | `LoginPage.jsx` (SCRUM-12) | one generic failure message for wrong email OR wrong password (no account-existence leak); separate messages for server down / too many attempts / server errors. |
| `/home` | `HomePage.jsx` | **Temporary** landing page: blank except a centered **YOU HAVE SUCCESSFULLY LOGGED IN!** message and a **LOG OUT** button. Only shown when the backend confirms a valid login; guests are sent to `/login`. Replace the contents of its `.landing` block with the real dashboard next sprint (keep the login check). |
| anything else | — | redirects to `/login` |

## What's in each file
| File | What it does |
|---|---|
| `index.html` | The one HTML page; React draws into its `<div id="root">` |
| `src/main.jsx` | Starts the app |
| `src/App.jsx` | Which page shows at which URL |
| `src/pages/*.jsx` | The pages above |
| `src/components/*` | Reusable pieces: email box, password box, live password-rules list |
| `src/lib/validators.js` | Rules for emails/passwords (edit `PASSWORD_RULES` to add a rule) |
| `src/api/auth.js` | **The only file that talks to the backend** — routes, request shape, status handling |
| `src/styles.css` | Our own small CSS (page background, 48px touch targets, landing layout). Most of the look comes from Bootstrap, which `src/main.jsx` loads first |
| `vite.config.js` | Dev-server settings, incl. the `/api` -> backend proxy |
| `tests/*` | Automated tests (validators, `src/api/auth.js`, both forms, the landing page) + `tests/setup.js` |

## Folder layout (matches the structure in the main README)
```
frontend/
├── src/
│   ├── api/          auth.js — every backend call
│   ├── components/   email box, password box, password-rules list
│   ├── pages/        RegisterPage, LoginPage, HomePage
│   ├── lib/          validators.js — email/password rules (not in the main README's diagram; fine to move)
│   ├── App.jsx, main.jsx, styles.css
├── tests/            all automated tests + setup.js
├── index.html, vite.config.js, package.json, package-lock.json, .gitignore, README.md
```

## Backend routes this frontend uses (confirmed against `backend/app/api/routes/auth.py`)
| Call | Route | Success | Failures the UI handles |
|---|---|---|---|
| `registerUser` | `POST /auth/register` `{email, password}` | 201 | 409 duplicate email, 422 rejected data |
| `loginUser` | `POST /auth/login` `{email, password}` | 200 + `access_token` httpOnly cookie | 401 (same reply for bad email or bad password) |
| `getCurrentUser` | `GET /auth/me` | 200 `{id, email}` | 401 not logged in |
| `logoutUser` | `POST /auth/logout` | 200 | network failure (the page says it couldn't log you out) |

Search the project for **`BACKEND HOOK`** to find every spot that depends on the backend.

## Notes for the team (found while connecting the two halves)
Flagged for whoever works on the backend next. They're observations, not blame — the frontend works around the first two.
1. **Emails are case-sensitive on the server.** `COLE@x.com` registers as a second account next to `cole@x.com`. The frontend lowercases emails before sending; the backend should normalise too.
2. **Server only enforces password length ≥ 8.** The requirements also say 1 capital + 1 symbol; the browser enforces those, but a direct call to the API can still create an account with a weak password like `password`. Mirror `PASSWORD_RULES` (in `src/lib/validators.js`) in the backend's `RegisterRequest`.
3. **Register doesn't start a session** (no cookie). The frontend logs in right after registering. If the backend ever does this itself, the extra login call can be removed from `RegisterPage.jsx`.
4. **Cookie is `secure=False`** (fine for http://localhost). Needs `secure=True` once the app is served over HTTPS.
5. **Route guards for every page are SCRUM-39** (Sprint 2). Only `/home` checks login for now.
6. **`uvloop` in `backend/requirements.txt` can't install on Windows**, so `pip install -r requirements.txt` fails there. The Quick start above skips that one line. Marking it Mac/Linux-only in the file (`uvloop==0.22.1; sys_platform != "win32"`) would let everyone use the same command.

## package.json, explained (JSON can't contain comments)
- `scripts` — the shortcuts above (`npm run dev`, `npm test`, `npm run build`).
- `dependencies` — libraries the app ships with: `react`, `react-dom`, `react-router-dom` (page routing), `bootstrap` (the team's one CSS framework; CSS only, we don't use its JavaScript).
- `devDependencies` — tools used only while developing: `vite` (dev server + build), `vitest` + `jsdom` + `@testing-library/*` (testing).
- `"type": "module"` — lets files use modern `import` / `export` syntax.
