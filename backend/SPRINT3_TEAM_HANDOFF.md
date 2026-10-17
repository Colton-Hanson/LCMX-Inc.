# Sprint 3 — Backend Team Handoff

## API endpoints

All endpoints require an authenticated session unless otherwise noted. Requests use JSON where a body is specified; authentication uses the existing session cookie.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/groups` | Create a group; creator becomes an accepted administrator |
| `POST` | `/groups/{group_id}/invitations` | Invite a registered user by email |
| `GET` | `/groups/invitations/pending` | Retrieve the signed-in user's pending invitations |
| `POST` | `/groups/{group_id}/invitations/accept` | Accept one's own pending invitation |
| `POST` | `/groups/{group_id}/invitations/decline` | Decline one's own pending invitation |
| `GET` | `/groups/{group_id}/members` | List accepted members |
| `DELETE` | `/groups/{group_id}/members/{user_id}` | Remove an accepted member (administrator only) |
| `POST` | `/events` | Create an event involving selected accepted group members |

**Permissions:** Any accepted member may invite others and create events. Only administrators may remove members. Pending and declined invitees do not have group-member privileges. The final accepted administrator cannot be removed.

## Cole — API integration

### Groups

`POST /groups`

```json
{"name": "Weekend Trip", "group_type": "outing"}
```

Returns `201` with `id`, `name`, `group_type`, and `created_by`. Valid `group_type` values: `roommate`, `partner`, `family`, `outing`. Blank names or unsupported types return `422`. The creator is automatically an accepted administrator.

### Invitations

`POST /groups/{group_id}/invitations`

```json
{"email": "friend@example.com"}
```

A registered user receives a **pending** group membership (`201`, response `status: "pending"`). An existing invitation or membership returns `409`, including a previously declined invitation. If the email is not registered, the response is `status: "registration_required"`; the backend logs the request **but sends no email and stores no pending invitation** for that address.

`GET /groups/invitations/pending` returns an array containing `group_id`, `group_name`, and `group_type` for each pending invitation. The invited user responds with `POST /groups/{group_id}/invitations/accept` or `/decline` (no request body). Only accepted memberships appear in the member list. Invitation by username is not implemented.

### Memberships

`GET /groups/{group_id}/members` returns accepted members, each with `user_id`, `email`, and `is_admin`.

`DELETE /groups/{group_id}/members/{user_id}` is administrator-only. Deleting a membership does not delete the user account. Removing the sole administrator returns `409`. A nonzero balance will also return `409` with `detail.confirmation_required: true`; the intended follow-up is `DELETE ...?confirm=true` after user confirmation. **Balance calculation is currently a Sprint 3 stub returning zero**, so the financial warning cannot yet represent actual debts.

### Events

`POST /events`

```json
{"name": "Friday Dinner", "group_id": 5, "member_ids": [12, 14]}
```

Returns `201` with `id`, `name`, `group_id`, and `member_ids`. A nonempty list of unique, accepted group-member IDs is required; the participants can be a subset of the group, and the creator does not need to be one of them. Invalid participants or duplicate IDs return `422`.

### Errors and integration notes

- `401`: no valid session; `403`: insufficient group permissions; `404`: missing group, accepted member, or pending invitation; `409`: duplicate invitation, sole-admin restriction, or balance-confirmation requirement; `422`: invalid input.
- Continue using the existing `/api` Vite proxy and cookie-authenticated request convention (`credentials: 'include'`).
- There is **no `GET /groups` or group-detail endpoint** in this Sprint 3 implementation. A dashboard showing all of a user's groups will need an additional backend endpoint.
- Pending and declined invitations must not be treated as active memberships.

## Mick — Database changes

Three Sprint 3 Alembic revisions are included under `backend/alembic/versions/`:

| Revision | Changes |
|---|---|
| `7ff4c9d68827` | Adds required `groups.name`, `group_type`, `created_by`, a group-type check constraint, and a creator foreign key |
| `88cb10c1de67` | Adds `user_groups.is_admin`, `invite_status`, and a status check constraint |
| `5f237ae3e79f` | Adds required `events.name`, the `event_members` table, and relevant cascading foreign keys |

**Legacy-data migrations:** Existing groups with members receive the name `Existing Group <id>`, type `outing`, and a creator selected from their members. Existing memberships become `accepted`; the member with the lowest ID becomes administrator. Existing events receive `Existing Event <id>` names. These rules preserve legacy data but assign placeholder metadata that can later be edited.

**Important considerations:**

- The three revisions were adapted from the corresponding migrations in `db_starter/alembic/versions/`. Keep the executable migration chain in `backend/alembic/versions/` synchronized; do not maintain conflicting definitions under the same revision IDs.
- `backend/models.py` now reflects the Sprint 3 fields and `EventMember` model. Unmigrated, unrelated draft fields from `db_starter/models.py` were intentionally not copied.
- A legacy group **without any membership** cannot be assigned a valid `created_by` by the backfill and will fail the required-field migration. Such groups need explicit handling if they exist in a teammate's database.
- Editing an Alembic revision does not reapply it to databases where it has already run; existing local data may need separate reconciliation.
- Group membership status is stored in `user_groups` (`pending`, `accepted`, `declined`). `UserGroup` has composite key `(user_id, group_id)`; `EventMember` has `(event_id, user_id)`.
- Removal currently deletes a membership record. Sprint 4 expense/balance logic must preserve the necessary financial history when someone leaves a group.

## Xander — Testing handoff

**Automated backend verification:** `python -m pytest -q` — **70 passing tests**, including:

- `tests/test_groups.py`: group creation, creator's administrator role, valid/invalid group types, unauthenticated requests.
- `tests/test_invitations.py`: pending invitation, duplicate `409`, accept/decline, outsider restrictions, pending-invite listing, unregistered email, non-admin accepted member inviting.
- `tests/test_memberships.py`: roster access, administrator-only removal, account preservation, sole-admin protection, missing members, and mocked nonzero-balance confirmation.
- `tests/test_events.py`: persistence, participant subsets, accepted-member permissions, rejection of empty/duplicate/outsider/pending participants, authentication, invalid event names.

**Migration verification:** All nine revisions applied on a fresh temporary PostgreSQL database. A separate database was populated at pre-Sprint 3 revision `91acb19563fb` with two users, one group, two memberships, and an event; upgrading to `5f237ae3e79f` preserved the records and applied the intended backfills. Required columns, check constraints, and cascading foreign keys were inspected.

**Useful additional QA**:

- Exercise the complete invitation lifecycle through HTTP with multiple authenticated accounts, including repeated responses and attempts from unauthorized users.
- Check declined-member access, removal and subsequent invitation behavior, multiple administrators, and nonexistent group IDs.
- Check email case handling and invalid addresses; test simultaneous duplicate invitations and database-error behavior.
- Verify that failed event submissions never persist an event or participant rows.
- When the frontend is integrated, validate session-cookie handling and actual UI error messages for `401`, `403`, `404`, `409`, and `422`.
- Use a dedicated test database for further integration testing where possible; the current automated suite uses development PostgreSQL with temporary-record cleanup.

## Current limitations

- Email-only registered-user invitations; unregistered email requests are logged but not emailed or persisted.
- A declined invitation remains recorded and blocks a new invitation until reinvitation behavior is implemented.
- Balance calculation returns `0.0`; financial confirmation behavior is tested with a mock rather than actual expense totals.
- No group-list/detail endpoint yet.
