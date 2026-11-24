<div align="center">

# Testing Document and Specification
## Test Specification

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
| Document | Required document 5, part 2 of 3: Test Specification |
| Other parts | [Test Plan](testplan.md) (part 1) · [Test Reports](testreports.md) (part 3) |
| Document owner | Xander McKie |
| Version and date | 1.3 Draft, November 24, 2026 |
| Status | Draft. Iteration 7 screen cases now point at the frontend tests that exist. Older rows still name the Oct 30 and Nov 19 runs. |

## Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | Oct 30, 2026 | Xander McKie | Test cases as tables in the single Test Documentation file. |
| 1.1 | Nov 16, 2026 | Xander McKie | One block per case in the course template's fields. Added TC-EXP-17 (recurring bills), TC-RCP-09 and TC-RCP-10 (receipt privacy and rollback, from the new receipt tests) and TC-SOC-02 (notifications). Statuses updated from the Nov 16 code check. |
| 1.2 | Nov 19, 2026 | Xander McKie | It7 review, settle, and delete cases pointed at the tests that passed on the local suite. Sprint 8 cases noted as written and skipped. |
| 1.3 | Nov 24, 2026 | Xander McKie | It7 cases now also name the frontend tests for review, settle, edit and delete, picture deletion, and the event picker. The reader cases name the temporary-reader unit tests. |

## Contents

1. [Introduction](#1-introduction)
2. [Accounts and sessions](#2-accounts-and-sessions)
3. [Groups, invitations, members and events](#3-groups-invitations-members-and-events)
4. [Expenses, splits and balances](#4-expenses-splits-and-balances)
5. [Receipts and AI reading](#5-receipts-and-ai-reading)
6. [Budgets and analysis](#6-budgets-and-analysis)
7. [Activity and notifications](#7-activity-and-notifications)
8. [Site admin](#8-site-admin)
9. [Security, layout, accessibility, data and performance](#9-security-layout-accessibility-data-and-performance)

---

## 1 Introduction

This document lists every test case for the Shared Expense Management Tool. The [Test Plan](testplan.md) says which items are tested and why. The [Test Reports](testreports.md) record what happened when the cases were run.

Each case uses the fields from the course template: Test Case ID, Title, Feature/Subfeature, Purpose, Initial Conditions, Test Data, Test Actions and Expected Results. Three fields are added:

- **Requirements:** the IDs in the Requirements Specification that the case checks.
- **Covered by:** the automated test that runs the case (`file::test`), or **E2E** (the Playwright walkthrough), **Probe** (a request sent by hand against real data) or **Manual**.
- **Status:** the result from the last test run (Oct 30, on `8c8498e`). Anything merged since then was checked in the code of `main` at `83aaf1f` (Nov 13). That check ran no tests, so a fix found there is marked 🔁 until it is re-tested.

Cases for features that are not built yet use the same fields, so they are ready to run when the feature lands. Their steps may change as the screens are built.

### 1.1 Test case IDs

Each ID is `TC-` plus an area code and a number. Incidents in the Test Reports take the case ID plus a letter, such as `TC-SEC-02-A`.

| Code | Area | Code | Area |
|---|---|---|---|
| ACC | Accounts and sessions | ADM | Site admin |
| GRP | Groups, invitations, members, events | SEC | Security |
| EXP | Expenses, splits, balances | CMP | Phone and PC layout |
| RCP | Receipts and AI reading | A11Y | Accessibility |
| BUD | Budgets | DAT | Demo data |
| ANL | Analysis | PER | Performance |
| SOC | Activity and notifications | USE | Usability |

### 1.2 Status marks

| Mark | Meaning |
|---|---|
| ✅ | Pass |
| ❌ | Fail |
| ⚠️ | Pass with a known gap (an incident is open) |
| 🔁 | A fix or the feature was merged after the last test run. Re-test pending. |
| ⏳ | Not run yet, because the feature is not built |

### 1.3 Shared starting conditions

Unless a case says otherwise:

- The database is migrated to the newest revision. The backend runs on port 8000 and the frontend on port 5173.
- API steps send the session cookie of the user named in the step. "No session" means no cookie at all.
- The demo accounts are Alice, Bob, Carol and Dave (`alice@example.com` and so on), with the passwords in the README.
- "Road Trip" is a group of type outing. Alice created it and is its admin, and Bob is an accepted member. Carol and Dave are not members unless a case adds them.
- Amounts are in US dollars.

### 1.4 Summary

| Area | Cases | ✅ | ❌ | ⚠️ | 🔁 | ⏳ |
|---|---|---|---|---|---|---|
| Accounts and sessions | 16 | 15 | 0 | 0 | 0 | 1 |
| Groups, invitations, members, events | 15 | 12 | 1 | 0 | 1 | 1 |
| Expenses, splits, balances | 17 | 10 | 1 | 3 | 2 | 1 |
| Receipts and AI reading | 10 | 0 | 0 | 3 | 5 | 2 |
| Budgets and analysis | 5 | 0 | 0 | 0 | 0 | 5 |
| Activity and notifications | 2 | 0 | 0 | 0 | 0 | 2 |
| Site admin | 3 | 0 | 0 | 0 | 0 | 3 |
| Security, layout, accessibility, data, performance | 12 | 4 | 3 | 0 | 1 | 4 |
| **Total** | **80** | **41** | **5** | **6** | **9** | **19** |

---

## 2 Accounts and sessions

Use cases UC-01, UC-13 and UC-16.

### TC-ACC-01: Register a new account

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-01 |
| Title | Register a new account |
| Feature/Subfeature | Accounts / Registration |
| Purpose | To ensure a new person can create an account with a valid email and a password that meets the rule. |
| Requirements | FR-ACC-01 |
| Initial Conditions | Not logged in. No account exists for the test email. |
| Test Data | Email: `ann@example.com`<br>Password: `Aaaaaaa!` |
| Test Actions | 1. Send `POST /auth/register` with the test data (or fill in the Register page and press Register).<br>2. Look up the account. |
| Expected Results | After step 1, the server answers 201. After step 2, the account exists with the test email. |
| Covered by | `test_auth::test_registration_succeeds` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-02: Register an email that already exists

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-02 |
| Title | Register an email that already exists |
| Feature/Subfeature | Accounts / Registration |
| Purpose | To ensure two accounts can never share one email. |
| Requirements | FR-ACC-01 |
| Initial Conditions | Not logged in. No account exists for the test email. |
| Test Data | Email: `ann@example.com`<br>Password: `Aaaaaaa!` |
| Test Actions | 1. Send `POST /auth/register` with the test data.<br>2. Send the same request again. |
| Expected Results | After step 1, the server answers 201. After step 2, it answers 409 and no second account is created. |
| Covered by | `test_auth::test_duplicate_registration_returns_409` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-03: Invalid registration

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-03 |
| Title | Invalid registration |
| Feature/Subfeature | Accounts / Registration |
| Purpose | To ensure the server refuses a badly formed email or a short password and says why. |
| Requirements | FR-ACC-02, FR-ACC-03 |
| Initial Conditions | Not logged in. |
| Test Data | Bad email: `not-an-email` with password `Aaaaaaa!`<br>Short password: `ann2@example.com` with password `Aa!` |
| Test Actions | 1. Send `POST /auth/register` with the bad email.<br>2. Send `POST /auth/register` with the short password. |
| Expected Results | Both are answered 422 with the reason. No account is created. |
| Covered by | `test_auth::test_invalid_registration_returns_422` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-04: Password rule on the server

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-04 |
| Title | Password rule on the server |
| Feature/Subfeature | Accounts / Password rule |
| Purpose | To ensure the server enforces the full password rule (at least 8 characters, a capital letter and a symbol) even when the browser check is skipped. |
| Requirements | FR-ACC-03 |
| Initial Conditions | Not logged in. For step 2, logged in as Alice. |
| Test Data | Passwords: `aaaaaaaa`, `Aaaaaaaa`, `Aaaaaaa1`, `Aaaaaaa!` |
| Test Actions | 1. Send `POST /auth/register` straight to the API once for each password, each with a new email.<br>2. As Alice, send `POST /auth/change-password` once for each password. |
| Expected Results | The first three are refused (no capital, then no symbol, then no symbol). The last is accepted. Both routes behave the same. |
| Covered by | Probe; `test_auth::test_change_password_rejects_short_password`, `test_change_password_rejects_password_without_capital`, `test_change_password_rejects_password_without_symbol` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-05: Password rule in the browser

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-05 |
| Title | Password rule in the browser |
| Feature/Subfeature | Accounts / Register page |
| Purpose | To ensure the Register page shows each unmet rule and will not send a weak password. |
| Requirements | FR-ACC-03, FR-ACC-04 |
| Initial Conditions | Not logged in. On `/register`. |
| Test Data | Email: `ann3@example.com`<br>Weak password: `aaaa`<br>Good password: `Aaaaaaa!` |
| Test Actions | 1. Enter the email and the weak password.<br>2. Press Register.<br>3. Replace the password with the good one. |
| Expected Results | After step 1, each unmet rule is shown. After step 2, nothing is sent to the server. After step 3, no rule is shown as unmet and the form can be sent. |
| Covered by | `validators.test.js`, `forms.test.jsx` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-06: Email case ignored

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-06 |
| Title | Email case ignored |
| Feature/Subfeature | Accounts / Registration and login |
| Purpose | To ensure capital letters in an email never create a second account or block a login. |
| Requirements | FR-ACC-01 |
| Initial Conditions | Not logged in. No account exists for the test email. |
| Test Data | Register as `Ann@Example.com`, log in as `ann@example.com`, password `Aaaaaaa!` |
| Test Actions | 1. Register with the mixed-case email.<br>2. Log in with the lowercase email. |
| Expected Results | After step 2, the login succeeds into the same account made in step 1. |
| Covered by | `test_auth::test_registration_and_login_ignore_email_case` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-07: Same error for a wrong password and an unknown email

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-07 |
| Title | Same error for a wrong password and an unknown email |
| Feature/Subfeature | Accounts / Login |
| Purpose | To ensure the login error never reveals whether an email has an account. |
| Requirements | FR-ACC-08 |
| Initial Conditions | Not logged in. An account exists for `ann@example.com`. |
| Test Data | Wrong password: `ann@example.com` with `Wrongpass!`<br>Unknown email: `nobody@example.com` with `Aaaaaaa!` |
| Test Actions | 1. Send `POST /auth/login` with the wrong password.<br>2. Send `POST /auth/login` with the unknown email. |
| Expected Results | Both are answered 401 with the same wording. |
| Covered by | `test_auth::test_bad_login_returns_401`, `test_unknown_email_login_returns_same_401` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-08: Log in, see who I am, log out

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-08 |
| Title | Log in, see who I am, log out |
| Feature/Subfeature | Accounts / Sessions |
| Purpose | To ensure a login starts a session the server recognizes and a logout ends it. |
| Requirements | FR-ACC-07, FR-ACC-10 |
| Initial Conditions | Not logged in. An account exists for `ann@example.com`. |
| Test Data | `ann@example.com` with `Aaaaaaa!` |
| Test Actions | 1. Send `POST /auth/login` with the test data.<br>2. Send `GET /auth/me`.<br>3. Send `POST /auth/logout`.<br>4. Send `GET /auth/me` again. |
| Expected Results | After step 2, the server answers 200 with Ann's account. After step 4, it answers 401. |
| Covered by | `test_auth::test_login_me_logout_flow` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-09: Expired or revoked session

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-09 |
| Title | Expired or revoked session |
| Feature/Subfeature | Accounts / Sessions |
| Purpose | To ensure an old or revoked session stops working and the user gets a clean 401, not an error page. |
| Requirements | FR-ACC-13 |
| Initial Conditions | One session past its expiry time. One session that has been revoked. |
| Test Data | The two session cookies |
| Test Actions | 1. Send `GET /auth/me` with the expired cookie.<br>2. Send `GET /auth/me` with the revoked cookie. |
| Expected Results | Both are answered 401. No server error. |
| Covered by | `test_auth::test_expired_session_returns_401`, `test_revoked_session_returns_401` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-10: Change password

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-10 |
| Title | Change password |
| Feature/Subfeature | Accounts / Settings |
| Purpose | To ensure a user can change their password, and that doing so signs out their other sessions. |
| Requirements | FR-ACC-16 |
| Initial Conditions | Logged in as Ann with two sessions (two browsers). |
| Test Data | Current password: `Aaaaaaa!`<br>New password: `Bbbbbbb!` |
| Test Actions | 1. In browser one, send `POST /auth/change-password` with both passwords.<br>2. In browser two, send `GET /auth/me`.<br>3. Log in with the new password.<br>4. Repeat step 1 with a wrong current password, a short new password, a new password with no capital, and one with no symbol. |
| Expected Results | After step 1, the change is saved. After step 2, the old session gets 401. Step 3 succeeds. Each attempt in step 4 is refused and changes nothing. |
| Covered by | `test_auth::test_change_password_succeeds_and_revokes_session`, `test_change_password_rejects_wrong_current_password`, `test_change_password_rejects_short_password`, `test_change_password_rejects_password_without_capital`, `test_change_password_rejects_password_without_symbol` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-11: Guest opens an internal page

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-11 |
| Title | Guest opens an internal page |
| Feature/Subfeature | Accounts / Route guard |
| Purpose | To ensure a person who is not logged in can never see an internal page. |
| Requirements | FR-ACC-12 |
| Initial Conditions | Not logged in. A fresh browser. |
| Test Data | Addresses: `/balances`, `/groups/3`, `/does-not-exist` |
| Test Actions | 1. Open each address in turn. |
| Expected Results | Each one sends the browser to `/login`. |
| Covered by | `routeGuard.test.jsx` (12 tests); E2E step 8 |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-12: Passwords never stored in plain text

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-12 |
| Title | Passwords never stored in plain text |
| Feature/Subfeature | Accounts / Password storage |
| Purpose | To ensure the database holds only a hash of each password. |
| Requirements | FR-ACC-05, NFR-SEC-02 |
| Initial Conditions | Database access. |
| Test Data | Register `ann@example.com` with `Aaaaaaa!` |
| Test Actions | 1. Register the account.<br>2. Read `users.password_hash` for that email. |
| Expected Results | The value is an Argon2 hash starting with `$argon2id$`. It never contains the password. |
| Covered by | Database check (Oct 30) |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-13: View and edit the profile name

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-13 |
| Title | View and edit the profile name |
| Feature/Subfeature | Accounts / Profile |
| Purpose | To ensure a user can see their profile and change their name without changing anything else. |
| Requirements | FR-ACC-14, FR-ACC-17 |
| Initial Conditions | Logged in as Alice. |
| Test Data | New name: `Alice Park`<br>Blank name: an empty string |
| Test Actions | 1. Send `GET /profile` (or open Settings).<br>2. Send `PATCH /profile` with only the new name.<br>3. Send `GET /profile`.<br>4. Send `PATCH /profile` with the blank name. |
| Expected Results | After step 3, the name is `Alice Park` and every other field is unchanged. Step 4 is refused and the name stays `Alice Park`. |
| Covered by | `test_profile::test_patch_*` (5 tests), `settings.test.jsx` |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-14: Email change needs verification

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-14 |
| Title | Email change needs verification |
| Feature/Subfeature | Accounts / Profile |
| Purpose | To ensure a new email is only saved after the user proves they own it. |
| Requirements | FR-ACC-15 |
| Initial Conditions | Logged in as Alice. |
| Test Data | New email: `alice.new@example.com`<br>Taken email: `bob@example.com`<br>Same email: `alice@example.com` |
| Test Actions | 1. Send `POST /profile/email-change` with the new email.<br>2. Send `GET /profile`.<br>3. Send `POST /profile/email-change/confirm` with a wrong token, then with the right token.<br>4. Request a change to the taken email, then to the same email. |
| Expected Results | After step 2, the email is still `alice@example.com`. In step 3, the wrong token is refused and the right token changes the email. Both requests in step 4 are refused. |
| Covered by | `test_profile::test_email_change_*`, `test_confirm_*` (8 tests) |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-15: Profile photo path is safe

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-15 |
| Title | Profile photo path is safe |
| Feature/Subfeature | Accounts / Profile |
| Purpose | To ensure a profile photo can only point inside the uploads folder. |
| Requirements | NFR-SEC-03 |
| Initial Conditions | Logged in as Alice. |
| Test Data | `/etc/passwd` (absolute path)<br>`../secret.png` (`..` path)<br>A path to a folder outside uploads |
| Test Actions | 1. Send `PATCH /profile` with each path as the photo. |
| Expected Results | All three are refused. The photo is not changed. |
| Covered by | `test_profile::test_patch_rejects_*photo*` (3 tests) |
| Status | ✅ Pass (Oct 30) |

### TC-ACC-16: Password reset

| Field | Entry |
|---|---|
| Test Case ID | TC-ACC-16 |
| Title | Password reset |
| Feature/Subfeature | Accounts / Password reset |
| Purpose | To ensure a user who forgot their password can set a new one through a link sent by email. |
| Requirements | FR-ACC-11 (SHOULD, stretch goal) |
| Initial Conditions | Not logged in. An account exists for `ann@example.com`. |
| Test Data | `ann@example.com`; new password `Ccccccc!` |
| Test Actions | 1. Ask for a reset link from the login page.<br>2. Open the link from the email.<br>3. Set the new password.<br>4. Log in with the old password, then the new one. |
| Expected Results | A reset email arrives. After step 3, the old password is refused and the new one works. |
| Covered by | Planned |
| Status | ⏳ Not built. Built only if both kept stretch goals (Web API reference and ADA audit) are done first. |

---

## 3 Groups, invitations, members and events

Use cases UC-04, UC-05 and UC-06.

### TC-GRP-01: Create a group

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-01 |
| Title | Create a group |
| Feature/Subfeature | Groups / Create |
| Purpose | To ensure a user can create a group of each type and becomes its admin. |
| Requirements | FR-GRP-01, FR-GRP-02 |
| Initial Conditions | Logged in as Alice. Road Trip does not exist yet. |
| Test Data | Name: `Road Trip`, type: outing. Then one group each of type roommate, partner and family. |
| Test Actions | 1. On `/groups/new`, enter the name, pick the type and press Create (or send `POST /groups`).<br>2. Repeat for the other three types. |
| Expected Results | Each group is created (201). Alice is listed as its accepted admin. All four types are accepted. |
| Covered by | `test_groups::test_create_group_success`, `test_all_valid_group_types` (4); E2E step 1 |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-02: Bad group type or logged out

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-02 |
| Title | Bad group type or logged out |
| Feature/Subfeature | Groups / Create |
| Purpose | To ensure a group needs a valid type and a logged-in creator. |
| Requirements | FR-GRP-01 |
| Initial Conditions | Logged in as Alice for step 1. No session for step 2. |
| Test Data | Name `Book Club`, type `club` |
| Test Actions | 1. Send `POST /groups` with the test data.<br>2. Send `POST /groups` with a valid type and no session. |
| Expected Results | Step 1 is answered 422. Step 2 is answered 401. No group is created. |
| Covered by | `test_groups::test_create_group_invalid_type`, `test_create_group_unauthenticated` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-03: Cancel group creation

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-03 |
| Title | Cancel group creation |
| Feature/Subfeature | Groups / Create page |
| Purpose | To ensure Cancel leaves without saving anything. |
| Requirements | FR-GRP-06 |
| Initial Conditions | Logged in as Alice. On `/groups/new`. |
| Test Data | Name `Test Group`, type family |
| Test Actions | 1. Fill in the form.<br>2. Press Cancel. |
| Expected Results | No group is created and no request is sent. |
| Covered by | `createGroup.test.jsx` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-04: Invite by email

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-04 |
| Title | Invite by email |
| Feature/Subfeature | Groups / Invitations |
| Purpose | To ensure an admin can invite a registered user, who then sees the invitation. |
| Requirements | FR-GRP-03, FR-GRP-04 |
| Initial Conditions | Road Trip exists with Alice as admin. Bob has an account and is not a member yet. |
| Test Data | `bob@example.com` |
| Test Actions | 1. As Alice, invite Bob from the group (or send `POST /groups/{id}/invitations`).<br>2. Log in as Bob and open Home (or send `GET /groups/invitations/pending`). |
| Expected Results | After step 2, Bob sees a pending invitation to Road Trip. |
| Covered by | `test_invitations::test_invitation_created`, `test_pending_invitations`; E2E steps 1 and 2 |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-05: Invite twice, or invite an unregistered email

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-05 |
| Title | Invite twice, or invite an unregistered email |
| Feature/Subfeature | Groups / Invitations |
| Purpose | To ensure an invitation cannot be sent twice and never creates a membership for someone without an account. |
| Requirements | FR-GRP-03, FR-GRP-05 |
| Initial Conditions | Logged in as Alice. Bob already has a pending invitation to Road Trip. |
| Test Data | `bob@example.com`; `nobody@example.com` (no account) |
| Test Actions | 1. Invite Bob again.<br>2. Invite the unregistered email. |
| Expected Results | Step 1 is answered 409. Step 2 is reported as registration required, and no membership is created. |
| Covered by | `test_invitations::test_duplicate_invitation_returns_409`, `test_unregistered_email` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-06: Accept or decline

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-06 |
| Title | Accept or decline |
| Feature/Subfeature | Groups / Invitations |
| Purpose | To ensure accepting adds the group and declining adds nothing. |
| Requirements | FR-GRP-07 |
| Initial Conditions | Bob and Carol each have a pending invitation to Road Trip. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. As Bob, press Accept on Home.<br>2. As Carol, press Decline on Home. |
| Expected Results | After step 1, Road Trip appears under Bob's groups without a reload. After step 2, Carol has no Road Trip membership. |
| Covered by | `test_invitations::test_accept_invitation`, `test_decline_invitation`; `invites.test.jsx`; E2E step 3 |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-07: Only the invitee can answer; outsiders cannot invite

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-07 |
| Title | Only the invitee can answer; outsiders cannot invite |
| Feature/Subfeature | Groups / Invitations, privacy |
| Purpose | To ensure nobody can accept someone else's invitation or invite people into a group they are not in. |
| Requirements | NFR-SEC-07 |
| Initial Conditions | Bob has a pending invitation to Road Trip. Dave is not a member. |
| Test Data | `carol@example.com` |
| Test Actions | 1. As Dave, try to accept Bob's invitation.<br>2. As Dave, try to invite Carol to Road Trip. |
| Expected Results | Both are refused. Nothing changes. |
| Covered by | `test_invitations::test_only_invitee_can_accept`, `test_outsider_cannot_invite` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-08: List members

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-08 |
| Title | List members |
| Feature/Subfeature | Groups / Members |
| Purpose | To ensure members can see the member list and outsiders cannot. |
| Requirements | FR-GRP-08 |
| Initial Conditions | Road Trip with Alice (admin) and Bob. Dave is not a member. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. As Alice, send `GET /groups/{id}/members`.<br>2. As Bob, send the same request.<br>3. As Dave, send the same request. |
| Expected Results | Alice and Bob see the member list. Dave is refused. |
| Covered by | `test_memberships::test_admin_can_list_members`, `test_regular_member_can_list_members`, `test_outsider_cannot_list_members` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-09: Remove a member with zero balance

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-09 |
| Title | Remove a member with zero balance |
| Feature/Subfeature | Groups / Members |
| Purpose | To ensure an admin can remove a member who owes nothing, with no extra step. |
| Requirements | FR-GRP-10 |
| Initial Conditions | Carol is an accepted member of Road Trip and owes nothing. Logged in as Alice. |
| Test Data | Carol's user ID |
| Test Actions | 1. Press Remove next to Carol in Group settings (or send `DELETE /groups/{id}/members/{carol_id}`). |
| Expected Results | Carol is removed at once. |
| Covered by | `test_memberships::test_admin_can_remove_member` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-10: Remove a member who still owes money

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-10 |
| Title | Remove a member who still owes money |
| Feature/Subfeature | Groups / Members |
| Purpose | To ensure an admin is warned before removing a member with an open balance, and that the removal waits for confirmation. |
| Requirements | FR-GRP-09, FR-GRP-11 |
| Initial Conditions | TC-EXP-01 is done, so Bob owes Alice $31.62 in Road Trip. Logged in as Alice. |
| Test Data | Bob's user ID |
| Test Actions | 1. Press Remove next to Bob (or send `DELETE /groups/{id}/members/{bob_id}`).<br>2. Confirm in the warning (or send the request again with `?confirm=true`). |
| Expected Results | After step 1, a warning shows the balance and Bob stays in the group (the API answers 409 and asks for confirmation). After step 2, Bob is removed. |
| Covered by | Probe against real data; `test_memberships::test_balance_requires_confirmation`, `test_balance_removal_with_confirmation` |
| Status | 🔁 Failed Oct 30 (BUG-05): the probe removed Bob with no warning, while the unit tests passed on a stubbed $25 balance. Fixed in code at `80d43c6` (Oct 31): the check now adds up real balance rows, and the tests use a real balance row. Re-test pending. |

### TC-GRP-11: Sole admin removes themself; non-admin removes someone

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-11 |
| Title | Sole admin removes themself; non-admin removes someone |
| Feature/Subfeature | Groups / Members |
| Purpose | To ensure a group always keeps an admin and only admins remove members. |
| Requirements | FR-GRP-12 |
| Initial Conditions | Alice is Road Trip's only admin. Bob is a regular member. |
| Test Data | Alice's and Carol's user IDs |
| Test Actions | 1. As Alice, try to remove Alice.<br>2. As Bob, try to remove Carol. |
| Expected Results | Both are refused. Nobody is removed. |
| Covered by | `test_memberships::test_sole_admin_cannot_remove_self`, `test_regular_member_cannot_remove` |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-12: Create an event for all or some members

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-12 |
| Title | Create an event for all or some members |
| Feature/Subfeature | Events / Create |
| Purpose | To ensure a member can create an event with all members or a chosen few. |
| Requirements | FR-GRP-13 |
| Initial Conditions | Road Trip with Alice, Bob and Carol as accepted members. Logged in as Alice. |
| Test Data | `Gas stops` with All members<br>`Dinner` with Alice and Bob only |
| Test Actions | 1. On `/groups/{id}/events/new`, create `Gas stops` for all members (or send `POST /events`).<br>2. Create `Dinner` for Alice and Bob. |
| Expected Results | Both are created (201) with exactly the chosen members and are listed on the group page. |
| Covered by | `test_events::test_create_event_success`, `test_event_with_subset_of_members`; E2E step 4 |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-13: Event with no members, outsiders, pending or duplicate members

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-13 |
| Title | Event with no members, outsiders, pending or duplicate members |
| Feature/Subfeature | Events / Create |
| Purpose | To ensure an event only ever holds accepted members of its group, each once. |
| Requirements | FR-GRP-15 |
| Initial Conditions | Road Trip with Alice and Bob. Carol has a pending invitation. Dave is not a member. |
| Test Data | No members; Dave; Carol; Bob listed twice |
| Test Actions | 1. Send `POST /events` once with each member list. |
| Expected Results | Each is answered 422. No event is created. |
| Covered by | `test_events::test_empty_participants_rejected` and 4 more |
| Status | ✅ Pass (Oct 30) |

### TC-GRP-14: Tag an expense to an event

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-14 |
| Title | Tag an expense to an event |
| Feature/Subfeature | Events / Expenses |
| Purpose | To ensure an expense tagged to an event is shared only by that event's members. |
| Requirements | FR-GRP-14 |
| Initial Conditions | Road Trip with Alice, Bob and Carol. Event `Dinner` has Alice and Bob only. Logged in as Alice. |
| Test Data | Title `Tacos`, $30.00, paid by Alice, event `Dinner`, even split |
| Test Actions | 1. Add the expense and pick `Dinner` as its event.<br>2. Open Balances as Alice, then as Carol. |
| Expected Results | Bob owes Alice $15.00 more. Carol's balance does not change. |
| Covered by | `addExpense.test.jsx` (event picker), `test_expense_mutations` (event on create and edit) |
| Status | ⚠️ The event picker and `event_id` are in the app as of Nov 24. The rule that an event expense includes only that event's members is not enforced by the backend, so this case is not a full pass. |

### TC-GRP-15: My groups on a second device

| Field | Entry |
|---|---|
| Test Case ID | TC-GRP-15 |
| Title | My groups on a second device |
| Feature/Subfeature | Groups / List |
| Purpose | To ensure a user sees all their groups on any device, not only the one they used to join. |
| Requirements | FR-GRP-01, NFR-CMP-01 |
| Initial Conditions | Bob belongs to two groups. A fresh browser with no saved data. |
| Test Data | Bob's login |
| Test Actions | 1. Log in as Bob in the fresh browser.<br>2. Open Home and `/groups`.<br>3. Open one group by its link. |
| Expected Results | Both groups are listed by name. The group page shows the group's real name. |
| Covered by | E2E; `test_groups::test_list_groups_requires_auth`, `test_groups_list_only_accepted_memberships`, `test_group_detail_access_and_members` (added Oct 31) |
| Status | ⚠️ API passed earlier. As of Nov 24 the frontend reads `GET /groups` and does not keep the group list in browser storage (`groupCache.js` and `eventCache.js` are gone). A second-device walkthrough was not repeated on Nov 24. |

---

## 4 Expenses, splits and balances

Use cases UC-07, UC-09 and UC-10.

### TC-EXP-01: Add an expense with an even split

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-01 |
| Title | Add an expense with an even split |
| Feature/Subfeature | Expenses / Add Expense |
| Purpose | To ensure a member can add an expense, split it evenly, and see where the extra cent goes before saving. |
| Requirements | FR-EXP-01 to FR-EXP-03, FR-SPL-07, FR-SPL-08 |
| Initial Conditions | Road Trip with Alice and Bob. Logged in as Alice. |
| Test Data | Title `Gas`, $63.25, paid by Alice, split between Alice and Bob, even |
| Test Actions | 1. Open Add Expense from the Road Trip page.<br>2. Enter the test data.<br>3. Look at the preview.<br>4. Press Save. |
| Expected Results | After step 3, the preview shows Alice $31.63 (+1¢) and Bob $31.62, with the extra cent flagged. After step 4, the page says "Expense 'Gas' saved: $63.25 shared by 2 people". |
| Covered by | `test_expenses::test_create_expense_success`; `addExpense.test.jsx`; E2E steps 5 and 6 |
| Status | 🔁 Passed on `8c8498e` (Oct 30). On `e72a276` creating an expense returned 500 (BUG-02). Fixed in code at `a1f1e00` (Nov 1). Re-test pending. |

### TC-EXP-02: Category on an expense

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-02 |
| Title | Category on an expense |
| Feature/Subfeature | Expenses / Add Expense |
| Purpose | To ensure each expense can carry a category, which budgets need. |
| Requirements | FR-EXP-01, FR-BUD-02 |
| Initial Conditions | Road Trip with Alice and Bob. Logged in as Alice. |
| Test Data | Title `Snacks`, $12.00, paid by Alice, even split, category Food |
| Test Actions | 1. On Add Expense, enter the test data and choose Food.<br>2. Save.<br>3. Open the expense. |
| Expected Results | The expense is saved with category Food. |
| Covered by | None yet |
| Status | ❌ Fail (Oct 30, BUG-07). Still open on Nov 16: the `expenses.category` column exists in the database, but `POST /expenses` and Add Expense have no category field. Planned in Iteration 8 (It8-1, It8-7, It8-12). |

### TC-EXP-03: Invalid expense input

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-03 |
| Title | Invalid expense input |
| Feature/Subfeature | Expenses / Validation |
| Purpose | To ensure bad input is refused with a reason and nothing is saved. |
| Requirements | FR-EXP-01, NFR-SEC-03 |
| Initial Conditions | Logged in as Alice, a member of Road Trip. |
| Test Data | Amounts: $0, -$5.00, $10.001, NaN<br>A blank title<br>A group ID or payer ID that does not exist<br>No participants; one participant listed twice<br>An unknown split method<br>In the form: a title of 101 characters |
| Test Actions | 1. Send `POST /expenses` once with each bad value.<br>2. Type the 101-character title on Add Expense. |
| Expected Results | Each is refused with a reason. Nothing is saved. |
| Covered by | `test_expense_validation::test_invalid_expense_schema` (11 cases); `expenseValidators.test.js` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-04: Payer or participant outside the group

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-04 |
| Title | Payer or participant outside the group |
| Feature/Subfeature | Expenses / Validation, privacy |
| Purpose | To ensure only group members can pay, share or create an expense in a group. |
| Requirements | NFR-SEC-07 |
| Initial Conditions | Road Trip with Alice and Bob. Dave is not a member. |
| Test Data | $20.00 expenses with Dave as payer; with Dave in the split; created by Dave |
| Test Actions | 1. As Alice, send `POST /expenses` with Dave as payer.<br>2. As Alice, send it with Dave in the split.<br>3. As Dave, send an expense for Road Trip. |
| Expected Results | All three are refused. Nothing is saved. |
| Covered by | `test_expense_validation::test_rejects_*` (4 tests) |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-05: Even split with a remainder

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-05 |
| Title | Even split with a remainder |
| Feature/Subfeature | Splits / Even |
| Purpose | To ensure an even split that does not divide exactly still adds up to the total, and names who gets the extra cent. |
| Requirements | FR-SPL-08, NFR-DAT-04 |
| Initial Conditions | None (pure calculation) |
| Test Data | $10.00 split three ways; $0.01 split three ways |
| Test Actions | 1. Run the split calculator on each amount. |
| Expected Results | $10.00 gives $3.34, $3.33 and $3.33, and the person with the extra cent is named. The shares always add up to the total. |
| Covered by | `test_split_calculator::test_even_split_with_remainder`, `test_one_cent_split_between_three_members` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-06: Custom amounts

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-06 |
| Title | Custom amounts |
| Feature/Subfeature | Splits / Custom |
| Purpose | To ensure custom amounts are accepted only when they add up to the total. |
| Requirements | FR-SPL-04, FR-SPL-06 |
| Initial Conditions | None (pure calculation) |
| Test Data | $50.00 as $20.00 and $30.00; $50.00 as $20.00 and $25.00 |
| Test Actions | 1. Run the split calculator on each set. |
| Expected Results | The first is accepted. The second is refused because it does not add up to the total. |
| Covered by | `test_split_calculator::test_custom_split`, `test_custom_amounts_must_match_the_total` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-07: Percentages

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-07 |
| Title | Percentages |
| Feature/Subfeature | Splits / Percentage |
| Purpose | To ensure percentage splits come out to the cent and must total 100%. |
| Requirements | FR-SPL-06 |
| Initial Conditions | None (pure calculation) |
| Test Data | $100.00 at 50%, 30% and 20%; $100.00 at 50%, 30% and 10% |
| Test Actions | 1. Run the split calculator on each set. |
| Expected Results | The first gives $50.00, $30.00 and $20.00. The second is refused because it does not total 100%. |
| Covered by | `test_split_calculator::test_percentage_split`, `test_percentage_rounding`, `test_percentages_must_total_100` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-08: Switch from an automatic split to a manual one

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-08 |
| Title | Switch from an automatic split to a manual one |
| Feature/Subfeature | Splits / Add Expense preview |
| Purpose | To ensure the preview keeps up with every change and the form cannot be saved while the split is wrong. |
| Requirements | FR-SPL-10 |
| Initial Conditions | Logged in as Alice. On Add Expense for Road Trip. |
| Test Data | $50.00, Alice and Bob |
| Test Actions | 1. Pick Even.<br>2. Switch to Custom.<br>3. Change Bob's amount to $25.00 and leave Alice's at $25.00, then change Bob's to $30.00. |
| Expected Results | The preview updates after every step. Save is blocked while the amounts do not match the total and allowed when they do. |
| Covered by | `addExpense.test.jsx`, `splits.test.js` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-09: Saving is all or nothing

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-09 |
| Title | Saving is all or nothing |
| Feature/Subfeature | Expenses / Saving |
| Purpose | To ensure an expense, its splits and the balance update are saved together or not at all. |
| Requirements | FR-EXP-03, NFR-DAT-01 |
| Initial Conditions | Test database. The balance update is forced to fail. |
| Test Data | Any valid expense |
| Test Actions | 1. Save the expense through the expense save service. |
| Expected Results | The save fails, and the expense and its splits are rolled back. No rows are left. |
| Covered by | `test_expense_integration::test_failed_balance_update_rolls_back_expense` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-10: Opposite debts net out

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-10 |
| Title | Opposite debts net out |
| Feature/Subfeature | Balances / Netting |
| Purpose | To ensure two people who owe each other end up with one balance. |
| Requirements | FR-SPL-11 |
| Initial Conditions | Road Trip with Alice and Bob and no expenses. |
| Test Data | $60.00 paid by Alice, even split (Bob owes $30.00)<br>$40.00 paid by Bob, even split (Alice owes $20.00) |
| Test Actions | 1. Save both expenses.<br>2. Read the balance between Alice and Bob. |
| Expected Results | One balance: Bob owes Alice $10.00. |
| Covered by | `test_expense_integration::test_opposite_debts_are_netted` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-11: Balances page

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-11 |
| Title | Balances page |
| Feature/Subfeature | Balances / Page |
| Purpose | To ensure the Balances page shows who owes the user and what the user owes. |
| Requirements | FR-SPL-12 |
| Initial Conditions | TC-EXP-01 is done. Logged in as Alice. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. Open `/balances`. |
| Expected Results | "Bob owes you +$31.62" (Bob's name, or his email if he has not set one) and "You owe $0.00". |
| Covered by | `balances.test.jsx` (17 tests); E2E step 7 |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-12: Balances stay inside each group, and private

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-12 |
| Title | Balances stay inside each group, and private |
| Feature/Subfeature | Balances / Privacy |
| Purpose | To ensure each group keeps its own balances and outsiders see none of them. |
| Requirements | NFR-SEC-07 |
| Initial Conditions | Alice and Bob share two groups, each with expenses. Dave is in neither. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. As Alice, send `GET /balances`.<br>2. As Dave, ask for those groups' balances. |
| Expected Results | Alice sees a separate balance for each group. Dave sees none. |
| Covered by | `test_expense_integration::test_balances_are_group_specific`, `test_balance_routes::test_user_cannot_see_another_groups_balances` |
| Status | ✅ Pass (Oct 30) |

### TC-EXP-13: List a group's expenses

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-13 |
| Title | List a group's expenses |
| Feature/Subfeature | Expenses / Group page |
| Purpose | To ensure members see a group's expenses, newest first, and outsiders do not. |
| Requirements | FR-EXP-02 |
| Initial Conditions | Road Trip has at least two expenses. Dave is not a member. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. As Alice, open the Road Trip page (or send `GET /groups/{id}/expenses`).<br>2. As Dave, send the same request. |
| Expected Results | Alice sees the expenses newest first, each with her share. Dave is refused. |
| Covered by | `test_expense_integration::test_api_lists_expenses_and_balances`, `test_expenses::test_list_expenses_*`, `groupExpenses.test.jsx` |
| Status | 🔁 Passed on `8c8498e`; failed on `e72a276` with a 500 (BUG-02). Fixed in code at `a1f1e00` (Nov 1). Re-test pending. |

### TC-EXP-14: Default split for a group

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-14 |
| Title | Default split for a group |
| Feature/Subfeature | Splits / Group default |
| Purpose | To ensure a group's saved default split is used on every device. |
| Requirements | FR-SPL-09 |
| Initial Conditions | Road Trip with Alice and Bob. Logged in as Alice in two browsers. |
| Test Data | Default split: Alice 60%, Bob 40% |
| Test Actions | 1. In browser one, save the default in Group settings.<br>2. In browser two, open Add Expense for Road Trip. |
| Expected Results | Browser two starts at Alice 60% and Bob 40%. |
| Covered by | `splitDefaultPanel.test.jsx`; `test_memberships::test_split_default_round_trip_and_reset` and 3 more (added Oct 31) |
| Status | ⚠️ Pass with a known gap (Oct 30, BUG-06): the default is saved only in the browser. Still open on Nov 16: the backend added `GET` and `PUT /groups/{id}/split-default` at `80d43c6`, but the frontend still uses browser storage (`splitDefault.js`). |

### TC-EXP-15: Edit and delete an expense

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-15 |
| Title | Edit and delete an expense |
| Feature/Subfeature | Expenses / Edit and delete |
| Purpose | To ensure an expense can be changed or removed, and balances are recalculated in the same step. |
| Requirements | FR-EXP-32, NFR-DAT-02, NFR-DAT-03 |
| Initial Conditions | TC-EXP-01 is done (Bob owes Alice $31.62). Logged in as Alice. |
| Test Data | New amount: $70.00 |
| Test Actions | 1. Edit `Gas` to $70.00 and save.<br>2. Open Balances.<br>3. Delete `Gas`, reading the confirmation before confirming.<br>4. Open Balances. |
| Expected Results | After step 2, Bob owes Alice $35.00. The confirmation in step 3 says what is lost and what is kept. After step 4, Bob owes Alice $0.00. |
| Covered by | `test_it7_financial_consistency::test_delete_forty_dollar_split_puts_both_balances_back` and `test_delete_after_repayment_creates_refund_obligation`. Edit after a partial payment: `test_edit_after_partial_repayment_recalculates_remaining_debt`. |
| Status | ⚠️ API passed Nov 19. The screen is in the app and covered by `expenseEditDelete.test.jsx` (passed Nov 24). Edit and delete are still admin-only. The agreed rule is payer, creator, and group admin. |

### TC-EXP-16: Settle up in full or in part

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-16 |
| Title | Settle up in full or in part |
| Feature/Subfeature | Balances / Settle up |
| Purpose | To ensure a user can record a payment made outside the app, and the balance drops by exactly that amount. |
| Requirements | FR-SPL-13 to FR-SPL-17 |
| Initial Conditions | TC-EXP-01 is done (Bob owes Alice $31.62). Logged in as Bob. |
| Test Data | Partial payment: $20.00<br>Too much: $50.00 |
| Test Actions | 1. Open Settle Up for Alice and read the wording.<br>2. Record $20.00 and confirm.<br>3. Open Balances and history as Bob, then as Alice.<br>4. Try to record $50.00. |
| Expected Results | Step 1 says the app records a payment made outside it and moves no money. After step 3, $11.62 is left and both users' history shows the payment. Step 4 is refused because it is more than what is owed. A settlement that is never submitted leaves the balance as it was. A member who is not on the debt is refused. |
| Covered by | `test_settlements::test_partial_repayment_updates_balance_and_history` ($20.00 of $50.00 leaves $30.00), `test_cancelled_settlement_changes_nothing`, `test_unrelated_member_cannot_record`; `settleUp.test.jsx` |
| Status | ⚠️ API passed Nov 19. The settle screen is in the app and covered by `settleUp.test.jsx` (passed Nov 24). |

### TC-EXP-17: Recurring bill repeats monthly

| Field | Entry |
|---|---|
| Test Case ID | TC-EXP-17 |
| Title | Recurring bill repeats monthly |
| Feature/Subfeature | Expenses / Recurring bills |
| Purpose | To ensure a bill set to repeat monthly is added once each month on its due date, through the normal expense save. |
| Requirements | FR-EXP-06, FR-SPL-01 |
| Initial Conditions | Apartment 4B with its members. Logged in as Alice. |
| Test Data | Title `Rent`, $1,200.00, paid by Alice, even split, due on the 1st, repeats monthly |
| Test Actions | 1. Add the bill with "repeats monthly" turned on.<br>2. Run the daily job for next month's due date.<br>3. Run it again the same day.<br>4. Open Balances. |
| Expected Results | After step 2, one new copy of `Rent` exists for that month. Step 3 adds nothing. Balances include each copy once. |
| Covered by | `test_sprint8_pending::test_recurring_bill_is_added_once_per_month` (skipped) |
| Status | ⏳ Iteration 8 (It8-4, It8-9, It8-12). The test is written and skipped until recurring bills exist. Third in line to be cut if Iteration 8 runs short. |

---

## 5 Receipts and AI reading

Use cases UC-02, UC-08 and UC-14. Uploading works on `main` (merged Nov 8 to 11). The team chose a small Qwen vision model as the AI reader, and it is being connected. Until it lands, every receipt on `main` stays at status `uploaded`.

### TC-RCP-01: Upload a JPEG photo or a PDF

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-01 |
| Title | Upload a JPEG photo or a PDF |
| Feature/Subfeature | Receipts / Upload |
| Purpose | To ensure a group member can upload a receipt and can tell right away that it worked. |
| Requirements | FR-EXP-10 to FR-EXP-12 |
| Initial Conditions | Logged in as Alice, a member of Apartment 4B. On `/receipts/new`. |
| Test Data | A JPEG receipt photo under 10 MB<br>A one-page PDF receipt<br>A photo taken with a phone camera |
| Test Actions | 1. Pick Apartment 4B and the JPEG, then press Upload.<br>2. Repeat with the PDF.<br>3. At phone width, take a photo with the camera and upload it. |
| Expected Results | Each upload is accepted (201) with status `uploaded` and a clear success indicator, and the reading screen opens. The file is stored privately, and its path is never sent back to the browser. |
| Covered by | `test_receipts::test_valid_upload_creates_private_file_and_uploaded_row`, `test_get_receipt_uploaded_returns_empty_items_without_file_path`; `receiptScreens.test.jsx`, `receiptsApi.test.js`; planned Playwright check at phone width |
| Status | 🔁 Merged Nov 8 to 11 (`2d505a4`, `bf02e10`). Not yet in a recorded run. |

### TC-RCP-02: Upload the wrong type, an oversized file or a corrupt file

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-02 |
| Title | Upload the wrong type, an oversized file or a corrupt file |
| Feature/Subfeature | Receipts / Upload errors |
| Purpose | To ensure each kind of bad file is refused with its own cause and a way to fix it, and nothing is saved. |
| Requirements | FR-EXP-16 |
| Initial Conditions | Logged in as Alice. On `/receipts/new`. |
| Test Data | `receipt.png` (wrong type)<br>A 12 MB JPEG (over the 10 MB default limit)<br>A `.jpg` file that is not really an image<br>An empty file<br>A password-protected PDF |
| Test Actions | 1. Upload each file in turn. |
| Expected Results | Each is refused and nothing is saved. Wrong type: 415 `wrong_format`. Too large: 413 `file_too_large`. Not a real image, empty or protected: 422 `corrupt_file`. Each error carries a message and an action, and the screen shows both. |
| Covered by | `test_receipts::test_invalid_upload_reports_cause_and_action`, `test_oversize_file_is_rejected_before_persisting`; `receiptErrors.test.js`, `receiptScreens.test.jsx` |
| Status | 🔁 Merged Nov 8 to 11. Not yet in a recorded run. The 10 MB limit is a default until the team agrees on one (`MAX_RECEIPT_MB`). |

### TC-RCP-03: AI reads a receipt

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-03 |
| Title | AI reads a receipt |
| Feature/Subfeature | Receipts / AI reading |
| Purpose | To ensure the AI reader turns a receipt into a store, a date and items with prices, checked and saved in receipt order. |
| Requirements | FR-EXP-13 to FR-EXP-15 |
| Initial Conditions | A receipt uploaded as in TC-RCP-01. |
| Test Data | Recorded reader replies for three receipts (no real AI calls in automated runs) |
| Test Actions | 1. Run the reading step with a recorded reply.<br>2. Send `GET /receipts/{id}`.<br>3. Open the reading screen. |
| Expected Results | The status moves from `uploaded` to `reading` to `read`. The reply is checked as valid JSON before saving. Decided Nov 19: the reader returns store, location, date, each item (name, quantity, price, line total), subtotal, tax, tip, and total. Those fields are saved and shown in receipt order. |
| Covered by | `temporary-reader/tests/test_reader.py` (fake client, no network), `test_receipts::test_get_receipt_read_returns_ordered_items`, `test_get_receipt_processing_states` |
| Status | ⚠️ Unit tests for the temporary reader passed Nov 24 (32 tests, fake client). A live read was not part of that run. The reader is not inside the backend. |

### TC-RCP-04: AI cannot read it

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-04 |
| Title | AI cannot read it |
| Feature/Subfeature | Receipts / AI reading errors |
| Purpose | To ensure a failed read looks different from a failed upload and offers manual entry. |
| Requirements | FR-EXP-17 |
| Initial Conditions | A receipt uploaded as in TC-RCP-01. |
| Test Data | A recorded reader reply that cannot be used |
| Test Actions | 1. Run the reading step with the bad reply.<br>2. Open the receipt's screen. |
| Expected Results | The status is `failed`, a state of its own, not an upload error. Decided Nov 19: that happens for bad JSON after one retry, a timeout, or no items found. If the items do not add up, the app shows a warning and still lets you review. The screen says it was uploaded but could not be read, and offers manual entry. |
| Covered by | `test_receipts::test_reading_failure_is_its_own_state`; `receiptScreens.test.jsx`; `temporary-reader/tests/test_reader.py::test_two_bad_replies_raise` |
| Status | ⚠️ The `failed` screen is in the app. The temporary reader marks a bad reply as failed after one retry. That path is unit tested with a fake client, not with a live call. |

### TC-RCP-05: Reading accuracy across lighting and formats

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-05 |
| Title | Reading accuracy across lighting and formats |
| Feature/Subfeature | Receipts / AI reading accuracy |
| Purpose | To measure how often the AI reader gets each field right, by condition. |
| Requirements | NFR-PER-02 |
| Initial Conditions | The AI reader is chosen and connected. |
| Test Data | 15 synthetic receipts (clean, crumpled, dim, angled, PDF) with an answer key |
| Test Actions | 1. Upload each receipt.<br>2. Compare the store, date, items and prices to the answer key.<br>3. Record the accuracy for each condition. |
| Expected Results | Accuracy for each condition is logged in the Test Reports and meets the NFR-PER-02 target. |
| Covered by | Manual |
| Status | ⏳ The temporary reader is connected for local use. The 15-receipt accuracy run has not been done. |

### TC-RCP-06: Review and assign items

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-06 |
| Title | Review and assign items |
| Feature/Subfeature | Receipts / Review and assign |
| Purpose | To ensure the user can fix what the AI read and say who shares each item before anything is saved. |
| Requirements | FR-EXP-20 to FR-EXP-24 |
| Initial Conditions | A read receipt in Apartment 4B with at least four items. |
| Test Data | One item renamed and repriced; one item assigned to two of the members, not all (OI-16); one item left unassigned |
| Test Actions | 1. Open the review screen.<br>2. Edit, assign and leave items as in the test data.<br>3. Look at each person's total before saving. |
| Expected Results | Every item can be edited. An item can be shared by some people, and the people left off it do not take a share. The unassigned item is left out. $10.00 across three people is accepted as 3.34, 3.33, and 3.33. 3.33 three times is refused and writes nothing. |
| Covered by | `test_receipt_confirmation::test_ten_dollar_line_shared_by_two_of_three_leaves_the_third_unchanged`, `test_unassigned_item_is_excluded`, `test_ten_dollars_across_three_people_accepts_the_extra_cent`, `test_shares_short_one_cent_are_rejected_and_save_nothing`; `receiptReview.test.jsx` |
| Status | ⚠️ API passed Nov 19. The review screen tests in `receiptReview.test.jsx` passed in the Nov 24 frontend run (587 tests, no failures). A browser walkthrough with a live receipt was not repeated that day. |

### TC-RCP-07: Cancel the review, then save

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-07 |
| Title | Cancel the review, then save |
| Feature/Subfeature | Receipts / Review and assign |
| Purpose | To ensure Cancel saves nothing, and saving creates the expense and balances in one step. |
| Requirements | FR-EXP-25, FR-EXP-26 |
| Initial Conditions | The review from TC-RCP-06, filled in. |
| Test Data | None beyond the initial conditions |
| Test Actions | 1. Press Cancel.<br>2. Open the review again, fill it in and press Save.<br>3. Open Balances. |
| Expected Results | After step 1, nothing is saved. The receipt stays at `read`, with no expense and no balance change. After step 2, one expense with its splits and balances is saved and the receipt is marked confirmed. The picture stays until someone deletes it. Step 3 shows the new balances. |
| Covered by | `test_receipt_confirmation::test_cancel_confirm_saves_nothing`, `test_confirmation_persists_everything_atomically`; `receiptReview.test.jsx` |
| Status | ⚠️ API passed Nov 19. The review screen is in the app and covered by `receiptReview.test.jsx` (passed Nov 24). |

### TC-RCP-08: Delete the receipt picture, keep the items

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-08 |
| Title | Delete the receipt picture, keep the items |
| Feature/Subfeature | Receipts / Picture deletion |
| Purpose | To ensure a user can delete a receipt's picture while its items stay, and a failed delete loses nothing. |
| Requirements | FR-EXP-30, FR-EXP-31, FR-EXP-33 |
| Initial Conditions | A receipt with saved items and its picture still stored. |
| Test Data | A forced delete failure for step 3 |
| Test Actions | 1. Press Delete picture and read the confirmation.<br>2. Confirm.<br>3. Repeat on another receipt with the delete forced to fail. |
| Expected Results | The confirmation says the items are kept. After step 2, the picture is gone and the items remain. After step 3, the picture is still there. A picture nobody confirms is kept 7 days, then deleted, and the receipt is marked abandoned. |
| Covered by | `test_receipt_management::test_delete_picture_preserves_items_expense_and_receipt`, `test_failed_commit_restores_original_picture`; `deletePicture.test.jsx` |
| Status | ⚠️ API passed Nov 19. The dialog is in the app and covered by `deletePicture.test.jsx` (passed Nov 24). The 7 day cleanup job is not built. The `abandoned` status exists. |

### TC-RCP-09: Receipts stay private to the group

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-09 |
| Title | Receipts stay private to the group |
| Feature/Subfeature | Receipts / Privacy |
| Purpose | To ensure only logged-in accepted members can upload to a group or open its receipts. |
| Requirements | NFR-SEC-04, NFR-SEC-07 |
| Initial Conditions | A receipt exists in Apartment 4B. Dave is not a member. |
| Test Data | A valid JPEG; the receipt's ID; an ID that does not exist |
| Test Actions | 1. As Dave, upload the JPEG to Apartment 4B.<br>2. As Dave, send `GET /receipts/{id}`.<br>3. With no session, repeat steps 1 and 2.<br>4. As Alice, ask for the ID that does not exist. |
| Expected Results | Step 1 is answered 403 and nothing is saved. Step 2 is refused. Step 3 is answered 401. Step 4 is answered 404. |
| Covered by | `test_receipts::test_not_group_member_cannot_upload`, `test_get_receipt_requires_accepted_group_membership`, `test_unauthenticated_upload_is_rejected`, `test_get_receipt_requires_authentication`, `test_get_missing_receipt_returns_404` |
| Status | 🔁 Merged Nov 8 to 11. Not yet in a recorded run. |

### TC-RCP-10: Upload is all or nothing

| Field | Entry |
|---|---|
| Test Case ID | TC-RCP-10 |
| Title | Upload is all or nothing |
| Feature/Subfeature | Receipts / Upload |
| Purpose | To ensure a failed save never leaves a stray picture on the server. |
| Requirements | NFR-DAT-01 |
| Initial Conditions | Test database. The database save is forced to fail. |
| Test Data | A valid JPEG |
| Test Actions | 1. Upload the JPEG. |
| Expected Results | The upload fails with error `upload_failed`. No receipt row is saved, and the stored file is removed. |
| Covered by | `test_receipts::test_failed_database_commit_removes_saved_file` |
| Status | 🔁 Merged Nov 8 to 11. Not yet in a recorded run. |

---

## 6 Budgets and analysis

All five cases are scheduled for Iteration 8 (Nov 16 to 20). The checks are written in `test_sprint8_pending.py` and skipped until the features exist, so the suite stays green. The mid-month edit rule is still open.

### TC-BUD-01: Set a monthly goal per category

| Field | Entry |
|---|---|
| Test Case ID | TC-BUD-01 |
| Title | Set a monthly goal per category |
| Feature/Subfeature | Budgets / Goals |
| Purpose | To ensure a user can set monthly goals by category, for themself or for a group, and see spending against each. |
| Requirements | FR-BUD-01 to FR-BUD-04 |
| Initial Conditions | Expenses have categories (TC-EXP-02). Logged in as Alice, a member of Apartment 4B. |
| Test Data | Group goal: Food, $300.00 for November, Apartment 4B<br>Expense: `Groceries`, $120.00, Food |
| Test Actions | 1. Set the goal.<br>2. Add the expense.<br>3. Open the budget screen.<br>4. Set the goal again as per person instead of total, if that option is built. |
| Expected Results | After step 3, Food shows $120.00 spent of $300.00. Step 4 shows each person's part of the goal. |
| Covered by | No skipped test yet. Goals themselves are not in this build. The over-goal check is the one written ahead. |
| Status | ⏳ Iteration 8 (It8-2, It8-7, It8-13). Per-person goals (FR-BUD-04) are second in line to be cut. |

### TC-BUD-02: Go over a goal

| Field | Entry |
|---|---|
| Test Case ID | TC-BUD-02 |
| Title | Go over a goal |
| Feature/Subfeature | Budgets / Over-goal flag |
| Purpose | To ensure going over a goal is shown but never stops an expense from being saved. |
| Requirements | FR-BUD-06 |
| Initial Conditions | TC-BUD-01 is done ($120.00 of $300.00 spent on Food). |
| Test Data | `Party food`, $200.00, Food |
| Test Actions | 1. Add the expense.<br>2. Open the budget screen. |
| Expected Results | The expense saves. Food shows $320.00 of $300.00 and is flagged as over. |
| Covered by | `test_sprint8_pending::test_going_over_a_goal_is_never_blocked` (skipped) |
| Status | ⏳ Iteration 8. The test is written and skipped until budget goals exist. |

### TC-BUD-03: Edit a goal mid-month

| Field | Entry |
|---|---|
| Test Case ID | TC-BUD-03 |
| Title | Edit a goal mid-month |
| Feature/Subfeature | Budgets / Goals |
| Purpose | To ensure a goal changed partway through a month follows the agreed rule. |
| Requirements | FR-BUD-05 |
| Initial Conditions | TC-BUD-01 is done, partway through November. |
| Test Data | New Food goal: $400.00 |
| Test Actions | 1. Change the goal.<br>2. Open the budget screen. |
| Expected Results | The goal and spending follow the mid-month rule once it is chosen. On Nov 19 that rule was still open: retroactive, or forward only. |
| Covered by | `test_sprint8_pending::test_mid_month_goal_edit_rule_is_still_open` (skipped) |
| Status | ⏳ Iteration 8. Skipped because the rule is not decided. |

### TC-ANL-01: Analysis for a month or a date range

| Field | Entry |
|---|---|
| Test Case ID | TC-ANL-01 |
| Title | Analysis for a month or a date range |
| Feature/Subfeature | Analysis / Page |
| Purpose | To ensure the analysis page shows what each member paid against their split, spending by category and by store, and a category chart. |
| Requirements | FR-ANL-01 to FR-ANL-04 |
| Initial Conditions | Apartment 4B has categorized expenses and at least one receipt in November. Logged in as Alice. |
| Test Data | Month: November 2026; range: September to November 2026 |
| Test Actions | 1. Open analysis for November.<br>2. Switch to the date range. |
| Expected Results | Each view shows each member's contribution against the configured split, spending by category and by store, and a category chart. A range can cover up to 12 months. |
| Covered by | `test_sprint8_pending::test_analysis_range_and_empty_state` (skipped; also covers the empty state in TC-ANL-02) |
| Status | ⏳ Iteration 8 (It8-3, It8-8, It8-14). The test is written and skipped until analysis exists. |

### TC-ANL-02: New account with no history

| Field | Entry |
|---|---|
| Test Case ID | TC-ANL-02 |
| Title | New account with no history |
| Feature/Subfeature | Analysis / Empty state |
| Purpose | To ensure a brand-new account sees a clear empty state, not a broken chart. |
| Requirements | FR-ANL-05 |
| Initial Conditions | A new account with no groups or expenses. |
| Test Data | None |
| Test Actions | 1. Open the analysis page. |
| Expected Results | The defined empty state is shown. No broken or empty chart. |
| Covered by | `test_sprint8_pending::test_analysis_range_and_empty_state` (skipped) |
| Status | ⏳ Iteration 8. The test is written and skipped until analysis exists. |

---

## 7 Activity and notifications

### TC-SOC-01: Activity history

| Field | Entry |
|---|---|
| Test Case ID | TC-SOC-01 |
| Title | Activity history |
| Feature/Subfeature | Activity / History |
| Purpose | To ensure every money or membership change is listed, and only for the people involved. |
| Requirements | FR-SOC-01, NFR-SEC-07 |
| Initial Conditions | Road Trip with Alice and Bob. Dave is not a member. |
| Test Data | One expense, one settlement and one member removal in Road Trip |
| Test Actions | 1. Make each change.<br>2. Open activity as Alice, then as Bob, then as Dave. |
| Expected Results | Alice and Bob see each change that involves them. Dave sees none of them. |
| Covered by | `test_sprint8_pending::test_activity_and_notifications_stay_with_the_people_involved` (skipped) |
| Status | ⏳ Iteration 8 (It8-5, It8-10, It8-17). The test is written and skipped until activity exists. |

### TC-SOC-02: Notifications

| Field | Entry |
|---|---|
| Test Case ID | TC-SOC-02 |
| Title | Notifications |
| Feature/Subfeature | Activity / Notifications |
| Purpose | To ensure users are told about changes that involve them, can mark them read, and can turn them off. |
| Requirements | FR-SOC-02, NFR-SEC-07 |
| Initial Conditions | Road Trip with Alice and Bob. Bob has notifications turned on. |
| Test Data | One expense added by Alice |
| Test Actions | 1. As Alice, add the expense.<br>2. As Bob, open the bell menu.<br>3. Mark the notification read.<br>4. Turn notifications off in Bob's settings and repeat step 1.<br>5. As Dave, open the bell menu. |
| Expected Results | After step 2, Bob sees the notification and an unread count. After step 3, the count clears. After step 4, Bob gets no new notification. Dave sees none of Bob's. |
| Covered by | `test_sprint8_pending::test_activity_and_notifications_stay_with_the_people_involved` (skipped) |
| Status | ⏳ Iteration 8 (It8-5, It8-10, It8-15). The test is written and skipped until notifications exist. Fourth in line to be cut. |

---

## 8 Site admin

All three cases are scheduled for Iteration 8. The blocked-path check is written in `test_sprint8_pending.py` and skipped until admin login, the dashboard, and the access-denied pages exist. Those pages were not built in this pass (SCRUM-154). Cole reviews them when they land.

### TC-ADM-01: Admin login

| Field | Entry |
|---|---|
| Test Case ID | TC-ADM-01 |
| Title | Admin login |
| Feature/Subfeature | Admin / Login |
| Purpose | To ensure admins log in on their own page, are checked against the admin table, and get the same generic error as users. |
| Requirements | FR-ADM-01, FR-ADM-02, FR-ADM-06 |
| Initial Conditions | One admin made with the server-side script (OI-15). Alice is a regular user. |
| Test Data | The admin's login; Alice's login; a wrong admin password |
| Test Actions | 1. Log in as the admin on the admin login page.<br>2. Try Alice's login there.<br>3. Try the wrong password. |
| Expected Results | Step 1 opens the dashboard. Steps 2 and 3 get the same generic error wording as a failed user login. |
| Covered by | `test_sprint8_pending::test_every_blocked_admin_path` (skipped) |
| Status | ⏳ Iteration 8 (It8-6, It8-11, It8-17). The test is written and skipped until the admin pages exist. |

### TC-ADM-02: Admin dashboard

| Field | Entry |
|---|---|
| Test Case ID | TC-ADM-02 |
| Title | Admin dashboard |
| Feature/Subfeature | Admin / Dashboard |
| Purpose | To ensure the dashboard shows only site-level counts. |
| Requirements | FR-ADM-03 |
| Initial Conditions | Logged in as the admin. |
| Test Data | None |
| Test Actions | 1. Open the dashboard. |
| Expected Results | It shows only uptime, error log count, total users and flagged issues, as decided in OI-13. No per-user or per-group data. |
| Covered by | `test_sprint8_pending::test_every_blocked_admin_path` (skipped; the dashboard page itself is SCRUM-154 and was not built) |
| Status | ⏳ Iteration 8. The blocked-path test is written and skipped until the admin pages exist. |

### TC-ADM-03: Admin tries to open user data; non-admin opens an admin page

| Field | Entry |
|---|---|
| Test Case ID | TC-ADM-03 |
| Title | Admin tries to open user data; non-admin opens an admin page |
| Feature/Subfeature | Admin / Privacy boundary |
| Purpose | To ensure admins can never see a user's data and non-admins can never reach admin pages, and that every attempt is logged. |
| Requirements | FR-ADM-05, FR-ADM-07, NFR-SEC-07 |
| Initial Conditions | One admin. Alice is a regular user with expenses. |
| Test Data | Alice's group and expense IDs |
| Test Actions | 1. As the admin, request Alice's group, expenses and balances.<br>2. As Alice, open the admin dashboard and its routes.<br>3. Read the admin access log. |
| Expected Results | Every request in steps 1 and 2 is blocked. Each one is in the log from step 3. |
| Covered by | `test_sprint8_pending::test_every_blocked_admin_path` (skipped) |
| Status | ⏳ Iteration 8. The test is written and skipped until the admin pages exist. |

---

## 9 Security, layout, accessibility, data and performance

### TC-SEC-01: Every protected route needs a session

| Field | Entry |
|---|---|
| Test Case ID | TC-SEC-01 |
| Title | Every protected route needs a session |
| Feature/Subfeature | Security / Authentication |
| Purpose | To ensure no protected route answers without a login. |
| Requirements | NFR-SEC-04 |
| Initial Conditions | No session. |
| Test Data | Expense, balance, group, event and profile routes |
| Test Actions | 1. Call each route with no cookie. |
| Expected Results | Each is answered 401. |
| Covered by | `*_requires_authentication` and `*_unauthenticated_*` tests |
| Status | ✅ Pass (Oct 30) |

### TC-SEC-02: No route exposes other users' data

| Field | Entry |
|---|---|
| Test Case ID | TC-SEC-02 |
| Title | No route exposes other users' data |
| Feature/Subfeature | Security / Data exposure |
| Purpose | To ensure no route hands out user data to someone who is not logged in. |
| Requirements | NFR-SEC-07 |
| Initial Conditions | No session. |
| Test Data | `GET /users` |
| Test Actions | 1. Send the request with no cookie. |
| Expected Results | 401, or the route no longer exists. |
| Covered by | Probe |
| Status | ❌ Fail (Oct 30, BUG-04): answered 200 with every user's ID and email. Still open on Nov 16: `backend/app/api/routes/users.py` is unchanged. |

### TC-SEC-03: Login is rate limited

| Field | Entry |
|---|---|
| Test Case ID | TC-SEC-03 |
| Title | Login is rate limited |
| Feature/Subfeature | Security / Rate limits |
| Purpose | To ensure repeated wrong passwords are slowed down. |
| Requirements | NFR-SEC-05 |
| Initial Conditions | Not logged in. |
| Test Data | `alice@example.com` with a wrong password, 25 times in a row |
| Test Actions | 1. Send `POST /auth/login` 25 times. |
| Expected Results | After a limit, the server answers 429. |
| Covered by | Probe |
| Status | ❌ Fail (Oct 30, BUG-08): 25 answers of 401, no limit. Still open on Nov 16. Planned in the Iteration 10 security audit (It10-1). |

### TC-SEC-04: Secrets stay out of git

| Field | Entry |
|---|---|
| Test Case ID | TC-SEC-04 |
| Title | Secrets stay out of git |
| Feature/Subfeature | Security / Secrets |
| Purpose | To ensure no real key or password is committed. |
| Requirements | NFR-SEC-06 |
| Initial Conditions | A clone of the repo. |
| Test Data | Search terms for keys, secrets and passwords |
| Test Actions | 1. Run `git grep` for each term. |
| Expected Results | Only `.env.example` placeholders and test or seed values are found. |
| Covered by | `git grep` (Oct 30) |
| Status | ✅ Pass (Oct 30) |

### TC-SEC-05: HTTPS and secure cookie

| Field | Entry |
|---|---|
| Test Case ID | TC-SEC-05 |
| Title | HTTPS and secure cookie |
| Feature/Subfeature | Security / Transport |
| Purpose | To ensure the live site only works over HTTPS and its login cookie cannot be read by scripts. |
| Requirements | NFR-SEC-01 |
| Initial Conditions | The app is deployed on the live server. |
| Test Data | The live address over `http://` |
| Test Actions | 1. Open the live address over HTTP.<br>2. Log in and inspect the session cookie. |
| Expected Results | Step 1 redirects to HTTPS. The cookie has the Secure and HttpOnly flags. |
| Covered by | Security checklist |
| Status | ⏳ Iteration 10 security audit (It10-1). No deploy files on `main` as of Nov 13. |

### TC-CMP-01: Phone width

| Field | Entry |
|---|---|
| Test Case ID | TC-CMP-01 |
| Title | Phone width |
| Feature/Subfeature | Layout / Phone |
| Purpose | To ensure every screen works on a phone. |
| Requirements | NFR-CMP-01 to NFR-CMP-04 |
| Initial Conditions | Browser window 390 px wide. Logged in as Alice. |
| Test Data | Every screen |
| Test Actions | 1. Open each screen at 390 px. |
| Expected Results | No sideways scrolling. The menu changes to its phone layout. Buttons are large enough to tap. |
| Covered by | Playwright |
| Status | ✅ Pass (Oct 30, 9 of 9 screens). The receipt screens added Nov 11 are not checked yet. |

### TC-A11Y-01: Automated accessibility scan

| Field | Entry |
|---|---|
| Test Case ID | TC-A11Y-01 |
| Title | Automated accessibility scan |
| Feature/Subfeature | Accessibility / Automated |
| Purpose | To ensure no screen breaks a WCAG 2 A or AA rule that can be checked automatically. |
| Requirements | NFR-A11Y-02, NFR-A11Y-03 |
| Initial Conditions | Logged in as Alice. |
| Test Data | Every screen |
| Test Actions | 1. Run axe-core on each screen. |
| Expected Results | No violations. |
| Covered by | axe-core 4.10.2 |
| Status | ✅ Pass (Oct 30, 0 violations on 11 of 11 screens). The receipt screens added Nov 11 are not scanned yet. |

### TC-A11Y-02: Screen reader and keyboard only

| Field | Entry |
|---|---|
| Test Case ID | TC-A11Y-02 |
| Title | Screen reader and keyboard only |
| Feature/Subfeature | Accessibility / Manual |
| Purpose | To ensure someone using a screen reader and no mouse can do the core tasks. |
| Requirements | NFR-A11Y-03, NFR-A11Y-04 |
| Initial Conditions | NVDA or VoiceOver running. No mouse. |
| Test Data | A new group, an expense and its balance |
| Test Actions | 1. Create a group.<br>2. Add an expense.<br>3. Read the balance. |
| Expected Results | Every control is named by the screen reader and can be reached with the keyboard. |
| Covered by | Manual |
| Status | ⏳ Iteration 10 (It10-2) |

### TC-DAT-01: Demo database from empty

| Field | Entry |
|---|---|
| Test Case ID | TC-DAT-01 |
| Title | Demo database from empty |
| Feature/Subfeature | Data / Migrations and seed |
| Purpose | To ensure a fresh demo database can be built quickly from nothing, with working logins. |
| Requirements | It5-1 |
| Initial Conditions | An empty database. |
| Test Data | The seed (four demo accounts) |
| Test Actions | 1. Run `alembic upgrade head`.<br>2. Run the seed.<br>3. Time steps 1 and 2.<br>4. Log in as each demo account. |
| Expected Results | Ready in under a minute. All four logins work. |
| Covered by | Timed manual run; `test_alembic_heads::test_alembic_has_a_single_head` (added Nov 1) |
| Status | 🔁 Passed on `8c8498e` (1.9 s). Failed on `e72a276` with "Multiple head revisions" (BUG-01). Fixed in code at `a1f1e00` (Nov 1). On Nov 16 the migration chain at `83aaf1f` has one head (`d890a95a86b8`, 24 revisions). Full re-test pending. |

### TC-DAT-02: Seeded expenses show in Balances

| Field | Entry |
|---|---|
| Test Case ID | TC-DAT-02 |
| Title | Seeded expenses show in Balances |
| Feature/Subfeature | Data / Seed |
| Purpose | To ensure the demo accounts show real balances from the seeded expenses. |
| Requirements | FR-SPL-11 |
| Initial Conditions | TC-DAT-01 is done. |
| Test Data | The nine seeded expenses |
| Test Actions | 1. Log in as Alice.<br>2. Open Balances. |
| Expected Results | Balances reflect the nine seeded expenses. |
| Covered by | Manual |
| Status | ❌ Fail (Oct 30, BUG-03): Balances is empty for every seeded user. Still open on Nov 16: `seed.py` still adds expenses and splits directly, without the save service that writes balances. |

### TC-PER-01: Several users at once

| Field | Entry |
|---|---|
| Test Case ID | TC-PER-01 |
| Title | Several users at once |
| Feature/Subfeature | Performance / Load |
| Purpose | To ensure the app stays responsive with several people using it at the same time. |
| Requirements | NFR-PER-01 |
| Initial Conditions | The live server with the demo seed. |
| Test Data | A load script with several simultaneous users |
| Test Actions | 1. Run the load script.<br>2. Use the app by hand while it runs. |
| Expected Results | Pages stay responsive. Results are logged in the Test Reports. |
| Covered by | Load script |
| Status | ⏳ Iteration 10 (It10-3) |

### TC-USE-01: First-time user understands the site

| Field | Entry |
|---|---|
| Test Case ID | TC-USE-01 |
| Title | First-time user understands the site |
| Feature/Subfeature | Usability |
| Purpose | To ensure a new user can figure the site out without help. |
| Requirements | NFR-USE-01 |
| Initial Conditions | Two people from outside the team who have not seen the app. |
| Test Data | The live site |
| Test Actions | 1. Give each person the address and no other help.<br>2. Time how long until they can explain what the site does and how to add an expense. |
| Expected Results | Each understands the site in under 3 minutes. |
| Covered by | Manual |
| Status | ⏳ Iteration 10 (It10-7) |
