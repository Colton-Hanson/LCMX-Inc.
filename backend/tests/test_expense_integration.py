
from decimal import Decimal
from unittest.mock import patch
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
from models import (
    Balance,
    Expense,
    ExpenseSplit,
    Group,
    Split,
    User,
    UserGroup,
)


TEST_DB_NAME = "shared_expense_sprint4_test"

# Always use the dedicated test database.
test_engine = create_engine(
    engine.url.set(database=TEST_DB_NAME)
)


@pytest.fixture
def data():
    # An outer transaction keeps test records isolated.
    connection = test_engine.connect()
    transaction = connection.begin()

    db = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    try:
        suffix = uuid4().hex

        alice = User(
            email=f"alice-{suffix}@example.com",
            password_hash="integration-test",
        )
        bob = User(
            email=f"bob-{suffix}@example.com",
            password_hash="integration-test",
        )
        charlie = User(
            email=f"charlie-{suffix}@example.com",
            password_hash="integration-test",
        )

        db.add_all([alice, bob, charlie])
        db.flush()

        group = Group(
            name="Integration Test Group",
            group_type="roommate",
            created_by=alice.id,
        )
        db.add(group)
        db.flush()

        for user in (alice, bob):
            db.add(
                UserGroup(
                    user_id=user.id,
                    group_id=group.id,
                    invite_status="accepted",
                )
            )

        db.flush()

        yield {
            "db": db,
            "alice": alice,
            "bob": bob,
            "charlie": charlie,
            "group": group,
        }

    finally:
        db.close()
        transaction.rollback()
        connection.close()


def make_expense(group_id, payer_id, participant_ids, amount="60.00"):
    return ExpenseCreate(
        group_id=group_id,
        description="Groceries",
        amount=Decimal(amount),
        paid_by=payer_id,
        participant_ids=participant_ids,
        split_method="even",
    )


def test_expense_and_splits_saved(data):
    db = data["db"]
    alice = data["alice"]
    bob = data["bob"]
    group = data["group"]

    expense_data = make_expense(
        group.id, alice.id, [alice.id, bob.id]
    )

    expense = create_expense_transaction(
        expense_data,
        {
            alice.id: Decimal("30.00"),
            bob.id: Decimal("30.00"),
        },
        db,
    )

    saved = db.get(Expense, expense.id)

    assert saved is not None
    assert saved.name == "Groceries"
    assert saved.amount == Decimal("60.00")
    assert saved.paid_by == alice.id

    splits = (
        db.query(Split)
        .join(ExpenseSplit, ExpenseSplit.split_id == Split.id)
        .filter(ExpenseSplit.expense_id == expense.id)
        .all()
    )

    assert {s.user_id: s.amount for s in splits} == {
        alice.id: Decimal("30.00"),
        bob.id: Decimal("30.00"),
    }

    balance = db.query(Balance).filter_by(group_id=group.id).one()

    assert balance.indebted_party == bob.id
    assert balance.debt == Decimal("30.00")


def test_opposite_debts_are_netted(data):
    db = data["db"]
    alice = data["alice"]
    bob = data["bob"]
    group = data["group"]

    # Alice pays $60. Bob owes Alice $30.
    create_expense_transaction(
        make_expense(group.id, alice.id, [alice.id, bob.id]),
        {
            alice.id: Decimal("30.00"),
            bob.id: Decimal("30.00"),
        },
        db,
    )

    # Bob pays $40. Alice now owes Bob $20.
    create_expense_transaction(
        make_expense(
            group.id, bob.id, [alice.id, bob.id], "40.00"
        ),
        {
            alice.id: Decimal("20.00"),
            bob.id: Decimal("20.00"),
        },
        db,
    )

    balance = db.query(Balance).filter_by(group_id=group.id).one()

    # Net result: Bob owes Alice $10.
    assert balance.indebted_party == bob.id
    assert balance.debt == Decimal("10.00")


def test_api_lists_expenses_and_balances(data):
    db = data["db"]
    alice = data["alice"]
    bob = data["bob"]
    group = data["group"]

    app.dependency_overrides[get_current_user] = lambda: alice
    app.dependency_overrides[get_db] = lambda: db

    try:
        with TestClient(app) as client:
            response = client.post(
                "/expenses",
                json={
                    "group_id": group.id,
                    "description": "Groceries",
                    "amount": "60.00",
                    "paid_by": alice.id,
                    "participant_ids": [alice.id, bob.id],
                    "split_method": "even",
                },
            )

            assert response.status_code == 201
            assert response.json()["amount"] == "60.00"

            expenses = client.get(
                f"/groups/{group.id}/expenses"
            )

            assert expenses.status_code == 200
            assert len(expenses.json()) == 1
            assert expenses.json()[0]["shares"] == {
                str(alice.id): "30.00",
                str(bob.id): "30.00",
            }

            balances = client.get("/balances")

            assert balances.status_code == 200
            assert balances.json()["total_net"] == "30.00"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def test_balances_are_group_specific(data):
    db = data["db"]
    alice = data["alice"]
    bob = data["bob"]
    group1 = data["group"]

    group2 = Group(
        name="Second Test Group",
        group_type="outing",
        created_by=alice.id,
    )
    db.add(group2)
    db.flush()

    for user in (alice, bob):
        db.add(
            UserGroup(
                group_id=group2.id,
                user_id=user.id,
                invite_status="accepted",
            )
        )
    db.flush()

    create_expense_transaction(
        make_expense(group1.id, alice.id, [alice.id, bob.id]),
        {alice.id: Decimal("30.00"), bob.id: Decimal("30.00")},
        db,
    )

    create_expense_transaction(
        make_expense(
            group2.id, bob.id, [alice.id, bob.id], "20.00"
        ),
        {alice.id: Decimal("10.00"), bob.id: Decimal("10.00")},
        db,
    )

    balances = db.query(Balance).all()

    assert len(balances) == 2

    by_group = {balance.group_id: balance for balance in balances}

    assert by_group[group1.id].indebted_party == bob.id
    assert by_group[group1.id].debt == Decimal("30.00")

    assert by_group[group2.id].indebted_party == alice.id
    assert by_group[group2.id].debt == Decimal("10.00")


def test_nonmember_cannot_view_group_expenses(data):
    db = data["db"]
    charlie = data["charlie"]
    group = data["group"]

    app.dependency_overrides[get_current_user] = lambda: charlie
    app.dependency_overrides[get_db] = lambda: db

    try:
        with TestClient(app) as client:
            response = client.get(
                f"/groups/{group.id}/expenses"
            )

            assert response.status_code == 403

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def test_failed_balance_update_rolls_back_expense(data):
    db = data["db"]
    alice = data["alice"]
    bob = data["bob"]
    group = data["group"]

    expense_data = make_expense(
        group.id, alice.id, [alice.id, bob.id]
    )

    with patch(
        "app.services.expense_persistence.update_balances",
        side_effect=RuntimeError("Simulated failure"),
    ):
        with pytest.raises(RuntimeError):
            create_expense_transaction(
                expense_data,
                {
                    alice.id: Decimal("30.00"),
                    bob.id: Decimal("30.00"),
                },
                db,
            )

    assert db.query(Expense).count() == 0
    assert db.query(ExpenseSplit).count() == 0
    assert db.query(Split).count() == 0
    assert db.query(Balance).count() == 0
