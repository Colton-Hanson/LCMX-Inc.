# Sprint 5 Backend — Team Handoff

**Branch:** `lukas-it5`  
**Commit:** `80d43c6`  
**Status:** Backend implementation complete; frontend integration pending.

## Implemented

| Area | Backend changes |
|---|---|
| Member removal | `DELETE /groups/{id}/members/{user_id}` now checks actual pairwise outstanding debt. Returns **409** with `detail: {message, balance, confirmation_required: true}` unless the admin retries with `?confirm=true`. Cole's warning/retry UI already supports this contract. |
| Group retrieval | New `GET /groups` and `GET /groups/{id}` return groups visible to accepted members, with embedded `members: [{id, name, email, is_admin}]`. `POST /groups` now returns the same enriched group shape. |
| Event retrieval | New `GET /groups/{id}/events` returns `[{id, group_id, name, member_ids}]` for accepted group members. |
| Display names | `GET /groups/{id}/members` now includes nullable `name` and `split_percentage` alongside existing fields; `GET /balances` includes `other_user_name` and `group_name` (on group entries). |
| Default splits | New `GET`/`PUT /groups/{id}/split-default` persist the group's shared setting in `user_groups.split_percentage`. Payload: `{"method":"percentage","percents":{"1":6000,"2":4000}}` (basis points, total **10,000**), or `{"method":"even","percents":{}}`. Percentages must cover exactly the accepted members. Accepting an invitation or removing a member resets the default to even. Any accepted member can edit it. |
| Balance details | `GET /balances` retains `group_balances`, `overall_balances`, and `total_net`, and adds expense breakdowns plus display names. Each expense includes `id`, `group_id`, `description`, `amount`, `paid_by`, `your_share`, `counterparty_share`, `signed_amount`, and `created_at`. Positive `signed_amount` means the other member owes you; negative means you owe them. Opposing debts are netted. |

**Authorization:** New read endpoints require authentication and accepted group membership. Existing access-control behavior is preserved. **No new tables or Alembic migrations** were required for these Sprint 5 changes.

## Frontend integration — Cole

- Replace browser-only group and event lists (`groupCache.js`, `eventCache.js`) with the new GET endpoints. Normalize group `group_type` → UI `type`, and embedded-member `id` → `user_id` where needed.
- Replace `splitDefault.js` localStorage as the source of truth with split-default GET/PUT calls in Group Settings and Add Expense. Refetch after membership changes; the backend resets defaults to even.
- Use names, group names, and signed expense breakdowns directly from `/balances` instead of rebuilding them through extra member/expense requests. Use email fallbacks when `name` is null.
- The member-removal 409 confirmation dialog already exists in the frontend; verify it end-to-end against this backend.

## Validation and remaining coordination

- **Backend regression:** `python -m pytest -q` → **139 passed**, 1 Starlette/httpx deprecation warning, on Lukas's local PostgreSQL setup. Targeted tests also passed. **Frontend end-to-end integration has not yet been verified.**
- **Mick:** Align `models.py` / `seed.py` group-type values with the singular API/migration values (`roommate`, `partner`); coordinate migration history rather than editing previously applied migrations.
- **Xander / team:** Test fresh-browser login → groups/events → saved splits → expenses/balances; check removed-member debt behavior. Confirm the product policy for former members seeing their unsettled debts.
- **Known follow-ups:** Concurrent expense creation vs member removal, concurrent default-split updates, and balance/detail snapshot consistency were flagged during read-only review; not reproduced by current tests. Address before final release as appropriate.

**Merge status:** Changes are committed on `lukas-it5`; merging into `main` and frontend integration should be coordinated with the team.
