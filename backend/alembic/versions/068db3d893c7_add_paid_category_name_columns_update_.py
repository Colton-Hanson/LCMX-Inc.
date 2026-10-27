"""Add paid, category, name columns; update balances table

Revision ID: 068db3d893c7
Revises: 5f237ae3e79f
"""

from alembic import op
import sqlalchemy as sa


revision = "068db3d893c7"
down_revision = "5f237ae3e79f"
branch_labels = None
depends_on = None


def upgrade():
    # Balances
    op.add_column(
        "balances",
        sa.Column("owed_party", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "balances",
        sa.Column("debt", sa.Numeric(10, 2), nullable=False),
    )
    op.create_foreign_key(
        "balances_owed_party_fkey",
        "balances", "users",
        ["owed_party"], ["id"],
    )
    op.create_check_constraint(
        "ck_balances_owed_party",
        "balances",
        "owed_party IS NULL OR owed_party IN (user_1_id, user_2_id)",
    )
    op.create_check_constraint(
        "ck_balances_debt_nonneg",
        "balances",
        "debt >= 0",
    )
    op.create_check_constraint(
        "ck_balances_user_order",
        "balances",
        "user_1_id < user_2_id",
    )

    # Events
    op.add_column(
        "events",
        sa.Column("paid", sa.Boolean(), server_default="false", nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("category", sa.String(20), nullable=True),
    )
    op.create_check_constraint(
        "ck_events_category",
        "events",
        "category IN ('food', 'rent', 'entertainment', 'other')",
    )

    # Expenses
    op.add_column(
        "expenses",
        sa.Column("name", sa.String(100), nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column("paid", sa.Boolean(), server_default="false", nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column("category", sa.String(20), nullable=True),
    )
    op.create_check_constraint(
        "ck_expenses_category",
        "expenses",
        "category IN ('food', 'rent', 'entertainment', 'other')",
    )
    op.drop_constraint(
        "expenses_group_id_fkey",
        "expenses",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "expenses_group_id_fkey",
        "expenses", "groups",
        ["group_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    # Expenses
    op.drop_constraint(
        "expenses_group_id_fkey",
        "expenses",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "expenses_group_id_fkey",
        "expenses", "groups",
        ["group_id"], ["id"],
    )
    op.drop_constraint(
        "ck_expenses_category",
        "expenses",
        type_="check",
    )
    op.drop_column("expenses", "category")
    op.drop_column("expenses", "paid")
    op.drop_column("expenses", "name")

    # Events
    op.drop_constraint(
        "ck_events_category",
        "events",
        type_="check",
    )
    op.drop_column("events", "category")
    op.drop_column("events", "paid")

    # Balances
    op.drop_constraint(
        "ck_balances_user_order",
        "balances",
        type_="check",
    )
    op.drop_constraint(
        "ck_balances_debt_nonneg",
        "balances",
        type_="check",
    )
    op.drop_constraint(
        "ck_balances_owed_party",
        "balances",
        type_="check",
    )
    op.drop_constraint(
        "balances_owed_party_fkey",
        "balances",
        type_="foreignkey",
    )
    op.drop_column("balances", "debt")
    op.drop_column("balances", "owed_party")