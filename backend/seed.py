"""
Populate an empty development database with Sprint 5 sample data.

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
from app.services.split_calculator import SplitCalculationError, _money, calculate_splits 
from models import Event, EventMember, Group, User, UserGroup, Expense, ExpenseSplit, Split

# Adds a given expense to the database while also creating and adding necessary even splits and expense_splits
# INPUT:
# - db: your database
# - member_ids: list of ids of members involved in the expense
# - new_expense: Expense object that you're adding
def new_expense_with_even_splits(db, member_ids, new_expense):
    # Add expense to database
    db.add(new_expense)
    db.flush()

    # Calculate the expense's splits
    calculated_splits = calculate_splits(new_expense.amount, member_ids)

    # For each split that results...
    for split_user_id, split_amount in calculated_splits["shares"].items():
        # Create new split object
        new_split = Split(
            user_id = split_user_id,
            amount = split_amount
        )

        # Add new split to database
        db.add(new_split)
        db.flush()

        # Add expense split to the database
        db.add(
            ExpenseSplit(
                expense_id= new_expense.id,
                split_id = new_split.id
            )
        )
        db.flush()

# Creates adds a given expense to the database while also creating and adding necessary percentage splits and expense_splits
# INPUT:
# - db: your database
# - members: dictionary where key = member id and value = percentage for that member (decimal value, e.g. 23.43(%))
# - new_expense: Expense object that you're adding
def new_expense_with_percentage_splits(db, members, new_expense):
    # Add expense to database
    db.add(new_expense)
    db.flush()

    # Calculate the expense's splits
    ids = list(members.keys())
    calculated_splits = calculate_splits(new_expense.amount, ids, method='percentage', values=members)

    # For each split that results...
    for split_user_id, split_amount in calculated_splits["shares"].items():
        # Create new split object
        new_split = Split(
            user_id = split_user_id,
            amount = split_amount
        )

        # Add new split to database
        db.add(new_split)
        db.flush()

        # Add expense split to the database
        db.add(
            ExpenseSplit(
                expense_id= new_expense.id,
                split_id = new_split.id
            )
        )
        db.flush()

# Creates adds a given expense to the database while also creating and adding necessary splits and expense_splits, with manually entered amounts
# INPUT:
# - db: your database
# - members: dictionary where key = member id and value = flat payment for that member (decimal value, e.g. ($)1.85)
# - new_expense: Expense object that you're adding
def new_expense_with_custom_splits(db, members, new_expense):
    # Add expense to database
    db.add(new_expense)
    db.flush()

    # Calculate the expense's splits
    ids = list(members.keys())
    calculated_splits = calculate_splits(new_expense.amount, ids, method='custom', values=members)

    # For each split that results...
    for split_user_id, split_amount in calculated_splits["shares"].items():
        # Create new split object
        new_split = Split(
            user_id = split_user_id,
            amount = split_amount
        )

        # Add new split to database
        db.add(new_split)
        db.flush()

        # Add expense split to the database
        db.add(
            ExpenseSplit(
                expense_id= new_expense.id,
                split_id = new_split.id
            )
        )
        db.flush()

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
            group_type="roommate",
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

        #### 8-10 expenses demonstrating all three split types
        ### Even splits

        ## 1st example
        new_expense = Expense(
            group_id = apartment.id,
            name = "New couch",
            paid_by = alice.id,    
            amount = 300.00,
            paid = False,
            category = 'other',
        )
        new_expense_with_even_splits(db, [alice.id, bob.id, carol.id], new_expense)

        ## 2nd example
        new_expense = Expense(
            group_id = lake.id,
            name = "Hotdogs",
            paid_by = bob.id,
            amount = 20.00,
            paid = False,
            category = 'food',
        )
        new_expense_with_even_splits(db, [bob.id, carol.id], new_expense)

        ## 3rd example
        new_expense = Expense(
            group_id = apartment.id,
            name = "rent",
            paid_by = alice.id,
            amount = 1820.00,
            paid = False,
            category = 'rent',
        )
        new_expense_with_even_splits(db, [alice.id, bob.id, carol.id], new_expense)

        ### Percentage splits
        ## 1st example
        new_expense = Expense(
            group_id = apartment.id,
            name = "Rent",
            paid_by = alice.id,    
            amount = 1743.43,
            paid = False,
            category = 'rent',
        )
        new_expense_with_percentage_splits(db, {alice.id : Decimal(60), bob.id : Decimal(20), carol.id : Decimal(20)}, new_expense)

        ## 2nd example
        new_expense = Expense(
            group_id = apartment.id,
            name = "Bob and Alice's new dog",
            paid_by = bob.id,    
            amount = 400.00,
            paid = False,
            category = 'other',
        )
        new_expense_with_percentage_splits(db, {alice.id : Decimal(70), bob.id : Decimal(30)}, new_expense)

        ## 3rd example
        new_expense = Expense(
            group_id = lake.id,
            name = "Carol accidentaly broke Alice's leg while tubing",
            paid_by = carol.id,    
            amount = 800.00,
            paid = False,
            category = 'other',
        )
        new_expense_with_percentage_splits(db, {alice.id : Decimal(10), bob.id : Decimal(10), carol.id : Decimal(80)}, new_expense)

        ### Custom splits
        ## 1st example
        new_expense = Expense(
            group_id = apartment.id,
            name = "Rent",
            paid_by = alice.id,    
            amount = 1800,
            paid = False,
            category = 'rent',
        )
        new_expense_with_custom_splits(db, {alice.id : Decimal(890), bob.id : Decimal(890), carol.id : Decimal(20)}, new_expense)

        ## 2nd example
        new_expense = Expense(
            group_id = apartment.id,
            name = "Times Four Gambling Game",
            paid_by = carol.id,    
            amount = 21,
            paid = False,
            category = 'other',
        )
        new_expense_with_custom_splits(db, {alice.id : Decimal(1), bob.id : Decimal(4), carol.id : Decimal(16)}, new_expense)

        ## 3rd example
        new_expense = Expense(
            group_id = lake.id,
            name = "Surprise gift to cheer Alice up after her leg got broken",
            paid_by = carol.id,    
            amount = 15,
            paid = False,
            category = 'other',
        )
        new_expense_with_custom_splits(db, {bob.id : Decimal(5), carol.id : Decimal(10)}, new_expense)


    print("Development seed completed.")
    print("Created 4 users, 2 groups, 8 memberships, 1 event, and 9 expenses.")
    print("No login sessions were created.")


if __name__ == "__main__":
    seed_database()