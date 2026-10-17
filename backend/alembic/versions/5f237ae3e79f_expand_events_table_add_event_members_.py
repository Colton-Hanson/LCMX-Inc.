"""expand events table, add event_members table, add cascade for event_splits, user_groups, events

Revision ID: 5f237ae3e79f
Revises: 88cb10c1de67
Create Date: 2026-10-12 10:32:17.437492

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5f237ae3e79f'
down_revision = '88cb10c1de67'
branch_labels = None
depends_on = None


def upgrade():
    # Create the event_members table.
    op.create_table(
        "event_members",
        sa.Column("event_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("event_id", "user_id"),
    )

    # Add the event name column without disrupting existing events.
    op.add_column(
        "events",
        sa.Column("name", sa.String(100), nullable=True),
    )

    # Give previously created events a temporary name.
    op.execute("""
        UPDATE events
        SET name = 'Existing Event ' || id
        WHERE name IS NULL
    """)

    # Require a name for all events going forward.
    op.alter_column(
        "events",
        "name",
        nullable=False,
    )

    # Replace existing foreign keys with cascading versions.
    foreign_keys = [
        ("user_groups", "group_id", "groups", "user_groups_group_id_fkey"),
        ("events", "group_id", "groups", "events_group_id_fkey"),
        ("event_splits", "event_id", "events", "event_splits_event_id_fkey"),
        ("event_splits", "split_id", "splits", "event_splits_split_id_fkey"),
    ]

    for table, column, referenced_table, constraint_name in foreign_keys:
        op.drop_constraint(
            constraint_name,
            table,
            type_="foreignkey",
        )

        op.create_foreign_key(
            constraint_name,
            table,
            referenced_table,
            [column],
            ["id"],
            ondelete="CASCADE",
        )

def downgrade():
    foreign_keys = [
        ("user_groups", "group_id", "groups", "user_groups_group_id_fkey"),
        ("events", "group_id", "groups", "events_group_id_fkey"),
        ("event_splits", "event_id", "events", "event_splits_event_id_fkey"),
        ("event_splits", "split_id", "splits", "event_splits_split_id_fkey"),
    ]

    for table, column, referenced_table, constraint_name in foreign_keys:
        op.drop_constraint(
            constraint_name,
            table,
            type_="foreignkey",
        )

        op.create_foreign_key(
            constraint_name,
            table,
            referenced_table,
            [column],
            ["id"],
        )

    op.drop_column("events", "name")
    op.drop_table("event_members")