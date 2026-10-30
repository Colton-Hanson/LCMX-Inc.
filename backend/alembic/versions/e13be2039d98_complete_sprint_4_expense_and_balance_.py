
"""Complete Sprint 4 expense and balance schema.

Revision ID: e13be2039d98
Revises: 6e590a5f2830
"""

from alembic import op
import sqlalchemy as sa


revision = "e13be2039d98"
# Sprint 5 already revised 904c58c16b43, so this follows that revision.
down_revision = "6e590a5f2830"
branch_labels = None
depends_on = None


def upgrade():
    # Expenses: record total cost, payer, and creation date.
    op.add_column(
        "expenses",
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
    )
    op.add_column(
        "expenses",
        sa.Column("paid_by", sa.BigInteger(), nullable=False),
    )
    op.add_column(
        "expenses",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )

    op.create_foreign_key(
        "expenses_paid_by_fkey",
        "expenses",
        "users",
        ["paid_by"],
        ["id"],
    )

    op.create_check_constraint(
        "ck_expenses_amount_positive",
        "expenses",
        "amount > 0",
    )

    op.alter_column(
        "expenses",
        "name",
        existing_type=sa.String(100),
        nullable=False,
    )

    op.alter_column(
        "expenses",
        "paid",
        existing_type=sa.Boolean(),
        existing_server_default=sa.text("'false'"),
        nullable=False,
    )

    # Balances: track debts separately for each group.
    op.add_column(
        "balances",
        sa.Column("group_id", sa.BigInteger(), nullable=False),
    )

    op.create_foreign_key(
        "balances_group_id_fkey",
        "balances",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "balances_pkey",
        "balances",
        type_="primary",
    )

    op.create_primary_key(
        "balances_pkey",
        "balances",
        ["group_id", "user_1_id", "user_2_id"],
    )

    op.create_check_constraint(
        "ck_balances_debt_direction",
        "balances",
        "(debt = 0 AND indebted_party IS NULL) OR "
        "(debt > 0 AND indebted_party IS NOT NULL)",
    )


def downgrade():
    # Restore the original balance primary key.
    op.drop_constraint(
        "ck_balances_debt_direction",
        "balances",
        type_="check",
    )

    op.drop_constraint(
        "balances_pkey",
        "balances",
        type_="primary",
    )

    op.create_primary_key(
        "balances_pkey",
        "balances",
        ["user_1_id", "user_2_id"],
    )

    op.drop_constraint(
        "balances_group_id_fkey",
        "balances",
        type_="foreignkey",
    )

    op.drop_column("balances", "group_id")

    # Remove the additional expense fields.
    op.alter_column(
        "expenses",
        "paid",
        existing_type=sa.Boolean(),
        existing_server_default=sa.text("'false'"),
        nullable=True,
    )

    op.alter_column(
        "expenses",
        "name",
        existing_type=sa.String(100),
        nullable=True,
    )

    op.drop_constraint(
        "ck_expenses_amount_positive",
        "expenses",
        type_="check",
    )

    op.drop_constraint(
        "expenses_paid_by_fkey",
        "expenses",
        type_="foreignkey",
    )

    op.drop_column("expenses", "created_at")
    op.drop_column("expenses", "paid_by")
    op.drop_column("expenses", "amount")

