# Project Plan

## Shared Expense Management Tool

> "Collaborative finance for people who actually share their lives."

| Item | Detail |
|---|---|
| Version | 1.0 |
| Date | October 15, 2026 |
| Baselined From | Project Charter v1.0 (Sep 21), Requirements Specification v1.0 (Sep 21), Iteration Plan v1.0 (Sep 25) |
| Project Team | Cole, Mick, Lukas, Xander |
| Sponsor | Commerce Bank |
| Course & Instructor | CS451R - Professor Jawad |
| Term | Fall 2026 |
| Status | Draft for Review |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Team and Stack Baseline](#2-team-and-stack-baseline)
3. [Schedule](#3-schedule)
4. [Release Plan](#4-release-plan)
5. [Work Breakdown and Task Schedule](#5-work-breakdown-and-task-schedule)
6. [Dependencies](#6-dependencies)
7. [Resources and Budget](#7-resources-and-budget)
8. [Quality Plan and Tracking](#8-quality-plan-and-tracking)
9. [Open Issue Decision Schedule](#9-open-issue-decision-schedule)
10. [Risks](#10-risks)
11. [Deliverables Schedule](#11-deliverables-schedule)
12. [Approval](#12-approval)

---

## 1. Introduction

### 1.1 Purpose

The Charter says why we are building the tool. The Requirements Specification says what it must do. This plan says when the work happens, who does it, what it depends on, and what it needs. It covers the timeline, milestones, tasks, dependencies, and resources, and it names every key deadline and deliverable through final delivery.

### 1.2 The Four Project Plan Components

The Iteration Plan organizes planning into four components. This document carries the same four, at project level.

| Component | Where it lives in this plan |
|---|---|
| Schedule | Section 3. Ten one-week iterations, plus warm-up and delivery. |
| Release Plan | Section 4. Which requirement groups ship with which iteration. |
| Quality Plan | Section 8. Definition of Done, cadence, regression, audits. |
| Budget | Section 7. No cash budget. The budget is the team's hours per week. |

### 1.3 Planning Basis

- Work runs in one-week iterations, Monday to Friday. The sprint backlog lives in JIRA. This plan is the project-level view. The Iteration Plan and JIRA are the iteration-level view.
- Dates in Section 3 come from the Iteration Plan, which is the most recent and most detailed schedule. Where it differs from the Charter, both dates are shown (Section 3.2).
- Tasks for It0 to It5 come from the Iteration Plan. Tasks for It6 to It10 are candidate backlogs, refined at each Friday close-out.
- Priority follows the Requirements Specification. When the schedule slips, COULD requirements are cut first, then SHOULD. MUST requirements are not cut.
- Test data is synthetic or anonymized. No live customer data is used.

---

## 2. Team and Stack Baseline

| Member | Role | Primary Responsibilities |
|---|---|---|
| Cole | Frontend and LLM | UI development and LLM implementation |
| Mick | Database | Database setup and implementation |
| Xander | Testing and Documentation | All tests, documentation, group communication, Figma designs |
| Lukas | Backend | Backend development and implementation |

| Layer | Selection |
|---|---|
| Frontend | React / JS, one CSS framework (Bootstrap) |
| Backend | Python (FastAPI) |
| Database | PostgreSQL |
| Auth | Hashed passwords, tokens with a secure, expiring cookie |
| LLM / Receipt Extraction | Candidates evaluated in IT0-9. Final choice tracked as OI-03. |
| Testing | unittest (PyUnit) per NFR-QUA-01. Test framework conflict (OI-26) resolved in It0. |
| Design | Figma (style guide, wireframes, clickable prototype) |
| Backlog tracking | JIRA |

---

## 3. Schedule

### 3.1 Iteration Calendar

As of October 15 the team is in It3.

| Iteration | Dates | Theme | Milestone |
|---|---|---|---|
| It0 | Sep 23 to Sep 25 | Warm-up | n/a |
| It1 | Sep 28 to Oct 2 | Auth foundation | M3 |
| It2 | Oct 5 to Oct 9 | Sessions, profile, guest handling | M3 |
| It3 | Oct 12 to Oct 16 | Groups, events, membership, plus Figma style guide and wireframes | M4 |
| It4 | Oct 19 to Oct 23 | Manual expenses, splits, balances, plus high-fidelity Figma prototype | M4 |
| It5 | Oct 26 to Oct 30 | Prototype demo: integration, bug fixes, demo data, no new features | Prototype |
| It6 | Nov 2 to Nov 6 | Receipt upload and LLM extraction, plus UI fixes from demo feedback | M5 |
| It7 | Nov 9 to Nov 13 | Review and assign screen, settle debt, built from Figma | M5 |
| It8 | Nov 16 to Nov 20 | Budgets, goals, analysis, built from Figma | M6 |
| It9 | Nov 23 to Nov 27 | Admin dashboard, activity, full UI polish pass. Thanksgiving, reduced capacity. | M6 |
| It10 | Nov 30 to Dec 4 | Hardening: full test pass, security and ADA audits, load check, User Guide | M7 |
| Delivery | Dec 7 | Final presentation, demo, source files | M8 |

### 3.2 Milestones

| ID | Charter target | Planned (Iteration Plan) | Variance | Exit criteria |
|---|---|---|---|---|
| M1 | Sep 18 | Sep 18 | None | 16 use cases written and reviewed. Complete. |
| M2 | Sep 25 | Sep 25 | None | Charter, requirements specification, and system architecture drafted. Repository and environments established. |
| M3 | Oct 2 | Oct 9 (end It2) | +1 week | PostgreSQL schema built. Register, login, password hashing, persistent sessions, guest redirect, profile and settings working. Unit test harness running. |
| M4 | Oct 16 | Oct 23 (end It4) | +1 week | Groups, events, member add and remove, manual expenses, all split methods, autosplit, and running balances working end to end. |
| Prototype | None | Oct 30 (end It5) | New | Demo of the built app plus clickable Figma prototype. No new features. |
| M5 | Oct 30 | Nov 13 (end It7) | +2 weeks | Upload from file, gallery, and camera. LLM extraction to JSON. Review-and-assign screen. Failed upload and failed parse handled. Receipt deletion. |
| M6 | Nov 13 | Nov 27 (end It9) | +2 weeks | Budgets and goals, monthly analysis and charts, settle debt, activity history, notifications. Admin dashboard with the privacy boundary enforced. Feature freeze. |
| M7 | Nov 27 | Dec 4 (end It10) | +1 week | Full test pass with report. Security and ADA checklists cleared. Load check done. User guide complete. |
| M8 | Dec 2 | Dec 7 | +5 days | Final presentation, live demo of all core features, organized source files submitted. |

The Charter dates and the Iteration Plan dates disagree for M3 through M8, by one to two weeks. The Charter also states that the delivery date does not move. The gap comes from the Figma and prototype work added in It3 to It5 and from the Charter schedule being written before the Iteration Plan. The team needs to do one of two things: confirm the actual course deadline and update the Charter dates to match this plan, or compress the later iterations to recover the lost time. Until then this plan schedules against the Iteration Plan dates.

### 3.3 Critical Path

Authentication and the database schema (M3) gate everything. The core ledger (M4) gates the receipt review screen, which writes into it, and the analysis layer, which reads from it. The receipt pipeline (M5) carries the most technical uncertainty. The high-fidelity Figma prototype (It4) gates the screen builds in It7 to It9. The admin dashboard cannot start until the definition of site-level data (OI-13) is written down.

---

## 4. Release Plan

| Iteration | Requirements shipped |
|---|---|
| It0 | None. Repo, backlog, ERD, migrations, scaffolds, LLM/OCR recommendation. |
| It1 | FR-ACC-01 to 09, NFR-SEC-02, 03, 04, NFR-QUA-01 |
| It2 | FR-ACC-10, 12 to 17, NFR-A11Y-03, NFR-CMP-01 |
| It3 | FR-GRP-01 to 16 |
| It4 | FR-EXP-01 to 05, FR-SPL-03, 04, 06, 07, 08, 10, 11, 12, NFR-SEC-07 |
| It5 | No new features. NFR-A11Y-02, NFR-CMP-01 to 04 verified on demo screens. |
| It6 | FR-EXP-10 to 17 |
| It7 | FR-EXP-20 to 26, FR-SPL-13 to 17 |
| It8 | FR-BUD-01 to 06, FR-ANL-01 to 05 |
| It9 | FR-ADM-01 to 07, FR-SOC-01 |
| It10 | NFR-SEC-08, NFR-A11Y-04, NFR-PER-01, NFR-QUA-02. No new features. |

### 4.1 Requirements Not Yet Placed

The requirements below are not named in any iteration yet. The proposed home is a suggestion for the next close-out, not a commitment.

| Requirement | Priority | Proposed home |
|---|---|---|
| FR-SPL-01, 02, 05 (standalone split creation, UC-03) | MUST, MUST, COULD | It6, or confirm that It4 expense splits satisfy UC-03 |
| FR-EXP-32 (delete an expense), NFR-DAT-02 (edit expenses, splits, balances) | MUST | It6 |
| FR-EXP-30, 31, 33 (receipt image deletion) | SHOULD | It7, because the M5 exit criteria include receipt deletion |
| FR-SPL-09 (saved group ratio) | SHOULD | It6, after OI-19 |
| FR-EXP-06 (recurring expenses) | SHOULD | It8 |
| FR-ACC-11 (password reset) | SHOULD | Depends on OI-02. Otherwise stretch goal SG-02. |
| FR-SOC-02 (notifications) | SHOULD | It9 if capacity allows. In the M6 exit criteria. |
| FR-SOC-03 (comments, reactions), FR-ANL-06 (advice) | COULD | It9 only if every MUST is done. Otherwise cut. |

---

## 5. Work Breakdown and Task Schedule

Task IDs refer to the Iteration Plan. Hours are shown where the Iteration Plan estimates them.

### 5.1 It0 Warm-Up (Sep 23 to Sep 25)

| Owner | Work | Plan IDs |
|---|---|---|
| Xander | JIRA project and board loaded from the spec, OI-26 decision, repo README | IT0-1, 2, 3, 10 |
| Mick | Initial ERD, first migrations, seed script | IT0-4, 5 |
| Lukas | Scaffold the project, wire backend to the schema | IT0-6, 7 |
| Cole | Scaffold the React app, evaluate 2 to 3 LLM or OCR services | IT0-8, 9 |

**Done when:** the repo runs from the README alone, the backlog holds every requirement as a story, the ERD is reviewed, migrations run on a clean database, and the LLM/OCR recommendation is written.

### 5.2 It1 Auth Foundation (Sep 28 to Oct 2)

| Owner | Work | Trace |
|---|---|---|
| Cole | Registration form with email validation, masked password, confirm check. Login form with generic failure states. | FR-ACC-01 to 04, 06, 07, 08 |
| Lukas | Register and login endpoints: validation, hashing, session token, generic errors. Input validation and auth checks on all new routes. | FR-ACC-01, 05, 07, 08, 09, NFR-SEC-03, 04 |
| Mick | Finalize users table (constraints, email index), confirm hash storage format | NFR-SEC-02 |
| Xander | Stand up the test framework and first unit tests (4 to 6h). It0 retrospective (2h). | NFR-QUA-01 |

### 5.3 It2 Sessions, Profile, Guest Handling (Oct 5 to Oct 9)

| Owner | Work | Trace |
|---|---|---|
| Lukas | Persistent sessions with secure cookie. Guest and expired-session handling. Profile update, password change, email change with verification. | FR-ACC-10, 12 to 17 |
| Mick | Extend users table. Add sessions and tokens table. | FR-ACC-10, 13, 14, 15 |
| Cole | Profile and settings page. Route guards. Inline validation errors. Responsive and screen-reader pass on It1 screens. | FR-ACC-12 to 14, 17, NFR-A11Y-03, NFR-CMP-01 |
| Xander | Unit tests for new requirements. It1 regression at kickoff. README update once the Python framework commands are confirmed. | NFR-QUA-01 |

### 5.4 It3 Groups, Events, Membership (Oct 12 to Oct 16)

| Owner | Work | Plan IDs | Hours |
|---|---|---|---|
| Xander | Decide who adds and removes members (OI-06) by Tuesday | It3-1 | 1 |
| Mick | groups, group_members, events, event_members tables and migrations | It3-2, 3 | 7 |
| Lukas | Create group, invite, accept and decline, add and remove member with balance check, create event | It3-4 to 7 | 25 |
| Cole | Create group screen, group settings, create event screen, pending invites on home page | It3-8 to 11 | 21 |
| Xander | Unit tests, It2 regression, user guide section, Figma style page and low-fidelity wireframes for the seven unbuilt screens | It3-12 to 15 | 15 |

**Trace:** FR-GRP-01 to 16.

### 5.5 It4 Manual Expenses, Splits, Balances (Oct 19 to Oct 23)

| Owner | Work | Plan IDs | Hours |
|---|---|---|---|
| Mick | expenses and expense_participants tables, split and balance amount columns, categories table | It4-1 to 3 | 13 |
| Lukas | Split calculator, POST /expenses with atomic balance update, GET /balances, GET group expenses | It4-4 to 7 | 27 |
| Cole | Add expense screen, split picker with live preview, Balances page | It4-8 to 10 | 24 |
| Xander | Split calculator tests, expense and balance route tests, settle OI-05, 07, 19, 20 by Monday, It3 regression, Figma high-fidelity screens and clickable prototype | It4-11 to 15 | 23 |

**Trace:** FR-EXP-01 to 05, FR-SPL-03, 04, 06, 07, 08, 10, 11, 12, NFR-SEC-07.

### 5.6 It5 Prototype Demo (Oct 26 to Oct 30)

| Owner | Work | Plan IDs | Hours |
|---|---|---|---|
| Mick | Demo seed script: 3 users, one roommate group, one event, 8 to 10 expenses across all three split methods | It5-1 | 4 |
| Lukas | Fix every bug from the It4 regression run | It5-2 | 8 |
| Cole | Consistency pass on built screens. Phone and laptop check of every demo screen. | It5-3, 4 | 10 |
| Xander | Demo script, full regression, demo-day checklist, Figma final pass and README link | It5-5, 6, 8 | 8 |
| All | Full dry run on Wednesday | It5-7 | 1 each |

### 5.7 It6 to It10 (Candidate Backlog)

These are planned allocations, not yet in JIRA. Each is refined at the close-out of the iteration before it.

| Iteration | Owner | Candidate work | Trace |
|---|---|---|---|
| It6 | Mick | Receipt and receipt item tables, persist extracted data | FR-EXP-15 |
| It6 | Lukas | Upload endpoint with type and size validation. Extraction service call and JSON output. Distinct upload and extraction failures. Edit and delete expense routes. | FR-EXP-10, 13, 14, 16, 17, 32, NFR-DAT-02 |
| It6 | Cole | Upload UI (camera, gallery, file explorer, status). UI fixes from demo feedback. | FR-EXP-10 to 12, 16, 17 |
| It6 | Xander | Receipt test set across lighting and formats. Tests with mocked LLM responses. Regression. | NFR-PER-02, NFR-QUA-01 |
| It7 | Mick | Settlements table. Receipt image deletion storage. | FR-SPL-16, FR-EXP-30 |
| It7 | Lukas | Save finalized expense and update balances. Settle debt full and partial. Receipt deletion. | FR-EXP-26, 30, 31, 33, FR-SPL-13 to 17 |
| It7 | Cole | Review-and-assign screen from Figma. Settle Up screen with wording that no money moves. | FR-EXP-20 to 25, FR-SPL-13 to 17 |
| It7 | Xander | Tests for review math and settlement. Test Documentation to date. Regression. | NFR-QUA-01, NFR-QUA-02 |
| It8 | Mick | Budget, category, and goal tables. Monthly metric queries. | FR-BUD-01 to 03, FR-ANL-02 |
| It8 | Lukas | Budgets and goal tracking with goal-edit rule. Analysis endpoints. Recurring expenses (SHOULD). | FR-BUD-01 to 06, FR-ANL-01, 02, 04, FR-EXP-06 |
| It8 | Cole | Budget screens and analysis page with category chart and empty state, from Figma. | FR-BUD, FR-ANL-01 to 05 |
| It8 | Xander | Budget and analysis tests. Regression. User Guide sections drafted. | NFR-QUA-01 |
| It9 | Mick | Admin role table, activity log table | FR-ADM-02, FR-SOC-01 |
| It9 | Lukas | Admin login, dashboard data, grant and revoke, block and log user-data access. Activity history. | FR-ADM-01 to 07, FR-SOC-01, NFR-SEC-07 |
| It9 | Cole | Admin screens, activity history screen, full UI polish pass. Notifications and COULD items only if capacity allows. | FR-ADM-03, FR-SOC-01, 02 |
| It9 | Xander | Tests for every blocked admin path. Regression. Stretch-goal go or no-go agreed with the team. | FR-ADM-05, 07 |
| It10 | Lukas | Security audit checklist and fixes. HTTPS deployment for the demo. | NFR-SEC-01 to 08 |
| It10 | Cole | ADA checklist and full screen-reader pass, with fixes | NFR-A11Y-01 to 04 |
| It10 | Mick | Load check with simultaneous users. Package source, database scripts, deployment resources. | NFR-PER-01, F2 |
| It10 | Xander | Full test pass and test report. User Guide complete. Team Effort Estimation final. Demo script and rehearsal. | NFR-QUA-01, 02, F1 |

### 5.8 Delivery (Dec 7)

Final presentation with a live demo of all core features, and source files submitted: code, styling, database, and every resource needed to deploy.

---

## 6. Dependencies

| Dependency | Needed by | Why |
|---|---|---|
| ERD and migrations (It0) | Every backend and frontend task | All records live in the schema |
| Auth and sessions (It1, It2) | Groups and every later feature | Every record belongs to an authenticated user |
| Groups and membership (It3) | Expenses (It4) | An expense belongs to a group or event |
| Split calculator and balances (It4) | Member removal check (It3-6 uses a stub until then), receipt save (It7), settle debt (It7), analysis (It8) | Everything downstream reads or writes balances |
| Figma high-fidelity prototype (It4) | Screen builds in It7 to It9 | Cole builds from the Figma designs |
| LLM/OCR selection (OI-03) | Extraction service (It6) | The service cannot be built without a chosen tool and API key |
| Extracted JSON schema (Cole, Lukas, Mick) | Persistence and review screen (It6, It7) | Storage and the review screen must agree on the shape |
| Definition of site-level data (OI-13) | Admin dashboard (It9) | Charter risk r3 |
| Feature freeze (end It9) | Hardening (It10) | No new code once audits begin |

**Handoff rules:** a migration merges before the endpoint that uses it. Backend and frontend agree on request and response shapes at kickoff, and the frontend builds against mocked responses until the endpoint lands. Features merge before the Friday close-out so the regression run covers them.

---

## 7. Resources and Budget

### 7.1 Budget

There is no cash budget. The budget is the team's hours per week. Person-hours per member are recorded in Team Effort Estimation (Deliverable 6). Planned hours from the Iteration Plan so far:

| Member | It3 | It4 | It5 |
|---|---|---|---|
| Mick | 7 | 13 | 5 |
| Lukas | 25 | 27 | 9 |
| Cole | 21 | 24 | 11 |
| Xander | 16 | 23 | 9 |
| **Total** | **69** | **87** | **34** |

It3 and It4 are the heaviest iterations. Xander carries the testing, documentation, and Figma work together, which is the main load risk. It9 runs at reduced capacity because of Thanksgiving.

### 7.2 Tools and Infrastructure

| Resource | Use |
|---|---|
| GitHub repository (LCMX-Inc.) | Source control, Charter, Requirements, README |
| JIRA | Backlog, iteration boards, requirement-tagged stories |
| Figma | Style guide, wireframes, clickable prototype |
| React, one CSS framework | Frontend |
| Python (FastAPI) | Backend |
| PostgreSQL | Persistent storage |
| unittest (PyUnit) | Automated testing |
| LLM with image reading, plus API key | Receipt extraction. Key kept outside source control. |
| HTTPS deployment target | Final demo and load check |
| Synthetic receipt set | Extraction and accuracy testing |

### 7.3 External Parties

| Party | Needed for |
|---|---|
| Commerce Bank (sponsor) | Progress reviews and the final demo. Charter Section 4.2 restated at every review. |
| Professor Jawad | Review and grading of the seven documents and final deliverables |

---

## 8. Quality Plan and Tracking

### 8.1 Cadence

- Standup at the start of each class: what moved, what is blocked, who is unblocking it.
- JIRA is updated as work moves, not batched at the end of the week.
- Friday close-out: demo what is done, run the full regression suite, move unfinished stories back to the backlog instead of silently rolling them over, and write the next iteration's candidate backlog.

### 8.2 Definition of Done

- Code merged to the shared branch.
- Automated test written and passing for the behavior in the requirement.
- Reviewed by at least one teammate other than the author.
- Runs from the README with no undocumented manual steps.

### 8.3 Quality Approach

Regression testing runs at every close-out, not only at hardening. Security and accessibility checks are verified as each feature ships. The formal audits in It10 confirm the whole system and are not where problems are first discovered.

### 8.4 Change Control

- A new requirement is added only by swapping out one of equal size.
- Changes are recorded in the Requirements Specification and in this plan at the next close-out.
- Fixed boundaries: no bank access, no real money movement, no budget enforcement, no admin access to individual user data. These are not schedule shortcuts.

---

## 9. Open Issue Decision Schedule

| Decision due | Open issues | Blocks |
|---|---|---|
| Done in It0 | OI-26 (test framework) | NFR-QUA-01 |
| End of It2 (Oct 9) | OI-01, OI-02, OI-23, OI-24 | FR-ACC-10, 11, 12. Confirm these are closed in the spec. |
| Tuesday of It3 (Oct 13) | OI-06 (scheduled as It3-1) | FR-GRP-08 |
| Start of It3 | OI-04, OI-08 | FR-GRP-01, 13. Not yet scheduled in the Iteration Plan. Confirm or defer. |
| Monday of It4 (Oct 19) | OI-05, OI-07, OI-19, OI-20 (scheduled as It4-13) | FR-GRP-11, 14, FR-SPL-09, FR-EXP-02 |
| Start of It6 (Nov 2) | OI-03, OI-17, OI-21 | FR-EXP-13, 30, 01 |
| Start of It7 (Nov 9) | OI-16, OI-18 | FR-EXP-22, FR-SPL-13 |
| Start of It8 (Nov 16) | OI-09, OI-10, OI-11, OI-12, OI-25, plus OI-13, OI-14, OI-15, OI-22 for the It9 admin build | FR-BUD-03, 04, 05, FR-ANL-01, 06, FR-ADM-01, 03, 04, FR-ACC-14 |

**Rule:** an open issue is decided before the first story that depends on it enters an iteration, and the decision is written into the Requirements Specification the same week.

---

## 10. Risks

Charter risks r1 to r7 apply unchanged. The risks below are specific to this schedule.

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| r8 | Iteration Plan dates run one to two weeks past the Charter dates for M3 to M8, and delivery is Dec 7 against Dec 2. | High | Confirm the real deadline now. Update the Charter or compress It8 to It10. |
| r9 | It9 holds the admin dashboard, activity history, and a full UI polish pass in a Thanksgiving week of reduced capacity, right before feature freeze. | High | Start admin schema work in It8 if capacity allows. Cut notifications and COULD items first. Agree the freeze scope on Nov 20. |
| r10 | Screen builds in It7 to It9 depend on the Figma prototype, and Xander carries Figma, tests, and documentation together. | Medium | Keep the It4 prototype scoped to the seven screens. If Figma slips, Cole builds from the wireframes and style page. |
| r11 | It10 holds every audit, the load check, the User Guide, and packaging in one week. | Medium | Verify security and accessibility incrementally. Draft the User Guide and Test Documentation from It3 on. |
| r12 | LLM tool and API key are not final until the It6 start. | Medium | Decide OI-03 by Nov 2. Keep manual entry as a full fallback. Prepare pre-extracted JSON for the demo receipts. |
| r13 | MUST requirements are not yet placed in any iteration (Section 4.1). | Medium | Place them at the next close-out. |
| r14 | One owner per component, so an absence stalls it. | Medium | Mandatory cross-review keeps a second person familiar with each component. |

---

## 11. Deliverables Schedule

| # | Deliverable | Target |
|---|---|---|
| 1 | Project Charter | v1.0 Sep 21 |
| 2 | Requirement Documents | v1.0 Sep 21 (use cases Sep 16) |
| 3 | Project Plan | v1.0 Oct 15 (this document). Revised at each milestone. |
| 4 | System Architecture | Drafted by M2 (Sep 25). Updated as decisions land. |
| 5 | Test Documentation | Test plan and cases grow every iteration. Report and issue log final in It10 (Dec 4). |
| 6 | Team Effort Estimation | Draft now. Final in It10. |
| 7 | User Guide | Sections written per iteration. Complete in It10. |
| F1 | Final Presentation | Dec 7 (Charter: Dec 2) |
| F2 | Source Files | Dec 7 (Charter: Dec 2) |

---

## 12. Approval

Signing below indicates agreement with the schedule, milestones, task ownership, and resource assumptions defined in this plan.

| Role | Signature | Date |
|---|---|---|
| Project Sponsor | | |
| Course Instructor | | |
| Team Representative | Xander McKie | 10/15/26 |
