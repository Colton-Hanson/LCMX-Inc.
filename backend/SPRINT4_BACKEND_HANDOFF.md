# Sprint 4 Backend Handoff

**Branch:** `lukas-it4`  

## What changed

- **`POST /expenses`** — Creates a group expense (HTTP 201), validates accepted group membership and split amounts, saves participant shares, and updates group balances in one database transaction.
- **`GET /groups/{group_id}/expenses`** — Lists that group's expenses newest-first, including each participant's share. Requires accepted group membership.
- **`GET /balances`** — Returns balances involving the signed-in user, broken down by group and netted across groups; positive `net_amount` means money owed to the user.
- Split methods: **even, custom amounts, and percentages**. Expense creation excludes the payer's own share from debt and nets opposing debts 

## Database / setup (Mick)

- SQLAlchemy models: `backend/models.py` (`Expense`, `Split`, `ExpenseSplit`, `Balance`).
- Migration chain ends at **`e13be2039d98`** and includes the updates to expenses, splits, and group-scoped balances. After pulling/merging, run from `backend/`:

  ```bash
  alembic upgrade head
  ```

- The migrations were verified on a fresh test database and applied locally. **Review migration changes before merging**, especially modifications to existing migration files.
- Seeded demo accounts should use the shared `hash_password()` helper from `app/core/security.py` (already used in `backend/seed.py`).

## Frontend integration (Cole)

- All three endpoints require an authenticated session.
- `POST /expenses` accepts `group_id`, `description` (max 100 characters), `amount`, `paid_by`, `participant_ids`, and optional `split_method` / `split_values`.
- The create response includes the expense ID, amount, payer, per-user `shares`, and rounding adjustment IDs. Amounts are returned as decimal strings.
- `GET /balances` returns `group_balances`, `overall_balances`, and `total_net`. 

## Testing / next steps

- Existing backend suite has **108 passing** currently. R
- Added `backend/tests/test_expense_integration.py` for persistence, debt netting, per-group isolation, endpoint access, and rollback. Run:

  ```bash
  python -m pytest -q
  ```

- **Still needed:** Team review, merge `lukas-it4` into `main`, apply migrations in each developer's local database, and hook up the frontend. 
