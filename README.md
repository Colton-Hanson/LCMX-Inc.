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

If you can register an account, log in, and land on the home page, you're set up correctly. Registering through the browser creates a real, working account. If any of these steps lied to you, fix the README instead of just quietly working around it in your head. Nobody else gets the benefit of your workaround if it only lives in your head.

Optional sample data, after `alembic upgrade head`, from `backend` with the virtualenv active:

```bash
python seed.py
```

That only runs against an empty `shared_expense_dev` database. It inserts four accounts with real password hashes:

| Email | Password |
|---|---|
| alice@example.com | AlicePassword123! |
| bob@example.com | BobPassword123! |
| carol@example.com | CarolPassword123! |
| dave@example.com | DavePassword123! |

Alice administers Apartment 4B (roommate). Bob and Carol are accepted members. Dave has a pending invitation there and a declined invitation to Lake Weekend (outing, administered by Bob). Lake Weekend also has an event named Lake Cabin for Alice, Bob, and Carol. Run seed once. A second run stops because those emails already exist.

**Environment variables.** Copy `backend/.env.example` to `backend/.env`. The app currently only reads two values:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/shared_expense_dev
JWT_SECRET=<output of: python -c "import secrets; print(secrets.token_hex(32))">
```

`.env` is git-ignored. Don't commit a real secret. That's not a suggestion, it's NFR-SEC-06.

A note on `db_starter/`: that folder is Mick's schema notes and early migration drafts, not the startup path. It uses a different port and password than the Docker database above. Run the app from `backend/` as described, treat `db_starter/` as reference, not instructions.

---

**How to actually use the thing**, as it stands today. This is the part a grader or a demo audience sees, so it's worth knowing cold, and worth being honest about what's real versus planned.

**Built and working in the browser:** register with an email and a password (eight characters, one capital letter, one symbol, typed twice), log in, land on a temporary home page that confirms you're logged in, change settings, and log out. Any unknown URL redirects to /login, and /home does the same when there is no valid session.

**Built and working in the API:** groups, invitations, membership removal, and events. There is no groups or events page in the React app yet. Use the walkthrough below.

**Planned, not built yet:** manual and receipt-based expense entry, splits and balances, budgets, and the analysis page. The product vision in the opening paragraph above describes where this is headed, not what's demoable right now. Update this section as each piece actually lands, don't let the walkthrough get ahead of the code again.

---

**Groups and events.** The server has to be the one you started above (`http://localhost:8000`). The same endpoints are listed at `http://localhost:8000/docs`. The steps below use `curl` because two people need two session cookies, and one browser tab only keeps one.

Login stores an `access_token` cookie. Register does not log you in. Passwords need eight characters, one capital letter, and one symbol. Group type is one of `roommate`, `partner`, `family`, or `outing`.

From `backend`, create three accounts and save each login cookie. Delete the `.cookies` files when you are done. They are session tokens.

```bash
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"AdaPassword123!"}'

curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bailey@example.com","password":"BaileyPassword123!"}'

curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@example.com","password":"CaseyPassword123!"}'

curl -s -c ada.cookies -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"AdaPassword123!"}'

curl -s -c bailey.cookies -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bailey@example.com","password":"BaileyPassword123!"}'

curl -s -c casey.cookies -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@example.com","password":"CaseyPassword123!"}'
```

Each login response includes that user's `id`. Write those three numbers down. The later commands use `ADA_ID`, `BAILEY_ID`, and `GROUP_ID` as stand-ins. Replace those words with the numbers from the responses before you run them.

Ada creates the group. She becomes its accepted administrator. The response `id` is `GROUP_ID`.

```bash
curl -s -b ada.cookies -X POST http://localhost:8000/groups \
  -H "Content-Type: application/json" \
  -d '{"name":"Saturday Market","group_type":"outing"}'
```

Ada invites Bailey, then Casey. An invite to an email with no account returns `registration_required` and does not create a membership.

```bash
curl -s -b ada.cookies -X POST http://localhost:8000/groups/GROUP_ID/invitations \
  -H "Content-Type: application/json" \
  -d '{"email":"bailey@example.com"}'

curl -s -b ada.cookies -X POST http://localhost:8000/groups/GROUP_ID/invitations \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@example.com"}'
```

Bailey accepts. Casey declines. Only the invited person can answer, and only while the invitation is pending.

```bash
curl -s -b bailey.cookies http://localhost:8000/groups/invitations/pending

curl -s -b bailey.cookies -X POST http://localhost:8000/groups/GROUP_ID/invitations/accept

curl -s -b casey.cookies -X POST http://localhost:8000/groups/GROUP_ID/invitations/decline
```

Ada lists accepted members. Bailey is there. Casey is not.

```bash
curl -s -b ada.cookies http://localhost:8000/groups/GROUP_ID/members
```

Ada creates an event for herself and Bailey. An empty `member_ids` list is rejected with 422. Every id in the list has to be an accepted member of that group.

```bash
curl -s -b ada.cookies -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Flower stall","group_id":GROUP_ID,"member_ids":[ADA_ID,BAILEY_ID]}'

curl -s -b ada.cookies -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Nobody","group_id":GROUP_ID,"member_ids":[]}'
```

Removal has three cases. Only an administrator can remove someone, and removal deletes the membership, not the account.

1. A member whose balance is zero is removed immediately.

```bash
curl -s -b ada.cookies -X DELETE http://localhost:8000/groups/GROUP_ID/members/BAILEY_ID
```

2. A member with a nonzero balance is refused with 409 until the caller sends `?confirm=true`. `get_member_balance()` still returns `0.0` for everyone, because expenses are not built yet, so this warning does not appear against the live server. The tests `test_balance_requires_confirmation` and `test_balance_removal_with_confirmation` cover it by stubbing a $25 balance.

3. The group's only administrator cannot be removed. This returns 409, and Ada is still a member.

```bash
curl -s -b ada.cookies -X DELETE http://localhost:8000/groups/GROUP_ID/members/ADA_ID
```

---
**Project structure.**

```
.
├── backend/
│   ├── app/
│   │   ├── api/            # auth, profile, groups, invitations, memberships, events
│   │   ├── core/           # security.py
│   │   ├── db/             # session.py
│   │   ├── schemas/        # request/response schemas
│   │   └── main.py
│   ├── alembic/
│   │   └── versions/       # through 5f237ae3e79f (events and event_members)
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


**Tests.** From `backend`, with the virtualenv active and Postgres migrated: `pytest`. That suite includes creating a group, inviting then accepting or declining, the three removal cases (zero balance, outstanding balance, sole administrator), and an event with zero members. From `frontend`: `npm test`. The frontend tests do not need the database. The backend tests do.

**Workflow.** Backlog lives in JIRA, seeded from the Requirements Spec, every story tagged with a requirement ID, an owner, and an hour estimate. Sprints run Monday to Sunday, one week each. Done means merged, tested, reviewed by someone who isn't you, and runnable from this README with no secret manual steps you forgot to write down. Full regression suite runs at every sprint close, not just at the end of the semester when it's too late to fix anything.

**Scope, the boundaries that don't move.** No real bank access. No real money moving, "settle up" just marks a debt as handled outside the app. No enforcement of budget rules, the app reports, you decide. No admin access to any individual user's data, full stop. Full detail's in the Charter, Section 4.2.

**Other project docs.** `projectcharter.md` and `projectrequirements.md` at the repo root. [Iteration Plan location TBD, see questions below.]

---

CS451R, Professor Jawad, Fall 2026 capstone.

