# Database Setup — Shared Expense Management Tool

## What's in this folder
- `models.py` — SQLAlchemy models (the shared schema definition; Backend Dev imports this)
- `alembic/` — migration files that build the schema in Postgres
- `alembic.ini` — Alembic config, including the connection string
- `seed.py` — inserts sample users + one sample group for testing

This schema follows the ERD draft in `database_tables_expenses_app.txt`:
users, groups, user_groups, events, itemized_expenses, expenses, budgets,
items, splits, expense_splits, item_splits, event_splits, item_and_expense,
budget_items, balances, audit_log.

### Open gaps in the ERD (resolve with the team before this is final)
1. **`items` table** — referenced by `item_splits` and `item_and_expense`
   but never defined in the draft. A placeholder with just an `id` column
   is included so migrations run; needs real columns.
2. **`splits` / `expense_splits`** — no amount or portion column anywhere,
   so there's currently no way to record how much of an expense each
   person owes.
3. **`balances`** — composite key of the two user IDs only, no amount
   column, so it can't store an actual balance.

## Prerequisites
- PostgreSQL installed and running locally (or via Docker)
- Python 3.10+
- `pip install sqlalchemy psycopg2-binary alembic`

## Steps to reproduce this database from scratch

1. Create the database:
   ```bash
   createdb shared_expense_dev
   ```

2. Confirm `alembic.ini`'s `sqlalchemy.url` matches your local Postgres
   username/password. Default assumes user `postgres`, password `postgres`,
   on `localhost:5433`.

3. Apply the migration:
   ```bash
   alembic upgrade head
   ```
   This creates the `users`, `groups`, and `group_members` tables.

4. Load sample data:
   ```bash
   python seed.py
   ```

5. Verify (optional):
   ```bash
   psql -U postgres shared_expense_dev -c "SELECT * FROM users;"
   ```

## Connection details for Backend Dev
```
Host:     localhost
Port:     5433
Database: shared_expense_dev
User:     postgres        (adjust to your local setup)
Password: splittinIt         (adjust to your local setup)
```
SQLAlchemy connection string format:
```
postgresql://<user>:<password>@<host>:<port>/<database>
```

## IMPORTANT NOTE FROM MICK
# Everything in these files says the port should be 5433, but it's very likely that, for your device, postgres is listening on 5432. You will likely have to update the port number in seed.py and alembic.ini.

## If you change the schema later
1. Edit `models.py`
2. Run: `alembic revision --autogenerate -m "describe the change"`
3. Review the generated file in `alembic/versions/` before applying
4. Run: `alembic upgrade head`
5. Commit both the model change and the new migration file together
## If it's saying you got the password wrong for no reason, try adding "-U postgres" after the initial command

## Known gaps / TODO
- Password column length is a placeholder (255 chars) — confirm against
  whatever hashing library Lukas uses and adjust if needed.
- See "Open gaps in the ERD" above — `items`, split amounts, and balance
  amounts all need team input before this schema is final.
