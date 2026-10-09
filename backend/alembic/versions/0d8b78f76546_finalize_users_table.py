"""finalize users table

Revision ID: 0d8b78f76546
Revises: 0001
Create Date: 2026-10-02 08:37:58.171055

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0d8b78f76546'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "users",
        "password",
        new_column_name="password_hash",
    )

    op.add_column(
        "users",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )



def downgrade():
    op.drop_column("users", "created_at")

    op.alter_column(
        "users",
        "password_hash",
        new_column_name="password",
    )