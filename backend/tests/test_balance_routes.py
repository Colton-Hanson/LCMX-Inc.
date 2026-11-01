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
    if label == "bob":
        user.name = "Bob Example"
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
        assert body["group_balances"][0]["other_user_name"] == "Bob Example"
        assert body["overall_balances"][0]["other_user_name"] == "Bob Example"
    finally:
        app.dependency_overrides.clear()


def test_balances_include_signed_expense_breakdown(two_groups):
    db = two_groups["db"]
    alice = two_groups["alice"]
    bob = two_groups["bob"]
    group = two_groups["group_a"]

    create_expense_transaction(
        ExpenseCreate(
            group_id=group.id,
            description="Groceries",
            amount=Decimal("60.00"),
            paid_by=alice.id,
            participant_ids=[alice.id, bob.id],
            split_method="even",
        ),
        {alice.id: Decimal("30.00"), bob.id: Decimal("30.00")},
        db,
    )
    create_expense_transaction(
        ExpenseCreate(
            group_id=group.id,
            description="Utilities",
            amount=Decimal("40.00"),
            paid_by=bob.id,
            participant_ids=[alice.id, bob.id],
            split_method="even",
        ),
        {alice.id: Decimal("20.00"), bob.id: Decimal("20.00")},
        db,
    )

    app.dependency_overrides[get_current_user] = lambda: alice
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.get("/balances")
        assert response.status_code == 200
        body = response.json()
        group_row = body["group_balances"][0]
        assert group_row["group_name"] == "Group A"
        assert group_row["net_amount"] == "10.00"
        assert group_row["owed_to_you"] == "10.00"
        assert group_row["other_user_name"] == "Bob Example"
        assert {e["description"]: e["signed_amount"] for e in group_row["expenses"]} == {
            "Groceries": "30.00",
            "Utilities": "-20.00",
        }
        assert {e["description"]: e["your_share"] for e in group_row["expenses"]} == {
            "Groceries": "30.00",
            "Utilities": "20.00",
        }
        assert {e["description"]: e["counterparty_share"] for e in group_row["expenses"]} == {
            "Groceries": "30.00",
            "Utilities": None,
        }
        assert sum(
            (Decimal(e["signed_amount"]) for e in group_row["expenses"]),
            Decimal("0.00"),
        ) == Decimal(group_row["net_amount"])
        assert body["overall_balances"][0]["net_amount"] == "10.00"
        assert len(body["overall_balances"][0]["expenses"]) == 2
    finally:
        app.dependency_overrides.clear()


def test_balance_breakdown_excludes_unrelated_group(two_groups):
    db = two_groups["db"]
    alice = two_groups["alice"]
    bob = two_groups["bob"]
    charlie = two_groups["charlie"]
    group_a = two_groups["group_a"]
    group_b = two_groups["group_b"]

    create_expense_transaction(
        ExpenseCreate(
            group_id=group_a.id,
            description="Visible",
            amount=Decimal("20.00"),
            paid_by=alice.id,
            participant_ids=[alice.id, bob.id],
        ),
        {alice.id: Decimal("10.00"), bob.id: Decimal("10.00")},
        db,
    )
    create_expense_transaction(
        ExpenseCreate(
            group_id=group_b.id,
            description="Private",
            amount=Decimal("20.00"),
            paid_by=charlie.id,
            participant_ids=[alice.id, charlie.id],
        ),
        {alice.id: Decimal("10.00"), charlie.id: Decimal("10.00")},
        db,
    )

    app.dependency_overrides[get_current_user] = lambda: alice
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.get("/balances")
        assert response.status_code == 200
        body = response.json()
        assert len(body["group_balances"]) == 1
        assert [e["description"] for e in body["group_balances"][0]["expenses"]] == ["Visible"]
        assert [e["description"] for e in body["overall_balances"][0]["expenses"]] == ["Visible"]
    finally:
        app.dependency_overrides.clear()


def test_balance_your_share_differs_from_counterparty_share(two_groups):
    db = two_groups["db"]
    alice, bob, group = two_groups["alice"], two_groups["bob"], two_groups["group_a"]
    create_expense_transaction(
        ExpenseCreate(
            group_id=group.id, description="Unequal split", amount=Decimal("100.00"),
            paid_by=alice.id, participant_ids=[alice.id, bob.id], split_method="custom",
            split_values={alice.id: Decimal("70.00"), bob.id: Decimal("30.00")},
        ),
        {alice.id: Decimal("70.00"), bob.id: Decimal("30.00")}, db,
    )
    app.dependency_overrides[get_current_user] = lambda: alice
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.get("/balances")
        assert response.status_code == 200
        expense = response.json()["group_balances"][0]["expenses"][0]
        assert expense["your_share"] == "70.00"
        assert expense["counterparty_share"] == "30.00"
        assert expense["signed_amount"] == "30.00"
    finally:
        app.dependency_overrides.clear()
