# Project Charter
## Shared Expense Management Tool

“Collaborative finance for people who actually share their lives.”

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | September 21, 2026 |
| **Project Team** | Cole, Mick, Lukas, Xander |
| **Sponsor** | Commerce Bank |
| **Course & Instructor** | CS451R - Professor Jawad |
| **Term** | Fall 2026 |
| **Status** | Draft for Review |

## Overview

### 1.1 Vision

People who share a home, a trip, or a relationship already share money. What they do not share is a reliable record of it. Receipts get lost, one person quietly covers more than their share, and the correction happens weeks later in a text message that starts with “so about rent.” The Shared Expense Management Tool replaces that with a shared ledger both sides can see.

The product is a responsive web application that lets a group capture an expense in seconds, by photographing a receipt or entering it by hand, split it fairly, and watch the running balance between members. A large language model reads the receipt image, itemizes it, and returns a structured JSON that the user reviews and corrects before anything is saved. Layered on top of that ledger are personal and group budgets, goals, and a monthly analysis that tells the user something they did not already know: “Cole paid for 62% of these shared expenses this month, though your configured split is 50%,” or “You visited Starbucks 23 times this month, for an average of $195.50.”

The application observes and reports. It does not enforce. It never touches a real bank account and never moves real money; settling a debt means marking it settled inside the app. That boundary is deliberate and is treated as a fixed constant throughout this project.

### 1.2 Problem Statement

Existing tools force a choice. Personal budgeting apps model one user and treat shared costs as an afterthought. Bill-splitting apps handle the split but carry no budgeting, no categories, no analysis, and no receipt-level detail. Neither tells a household where its money actually went at the line-item level, and neither flags when the agreed split and the real split have drifted apart. This project addresses the gap in the middle.

### 1.3 Product Summary

The core data model runs in one direction:

> **Core Flow**
> Users -> Groups -> Expenses -> Splits -> Balances (-> Budgets -> AI Analysis)

A user registers and joins or creates a group typed by relationship (roommate, partner, family, group outing). Within a group, an event scopes an expense to a subset of members, because not every member is relevant to every tripp or dinner. Expenses attach to a group or event, split evenly, by custom amount, or by percentage, and roll up into a pairwise balance. Budgets and monthly analysis read from that same ledger.

## Objectives and Success Criteria

Each objective below is stated so that it can be judged true or false by the end of our project.

| ID | Objective | Success Criterion |
|---|---|---|
| Obj-1 | Deliver the working core ledger | A user can register, create a group, add an expense, split it, and see an accurate running balance with another member. End to end, in a deployed build. |
| Obj-2 | Receipt capture by LLM | The system accepts a jpeg, PDF, or a camera photo, returns itemized JSON (store, items, prices, date), and presents every field to the user for correction before save. |
| Obj-3 | Human review of all extracted data | No LLM extracted value is written to a balance without passing through an editable review screen. Unassigned items are flagged and excluded from the split until resolved. |
| Obj-4 | Budgets and goals | A user sets categories and monthly goals for a personal or group view; spending is tracked against each goal. The system reports overruns. It does not block spending or enforce rules. |
| Obj-5 | Monthly analysis and metrics | For any month with data, the system produces category charts plus at least two derived metrics of the kind shown in Section 1.1, and degrades to a clean empty state for new users. |
| Obj-6 | Security baseline | HTTPS, hashed passwords, input validation, auth tokens, authorization checks on every protected route, rate limiting, and secrets kept out of source control. The build passes the team’s security audit checklist. |
| Obj-7 | Usability on phone and PC | A first-time user understands what the site does in under three minutes. Layout, text, and touch targets adapt correctly on both a phone and a desktop browser. |
| Obj-8 | Accessibility | The application is navigable by screen reader, text is readable and aligned, and the build passes an ADA audit checklist. |
| Obj-9 | Privacy boundary for administrators | An administrator teaches site-level metrics only. Any attempt to reach an individual user’s data is blocked and logged. |
| Obj-10 | Test coverage and documentation | AAutomated unit tests (unittest / PyUnit) cover all site functionality, run repeatably, and are reported on. All seven required documents are complete. |

## Stakeholders

### 3.1 Project Team

| Member | Role | Primary Responsibilities |
|---|---|---|
| Cole | Frontend and LLM | UI development and LLM implementation |
| Mick | Database | Database setup and implementation |
| Xander | Testing and Documentation | All tests, documentation, group communication |
| Lukas | Backend | Backend development and implementation |

### 3.2 External Stakeholders

| Stakeholder | Interest | Engagement |
|---|---|---|
| Commerce Bank | Sponsoring organization | Sets the real world context, reviews progress, and receives final presentation and demo. |
| Course Instructor | Academic evaluator | Reviews and grades the seven required documents and final deliverables |
| Administrators (Commerce Bank Employees) | Site operation | Access a separate admin login and a site-level metrics dashboard. Explicitly cannot view individual user data. Can grant or revoke admin access for other employees. |
| Normal users (Commerce Bank Customers) | Primary end users | Access only their own account and the main application functionality. The product is designed around them. |
| Guest users | Unauthenticated visitors | Reach the login / register page only. Every internal URL redirects to login when no valid session exists. |

## Scope

### 4.1 In Scope

| Area | Included |
|---|---|
| Accounts and access | Register and log in, password hashing, persistent sessions via securely stored cookies with configurable expiration, profile and settings page, separate admin login, guest redirect behavior. |
| Groups and events | Create groups by type (roommate, partner, family, group outing); invite, add, and remove members; create events that scope expenses to a subset of members. |
| Expenses | Manual entry with title, amount, category, payer, and participants. Recurring payments for rent, utilities, and other monthly bills. |
| Receipt and bill upload | Upload form file explorer, photo gallery, or camera. Accepts PDF, JPEG, and camera images. LLM / OCR extraction into structured JSON, followed by a user review-and-assign screen. Receipt image deletion with extracted data retained. |
| Splits and balances | Even split, custom amount, percentage, and autosplit with rounding rules. Running pairwise balances and debt settlement recorded in the app. |
| Budgets | Personal and group categories with monthly goals tracked against actual spending. |
| Analysis | Monthly metrics, category charts, month and range selection, and optional simple advice. |
| Supporting features | Notifications, activity history, and comments and emoji reactions on expenses. |
| Quality | Security controls, responsive design, screen reader support, automated unit testing, and full documentation. |

### 4.2 Out of Scope

- No bank account access. The application does not connect to, read from, or authenticate against any financial institution.
- No real money movement. No payments, transfers, or card processing. “Settle up” records that a debt was cleared outside the app, and the interface must say so plainly.
- No enforcement of budgeting rules. The system reports against goals; users decide what to do about it.
- No content management system. WordPress and equivalents are prohibited.
- No native mobile application. Mobile support is delivered through responsive web design.
- No administrator access to individual user data under any circumstance.

### 4.3 Constraints

- PostgreSQL as the database; passwords stored hashed.
- Exactly one CSS framework; any additional framework or library otherwise permitted.
- The web application must be usable on both phone and PC.
- Automated unit testing with unittest (PyUnit)
- Fixed academic calendar. The delivery date does not move.

### 4.4 Assumptions

- The team has access to an LLM with image-reading capability for receipt parsing.
- A deployment target with HTTPS available for the final demo.
- Test data will be synthetic or anonymized. No live customer data is used.
- All four team members remain available throughout the term.

### 4.5 Stretch Goals

Pursued only after every in-scope objective in Section 2 is met. (At least 2)

- Web API for backend interactions.
- Self-hosted authentication for password reset.
- Formal ADA audit beyond the internal checklist.

## Deliverables

| # | Deliverable | Contents | Due |
|---|---|---|---|
| 1 | Project Charter | This document. Overview, objectives, stakeholders, scope, timeline. | Draft ASAP |
| 2 | Requirement Documents | Functional and non-functional specifications with traceability to use cases. | Draft ASAP |
| 3 | Project Plan | Timeline, milestones, tasks, dependencies, resources. | Draft ASAP |
| 4 | System Architecture | Diagram and explanation of components, data flow, and integration points. | Draft ASAP |
| 5 | Test Documentation | Test plan, test cases, and test report including issues and fixes. | Draft ASAP |
| 6 | Team Effort Estimation | Person-hours per member with roles and responsibilities. | Draft ASAP |
| 7 | User Guide | Installation, interface walkthrough, troubleshooting. | Draft ASAP |
| F1 | Final Presentation | Goals, process, outcomes, and a live demo covering all core features. | Last Week |
| F2 | Source Files | Source code, styling, database, and every resource needed to deploy. | Last Week |

## Timeline

| Milestone | Target Date | Phase | Exit Criteria |
|---|---|---|---|
| m1 | Sep 18 | Requirements baseline | 16 uses cases written and reviewed. Complete |
| m2 | Sep 25 | Planning Documents | Charter, requirements specifications and system architecture drafted. Repository and environments established. |
| m3 | Oct 2 | Foundation | PostgreSQL schema built. Register, login, password hashing, persistent sessions, guest redirect, and profile/settings working. Unit test harness running. |
| m4 | Oct 16 | Core ledger | Groups, events, member add/remove, manual expenses, all split methods, autosplit, and running balances working end to end. |
| m5 | Oct 30 | Receipt pipeline | Upload from file, gallery, and camera. LLM extraction to JSON. Review-and-assign screen. Error handling for failed upload and failed parse. Receipt deletion. |
| m6 | Nov 13 | Insight layer | Budget categories and goals, monthly analysis and charts, settle debt, activity history, notifications. Admin dashboard with the privacy boundary enforced. |
| m7 | Nov 27 | Hardening | Full test pass with report. Security audit and ADA audit checklists cleared. Load check for simultaneous users. User guide complete. Feature freeze. |
| m8 | Dec 2 | Delivery | Final presentation, live demo of all core features, and organized source files submitted at the start of the last week of the course. |

### 6.1 Critical Path

Authentication and the database schema (m3) gate everything. The core ledger (m4) gates both the receipt and review screen, which writes into it, and the analysis later, which reads from it. The receipt pipeline (m5) carries the most technical uncertainty.

## Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| r1 | LLM misreads receipts under poor lighting, unusual formats, or low resolution. | High | Every extracted field is editable before save. Build a test set of receipts across lighting conditions and formats. Manual entry always remains available as a fallback path. |
| r2 | Scope creep from optional features (comments, reactions, advice engine). | High | Objectives in Section 2 are the contract. Optional items are marked Could-have in the requirements specification and are cut first when the schedule slips.. |
| r3 | Admin privacy boundary is ambiguous.  Aggregate statistics may still expose user behavior. | High | Resolve in the requirements specification before building the admin dashboard. Define in writing what counts as site-level data, and log every blocked access attempt. |
| r4 | Unresolved open issues block implementation mid-sprint. | Medium | Tracked in use cases. Make decisions ASAP. |
| r5 | Accessibility and responsive work deferred to the end and then rushed. | Medium | Treated as an acceptance criteria on each feature rather than a phase. Screen-reader and mobile checks happen at every milestone, not only at m7. |
| r6 | Team availability drops during exam weeks. | Medium | Feature freeze at m7 leaves the final week for presentation and packaging only. No new code after freeze. |
| r7 | Sponsor expectations drift toward real bank integration. | Medium | Section 4.2 is restated in every sponsor review. The exclusion is a product boundary, not a schedule shortcut. |

## Approval

Signing below indicates agreement with the vision, objectives, scope boundaries, and timeline defined in this charter.

Course Instructor				Signature				Date



Team Representative				Signature				Date
Xander McKie              XWM             9/25/26
**Claude Sonnet 5 used to format this document for markdown on GitHub. No changes were made to the content by the model**
