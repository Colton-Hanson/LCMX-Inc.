"""initial schema — from ERD draft (database_tables_expenses_app.txt)

Revision ID: 0001
Revises:
Create Date: 2026-10-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # --- Users and Groups ---
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password", sa.String(255), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "groups",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    )

    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_id", sa.BigInteger(), sa.ForeignKey("groups.id"), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "group_id"),
    )

    # --- Things associated with one group ---
    op.create_table(
        "events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("group_id", sa.BigInteger(), sa.ForeignKey("groups.id"), nullable=False),
    )

    op.create_table(
        "itemized_expenses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("group_id", sa.BigInteger(), sa.ForeignKey("groups.id"), nullable=False),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("group_id", sa.BigInteger(), sa.ForeignKey("groups.id"), nullable=False),
    )

    op.create_table(
        "budgets",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("group_id", sa.BigInteger(), sa.ForeignKey("groups.id"), nullable=False),
    )

    # --- Items (inferred placeholder — not in original draft, see models.py note) ---
    op.create_table(
        "items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    )

    # --- Splits ---
    op.create_table(
        "splits",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
    )

    op.create_table(
        "expense_splits",
        sa.Column("expense_id", sa.BigInteger(), sa.ForeignKey("expenses.id"), nullable=False),
        sa.Column("split_id", sa.BigInteger(), sa.ForeignKey("splits.id"), nullable=False),
        sa.PrimaryKeyConstraint("expense_id", "split_id"),
    )

    op.create_table(
        "item_splits",
        sa.Column("item_id", sa.BigInteger(), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("split_id", sa.BigInteger(), sa.ForeignKey("splits.id"), nullable=False),
        sa.PrimaryKeyConstraint("item_id", "split_id"),
    )

    op.create_table(
        "event_splits",
        sa.Column("event_id", sa.BigInteger(), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("split_id", sa.BigInteger(), sa.ForeignKey("splits.id"), nullable=False),
        sa.PrimaryKeyConstraint("event_id", "split_id"),
    )

    # --- Objects w/ multiple parts ---
    op.create_table(
        "item_and_expense",
        sa.Column("item_id", sa.BigInteger(), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("itemized_expense_id", sa.BigInteger(),
                  sa.ForeignKey("itemized_expenses.id"), nullable=False),
        sa.PrimaryKeyConstraint("item_id", "itemized_expense_id"),
    )

    op.create_table(
        "budget_items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("budget_id", sa.BigInteger(), sa.ForeignKey("budgets.id"), nullable=False),
    )

    op.create_table(
        "balances",
        sa.Column("user_1_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_2_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.PrimaryKeyConstraint("user_1_id", "user_2_id"),
    )

    # --- Audit Log ---
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("table_name", sa.Text(), nullable=False),
        sa.Column("record_id", sa.BigInteger(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("old_data", postgresql.JSONB(), nullable=True),
        sa.Column("new_data", postgresql.JSONB(), nullable=True),
        sa.Column("changed_by", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("changed_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("audit_log")
    op.drop_table("balances")
    op.drop_table("budget_items")
    op.drop_table("item_and_expense")
    op.drop_table("event_splits")
    op.drop_table("item_splits")
    op.drop_table("expense_splits")
    op.drop_table("splits")
    op.drop_table("items")
    op.drop_table("budgets")
    op.drop_table("expenses")
    op.drop_table("itemized_expenses")
    op.drop_table("events")
    op.drop_table("user_groups")
    op.drop_table("groups")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
