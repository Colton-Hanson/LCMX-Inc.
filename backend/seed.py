"""
Populate an empty development database with Sprint 3 sample data.

Run after:
    alembic upgrade head

Usage:
    python seed.py

Development use only. Do not run against production data.
"""

import os
from decimal import Decimal

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from models import Event, EventMember, Group, User, UserGroup


load_dotenv(".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured.")

from sqlalchemy.engine import make_url

database_name = make_url(DATABASE_URL).database

if database_name not in {
    "shared_expense_dev",
    "shared_expense_seed_test",
}:
    raise RuntimeError(
        f"Seeding is not allowed for database: {database_name}"
    )

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def seed_database():
    with SessionLocal.begin() as db:
        # Prevent accidentally inserting the sample accounts twice.
        sample_emails = [
            "alice@example.com",
            "bob@example.com",
            "carol@example.com",
            "dave@example.com",
        ]

        existing_users = (
            db.query(User)
            .filter(User.email.in_(sample_emails))
            .count()
        )

        if existing_users:
            raise RuntimeError(
                "Sample accounts already exist. "
                "Seed an empty development database instead."
            )

        # Development-only sample accounts.
        alice = User(
            email="alice@example.com",
            password_hash=hash_password("AlicePassword123!"),
            email_verified=True,
        )

        bob = User(
            email="bob@example.com",
            password_hash=hash_password("BobPassword123!"),
            email_verified=True,
            notify_new_expense=False,
            notify_settlement=False,
        )

        carol = User(
            email="carol@example.com",
            password_hash=hash_password("CarolPassword123!"),
        )

        dave = User(
            email="dave@example.com",
            password_hash=hash_password("DavePassword123!"),
        )

        db.add_all([alice, bob, carol, dave])
        db.flush()

        # Groups.
        apartment = Group(
            name="Apartment 4B",
            group_type="roommates",
            created_by=alice.id,
        )

        lake = Group(
            name="Lake Weekend",
            group_type="outing",
            created_by=bob.id,
        )

        db.add_all([apartment, lake])
        db.flush()

        # Memberships and invitation states.
        db.add_all([
            UserGroup(
                user_id=alice.id,
                group_id=apartment.id,
                is_admin=True,
                invite_status="accepted",
                split_percentage=Decimal("50.00"),
            ),
            UserGroup(
                user_id=bob.id,
                group_id=apartment.id,
                is_admin=False,
                invite_status="accepted",
                split_percentage=Decimal("30.00"),
            ),
            UserGroup(
                user_id=carol.id,
                group_id=apartment.id,
                is_admin=False,
                invite_status="accepted",
                split_percentage=Decimal("20.00"),
            ),
            UserGroup(
                user_id=dave.id,
                group_id=apartment.id,
                is_admin=False,
                invite_status="pending",
            ),
            UserGroup(
                user_id=bob.id,
                group_id=lake.id,
                is_admin=True,
                invite_status="accepted",
            ),
            UserGroup(
                user_id=alice.id,
                group_id=lake.id,
                is_admin=False,
                invite_status="accepted",
            ),
            UserGroup(
                user_id=carol.id,
                group_id=lake.id,
                is_admin=False,
                invite_status="accepted",
            ),
            UserGroup(
                user_id=dave.id,
                group_id=lake.id,
                is_admin=False,
                invite_status="declined",
            ),
        ])

        # Event involving a subset of the group's members.
        cabin = Event(
            group_id=lake.id,
            name="Lake Cabin",
        )

        db.add(cabin)
        db.flush()

        db.add_all([
            EventMember(event_id=cabin.id, user_id=bob.id),
            EventMember(event_id=cabin.id, user_id=carol.id),
        ])

    print("Development seed completed.")
    print("Created 4 users, 2 groups, 8 memberships, and 1 event.")
    print("No login sessions were created.")


if __name__ == "__main__":
    seed_database()