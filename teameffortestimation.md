# Team Effort Estimation: Shared Expense Management Tool

*CS451R Agile Software Engineering Capstone, Fall 2026 · Required document 6*

| Field | Entry |
|---|---|
| Project | Shared Expense Management Tool |
| Team | Colton "Cole" Hanson, Mick Leinbach, Lukas Viskovic, Xander McKie |
| Document owner | Xander McKie |
| Instructor | Prof. Jawad |
| Sponsor | Commerce Bank |
| Version and date | 1.0 Draft, October 30, 2026 |
| Status | Draft. Actual hours are added at each Friday close-out; final version in Iteration 10 (Dec 4). |

## Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | Oct 30, 2026 | Xander McKie | First version: roles, planned hours from the Iteration Plan, and estimates for the remaining iterations. |

---

## 1 Summary

The team expects to spend about **626 person-hours** on the project from Iteration 0 (Sep 23) to final delivery (Dec 7). About 296 of those hours fall in Iterations 0 to 5, which are finished or finishing, and about 330 in Iterations 6 to 10. Per person, that is roughly 99 to 194 hours over 11 weeks, or about 9 to 18 hours a week.

| Member | Role | Total hours (planned + estimated) | Average per week (11 weeks) |
|---|---|---|---|
| Lukas Viskovic | Backend lead | 194 | 17.6 |
| Colton "Cole" Hanson | Frontend and LLM lead | 183 | 16.6 |
| Xander McKie | Testing and documentation lead | 150 + document hours (see 3.3) | 13.6 + |
| Mick Leinbach | Database lead | 99 | 9.0 |
| **Team** | | **626** | **56.9** |

These numbers are plans, not a time sheet. Section 5 is where each person records actual hours as iterations close, and the final version of this document reports actual against planned.

## 2 Roles and responsibilities

| Member | Role | Responsibilities | Deliverables owned | Backup |
|---|---|---|---|---|
| Colton "Cole" Hanson | Frontend and LLM lead | React screens and the design system; responsive layout; route guards; the receipt upload, reading and review screens; the LLM receipt-reading service; the screen reader pass | Web client, LLM pipeline, ADA checklist fixes | Xander (UI fixes) |
| Mick Leinbach | Database lead | Schema and Alembic migrations; the demo seed; data rules (money columns, constraints); metric queries for analysis; server database, backups and the load check | Database, seed, F2 source package | Lukas |
| Lukas Viskovic | Backend lead | FastAPI routes; authentication and sessions; input validation; the split calculator and balances; settlements, budgets, admin; security checklist fixes; backend Docker image | API, security audit | Mick |
| Xander McKie | Testing and documentation lead | All seven required documents; test plan, regression runs and the test report; receipt accuracy set; JIRA board; README; Figma designs and HTML mockups; demo script; CI and the deploy runbook | Documents 1 to 7, test report, F1 presentation | Cole (document review) |

Shared by everyone: write the tests for your own code, review at least one teammate's pull request each iteration, keep JIRA current, attend the stand-up at the start of each class and the Friday close-out.

## 3 How the estimate was made

### 3.1 Method

1. **Planned (P):** hours the Iteration Plan put on each task. These exist for Xander's Iteration 0 and 1 tasks, Mick's ERD, and every task in Iterations 3 to 5.
2. **Estimated (E):** where the Iteration Plan gave no hours (most of Iterations 0 to 2) or has not been written yet (Iterations 6 to 10), hours are estimated from the task list in the Project Plan and the Sprints 6 to 10 close-out plan, using the Iteration 3 to 5 hours as the yardstick for similar work.
3. **Actual (A):** each person logs real hours in JIRA; Xander copies the totals into Section 5 at every close-out.

The unit is ideal hours of focused work. Meetings in class are not counted; the Friday close-out and the demo rehearsals are.

### 3.2 Assumptions

- Each person can give 10 to 25 hours in a normal week, less in exam weeks.
- Thanksgiving week (Iteration 9) has 3 working days, so its estimates are about half a normal week.
- Iteration 10 is hardening and documents, not new features.
- No one leaves the team (Charter assumption).

### 3.3 What is not in these numbers yet

Hours Xander spent on the Charter, Requirements Specification, Project Plan, System Architecture, the Figma and HTML mockups, and the demo script were outside the Iteration Plan's task hours. Xander will add them from his own log as a separate line in Section 5 so the documentation effort is visible.

## 4 Effort by iteration

P = planned in the Iteration Plan, E = estimated. Hours per person per iteration.

| Iteration | Dates | Cole | Mick | Lukas | Xander | Team | Basis |
|---|---|---|---|---|---|---|---|
| It0 Warm-up | Sep 23 to 25 | 6 | 10 | 6 | 6 | 28 | Xander P, Mick ERD P, rest E |
| It1 Auth foundation | Sep 28 to Oct 2 | 10 | 4 | 12 | 7 | 33 | Xander P (6 to 8 h), rest E |
| It2 Sessions, profile | Oct 5 to 9 | 14 | 5 | 18 | 8 | 45 | E |
| It3 Groups, events | Oct 12 to 16 | 21 | 7 | 25 | 16 | 69 | P |
| It4 Expenses, splits, balances | Oct 19 to 23 | 24 | 13 | 27 | 23 | 87 | P |
| It5 Prototype demo | Oct 26 to 30 | 11 | 5 | 9 | 9 | 34 | P |
| It6 Fix main, server, receipts | Nov 2 to 6 | 24 | 12 | 24 | 20 | 80 | E |
| It7 Review, assign, settle up | Nov 9 to 13 | 24 | 10 | 22 | 14 | 70 | E |
| It8 Budgets, analysis, activity | Nov 16 to 20 | 22 | 12 | 22 | 14 | 70 | E |
| It9 Admin (3 days) | Nov 23 to 25 | 10 | 6 | 12 | 8 | 36 | E |
| It10 Hardening | Nov 30 to Dec 4 | 14 | 12 | 14 | 22 | 62 | E |
| Final delivery | Dec 7 | 3 | 3 | 3 | 3 | 12 | E |
| **Total** | | **183** | **99** | **194** | **150** | **626** | |

```mermaid
xychart-beta
    title "Team hours per iteration (planned and estimated)"
    x-axis [It0, It1, It2, It3, It4, It5, It6, It7, It8, It9, It10, Final]
    y-axis "Person-hours" 0 --> 100
    bar [28, 33, 45, 69, 87, 34, 80, 70, 70, 36, 62, 12]
```

Iteration 4 was the heaviest week so far (87 hours). Iteration 6 is the heaviest week left (80 hours), because it carries the repair of `main`, the server setup and the start of the receipt feature together.

### 4.1 What the remaining hours buy

| Iteration | Cole | Mick | Lukas | Xander |
|---|---|---|---|---|
| It6 | LLM reading service; upload, reading and error screens; remove the browser group list | Fix the migration chain and `created_at`; receipt tables; seed that fills balances; server database and backups | `GET /groups`; lock down `GET /users`; real balance check on member removal; upload endpoints; backend Docker image | CI on every pull request; production compose file, Caddy and runbook; 15-receipt test set; mocked-LLM tests |
| It7 | Review-and-assign screen; Settle Up; edit and delete expense | Settlements; item assignments; optional event on expenses | Save reviewed receipts; edit and delete expense; settle up; picture deletion | Review math and settlement tests; Test Documentation update; User Guide sections |
| It8 | Budget screens; analysis page and chart; activity page | Budget tables; categories; metric queries; activity rows | Budget, analysis and activity endpoints | Budget, analysis, activity tests; security checklist pass |
| It9 | Admin pages; final pass on own screens | Admin role and log tables | Admin routes; rate limiting | Admin path tests; stretch go or no-go; this document |
| It10 | ADA checklist and screen reader pass | Load check; source package; fresh seed | Security audit and fixes | Full test report; User Guide; final presentation |

## 5 Actual hours log

Filled in at each Friday close-out from JIRA. Leave a cell blank until the number is real.

| Iteration | Member | Planned or estimated | Actual | Note |
|---|---|---|---|---|
| It3 | Cole | 21 | | |
| It3 | Mick | 7 | | |
| It3 | Lukas | 25 | | |
| It3 | Xander | 16 | | |
| It4 | Cole | 24 | | |
| It4 | Mick | 13 | | |
| It4 | Lukas | 27 | | |
| It4 | Xander | 23 | | |
| It5 | Cole | 11 | | |
| It5 | Mick | 5 | | |
| It5 | Lukas | 9 | | |
| It5 | Xander | 9 | | |
| Documents and design (all iterations) | Xander | not in plan | | Charter, Requirements, Plan, Architecture, mockups, demo script |

Iterations 0 to 2 and 6 to 10 are added the same way.

## 6 Risks to these estimates

| Risk | Effect | Response |
|---|---|---|
| Iteration 6 is the heaviest remaining week | Receipt work may slip into Iteration 7 | Fix `main` first on Monday; the server and receipts run in parallel; manual entry stays as the fallback |
| Xander carries tests, documents and design together | Documents fall behind | Cole reviews documents; tests are written by each feature owner, not only Xander |
| Exam weeks and Thanksgiving | Fewer hours than planned | Thanksgiving week holds only the admin feature; the cut order in the Project Plan removes COULD and SHOULD items first |
| Estimates for Iterations 6 to 10 are new | Real hours may differ | Re-estimate at every Friday close-out from the last two iterations' actuals |
