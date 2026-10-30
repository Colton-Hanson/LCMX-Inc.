from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import engine, get_db
from app.main import app
from app.schemas.expenses import ExpenseCreate
from app.services.expense_persistence import create_expense_transaction
from models import Group, User, UserGroup


client = TestClient(app)

# Balances are filtered in SQL, so this uses the dedicated test database.
test_engine = create_engine(
    engine.url.set(database="shared_expense_sprint4_test")
)


def add_user(db, suffix, label):
    user = User(
        email=f"{label}-{suffix}@example.com",
        password_hash="route-test",
    )
    db.add(user)
    db.flush()
    return user


def add_group(db, owner, name):
    group = Group(
        name=name,
        group_type="roommate",
        created_by=owner.id,
    )
    db.add(group)
    db.flush()
    return group


def accept(db, user, group):
    db.add(
        UserGroup(
            user_id=user.id,
            group_id=group.id,
            invite_status="accepted",
        )
    )
    db.flush()


@pytest.fixture
def two_groups():
    # An outer transaction rolls the rows back when the test ends.
    connection = test_engine.connect()
    transaction = connection.begin()
    db = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    try:
        suffix = uuid4().hex
        alice = add_user(db, suffix, "alice")
        bob = add_user(db, suffix, "bob")
        charlie = add_user(db, suffix, "charlie")

        # Alice belongs to the first group only.
        group_a = add_group(db, alice, "Group A")
        accept(db, alice, group_a)
        accept(db, bob, group_a)

        # The second group has its own members. Alice is not one of them.
        group_b = add_group(db, charlie, "Group B")
        accept(db, charlie, group_b)
        accept(db, bob, group_b)

        yield {
            "db": db,
            "alice": alice,
            "bob": bob,
            "charlie": charlie,
            "group_a": group_a,
            "group_b": group_b,
        }
    finally:
        db.close()
        transaction.rollback()
        connection.close()


def test_get_balances_requires_authentication():
    # The balance list is private, so a signed-out request is refused.
    response = client.get("/balances")

    assert response.status_code == 401


def test_user_cannot_see_another_groups_balances(two_groups):
    # Arrange: Alice is paid back in her group, and also named on a
    # balance in a group she never joined.
    db = two_groups["db"]
    alice = two_groups["alice"]
    bob = two_groups["bob"]
    charlie = two_groups["charlie"]
    group_a = two_groups["group_a"]
    group_b = two_groups["group_b"]

    create_expense_transaction(
        ExpenseCreate(
            group_id=group_a.id,
            description="Groceries",
            amount=Decimal("60.00"),
            paid_by=alice.id,
            participant_ids=[alice.id, bob.id],
            split_method="even",
        ),
        {alice.id: Decimal("30.00"), bob.id: Decimal("30.00")},
        db,
    )

    # This row names Alice, but she is not an accepted member of group B.
    # Dropping the group filter would leak it onto her balance page.
    create_expense_transaction(
        ExpenseCreate(
            group_id=group_b.id,
            description="Dinner",
            amount=Decimal("20.00"),
            paid_by=charlie.id,
            participant_ids=[alice.id, charlie.id],
            split_method="even",
        ),
        {alice.id: Decimal("10.00"), charlie.id: Decimal("10.00")},
        db,
    )

    app.dependency_overrides[get_current_user] = lambda: alice
    app.dependency_overrides[get_db] = lambda: db

    try:
        # Act: Alice asks for every balance the app will show her.
        response = client.get("/balances")

        # Assert: only group A comes back, with Bob's share of the groceries.
        assert response.status_code == 200
        body = response.json()
        group_ids = [row["group_id"] for row in body["group_balances"]]

        assert group_ids == [group_a.id]
        assert group_b.id not in group_ids
        assert body["total_net"] == "30.00"
        assert body["group_balances"][0]["other_user_id"] == bob.id
    finally:
        app.dependency_overrides.clear()
