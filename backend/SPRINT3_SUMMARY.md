# Sprint 3 — Backend Development Summary

**Branch:** `lukas-it3`  

This is an AI-generated document intended primarily for documentation purposes. It is unlikely you'll need to read this, but who knows. 

## Overview

Sprint 3 introduced **shared-group membership and events** on top of the Sprint 1–2 authentication, session, and profile infrastructure. The backend now supports creating groups, inviting registered users, accepting or declining invitations, listing and removing members under appropriate permissions, and creating events involving selected members of a group.

The backend test suite finished with **70 passing tests**. The migrations were also exercised on both fresh and populated databases.

## 1. It3-4 — Group creation

**Endpoint:** `POST /groups`  
**Files:** `app/api/routes/groups.py`, `app/schemas/groups.py`

- Requires an authenticated user; unauthenticated requests return **401**.
- Accepts a `name` and a `group_type` (`roommate`, `partner`, `family`, `outing`).
- Trims whitespace from names and rejects blank names or invalid group types with **422**.
- Creates a `Group` row whose `created_by` references the authenticated user.
- Automatically creates a corresponding `UserGroup` membership for the creator with `is_admin=True` and `invite_status='accepted'`.
- Creates the group and administrator membership within the same database transaction.
- Returns **201** with the new group's ID, name, type, and creator.

**Example input:**

```json
{"name": "Weekend Trip", "group_type": "outing"}
```

## 2. It3-5 — Group invitations

**Files:** `app/api/routes/invitations.py`, `app/schemas/invitations.py`

| Endpoint | Purpose |
|---|---|
| `POST /groups/{group_id}/invitations` | Invite an existing user by email |
| `GET /groups/invitations/pending` | List current user's pending group invitations |
| `POST /groups/{group_id}/invitations/accept` | Accept one's own pending invitation |
| `POST /groups/{group_id}/invitations/decline` | Decline one's own pending invitation |

- **Any accepted group member may invite**, not just an administrator. This accommodates outings and trips where regular members bring friends.
- Inviting a registered user creates a `UserGroup` record with `invite_status='pending'` and `is_admin=False`.
- Only the invited user can accept or decline their invitation; accepted membership grants normal group access.
- Declines are retained as `declined` records but are **not active memberships**.
- An existing membership/invitation, including a declined one, results in **409 Conflict** on repeat invitation.
- Unknown email addresses result in a logged registration-invitation request and a `registration_required` API response; **no email is sent and no durable record is created** for that address.
- Username invitations were deferred. Invitation lookup currently uses email.

**Example invitation body:**

```json
{"email": "friend@example.com"}
```

## 3. It3-6 — Membership management

**Files:** `app/api/routes/memberships.py`, `app/schemas/memberships.py`

| Endpoint | Purpose |
|---|---|
| `GET /groups/{group_id}/members` | List accepted members of a group |
| `DELETE /groups/{group_id}/members/{user_id}` | Remove an accepted member |

- Only accepted members may view a group's accepted-member roster.
- **Only administrators may remove members**; ordinary accepted members cannot.
- Removal deletes the `UserGroup` relationship, **not the user's account**.
- Removal of a group's **sole accepted administrator** is blocked with **409**.
- The endpoint checks `get_member_balance(group_id, user_id)` before removal.
- Nonzero balances require explicit `?confirm=true` after a **409** warning; tests cover this through a patched balance function.
- **Sprint 4 limitation:** `get_member_balance()` currently returns `0.0` for everyone. Actual expense balances, historical debts, and their treatment after removal are future integration work.

**Example removal:**

```text
DELETE /groups/5/members/12
DELETE /groups/5/members/12?confirm=true
```

## 4. It3-7 — Event creation

**Endpoint:** `POST /events`  
**Files:** `app/api/routes/events.py`, `app/schemas/events.py`

- Only an accepted group member may create an event in that group.
- The event has a nonblank name, `group_id`, and a list of `member_ids`.
- Every selected participant must already have an **accepted** membership in the group.
- A subset of members is allowed; the event creator need not be included in that subset.
- An empty participant list, duplicate user IDs, an outsider, or a pending invitee causes **422**.
- Saves the event to `events` and its selected participants to `event_members` in one committed transaction.
- Successful creation returns **201** with the event and participant IDs.

**Example input:**

```json
{"name": "Dinner", "group_id": 5, "member_ids": [12, 14]}
```

## 5. Database and model integration

Updated `backend/models.py` to support the new group, invitation, and event structure:

| Model/table | Sprint 3 changes |
|---|---|
| `Group` / `groups` | `name`, `group_type`, `created_by`, allowed-type check, creator FK |
| `UserGroup` / `user_groups` | `is_admin`, `invite_status`, status check, group FK cascade |
| `Event` / `events` | Required `name`, group FK cascade |
| `EventMember` / `event_members` | New composite-key association between events and users |

Integrated and adapted the three Sprint 3 Alembic revisions from Mick's `db_starter` migration work into the executable `backend/alembic/versions/` chain:

1. `7ff4c9d68827`: expand `groups`; backfill existing group names/types and derive creators from existing group memberships.
2. `88cb10c1de67`: add invitation/admin fields; mark preexisting memberships accepted and assign an initial administrator to each existing group.
3. `5f237ae3e79f`: add event names and `event_members`; backfill legacy event names and change relevant foreign keys to cascade on deletion.

The backfills replaced an initial hardcoded assumption about a development user/group. **Legacy groups with no membership rows remain an unsupported migration edge case**: no valid creator can be inferred, and the required `created_by` constraint will cause that upgrade to fail.

The backend model changes deliberately do **not** introduce unrelated draft fields from `db_starter/models.py` that lack corresponding migrations.

## 6. Testing and verification

**Automated tests:**

| Test file | New tests | Key coverage |
|---|---:|---|
| `tests/test_groups.py` | 7 | Create/auth/type/admin membership |
| `tests/test_invitations.py` | 9 | Invite/duplicate/accept/decline/permissions/pending list |
| `tests/test_memberships.py` | 10 | Member listing/removal/admin restriction/balance confirmation |
| `tests/test_events.py` | 11 | Creation, subsets, permissions, participant validation |
| Earlier tests | 33 | Existing authentication and other backend functionality |
| **Full suite** | **70** | **All passing locally** |

Commands used:

```bash
python -m compileall -q app alembic/versions
python -m pytest -q
alembic current
```

**Migration verification:**

- Ran all nine migrations on a freshly created temporary PostgreSQL database; reached `5f237ae3e79f (head)` successfully.
- Inspected the required columns, status/type check constraints, and cascading foreign keys.
- Rebuilt the temporary database to pre-Sprint 3 revision `91acb19563fb`, inserted two users, a group, two memberships, and an event, then upgraded to head.
- Verified that the original records survived, both old memberships became accepted, an administrator was assigned, and group/event names were backfilled.
- Removed the temporary database after testing.
- Corrected a test-fixture cleanup issue involving deletion order, then removed the leftover synthetic accounts and groups; verified zero remained.

The automated tests used the local development database, **not a dedicated CI-managed test environment**.

## 7. Important choices and limitations

- Session-based authentication from earlier sprints is reused by all new endpoints.
- Accepted members can invite and create events; only admins can remove members.
- Invitations are email-only at this stage. No outbound emails are implemented.
- Declined invitations remain recorded; repeat invitations currently return `409`.
- A nonexistent user's email produces a log entry, not a persistent invitation awaiting registration.
- Real member balances and debt-preserving removal behavior are deferred to Sprint 4.
- Some legacy migration cases, including groups without any members, still need explicit handling.
- Additional frontend integration, test-database isolation, and concurrency/edge-case QA remain appropriate team follow-up work.

## 8. Handoff and Git status

All four assigned Sprint 3 backend tasks are **implemented and locally tested**. The working branch is `lukas-it3`; no GitHub push or merge is claimed by this document. Intended code/test/migration changes were staged, with `currentnotes.md` intentionally excluded.

For teammate-specific instructions, API integration expectations, and further QA recommendations, see **`SPRINT3_TEAM_HANDOFF.md`**. Mick should reconcile duplicate migration revisions in `db_starter` and `backend`; Xander should conduct broader integration QA; Cole should wire the frontend to the new API routes.
