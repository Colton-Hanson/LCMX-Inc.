# Shared Expense Management Tool

"Collaborative finance for people who actually share their lives." That's the pitch. In practice it means you upload a receipt, the app reads it, and it tells you who owes what. No bank connection, no real money moving. Just an honest ledger for people who already trust each other enough to live together or travel together, which is a different kind of trust than "give me your bank password."

**Stack.** React (Vite) on the frontend, Bootstrap for CSS. FastAPI (Python), served by Uvicorn, on the backend, with SQLAlchemy and Alembic for the database layer. PostgreSQL for the database.

**Team.** Cole owns frontend and the LLM receipt pipeline. Mick owns the database. Lukas owns the backend. Xander owns documentation and testing, which is why this file exists and isn't three sentences long.

---

**Getting it running.** Prerequisites: Docker Desktop, Python 3.12 specifically (not whatever `python` resolves to on your machine, 3.12 is the version the pinned packages install cleanly against), and Node.js 20 or newer.

```bash
git clone [repo-url]
cd [repo-name]
docker compose up -d
```

Backend:

```bash
cd backend
py -3.12 -m venv .venv          # Mac/Linux: python3.12 -m venv .venv
.venv\Scripts\Activate.ps1      # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # Mac/Linux: cp .env.example .env
```

Fill in `.env` (two values, see Environment variables below), then:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

Check `http://localhost:8000/health`. It should return `{"status":"ok"}`.

Frontend, second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. On Windows, if PowerShell blocks `npm`, use `npm.cmd` instead.

If you can register an account, log in, and land on the home page, you're set up correctly. Skip `python backend/seed.py` in this flow, it inserts users with placeholder password hashes that can't actually log in. Registering through the browser creates a real, working account. If any of these steps lied to you, fix the README instead of just quietly working around it in your head. Nobody else gets the benefit of your workaround if it only lives in your head.

**Environment variables.** Copy `backend/.env.example` to `backend/.env`. The app currently only reads two values:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/shared_expense_dev
JWT_SECRET=<output of: python -c "import secrets; print(secrets.token_hex(32))">
```

`.env` is git-ignored. Don't commit a real secret. That's not a suggestion, it's NFR-SEC-06.

A note on `db_starter/`: that folder is Mick's schema notes and early migration drafts, not the startup path. It uses a different port and password than the Docker database above. Run the app from `backend/` as described, treat `db_starter/` as reference, not instructions.

---

**How to actually use the thing**, as it stands today. This is the part a grader or a demo audience sees, so it's worth knowing cold, and worth being honest about what's real versus planned.

**Built and working:** register with an email and a password (eight characters, one capital letter, one symbol, typed twice), log in, land on a temporary home page that confirms you're logged in, and log out. Any unknown URL redirects to /login, and /home does the same when there is no valid session.

**Planned, not built yet:** groups and events, manual and receipt-based expense entry, splits and balances, budgets, and the analysis page. The product vision in the opening paragraph above describes where this is headed, not what's demoable right now. Update this section as each piece actually lands, don't let the walkthrough get ahead of the code again.

---
**Project structure.**

```
.
├── backend/
│   ├── app/
│   │   ├── api/            # route handlers
│   │   ├── core/           # security.py
│   │   ├── db/             # session.py
│   │   ├── schemas/        # request/response schemas
│   │   └── main.py
│   ├── alembic/
│   │   └── versions/       # 0001_initial_schema.py
│   ├── tests/
│   ├── models.py
│   ├── requirements.txt
│   ├── seed.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   └── tests/
├── db_starter/             # schema notes, not the startup path
├── docker-compose.yml
├── projectcharter.md
└── projectrequirements.md
```


**Tests.** From `backend`, with the virtualenv active: `pytest`. From `frontend`: `npm test`. Neither needs the database running.

**Workflow.** Backlog lives in JIRA, seeded from the Requirements Spec, every story tagged with a requirement ID, an owner, and an hour estimate. Sprints run Monday to Sunday, one week each. Done means merged, tested, reviewed by someone who isn't you, and runnable from this README with no secret manual steps you forgot to write down. Full regression suite runs at every sprint close, not just at the end of the semester when it's too late to fix anything.

**Scope, the boundaries that don't move.** No real bank access. No real money moving, "settle up" just marks a debt as handled outside the app. No enforcement of budget rules, the app reports, you decide. No admin access to any individual user's data, full stop. Full detail's in the Charter, Section 4.2.

**Other project docs.** `projectcharter.md` and `projectrequirements.md` at the repo root. [Iteration Plan location TBD, see questions below.]

---

CS451R, Professor Jawad, Fall 2026 capstone.

