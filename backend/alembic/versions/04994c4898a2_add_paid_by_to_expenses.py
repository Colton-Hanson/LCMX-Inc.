"""add paid_by to expenses

Revision ID: 04994c4898a2
Revises: e13be2039d98
Create Date: 2026-10-29 11:02:10.352825

Sprint 4 revision e13be2039d98 already added amount and paid_by.
This revision stays in history so there is one Alembic head, and it
does not add those columns again.
"""

# revision identifiers, used by Alembic.
revision = "04994c4898a2"
down_revision = "e13be2039d98"
branch_labels = None
depends_on = None


def upgrade():
    # Sprint 4 already added amount, paid_by, and the payer foreign key.
    pass


def downgrade():
    # Nothing to undo. Dropping the columns would remove the sprint 4 schema.
    pass
