# User Guide: Shared Expense Management Tool

*CS451R Agile Software Engineering Capstone, Fall 2026 · Required document 7*

| Field | Entry |
|---|---|
| Product | Shared Expense Management Tool |
| Team | Colton "Cole" Hanson, Mick Leinbach, Lukas Viskovic, Xander McKie |
| Document owner | Xander McKie |
| Instructor | Prof. Jawad |
| Sponsor | Commerce Bank |
| Version and date | 1.2 Draft, November 24, 2026 (Iterations 0 to 7 in the app, except budgets, analysis, and admin) |
| Status | Draft. A section is added as each feature ships; complete in Iteration 10 (Dec 4). |

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Installation](#2-installation)
3. [Using the app](#3-using-the-app)
4. [Coming in later iterations](#4-coming-in-later-iterations)
5. [Troubleshooting](#5-troubleshooting)

---

# 1 What the app does

The Shared Expense Management Tool keeps a shared ledger for people who split costs: roommates, partners, families, and friends on a trip. You put people in a **group**, add what someone paid as an **expense**, choose how to **split** it, and the app keeps a running **balance** of who owes whom.

It never connects to a bank and never moves money. When someone pays you back outside the app, you record it, and the balance changes.

| Available now (Nov 24) | Coming later |
|---|---|
| Create an account, log in, log out | Budgets, monthly analysis, activity history (Iteration 8, not built) |
| Profile, email and password changes | Admin dashboard (Iteration 9, not built) |
| Groups, invitations, members | A hosted HTTPS address you can open from any device |
| Events for part of a group | |
| Add an expense with an even, custom or percentage split | |
| Edit or delete a manual expense (group admin) | |
| Balances, and settle up (Pay or Mark received) | |
| Upload a receipt, review it, and delete its picture | |
| Works on a phone and a computer | |

---

# 2 Installation

These steps run the whole app on one computer. From Iteration 6 the app will also run on a hosted server, and this section will add its address.

## 2.1 What you need

| Software | Version | Why |
|---|---|---|
| Docker Desktop | Current | Runs the PostgreSQL database |
| Python | 3.12 | Runs the backend; the pinned packages install cleanly on 3.12 |
| Node.js | 22 or newer | Runs the frontend |
| Git | Any | Gets the code |

No Docker? `backend/scripts/dev-postgres.sh start` runs PostgreSQL from your home folder instead (see the README).

## 2.2 Get the code and start the database

```bash
git clone https://github.com/Colton-Hanson/LCMX-Inc..git
cd LCMX-Inc.
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 with the database `shared_expense_dev` (user `postgres`, password `postgres`).

## 2.3 Start the backend

Windows (PowerShell):

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Mac or Linux:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and set these values:

| Setting | Example | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/shared_expense_dev` | Where the database is |
| `EMAIL_VERIFICATION_SECRET` | Any long random string, for example the output of `python -c "import secrets; print(secrets.token_hex(32))"` | Signs email-change codes |
| `SESSION_EXPIRE_HOURS` | `168` | How long you stay logged in (168 hours is 7 days) |
| `COOKIE_SECURE` | `false` on your computer, `true` on an HTTPS server | Whether the login cookie is sent only over HTTPS |
| `EMAIL_VERIFICATION_EXPIRE_MINUTES` | `30` | How long an email-change code works |

Never commit `.env`; it is ignored by git on purpose.

Create the tables and start the server:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

Open `http://localhost:8000/health`. It should show `{"status":"ok"}`.

## 2.4 Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. On Windows, if PowerShell blocks `npm`, type `npm.cmd` instead.

You are set up correctly if you can create an account, log in and reach the Home page.

## 2.4.1 Start the temporary receipt reader

Only needed when you want an uploaded receipt to be read. Without it, the receipt stays at uploaded.

1. Start the database and the backend first.
2. On Windows, double-click `temporary-reader\Start_Receipt_Reader.bat`.
3. The first time, paste the API key when it asks. It is saved in `temporary-reader\.env`. Git ignores that file. Never commit it.
4. Leave the window open. The reader uses Haiku 5.5, medium effort, with thinking off.

## 2.5 Optional: sample data

With the backend virtual environment active, on an empty database:

```bash
python seed.py
```

This creates four accounts, two groups (Apartment 4B and Lake Weekend), one event and nine expenses. It only runs once.

| Email | Password |
|---|---|
| alice@example.com | AlicePassword123! |
| bob@example.com | BobPassword123! |
| carol@example.com | CarolPassword123! |
| dave@example.com | DavePassword123! |

---

# 3 Using the app

The screenshots below are from a Selenium walkthrough of the running app on Nov 24, 2026. Each step is marked pass, fail, or not run in the [browser checklist](userguide-images/checklist.md). The bar across the top of every page has **Home**, **Groups**, **Balances**, an **Add expense** button and your account menu.

## 3.1 Create an account and log in

![Log in page](userguide-images/01-login.png)

1. Choose **Create an account**.
2. Enter your email and a password, then type the password again. A password needs at least 8 characters, one capital letter and one symbol. The page shows each rule you have not met yet.
3. After you register, the app logs you in and opens Home.

Next time, enter your email and password on **Log in**. You stay logged in for 7 days unless you log out. If you type the wrong email or password, the message does not say which one was wrong; that is on purpose.

## 3.2 Home

![Home page](userguide-images/02-home.png)

Home greets you and lists **Your groups**. Invitations waiting for you appear below it. **See all** opens the Groups page.

## 3.3 Create a group and invite people

![Create group page](userguide-images/03-create-group.png)

1. Choose **Groups**, then **Create group**.
2. Enter a **Group name**.
3. Pick a **Group type**: Roommate, Partner, Group outing or Family.
4. Type a person's email under **Invite members by email** and choose **Add**. Repeat for each person. The × removes someone from the list.
5. Choose **Create group**. **Cancel** saves nothing.

You become the group's admin. Invited people show as pending until they accept. An invite only reaches people who already have an account.

## 3.4 Answer an invitation

![An invitation on Home](userguide-images/04-home-invite.png)

When someone invites you, the invitation appears on your Home page. Choose **Accept** to join, or **Decline**. Accepting adds the group to Your groups straight away.

## 3.5 The group page

![Group page](userguide-images/08-group-page.png)

Open a group from Home or Groups. The group page shows:

- **Recent expenses:** the 5 newest, each with who paid, the date, the total and your share. Open **Split between N people** to see everyone's share.
- **Events:** smaller circles inside the group.
- **Members:** everyone in the group and who the admin is.
- Buttons for **Add expense**, **New event** and **Group settings**.

## 3.6 Create an event

![Create event page](userguide-images/06-create-event.png)

An event is for costs only some members share, like one dinner during a trip.

1. On the group page, choose **New event**.
2. Enter an **Event name**.
3. Choose **All members**, or **Pick members** and select people. You need at least one person.
4. Choose **Create event**.

## 3.7 Add an expense and choose a split

![Add expense page](userguide-images/07-add-expense.png)

1. Choose **Add expense** on the group page or in the top bar.
2. Check the **Group**, then enter a **Title** (up to 100 characters) and the **Total ($)** in dollars and cents.
3. Pick who it was **Paid by**.
4. Under **Who is in this expense?**, select the people sharing it. Everyone in the group starts selected.
5. Under **How to split it**, choose:
    - **Even:** everyone pays the same. If the total does not divide exactly, one person gets the leftover cent, and the page says who (`+1¢`).
    - **Custom:** type each person's amount. The amounts must add up to the total.
    - **Percentage:** type each person's percentage. The percentages must add up to 100.
6. Check each person's share in the preview, then choose **Save expense**.

Your share and the balances update as soon as it saves.

## 3.8 See your balances

![Balances page](userguide-images/09-balances.png)

**Balances** shows two totals at the top: **Owed to you** and **You owe**. Below them, **Who owes you** and **Who you owe** list each person, newest first. Open a row to see the expenses. A positive amount is money owed to you.

**Pay** and **Mark received** record a payment that already happened outside the app. The app does not move money. You can record the full amount or part of it. History lists those payments. A mistaken payment cannot be undone in the app.

![Record a partial payment](userguide-images/14-settle.png)

Choose **Part of it**, type the amount, then **Mark as paid** and confirm. Whatever you do not record stays outstanding.

## 3.9 Group settings

![Group settings page](userguide-images/10-group-settings.png)

On the group page, choose **Group settings**.

- **Members:** see each person's role. The admin can **Remove** a member. A group's only admin cannot remove themself.
- **Add a member by email:** invite someone new. They show as pending until they accept.
- **Default split:** choose **Even** or **Percentage** for new expenses in this group, then **Save default split**. You can still pick another split on each expense.

**Make admin** is not available yet.

## 3.10 Your settings

![Settings page](userguide-images/11-settings.png)

Open the account menu (your initial, top right) and choose **Settings**.

- **Profile:** change your name and choose **Save changes**. Photo upload is not available yet.
- **Email:** enter a new email. The change takes effect only after you enter the verification code.
- **Password:** enter your current password, then the new one. Changing it ends every session you have open, so you log in again with the new password.
- **Notifications:** choose which events you want to hear about, then **Save notification choices**.

To log out, open the account menu and choose **Log out**.

## 3.11 On your phone

<p>
  <img src="userguide-images/12-phone-group.png" alt="Group page on a phone" width="260">
  &nbsp;
  <img src="userguide-images/13-phone-balances.png" alt="Balances on a phone" width="260">
</p>

Every page fits a phone screen without sideways scrolling. On a phone, **Add expense** in the top bar becomes a **+** button, and buttons are sized for fingers.

## 3.12 Scan a receipt, review it, and delete the picture

Upload from Home. The file has to be a JPEG or a PDF. The app stores it and waits. Nothing is read until the temporary reader is running (section 2, and `temporary-reader/README.md`). Keep that window open. The receipt then moves from uploaded, to reading, to read. If the read fails, the screen says so and you can enter the expense by hand. That is different from a file the app refused at upload.

**Review.** On the review screen, fix what was read and pick who shares each item. An item can go to some of the group and not the rest. An item you leave unassigned is left out. The shares on a line have to add up to that line, to the cent. $10.00 across three people is $3.34, $3.33, and $3.33. Cancel saves nothing. Save adds the expense.

**Delete the picture.** The uploader or a group admin can delete the picture after it is no longer uploading or reading. The items stay. A picture nobody confirms is supposed to be kept 7 days and then removed. That cleanup job is not running yet.

The reader's API key stays on your computer in `temporary-reader/.env`. Do not commit it.

## 3.13 Edit and delete an expense

On the group page or on Balances, a group admin can edit or delete a manual expense. Delete asks first. Deleting puts the balances back. A $40.00 expense split $20.00 and $20.00, once deleted, leaves $0.00 between those two people. Today only a group admin can edit or delete. An expense that came from a confirmed receipt cannot be edited or deleted from these screens. The server says to use receipt review, and review is already closed after you save.

---

# 4 Coming in later iterations

These sections will be written in full as each feature ships. Review, settle, edit, and picture deletion are in the app (sections 3.8, 3.12, and 3.13). Budget, analysis, activity, and admin screens get their sections when those screens exist.

| Feature | What you will do | Iteration |
|---|---|---|
| Budgets | Set a monthly goal per category for yourself or a group. The app shows where you stand; it never blocks spending. Going over a goal is never blocked. The mid-month edit rule is still open. | 8 (not built as of Nov 24) |
| Monthly analysis | See spending by category and store, and how your share compares to your group's split. A new account sees an empty state. | 8 |
| Activity history | See every expense, settlement and membership change that involves you. Someone else does not see it. | 8 |
| Admin dashboard | For Commerce Bank staff only: site-level numbers, never any one user's data. Login, dashboard, and access denied are not built. | 9 (Nov 23 to 25) |

---

# 5 Troubleshooting

| Problem | Why it happens | What to do |
|---|---|---|
| Home lists no groups, but you belong to some | You are looking at a different account, or the backend is not the database that has your groups. Groups come from the server now, not from this browser. | Log in as the right account and check `http://localhost:8000/health`. |
| A receipt stays on "uploaded" | The temporary reader is not running. The backend does not start it. | Start `temporary-reader\Start_Receipt_Reader.bat` and leave the window open. |
| Balances is empty for the sample accounts | The sample-data script may not have been run, or it was run before expenses existed. | Add an expense through the app, or run `python seed.py` once on an empty database. |
| You are sent to Log in | You are not logged in, your session expired (after 7 days), or you changed your password. | Log in again. |
| "Password must contain at least one capital letter" or "one symbol" | The password rule: 8 or more characters, a capital letter, a symbol. | Choose a password that meets all three, for example by adding `!` and a capital. |
| The sample logins do not work | The sample data was not loaded, or loaded into a different database. | Run `python seed.py` once on an empty `shared_expense_dev` database, then use the passwords in Section 2.5 exactly. |
| `seed.py` says "Sample accounts already exist" | The script only runs on an empty database. | Use the accounts that already exist, or recreate the database and run it again. |
| The page says it cannot reach the server | The backend is not running, or is on another port. | Start `uvicorn app.main:app --reload` in `backend/` and check `http://localhost:8000/health`. |
| You opened `http://localhost:8000` and see text instead of the app | Port 8000 is the backend. | Open `http://localhost:5173`. |
| `alembic upgrade head` says "Multiple head revisions" | An old checkout from before the Oct 30 chain was joined. | Pull the current `main` and run the command again. |
| Removing a member who owes money gives no warning | Their rows in `balances` for this group sum to zero. | Check Balances. A nonzero total asks you to confirm. |
| Docker says port 5432 is already in use | Another PostgreSQL is running on your computer. | Stop it, or change the port in `docker-compose.yml` and in `DATABASE_URL`. |
| `pip install` fails on a package | Your Python is not 3.12. | Create the virtual environment with Python 3.12 (`py -3.12` on Windows, `python3.12` on Mac or Linux). |
| PowerShell will not run `npm` | Windows script policy. | Use `npm.cmd install` and `npm.cmd run dev`. |
| **Make admin** or **Upload a photo** does nothing | Not built yet. | No action needed; both are on the backlog. |

Still stuck? Open an issue in the GitHub repository with the steps you took, what you expected and what happened, and a screenshot.
