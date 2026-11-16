<div align="center">

# Testing Document and Specification
## Test Plan

**Shared Expense Management Tool**

LCMX Inc.<br>
CS 451R Agile Software Engineering Capstone, Fall 2026

Hanson, Colton "Cole"<br>
Leinbach, Mick<br>
McKie, Xander<br>
Viskovic, Lukas

</div>

---

| Field | Entry |
|---|---|
| Document | Required document 5, part 1 of 3: Test Plan |
| Other parts | [Test Specification](testspecification.md) (part 2) · [Test Reports](testreports.md) (part 3) |
| Instructor | Prof. Jawad |
| Sponsor | Commerce Bank |
| Document owner | Xander McKie |
| Version and date | 1.1 Draft, November 16, 2026 |
| Status | Draft. Updated at every iteration close-out. Final version after the full test pass on Dec 2. |

## Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | Oct 30, 2026 | Xander McKie | First version, as one Test Documentation file (`testdocumentation`): test plan, test cases and the Oct 30 test run. |
| 1.1 | Nov 16, 2026 | Xander McKie | Split into Test Plan, Test Specification and Test Reports to match the course templates. Schedule moved to the Iteration 8 to 10 plan (Thanksgiving week off, feature freeze Nov 20). Recurring bills and notifications added to the items tested. |

## Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Items tested](#3-items-tested)
4. [Items not tested](#4-items-not-tested)
5. [Approach](#5-approach)
6. [Item pass/fail criteria](#6-item-passfail-criteria)
7. [Test deliverables](#7-test-deliverables)
8. [Testing tasks](#8-testing-tasks)
9. [Roles and responsibilities](#9-roles-and-responsibilities)
10. [Schedule](#10-schedule)
11. [How to run the tests](#11-how-to-run-the-tests)

---

## 1 Introduction

This document is the test plan for the Shared Expense Management Tool. The tool is a web app for roommates, partners, families and friends on an outing. They record shared expenses, split them, and see who owes whom. An expense can be entered by hand or read from a receipt by an AI. The app also tracks budgets and shows spending analysis. It never uses real bank data and never moves real money.

The testing in this plan checks that the software meets the requirements in the Requirements Specification. It covers accounts and login, groups and invitations, expenses and splits, balances, receipts, settling up, budgets, analysis, activity history and the admin dashboard. It also covers security, accessibility, phone layout and load. The results tell the team whether each milestone in the Project Plan (M5 to M8) is met.

The objectives are:

1. Prove every requirement that is built works as the Requirements Specification says, with an automated test where possible (NFR-QUA-01).
2. Catch a break in the week it happens. The full suite runs at every Friday close-out, not only in the final week.
3. Prove money is right to the cent: every split adds up to its total and leftover cents are shown, never lost (NFR-DAT-04).
4. Prove one user can never read or change another user's data, including administrators (NFR-SEC-07).
5. Prove the app works on a phone and a PC, and with a screen reader (NFR-CMP, NFR-A11Y).
6. For the receipt feature, measure how often the AI reads a receipt correctly across lighting and formats (NFR-PER-02).

## 2 Terminology

These terms are used throughout the three test documents.

| Term | Meaning |
|---|---|
| User | A person with an account who signs in to the main website. |
| Group | A set of users who share expenses. Every group has one of four types: roommate, partner, family or outing. |
| Group admin | A group member who can invite and remove members. The person who creates a group is its first admin. |
| Member | A user who has accepted an invitation to a group. |
| Invitation | A request for a registered user to join a group. It stays pending until the invitee accepts or declines. |
| Event | A named part of a group, such as "Lake Cabin", made up of some or all of its members. An expense can be tagged to an event. |
| Expense | An amount one member paid for the group, with a title and a payer. |
| Split | How an expense is divided: evenly, by custom amounts, or by percentages. Each person's part is their share. |
| Balance | What one member owes another inside a group, after debts that run in opposite directions are netted. |
| Settlement (settle up) | A record that one member paid another outside the app. The app records it and moves no money. |
| Receipt | A JPEG photo or PDF a user uploads. The AI reader turns it into a store, a date and line items. |
| AI reader (LLM/OCR) | The model that reads receipts. Not chosen yet as of Nov 16. |
| Site admin | A separate role that sees only site-level counts and can never open a user's data. |
| Session | The login cookie that keeps a user signed in. It can expire or be revoked. |
| Close-out | The Friday that ends each one-week iteration, when the full regression runs. |
| Regression run | Both automated suites, the end-to-end walkthrough and the probes, run on the newest `main`. |
| Probe | A request sent by hand to the API to check one behavior against real data. |
| E2E | End-to-end. A real browser (Playwright) driving the running app. |
| Seed | The script that fills an empty database with the four demo accounts and their groups and expenses. |
| MUST, SHOULD, COULD | Requirement priority, as set in the Requirements Specification. |
| Incident | Something a test found that did not match the expected result. Recorded in the Test Reports. |

## 3 Items tested

Items to be tested, as laid out in the Requirements Specification and the Project Plan, include but are not limited to the list below. The steps and expected results for each case are in the [Test Specification](testspecification.md).

| Item | Test cases | Run in |
|---|---|---|
| Ability for a person to register, log in, stay logged in, change their password and log out, with the password rule checked in the browser and on the server | TC-ACC-01 to TC-ACC-12 | Oct 30 run |
| Ability for a user to view and edit their profile, change their email with verification, and set a safe profile photo | TC-ACC-13 to TC-ACC-15 | Oct 30 run |
| Ability to reset a forgotten password by email | TC-ACC-16 | Only if built (stretch goal) |
| Ability for a user to create a group, invite members by email, and accept or decline an invitation | TC-GRP-01 to TC-GRP-07 | Oct 30 run |
| Ability for a group admin to list and remove members, with a warning when the member still owes money | TC-GRP-08 to TC-GRP-11 | Oct 30 run |
| Ability to create an event for all or some members, and tag an expense to it | TC-GRP-12 to TC-GRP-14 | Oct 30 run; TC-GRP-14 when built |
| Ability to see your groups from any device | TC-GRP-15 | Oct 30 run |
| Ability to add an expense and split it evenly, by custom amounts or by percentages, with leftover cents shown | TC-EXP-01 to TC-EXP-08 | Oct 30 run |
| Ability to save an expense all or nothing, net opposite debts, list a group's expenses and see balances per group | TC-EXP-09 to TC-EXP-13 | Oct 30 run |
| Ability to save a default split for a group | TC-EXP-14 | Oct 30 run |
| Ability to edit or delete an expense, and to settle up in full or in part | TC-EXP-15, TC-EXP-16 | When built (was Iteration 7) |
| Ability to set a bill to repeat monthly | TC-EXP-17 | Iteration 8 |
| Ability to upload a receipt, have the AI read it, review and assign the items, and delete the picture while keeping the items | TC-RCP-01 to TC-RCP-10 | Upload from Iteration 8 kickoff; reading and review when built |
| Ability to set monthly budget goals by category and see spending against them | TC-BUD-01 to TC-BUD-03 | Iteration 8 |
| Ability to see spending analysis for a month or a date range | TC-ANL-01, TC-ANL-02 | Iteration 8 |
| Ability to see activity history and notifications, shown only to the people involved | TC-SOC-01, TC-SOC-02 | Iteration 8 |
| Ability for a site admin to log in on a separate page and see only site-level counts, with every attempt to open user data blocked and logged | TC-ADM-01 to TC-ADM-03 | Iteration 8 |
| Security: login on every protected route, no exposed user data, rate limits, secrets out of git, HTTPS | TC-SEC-01 to TC-SEC-05 | Oct 30 run; Iteration 10 audit |
| Phone layout, automated accessibility scan, screen reader and keyboard use | TC-CMP-01, TC-A11Y-01, TC-A11Y-02 | Oct 30 run; Iteration 10 |
| Demo database built from empty, and seeded data shown in Balances | TC-DAT-01, TC-DAT-02 | Oct 30 run |
| Several users at once, and a first-time user understanding the site | TC-PER-01, TC-USE-01 | Iteration 10 |

If Iteration 8 runs short, the plan cuts in this order: COULD items, then per-person group goals (FR-BUD-04), then recurring bills (FR-EXP-06), then notifications (FR-SOC-02). A cut feature's test case is marked cut, not deleted.

## 4 Items not tested

Some features are not part of this testing. Some are outside the product's scope. Others are not built and may be cut. If one of them is built after all, it gets a test case before it can be called done.

**Out of scope for the product:**

- Internal behavior of third-party libraries (FastAPI, React, SQLAlchemy).
- The AI vendor's own model quality, beyond our 15-receipt accuracy set.
- Real bank data or real money movement. The product never does either.
- Native mobile apps. The product is a web app.
- Browsers older than the current versions of Chrome, Safari, Firefox and Edge.

**Not built, and only tested if built:**

- Password reset by email (FR-ACC-11, a stretch goal). Built only if both kept stretch goals (the Web API reference and the formal ADA audit) are done first. TC-ACC-16 holds its place.
- Comments and emoji reactions (FR-SOC-03, COULD).
- Spending advice (FR-ANL-06, COULD).
- Account deletion (OI-22). Not planned this semester.

## 5 Approach

Most testing is automated. Manual system testing covers what a person has to judge: the screen reader pass, the receipt accuracy run and the first-time-user check. Each test case links to at least one requirement in the Requirements Specification, so a failed case shows which requirement is broken.

Every Friday close-out runs everything, old and new, on the newest `main`. New code can break old features. The Oct 30 run showed this: one merge broke two working features the same day (BUG-01 and BUG-02 in the Test Reports). Unit tests that stub data are backed by a probe or an E2E step against real data, because a stubbed test can pass while the real path fails (BUG-05).

### 5.1 Test levels

| Level | What it checks | Tool | Who writes it |
|---|---|---|---|
| Unit | Pure logic with no database: split calculator, expense validation, frontend validators and money formatting | pytest, Vitest | Feature owner; Xander reviews |
| API integration | Each route against a real PostgreSQL database: status codes, saved rows, authorization, rollback | pytest + FastAPI `TestClient` | Lukas and Xander |
| Frontend component | Each screen renders, validates, calls the right endpoint and handles errors; the backend is mocked | Vitest + React Testing Library + jsdom | Cole and Xander |
| End-to-end | A real browser against the running app: two users, a full flow from group to balance | Playwright | Xander |
| Accessibility | Automated WCAG 2 A and AA rules on every screen, then a manual keyboard and screen reader pass | axe-core, NVDA or VoiceOver | Cole and Xander |
| Responsive | No sideways scrolling at a 390 px phone width on every screen | Playwright | Xander |
| Security | Login required on every protected route, open data exposure, password rule, rate limits, HTTPS, cookies | pytest probes, security checklist | Lukas and Xander |
| Receipt accuracy | Items, prices, store and date read correctly from 15 synthetic receipts (clean, crumpled, dim, angled, PDF) | Manual run, logged | Xander and Cole |
| Load | The app stays responsive with several simultaneous users | Load script against the live server | Mick |

### 5.2 Tools and versions

| Tool | Version | Used for |
|---|---|---|
| pytest | 9.1.1 | Backend unit and API tests (`backend/tests`) |
| FastAPI `TestClient` (httpx) | FastAPI 0.141.1, httpx 0.28.1 | Calling routes in tests without a running server |
| Vitest | 5.0.3 | Frontend tests (`frontend/tests`) |
| React Testing Library, user-event, jest-dom | 16, 14, 6 | Rendering screens and simulating clicks and typing |
| jsdom | 24 | A simulated browser for frontend tests |
| Playwright (Chromium) | Pre-installed | End-to-end walkthrough, phone-width checks, screenshots |
| axe-core | 4.10.2 | Automated accessibility scan |
| PostgreSQL | 16 | Test databases `shared_expense_dev` and `shared_expense_sprint4_test` |
| GitHub Actions | Not set up yet | Run both suites on every pull request. Planned for Iteration 6; no workflow on `main` as of Nov 13. |
| JIRA | n/a | Bug tickets (severity, owner, steps) |

**Test framework note (OI-26):** the Charter and NFR-QUA-01 name `unittest` (PyUnit). The backend suite is written in pytest and the frontend in Vitest. pytest also runs `unittest`-style tests, so nothing written for PyUnit is lost. This exception still needs to be written into the README and the Requirements Specification.

### 5.3 Test environment and data

- **Local:** each developer runs Postgres in Docker (`docker compose up -d`) or with `backend/scripts/dev-postgres.sh start`, the backend on port 8000 and the frontend on port 5173.
- **Test databases:** integration tests run inside a transaction on `shared_expense_sprint4_test` and roll back, so they leave no rows behind. Other API tests use the development database.
- **Live server:** from Iteration 8, the kickoff and close-out regressions run on the hosted server (It8-16, It8-19). HTTPS and the secure cookie are checked in the Iteration 10 security audit (It10-1).
- **Data:** synthetic only. The seed creates four accounts (`alice`, `bob`, `carol` and `dave` at `example.com`), two groups (Apartment 4B and Lake Weekend), one event (Lake Cabin) and nine expenses. Receipt tests use 15 synthetic receipts. No real names, cards, receipts or bank details are ever used.
- **AI reader:** automated tests use recorded reader replies, so no real AI calls happen during a test run.

## 6 Item pass/fail criteria

The Requirements Specification sets the minimum each feature must do. The Project Plan says what counts as success for each milestone.

A test case **passes** when the actual result matches the expected result in the Test Specification. For money, matching means to the cent. A feature passes when all its test cases pass and a user can use it with little or no help. Two people outside the team check that in Iteration 10 (NFR-USE-01).

A test case **fails** when any part of the result differs. Each failure is recorded as an incident in the Test Reports, filed in JIRA with steps to reproduce, given a severity, and sent to the developer who owns it.

**Status marks used in all three documents:**

| Mark | Meaning |
|---|---|
| ✅ | Pass |
| ❌ | Fail |
| ⚠️ | Pass with a known gap (an incident is open) |
| 🔁 | A fix or the feature was merged after the last test run. Re-test pending. |
| ⏳ | Not run yet, because the feature is not built |

**Bug severity:**

| Severity | Meaning | Rule |
|---|---|---|
| Blocker | The app or a core flow cannot run | Fixed before any new work |
| Major | A requirement is broken or data is wrong or exposed | Fixed before the iteration's review |
| Minor | Cosmetic, wording, or documentation | Goes to the backlog |

Every fix adds a test that fails without it. Xander re-tests and closes the ticket.

**A story can be called done when** its automated test passes, the full suite still passes, someone other than the author reviewed it, and it runs from the README (Definition of Done).

**The product is ready for final delivery when:**

- 100% of backend and frontend tests pass on `main`.
- No open Blocker or Major bugs.
- Every MUST requirement has at least one passing test case.
- The security and ADA checklists are complete.
- The load check and the receipt accuracy run are logged in the Test Reports.

## 7 Test deliverables

Besides this Test Plan, the test deliverables are:

- **[Test Specification](testspecification.md):** every test case, with its purpose, starting conditions, test data, steps and expected results.
- **[Test Reports](testreports.md):** the results of each run, made up of incidents, defects and changes.
- **Automated tests:** the code in `backend/tests` and `frontend/tests`, run with the commands in Section 11.
- **JIRA bug tickets:** one per incident, with severity, owner and steps.
- **Iteration 10 records:** the receipt accuracy log, the load check results and the accessibility findings report. Each is summarized in the Test Reports.

## 8 Testing tasks

The table lists each test deliverable and the work needed to produce it.

| Deliverable | Activities | Owner | When |
|---|---|---|---|
| Test Plan | Analyze the requirements for each feature. Decide what can and cannot be tested. Choose the approach and tools. Estimate the effort (in the Team Effort Estimation). Set the testing schedule. | Xander | Iteration 5; updated each close-out |
| Test Specification | Analyze the requirements. Write a test case for every testable feature in this plan, with data, steps and expected results. Link each case to its automated test. | Xander, with each feature owner | Before or with each feature |
| Test Reports | Run the test cases at each close-out. Record incidents and defects. Set each one's severity. Decide what must change in the system. File change requests in JIRA for the developer. Re-test fixes and close tickets. | Xander | Every Friday close-out; final report Dec 2 |

## 9 Roles and responsibilities

| Person | Testing responsibility |
|---|---|
| Xander McKie | Owns the three test documents, the regression run at every close-out, end-to-end and accessibility runs, the receipt accuracy set, and the final test report |
| Lukas Viskovic | API tests for every backend route he writes; security checklist and fixes |
| Cole Hanson | Component tests for every screen he writes; screen reader pass; AI reader tests with recorded replies |
| Mick Leinbach | Migrations run cleanly on an empty database; seed works; load check |

Testing time is part of each person's hours in the Team Effort Estimation (document 6).

## 10 Schedule

This follows the Iteration 8 to 10 plan. Thanksgiving week (Iteration 9) is fully off, features freeze Friday Nov 20, and code freezes Wednesday Dec 2.

| When | Test activity | Status on Nov 16 |
|---|---|---|
| Every pull request | Both suites run by hand before merging | GitHub Actions not set up |
| Every Friday close-out | Full regression; failures filed as JIRA bugs | Ongoing |
| Iteration 5 (Oct 26 to 30) | First full regression, E2E walkthrough, phone width, accessibility scan, security probes | Done Oct 30 |
| Iteration 6 (Nov 2 to 6) | Upload tests; reading tests with recorded AI replies; first 15-receipt accuracy run | Upload tests merged Nov 8 to 11. The AI reader is not chosen, so reading tests and the accuracy run wait for it. |
| Iteration 7 (Nov 9 to 13) | Review math, settlement, receipt picture deletion | Database tables merged Nov 13; routes and screens not on `main` yet |
| Iteration 8 (Nov 16 to 20) | Monday kickoff regression on the live server, including re-tests of every 🔁 case (It8-16). Tests for budgets, analysis, recurring bills, activity, notifications and every blocked admin path (It8-18). Friday freeze close-out regression (It8-19). | Starts today |
| Iteration 9 (Nov 23 to 27) | Thanksgiving break. No testing. Server check first thing Monday Nov 30. | Planned |
| Iteration 10 (Nov 30 to Dec 4) | Security audit with rate limits and HTTPS (It10-1). ADA checklist and screen reader pass (It10-2). Load check (It10-3). Full test pass and final Test Report on Wednesday Dec 2 (It10-5). First-time-user check (It10-7). | Planned |
| Monday Dec 7 | Final presentation and delivery | Planned |

## 11 How to run the tests

**Backend** (Postgres running and migrated; from `backend/` with the virtualenv active):

```bash
# One-time: create and migrate the database the integration tests use
createdb -h localhost -U postgres shared_expense_sprint4_test
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/shared_expense_sprint4_test alembic upgrade head

python -m pytest -q
```

**Frontend** (no database needed; from `frontend/`):

```bash
npm install
npm test
```

A run is green only when both commands finish with zero failures.
