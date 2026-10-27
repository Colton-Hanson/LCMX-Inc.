"""Renamed 'owed_party' to 'indebted_party'

Revision ID: dba5e2147fad
Revises: 068db3d893c7
Create Date: 2026-10-25 10:08:15.311589

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dba5e2147fad'
down_revision = '068db3d893c7'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "balances",
        "owed_party",
        new_column_name="indebted_party",
    )

    op.drop_constraint(
        "ck_balances_owed_party",
        "balances",
        type_="check",
    )

    op.create_check_constraint(
        "ck_balances_indebted_party",
        "balances",
        "indebted_party IS NULL OR "
        "indebted_party IN (user_1_id, user_2_id)",
    )

def downgrade():
    op.drop_constraint(
        "ck_balances_indebted_party",
        "balances",
        type_="check",
    )

    op.alter_column(
        "balances",
        "indebted_party",
        new_column_name="owed_party",
    )

    op.create_check_constraint(
        "ck_balances_owed_party",
        "balances",
        "owed_party IS NULL OR "
        "owed_party IN (user_1_id, user_2_id)",
    )