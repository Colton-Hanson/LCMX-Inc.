<div align="center">

# Testing Document and Specification
## Test Reports

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
| Document | Required document 5, part 3 of 3: Test Reports |
| Other parts | [Test Plan](testplan.md) (part 1) · [Test Specification](testspecification.md) (part 2) |
| Document owner | Xander McKie |
| Version and date | 1.2 Draft, November 19, 2026 |
| Status | Draft. A new run is added at every close-out. The final report comes from the full test pass on Dec 2. |

## Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | Oct 30, 2026 | Xander McKie | Oct 30 test run, as Section 3 of the single Test Documentation file. |
| 1.1 | Nov 16, 2026 | Xander McKie | Moved into its own document in the course template's format: incidents, defects and changes. Added the Nov 16 code check of `main`. |
| 1.2 | Nov 19, 2026 | Xander McKie | Local regression after bringing Iteration 7 onto `main`. Leftovers, stretch no-go, and the ticket comments for this week. |

## Contents

1. [Introduction](#1-introduction)
2. [Test runs](#2-test-runs)
3. [Incidents](#3-incidents)
4. [Defects](#4-defects)
5. [Changes](#5-changes)
6. [Not yet tested](#6-not-yet-tested)
7. [Summary](#7-summary)

---

## 1 Introduction

This document records the outcome of the system tests run so far. Incidents, defects and the changes that need to be made are presented here formally. They are separate things, but they are kept together in this one document.

It covers two checks so far:

- **Run 1, Friday Oct 30, 2026:** the Iteration 5 close-out. A full regression of everything built at the time.
- **Check 2, Monday Nov 16, 2026:** a code check of `main` at `83aaf1f` (Nov 13). It read the code behind each open incident and listed what merged since Oct 30. It ran no tests, so a fix it found is marked 🔁 (re-test pending), not ✅.

The test cases named here are written out in the [Test Specification](testspecification.md). The status marks are defined in the [Test Plan](testplan.md#6-item-passfail-criteria).

---

## 2 Test runs

### 2.1 Run 1: Oct 30, 2026

#### What was run

| Item | Detail |
|---|---|
| Date | Friday Oct 30, 2026 (Iteration 5 close-out) |
| Run by | Xander McKie |
| Code tested | `8c8498e` (`main` before PR #9, the code from Oct 27) and `e72a276` (`main` after PR #9, Mick's Sprint 5 seed, merged Oct 30) |
| Environment | Linux, Python 3.13.17, PostgreSQL 16.15, Node.js 22.23.4, Chromium via Playwright |
| Data | Empty test databases, then the Sprint 5 seed; synthetic accounts only |

Python 3.13 was used here; the README asks for 3.12. All pinned packages installed and every test passed at `8c8498e`, so this did not affect results.

#### Results

| Suite | Code | Tests | Passed | Failed | Time |
|---|---|---|---|---|---|
| Backend (pytest) | `8c8498e` | 120 | 120 | 0 | 36.2 s |
| Backend (pytest) | `e72a276` | 120 | 119 | 1 | 37.7 s |
| Frontend (Vitest) | `e72a276` (frontend unchanged by PR #9) | 302 in 22 files | 302 | 0 | 33.0 s |
| Migrations on an empty database | `8c8498e` | `alembic upgrade head` | ✅ | | |
| Migrations on an empty database | `e72a276` | `alembic upgrade head` | | ❌ "Multiple head revisions" | |
| End-to-end walkthrough, two users | `8c8498e` backend | 8 steps | 8 | 0 | |
| Phone width (390 px) | same | 9 screens | 9 | 0 | |
| Accessibility scan (axe-core, WCAG 2 A/AA) | same | 11 screens | 11 (0 violations) | 0 | |
| Security and data probes | same | 5 checks | 2 | 3 | |

**Pass rate for automated tests on the pre-merge code: 422 of 422 (100%).** On `main` after PR #9, 421 of 422 passed, and the database could not be built from scratch (BUG-01).

#### Backend tests by file

| File | Tests | What it covers |
|---|---|---|
| `test_auth.py` | 16 | Register, login, logout, sessions, password change and rules |
| `test_profile.py` | 16 | Profile view and edit, photo path safety, email change with token |
| `test_expense_validation.py` | 19 | Expense input rules, membership of payer and participants |
| `test_split_calculator.py` | 18 | Even, custom and percentage splits, rounding, invalid splits |
| `test_events.py` | 11 | Event creation, member rules |
| `test_memberships.py` | 10 | List and remove members, admin rules, balance confirmation (stubbed) |
| `test_invitations.py` | 9 | Invite, accept, decline, duplicates, outsiders |
| `test_groups.py` | 7 | Create group, types, login required |
| `test_expense_integration.py` | 6 | Saving to the database, netting, per-group balances, rollback |
| `test_expenses.py` | 5 | Expense routes, login and membership required |
| `test_balance_routes.py` | 2 | Balances need login and stay private |
| `test_health.py` | 1 | Health check |
| **Total** | **120** | |

#### Frontend tests by file

| File | Tests | File | Tests |
|---|---|---|---|
| `addExpense.test.jsx` | 36 | `forms.test.jsx` | 14 |
| `splits.test.js` | 32 | `invites.test.jsx` | 14 |
| `settings.test.jsx` | 26 | `auth.test.js` | 13 |
| `groupSettings.test.jsx` | 18 | `routeGuard.test.jsx` | 12 |
| `balances.test.jsx` | 17 | `splitDefault.test.js` | 12 |
| `createGroup.test.jsx` | 17 | `balancesLib.test.js` | 10 |
| `createEvent.test.jsx` | 14 | `groups.test.js` | 10 |
| `pageTitle.test.jsx` | 10 | `home.test.jsx` | 9 |
| `groupExpenses.test.jsx` | 8 | `validators.test.js` | 8 |
| `expenseValidators.test.js` | 7 | `expensesApi.test.js` | 6 |
| `splitDefaultPanel.test.jsx` | 6 | `initials.test.js` | 3 |
| | | **Total** | **302** |

#### End-to-end walkthrough

Two browsers, Alice and Bob, against the running app (backend `8c8498e`, frontend `e72a276`, seeded database):

| Step | Result |
|---|---|
| 1. Alice creates "Road Trip" (Group outing) and invites bob@example.com | ✅ Lands on the group page as admin |
| 2. Bob logs in and sees the invitation on Home | ✅ |
| 3. Bob accepts | ✅ Group appears under Your groups without a reload |
| 4. Alice creates the event "Gas stops" for all members | ✅ Listed on the group page |
| 5. Alice adds "Gas", $63.25, even split with Bob | ✅ Preview shows $31.63 (+1¢) and $31.62 |
| 6. Expense saved | ✅ "Expense 'Gas' saved: $63.25 shared by 2 people" |
| 7. Alice opens Balances | ✅ "bob@example.com owes you +$31.62" |
| 8. A guest opens `/balances`, `/groups/3` and an unknown URL | ✅ Sent to `/login` each time |

### 2.2 Check 2: Nov 16, 2026 code check

#### What was checked

| Item | Detail |
|---|---|
| Date | Monday Nov 16, 2026 (start of Iteration 8) |
| Code checked | `83aaf1f` (`main`, Nov 13) |
| Method | Read the code behind each open incident. Listed every commit merged since `e72a276`. Checked the Alembic migration chain for heads without a database. |
| Tests run | None. Every fix below is re-tested at the Iteration 8 kickoff regression (It8-16). |

#### Merged since Oct 30

| Commit | Date | Author | What changed | Effect on testing |
|---|---|---|---|---|
| `80d43c6` | Oct 31 | Lukas | Real balance check on member removal; `GET /groups`, `GET /groups/{id}`, `GET /groups/{id}/events`; `GET` and `PUT /groups/{id}/split-default`; names in balances. Tests added to five backend files. | Fixes BUG-05. Backend half of BUG-06. |
| `a1f1e00` | Nov 1 | Xander | Restored `Expense.created_at`. Joined the Sprint 5 migration to the main chain. New `test_alembic_heads.py`. | Fixes BUG-01 and BUG-02. |
| `8142e31`, `b1a1082` | Nov 3 to 4 | Mick | `receipts` and `receipt_items` tables; group ID on receipts | Needed by TC-RCP cases |
| `2d505a4` | Nov 8 | Lukas | `POST /receipts` (upload with type, size and content checks) and `GET /receipts/{id}`; `test_receipts.py` | TC-RCP-01, 02, 04, 09, 10 ready to run |
| `bf02e10` | Nov 11 | Cole | Upload, reading and error screens; 6 new frontend test files | Same cases, frontend side |
| `e6ed9cb` | Nov 11 | Xander | More tests in `test_auth.py` and `test_receipts.py`; README update | |
| `560e479` | Nov 13 | Mick | Settlements table; item assignments (replacing `item_splits`); `abandoned` receipt status and index; optional event on expenses, with the unused event columns retired | Tables for TC-EXP-16, TC-RCP-06 to 08 and TC-GRP-14. Routes and screens not built yet. |

**Suite sizes reported by teammates.** Lukas's Sprint 5 handoff reports 139 backend tests passing at `80d43c6` on his machine. Cole's Sprint 6 handoff reports 358 frontend tests in 28 files passing at `bf02e10`, up from 302 in 22. Neither number has been confirmed in a recorded run yet; the Iteration 8 kickoff regression confirms both.

**Migration chain.** At `83aaf1f` the chain has one head (`d890a95a86b8`) across 24 revisions.

**Not on `main` yet:** a GitHub Actions workflow, deploy files for the live server, the AI reader, and the Iteration 7 routes and screens (review and assign, settle up, edit and delete, picture deletion).

#### Incident status after the check

| Incident | Oct 30 | Nov 16 |
|---|---|---|
| BUG-01 | ❌ Open | 🔁 Fixed in code (`a1f1e00`) |
| BUG-02 | ❌ Open | 🔁 Fixed in code (`a1f1e00`) |
| BUG-03 | ❌ Open | ❌ Open, no change to `seed.py` |
| BUG-04 | ❌ Open | ❌ Open, `users.py` unchanged |
| BUG-05 | ❌ Open | 🔁 Fixed in code (`80d43c6`) |
| BUG-06 | ❌ Open | ❌ Partly fixed: backend done (`80d43c6`), frontend still uses browser storage |
| BUG-07 | ❌ Open | ❌ Open, planned for Iteration 8 |
| BUG-08 | ❌ Open | ❌ Open, planned for Iteration 10 |
| BUG-09 | ❌ Open | ❌ Open, and one more line is now out of date |

### 2.3 Run 3: Nov 19, 2026

#### What was run

| Item | Detail |
|---|---|
| Date | Thursday Nov 19, 2026 |
| Code | Local `main` fast-forwarded to `origin/main` (`0498ca2`), then `origin/lukas-it7` merged into the working tree and left uncommitted |
| Method | Local suites. There is no deployed URL in the README, so this is not a live server run. |
| Backend | `python -m pytest -q` in `backend`, against `shared_expense_sprint4_test` after `alembic upgrade head` (`7f31b2e4c9a0`) |
| Frontend | `npm test` in `frontend` |

#### Results

| Suite | Result |
|---|---|
| Backend | 264 passed, 6 skipped, 1 existing Starlette and httpx deprecation warning |
| Frontend | 28 files, 358 passed |

The 6 skips are `test_sprint8_pending.py`. They cover going over a goal, the mid-month edit rule, analysis range and empty state, a recurring bill once a month, activity and notifications staying with the people involved, and every blocked admin path. The features are not in this build. A live test would only fail because the feature is missing.

New It7 cases that passed:

| Case | Test |
|---|---|
| $10.00 shared by two of three people. The third person's balance does not move. | `test_ten_dollar_line_shared_by_two_of_three_leaves_the_third_unchanged` |
| Unassigned lines left out | `test_unassigned_item_is_excluded` (already in Lukas's file) |
| $10.00 as 3.34 + 3.33 + 3.33 accepted. 3.33 three times refused and writes nothing. | `test_ten_dollars_across_three_people_accepts_the_extra_cent`, `test_shares_short_one_cent_are_rejected_and_save_nothing` |
| Cancel confirm saves nothing | `test_cancel_confirm_saves_nothing` |
| Delete a $40.00 expense split $20.00 and $20.00 and both balances go back | `test_delete_forty_dollar_split_puts_both_balances_back` |
| $20.00 of a $50.00 debt leaves $30.00 | `test_partial_repayment_updates_balance_and_history` (already in Lukas's file) |
| A settlement that is never submitted leaves the $50.00 | `test_cancelled_settlement_changes_nothing` |
| A member who is not on the debt gets 403 | `test_unrelated_member_cannot_record` (already in Lukas's file) |

#### Monday decisions

Recorded in the Requirements Specification on Nov 19:

- The reader returns store, location, date, each item (name, quantity, price, line total), subtotal, tax, tip, and total.
- "Could not read it" means bad JSON after one retry, a timeout, or no items. If the items do not add up, the app shows a warning and still lets you review.
- Either person on a debt can record a settlement. The other person does not confirm. Both can see it.
- The person who paid, the person who created the expense, and the group admin can edit or delete it.
- Delete receipt picture removes the saved image and keeps the items.
- A picture nobody confirms is kept 7 days, then deleted, and the receipt is marked abandoned.

The mid-month budget edit rule is still open. Retroactive or forward only was not chosen.

#### Iteration 7 leftovers to file in JIRA

I cannot post to JIRA from here. File these:

| Leftover | Why it is still open |
|---|---|
| Edit and delete are still admin-only | The agreed rule is the payer, the creator, and the group admin. Lukas's tests still expect admin-only, so the API was left as it is. |
| No 7 day abandon job | The `abandoned` status exists. Nothing deletes an unconfirmed picture after 7 days. |
| Reader rules are not wired | The field list and the "could not read it" rule are in the spec. The reader is not connected to them. |
| Mid-month budget edit | Still undecided. |
| Activity page, admin login, dashboard, access denied (SCRUM-154) | Not in the repo. Left unbuilt. Cole reviews them when they land. |

#### Stretch goal

No-go this week. Budgets, analysis, and the admin boundary are musts, and they are not in this build. The plan says stretch waits until those are done. Password reset, the formal ADA audit, and group budget goals stay stretch.

#### Comments to paste on the tickets

SCRUM-121: Review math is in from the hand worked numbers. Shared item, skipped item, the extra cent, and cancel. They run against Lukas's confirm route.

SCRUM-122: Delete puts the money back. A partial settle leaves the rest. Cancel leaves the balance alone. A third person gets refused.

SCRUM-153: Merged `lukas-it7` into `main` in the working tree and left the commit for me to make. Regression is local pytest and Vitest. 264 backend passed, 6 skipped. 358 frontend passed. No public server URL in the README, so I did not fake a live run. Decisions are in the requirements spec. Leftovers are in this report for filing. I cannot post to JIRA from here.

SCRUM-154: Pages not built. They are not in the repo, and this pass leaves them until the features exist. Cole still reviews them when they land.

SCRUM-155: Tests are in the tree and skipped. Budgets, analysis, recurring bills, activity, and admin paths are not in this build. A live test would only fail because the feature is missing. Mid-month edit is still open. You did not pick retroactive or forward only.

SCRUM-156: Local regression after the merge. Stretch is no-go this week. Test spec, test report, and user guide cover review, settle, and edit and delete. They do not describe screens we do not have.

---

## 3 Incidents

This section defines the incidents found while testing the system. It grows as more are found. Each Incident ID is the test case it ties to plus a letter, so TC-SEC-02-A is the first incident from test case TC-SEC-02. The JIRA bug number is shown with it. BUG-09 came from a document review, not a test case, so it keeps only its bug number.

| Incident ID | Bug | Title | Severity | Owner | Status (Nov 16) |
|---|---|---|---|---|---|
| [TC-DAT-01-A](#tc-dat-01-a-bug-01-two-migration-heads-after-pr-9) | BUG-01 | Two migration heads after PR #9 | Blocker | Mick | 🔁 Fixed in code |
| [TC-EXP-13-A](#tc-exp-13-a-bug-02-expense-routes-read-a-removed-column) | BUG-02 | Expense routes read a removed column | Blocker | Mick, Lukas | 🔁 Fixed in code |
| [TC-DAT-02-A](#tc-dat-02-a-bug-03-seed-leaves-balances-empty) | BUG-03 | Seed leaves Balances empty | Major | Mick | ❌ Open |
| [TC-SEC-02-A](#tc-sec-02-a-bug-04-get-users-open-to-anyone) | BUG-04 | `GET /users` open to anyone | Major (security) | Lukas | ❌ Open |
| [TC-GRP-10-A](#tc-grp-10-a-bug-05-member-who-owes-money-removed-without-warning) | BUG-05 | Member who owes money removed without warning | Major | Lukas | 🔁 Fixed in code |
| [TC-GRP-15-A](#tc-grp-15-a-bug-06-group-lists-live-only-in-the-browser) | BUG-06 | Group lists live only in the browser | Major | Lukas, Cole | ❌ Partly fixed |
| [TC-EXP-02-A](#tc-exp-02-a-bug-07-no-category-on-expenses) | BUG-07 | No category on expenses | Major | Mick, Lukas, Cole | ❌ Open |
| [TC-SEC-03-A](#tc-sec-03-a-bug-08-no-rate-limit-on-login) | BUG-08 | No rate limit on login | Major | Lukas | ❌ Open |
| [BUG-09](#bug-09-readme-out-of-date) | BUG-09 | README out of date | Minor | Xander | ❌ Open |

### TC-DAT-01-A (BUG-01): Two migration heads after PR #9

| Field | Entry |
|---|---|
| Incident ID | TC-DAT-01-A |
| Bug | BUG-01 |
| Description | PR #9 added migration `04994c4898a2` on top of an older migration, so the chain had two heads. `alembic upgrade head` failed on an empty database, and `alembic upgrade heads` failed with "column paid_by already exists". |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Blocker |
| Steps Required to Produce Incident | 1. Check out `e72a276`.<br>2. Create an empty database.<br>3. Run `alembic upgrade head`.<br>4. Run `alembic upgrade heads`. |
| Responder | Mick Leinbach, Developer (owner). The fix was committed by Xander McKie. |
| Current Status | Fixed in code. Re-test pending. |
| Cause | The new migration named an older revision as its parent instead of the newest one. |
| Resolution | `a1f1e00` joined `04994c4898a2` to the main chain and added `test_alembic_heads::test_alembic_has_a_single_head`, so a second head now fails the suite. On Nov 16 the chain at `83aaf1f` has one head. |
| Addressed Date | November 1, 2026 |
| Creation Phase | Implementation (PR #9, merged Oct 30) |
| Detection Phase | Testing (Oct 30 close-out) |
| Correction Time | 2 days |

### TC-EXP-13-A (BUG-02): Expense routes read a removed column

| Field | Entry |
|---|---|
| Incident ID | TC-EXP-13-A |
| Bug | BUG-02 |
| Description | PR #9 removed `created_at` from the Expense model, but `routes/expenses.py` still read it. Creating an expense and listing a group's expenses raised `AttributeError` (500). |
| Originator | Xander McKie, Tester (found by `test_expense_integration::test_api_lists_expenses_and_balances`) |
| Discover Date | October 30, 2026 |
| Severity | Blocker |
| Steps Required to Produce Incident | 1. Check out `e72a276` and log in as a member of a group.<br>2. Send `POST /expenses` with a valid expense.<br>3. Send `GET /groups/{id}/expenses`. |
| Responder | Mick Leinbach and Lukas Viskovic, Developers (owners). The fix was committed by Xander McKie. |
| Current Status | Fixed in code. Re-test pending. |
| Cause | A model change was merged without updating the code that reads the field, and without a full test run. |
| Resolution | `a1f1e00` restored `Expense.created_at` and updated `test_expense_integration.py`. |
| Addressed Date | November 1, 2026 |
| Creation Phase | Implementation (PR #9, merged Oct 30) |
| Detection Phase | Testing (Oct 30 close-out) |
| Correction Time | 2 days |

### TC-DAT-02-A (BUG-03): Seed leaves Balances empty

| Field | Entry |
|---|---|
| Incident ID | TC-DAT-02-A |
| Bug | BUG-03 |
| Description | The seed adds 9 expenses and 24 splits but no balance rows, so Balances is empty for every demo account. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major |
| Steps Required to Produce Incident | 1. Build an empty database and run the seed (TC-DAT-01).<br>2. Log in as Alice.<br>3. Open Balances. |
| Responder | Mick Leinbach, Developer |
| Current Status | Open. `seed.py` is unchanged on this point at `83aaf1f`. |
| Cause | `seed.py` writes expense and split rows directly instead of going through the expense save service, so the balance rows the API would write are never made. |
| Resolution | Planned: create the seed expenses through `create_expense_transaction` in `expense_persistence`, the same path `POST /expenses` uses. |
| Addressed Date | TBD (was planned for Iteration 6) |
| Creation Phase | Implementation (Sprint 5 seed, PR #9) |
| Detection Phase | Testing (Oct 30 close-out) |
| Correction Time | TBD |

### TC-SEC-02-A (BUG-04): GET /users open to anyone

| Field | Entry |
|---|---|
| Incident ID | TC-SEC-02-A |
| Bug | BUG-04 |
| Description | `GET /users` needs no login and returns every user's ID and email. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major (security) |
| Steps Required to Produce Incident | 1. With no session, send `GET /users`. |
| Responder | Lukas Viskovic, Developer |
| Current Status | Open. `backend/app/api/routes/users.py` is unchanged at `83aaf1f`. |
| Cause | The route has no login check. No screen in the frontend calls it. |
| Resolution | Planned: remove the route, or require login and return only what a screen needs. Since nothing calls it, removing it breaks nothing. |
| Addressed Date | TBD (was planned for Iteration 6). The Iteration 10 security audit (It10-1) checks login on every route at the latest. |
| Creation Phase | Implementation |
| Detection Phase | Testing (Oct 30 security probes) |
| Correction Time | TBD |

### TC-GRP-10-A (BUG-05): Member who owes money removed without warning

| Field | Entry |
|---|---|
| Incident ID | TC-GRP-10-A |
| Bug | BUG-05 |
| Description | `get_member_balance()` in `memberships.py` always returned 0, so a member who owed money was removed with no warning. The unit tests stubbed a $25 balance, so they passed. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major |
| Steps Required to Produce Incident | 1. Do TC-EXP-01, so Bob owes Alice $31.62 in Road Trip.<br>2. As Alice, send `DELETE /groups/{id}/members/{bob_id}` without confirming. |
| Responder | Lukas Viskovic, Developer |
| Current Status | Fixed in code. Re-test pending. |
| Cause | The balance check was a placeholder written before expenses existed. Its tests stubbed the balance, so the placeholder was never exercised. |
| Resolution | `80d43c6` adds up the member's real balance rows in the group. The API answers 409 with the balance and asks for confirmation until the admin sends the request again with `?confirm=true`. The tests now use a real balance row. |
| Addressed Date | October 31, 2026 |
| Creation Phase | Implementation (Iteration 3 groups work) |
| Detection Phase | Testing (Oct 30 probe against real data) |
| Correction Time | 1 day |

### TC-GRP-15-A (BUG-06): Group lists live only in the browser

| Field | Entry |
|---|---|
| Incident ID | TC-GRP-15-A (also affects TC-EXP-14) |
| Bug | BUG-06 |
| Description | There was no `GET /groups`, so the group and event lists and each group's default split lived in the browser. On a new device, Home says "You are not in any groups on this device yet", and a group page opened by link shows "Group" as its name. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major |
| Steps Required to Produce Incident | 1. Log in as Bob, who belongs to two groups, in a fresh browser.<br>2. Open Home.<br>3. Open one of his groups by its link. |
| Responder | Lukas Viskovic (backend) and Cole Hanson (frontend), Developers |
| Current Status | Partly fixed. The backend is done; the frontend is open. |
| Cause | The frontend was built before list routes existed and kept the lists in browser storage as a stopgap (`groupCache.js`, `eventCache.js`, `splitDefault.js`). |
| Resolution | Backend: `80d43c6` added `GET /groups`, `GET /groups/{id}`, `GET /groups/{id}/events`, and `GET` and `PUT /groups/{id}/split-default`, with tests. Frontend: planned. Replace the three browser stores with these routes, as Lukas's Sprint 5 handoff describes. Not done at `83aaf1f`. |
| Addressed Date | October 31, 2026 (backend). Frontend TBD. |
| Creation Phase | Implementation (Iterations 3 and 4) |
| Detection Phase | Testing (Oct 30 E2E in a fresh browser) |
| Correction Time | TBD |

### TC-EXP-02-A (BUG-07): No category on expenses

| Field | Entry |
|---|---|
| Incident ID | TC-EXP-02-A |
| Bug | BUG-07 |
| Description | Add Expense and `POST /expenses` have no category, which FR-EXP-01 requires and budgets need. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major |
| Steps Required to Produce Incident | 1. Open Add Expense and look for a category field.<br>2. Read the request body that `POST /expenses` accepts. |
| Responder | Mick Leinbach, Lukas Viskovic and Cole Hanson, Developers |
| Current Status | Open. Planned for Iteration 8. |
| Cause | Category was scheduled with the budget work in Iteration 8, but FR-EXP-01 asks for it on every expense. |
| Resolution | Planned in Iteration 8: the column (It8-1), the API (It8-7) and the picker (It8-12). The `expenses.category` column already exists with a check that allows only food, rent, entertainment and other. The Iteration 8 proposal is free text up to 30 characters with four suggestions, so It8-1 changes that check if the proposal is accepted. |
| Addressed Date | TBD (Iteration 8) |
| Creation Phase | Planning (scheduled after the expense form was built) |
| Detection Phase | Testing (Oct 30 close-out) |
| Correction Time | TBD |

### TC-SEC-03-A (BUG-08): No rate limit on login

| Field | Entry |
|---|---|
| Incident ID | TC-SEC-03-A |
| Bug | BUG-08 |
| Description | There is no rate limiting on login. 25 wrong passwords in a row were all answered 401. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Major |
| Steps Required to Produce Incident | 1. Send `POST /auth/login` for `alice@example.com` with a wrong password 25 times in a row. |
| Responder | Lukas Viskovic, Developer |
| Current Status | Open. Planned for Iteration 10. |
| Cause | Not built yet. It is scheduled with the security work. |
| Resolution | Planned: rate limiting on login, register and receipt upload (It10-1). |
| Addressed Date | TBD (Iteration 10) |
| Creation Phase | Implementation (not yet built) |
| Detection Phase | Testing (Oct 30 security probes) |
| Correction Time | TBD |

### BUG-09: README out of date

| Field | Entry |
|---|---|
| Incident ID | BUG-09 (document review; no test case) |
| Bug | BUG-09 |
| Description | The README lists `JWT_SECRET` (the app reads `EMAIL_VERIFICATION_SECRET`), calls expenses and balances "planned", shows an old project tree, and says sprints run Monday to Sunday. |
| Originator | Xander McKie, Tester |
| Discover Date | October 30, 2026 |
| Severity | Minor |
| Steps Required to Produce Incident | 1. Read the README next to `backend/.env.example` and the code on `main`. |
| Responder | Xander McKie |
| Current Status | Open. The README was updated on Nov 11, but it still lists `JWT_SECRET`, says sprints run Monday to Sunday, and lists expenses, splits and balances as "Planned, not built yet". It also still says `get_member_balance()` returns 0.0, which stopped being true on Oct 31 (BUG-05). |
| Cause | The README was not updated as features landed. |
| Resolution | Planned: see the change request in Section 5.1. |
| Addressed Date | TBD |
| Creation Phase | Documentation |
| Detection Phase | Review (Oct 30) |
| Correction Time | TBD |

---

## 4 Defects

Every incident so far turned out to be a real defect in the code or the documents. None was a mistake in a test. They fall into five kinds:

| Kind | Incidents | What happened |
|---|---|---|
| A merge broke working code | BUG-01, BUG-02 | PR #9 was merged without a full test run, and it broke `main` the same day. |
| A placeholder was never replaced | BUG-03, BUG-05, BUG-06 | The seed skipped the save service, the balance check was a stub, and the lists lived in the browser. Each one passed its own tests. |
| Security gap | BUG-04, BUG-08 | An open user list and no rate limit on login. |
| Requirement gap | BUG-07 | No category on expenses. |
| Documentation | BUG-09 | The README fell behind the code. |

**By severity on Nov 16:**

| Severity | Found | Fixed in code | Partly fixed | Open |
|---|---|---|---|---|
| Blocker | 2 | 2 | 0 | 0 |
| Major | 6 | 1 | 1 | 4 |
| Minor | 1 | 0 | 0 | 1 |

Three Majors (BUG-03, BUG-04 and BUG-06) were planned for Iteration 6 and are still open. Under the severity rule in the Test Plan, a Major is fixed before the iteration's review, so these are due before the Iteration 8 review on Friday Nov 20.

---

## 5 Changes

### 5.1 Change requests

These are the changes the system needs, sent to the developer who owns each one.

| For | Change needed | Owner | Target |
|---|---|---|---|
| BUG-03 | Create the seed expenses through `create_expense_transaction`, so balances are filled in | Mick | Iteration 8 review (Nov 20) |
| BUG-04 | Remove `GET /users`, or require login and return only what a screen needs | Lukas | Iteration 8 review (Nov 20) |
| BUG-06 | Replace `groupCache.js`, `eventCache.js` and `splitDefault.js` with the new group, event and split-default routes | Cole | Iteration 8 review (Nov 20) |
| BUG-07 | Category on the expense routes and on Add Expense | Mick, Lukas, Cole | Iteration 8 (It8-1, It8-7, It8-12) |
| BUG-08 | Rate limiting on login, register and receipt upload | Lukas | Iteration 10 (It10-1) |
| BUG-09 | README: `EMAIL_VERIFICATION_SECRET` in place of `JWT_SECRET`, sprints Monday to Friday, what is built now, the real member balance check, and the project tree | Xander | Iteration 8 |
| OI-26 | Write the pytest and Vitest exception (in place of `unittest`) into the Requirements Specification. The README has had it since Nov 11. | Xander | Iteration 8 |
| Process | GitHub Actions running both suites on every pull request. It was planned for Iteration 6 and is not on `main`. It would have caught BUG-01 and BUG-02 before the merge. | Xander | TBD |

### 5.2 Changes verified by a test run

| Change | When | Verified by |
|---|---|---|
| Server-side password rule (8 characters, a capital letter, a symbol) on register and password change | Oct 9, Lukas | TC-ACC-04 and 3 rejection tests |
| Group type names aligned between database and app (`roommate`, `partner`, `family`, `outing`) | Migration `6e590a5f2830` | `test_all_valid_group_types` (4) |
| Seed uses real password hashes, so demo logins work | Sprint 4 and 5, Mick | Logged in as all four seed accounts |
| Expense save is all or nothing | Sprint 4, Lukas | `test_failed_balance_update_rolls_back_expense` |
| Opposite debts net into one balance | Sprint 4, Lukas | `test_opposite_debts_are_netted` |

### 5.3 Changes waiting for a re-test

| Change | Commit | Re-test with |
|---|---|---|
| Migration chain joined, single-head test added (BUG-01) | `a1f1e00` | TC-DAT-01 |
| `Expense.created_at` restored (BUG-02) | `a1f1e00` | TC-EXP-01, TC-EXP-13 |
| Real balance check on member removal (BUG-05) | `80d43c6` | TC-GRP-10, with the probe against real data |
| Group, event and split-default routes (BUG-06, backend half) | `80d43c6` | TC-GRP-15, TC-EXP-14 once the frontend uses them |
| Receipt upload and status | `2d505a4`, `bf02e10` | TC-RCP-01, 02, 04, 09, 10; TC-CMP-01 and TC-A11Y-01 on the new screens |

---

## 6 Not yet tested

AI reading and the receipt accuracy run, the review screen, receipt picture deletion in the browser, the edit and delete screens, the settle screen, tagging an expense to an event, recurring bills, budgets, analysis, activity, notifications, site admin, HTTPS, load, the manual screen reader pass and the first-time-user check. The receipt screens added Nov 11 have not been checked at phone width or scanned for accessibility. The API for review math, cancel confirm, picture deletion, delete-reverses-balance, partial settle, cancel settle, and a third person settling someone else's debt passed on Nov 19. Each item has a case in the [Test Specification](testspec.md) and a slot in the [Test Plan schedule](testplan.md#10-schedule).

---

## 7 Summary

Testing to date used automated unit, API and component tests, an end-to-end walkthrough with two users, phone-width and accessibility scans, and probes against real data. Features tested include:

- Registering, logging in and out, sessions, the password rule and password change. Test cases: TC-ACC-01 to TC-ACC-12
- Viewing and editing the profile, changing email with verification, and safe photo paths. Test cases: TC-ACC-13 to TC-ACC-15
- Creating groups, inviting members, and accepting or declining. Test cases: TC-GRP-01 to TC-GRP-07
- Listing and removing members, and creating events. Test cases: TC-GRP-08 to TC-GRP-13
- Adding expenses, the three split methods, saving all or nothing, netting, balances and the expense list. Test cases: TC-EXP-01, TC-EXP-03 to TC-EXP-14
- Login on every protected route, data exposure, rate limits and secrets. Test cases: TC-SEC-01 to TC-SEC-04
- Phone width, accessibility, and building the demo database. Test cases: TC-CMP-01, TC-A11Y-01, TC-DAT-01, TC-DAT-02

On Oct 30, all 422 automated tests passed on the pre-merge code. The run found nine incidents: two Blockers, six Majors and one Minor. By the Nov 16 code check, three are fixed in code (BUG-01, BUG-02, BUG-05), one is partly fixed (BUG-06) and five are open (BUG-03, BUG-04, BUG-07, BUG-08, BUG-09).

On Nov 19 the local suites passed: 264 backend tests, 6 skipped, and 358 frontend tests. The skips are the Sprint 8 cases. Stretch is no-go this week.

Further testing happens as features land. The Friday Nov 20 close-out was this local regression. There is no deployed server URL in the README. The full test pass on Wednesday Dec 2 produces the final report.
