"""Fix Sprint 7 item assignments and receipt lifecycle constraints.

Revision ID: 7f31b2e4c9a0
Revises: d890a95a86b8

Adds corrective changes without editing already-shared migrations.
"""
from alembic import op
import sqlalchemy as sa

revision = "7f31b2e4c9a0"
down_revision = "d890a95a86b8"
branch_labels = None
depends_on = None

OLD_STATUS_CHECK = "status IN ('uploaded', 'reading', 'read', 'failed')"
NEW_STATUS_CHECK = (
    "status IN ('uploaded', 'reading', 'read', 'failed', 'abandoned', 'confirmed')"
)


def upgrade():
    # Each item may have multiple assigned users, and each user may be assigned
    # multiple items. Only duplicate assignments of the *same pair* are banned.
    op.drop_constraint("item_assignments_user_id_key", "item_assignments", type_="unique")
    op.drop_constraint("item_assignments_receipt_item_id_key", "item_assignments", type_="unique")
    op.create_unique_constraint(
        "uq_item_assignments_item_user",
        "item_assignments",
        ["receipt_item_id", "user_id"],
    )

    # The earlier 'abandoned' migration was empty: update the actual DB check.
    op.drop_constraint("ck_receipts_status", "receipts", type_="check")
    op.create_check_constraint("ck_receipts_status", "receipts", NEW_STATUS_CHECK)

    # Keeping extracted data after deleting an image needs a nullable path.
    op.alter_column("receipts", "file_path", existing_type=sa.String(length=1024), nullable=True)


def downgrade():
    # Downgrade is intentionally strict: reject existing rows with null paths
    # or newer statuses rather than silently deleting or rewriting data.
    op.alter_column("receipts", "file_path", existing_type=sa.String(length=1024), nullable=False)
    op.drop_constraint("ck_receipts_status", "receipts", type_="check")
    op.create_check_constraint("ck_receipts_status", "receipts", OLD_STATUS_CHECK)
    op.drop_constraint("uq_item_assignments_item_user", "item_assignments", type_="unique")
    # Recreating legacy uniqueness may fail if corrected many-to-many data exists.
    op.create_unique_constraint("item_assignments_user_id_key", "item_assignments", ["user_id"])
    op.create_unique_constraint("item_assignments_receipt_item_id_key", "item_assignments", ["receipt_item_id"])
