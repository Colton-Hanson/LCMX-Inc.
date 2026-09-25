# Shared Expense Management Tool

"Collaborative finance for people who actually share their lives." That's the pitch. In practice it means you upload a receipt, the app reads it, and it tells you who owes what. No bank connection, no real money moving. Just an honest ledger for people who already trust each other enough to live together or travel together, which is a different kind of trust than "give me your bank password."

**Stack.** React on the frontend. Python on the backend, framework TBD, confirm with Lukas and drop it in here once it's picked. PostgreSQL for the database. One CSS framework, per the project constraint. This resolves the testing conflict from the Requirements Spec too: it called for unittest (PyUnit), and now that the backend is actually Python, that requirement just works instead of needing a workaround.

**Team.** Cole owns frontend and the LLM receipt pipeline. Mick owns the database. Lukas owns the backend. Xander owns documentation and testing, which is why this file exists and isn't three sentences long.

---

**Getting it running.** Clone the repo, then set up each piece in order, since the frontend needs the backend and the backend needs the database.

```bash
git clone [repo-url]
cd [repo-name]
```

Database first:

```bash
createdb shared_expense_dev
cd backend
pip install -r requirements.txt
python manage.py migrate      # or the equivalent for whatever Python framework we land on
python manage.py seed         # optional, loads sample data
```

Backend next:

```bash
cd backend
cp .env.example .env          # fill in real values, see below
python manage.py runserver    # or the actual run command for our framework
```

Check `http://localhost:[PORT]/health`. If it responds, the backend's alive.

Frontend last:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:[PORT]`. If you can register an account and land on the home page, you're set up correctly. If any of these steps lied to you, fix the README instead of just quietly working around it in your head. Nobody else gets the benefit of your workaround if it only lives in your head.

**Environment variables.** Copy `backend/.env.example` to `backend/.env` and fill in `DATABASE_URL`, `PORT`, `JWT_SECRET`, `COOKIE_EXPIRY`, `LLM_API_KEY`, and `LLM_API_URL`. `.env` is git-ignored. Don't commit a real secret. That's not a suggestion, it's NFR-SEC-06.

---

**How to actually use the thing**, once it's running. This is the part a grader or a demo audience sees, so it's worth knowing cold.

Register with an email and a password. The password needs eight characters, a capital letter, and a symbol, and you'll type it twice. Log in after that and you land on the home page.

Create a group. Pick a type, roommate, partner, family, group outing, and invite people by email. They show up as pending until they accept. Inside a group you can also make an event, which is just a subset of members, for the trip that not everyone in the roommate group is going on.

Add an expense two ways. Manually: title, amount, category, who paid, who's involved, pick a split method (even, custom, percentage). Or upload a receipt: snap a photo or drop in a PDF, the LLM reads it and itemizes it, and you get a screen to fix whatever it got wrong and assign each line to whoever ordered it. Nothing saves to a balance until you've reviewed it. That review step isn't a formality, it's the whole reason the app is trustworthy instead of just a fancy calculator.

Check balances on the Balances page. When someone pays you back in real life, hit "Settle Up" and mark it. The app doesn't move money, it just stops pretending you're still owed.

Set a budget under a category, food, rent, whatever, give it a monthly goal, and the app tracks your actual spending against it. It'll tell you when you're over. It won't stop you from spending. That line stays firm on purpose, see Scope below.

Check the Analysis page once you've got a month of data. It'll tell you things like who's actually covering more than their share this month versus the agreed split, or how many times you've been to the same coffee shop. That's the whole value proposition in one screen.

---

**Project structure.**

```
.
├── backend/
│   ├── src/ (or app/, depending on the framework)
│   ├── migrations/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
│   └── tests/
└── docs/
```

Confirm this matches reality once Iteration 0's scaffolding actually lands. A structure diagram that's aspirational instead of accurate is worse than no diagram.

**Tests.** `python manage.py test` on the backend (or whatever the chosen framework's unittest runner is called), `npm test` on the frontend.

**Workflow.** Backlog lives in JIRA, seeded from the Requirements Spec, every story tagged with a requirement ID, an owner, and an hour estimate. Sprints run Monday to Sunday, one week each. Done means merged, tested, reviewed by someone who isn't you, and runnable from this README with no secret manual steps you forgot to write down. Full regression suite runs at every sprint close, not just at the end of the semester when it's too late to fix anything.

**Scope, the boundaries that don't move.** No real bank access. No real money moving, "settle up" just marks a debt as handled outside the app. No enforcement of budget rules, the app reports, you decide. No admin access to any individual user's data, full stop. Full detail's in the Charter, Section 4.2.

**Other project docs**, all in `docs/`: the Project Charter, the Requirements Specification, and the Iteration Plan.

---

Course number, instructor, semester: fill in. Fall 2026 capstone.
