"""PostgreSQL integration tests for receipt confirmation and financial effects."""

from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import engine, get_db
from app.main import app
from models import (
    Balance, Expense, ExpenseSplit, Group, Item, ItemAssignment,
    Receipt, Receipt_Item, Split, User, UserGroup,
)

# Same isolated database used by the existing expense integration tests.
test_engine = create_engine(engine.url.set(database="shared_expense_sprint4_test"))


@pytest.fixture
def scenario():
    connection = test_engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        suffix = uuid4().hex
        alice = User(email=f"confirm-a-{suffix}@example.com", password_hash="test")
        bob = User(email=f"confirm-b-{suffix}@example.com", password_hash="test")
        outsider = User(email=f"confirm-o-{suffix}@example.com", password_hash="test")
        db.add_all([alice, bob, outsider])
        db.flush()
        group = Group(name="Receipt Group", group_type="roommate", created_by=alice.id)
        db.add(group)
        db.flush()
        db.add_all([
            UserGroup(user_id=alice.id, group_id=group.id, invite_status="accepted"),
            UserGroup(user_id=bob.id, group_id=group.id, invite_status="accepted"),
        ])
        receipt = Receipt(
            group_id=group.id, uploader=alice.id, status="read", expense_id=None,
            file_path="/tmp/receipt-confirm-test.jpg", file_type="jpg", size=100,
        )
        db.add(receipt)
        db.flush()
        pizza = Item(name="Pizza", quantity=1, unit_price=Decimal("12.00"),
                     line_total=Decimal("12.00"), position=0)
        soda = Item(name="Soda", quantity=1, unit_price=Decimal("6.00"),
                    line_total=Decimal("6.00"), position=1)
        db.add_all([pizza, soda]); db.flush()
        db.add_all([Receipt_Item(receipt_id=receipt.id, item_id=pizza.id),
                    Receipt_Item(receipt_id=receipt.id, item_id=soda.id)])
        db.flush()
        db.commit()  # Keep fixture rows when the endpoint deliberately rolls back.
        yield {"db": db, "alice": alice, "bob": bob, "outsider": outsider,
               "group": group, "receipt": receipt, "pizza": pizza, "soda": soda}
    finally:
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def send(data, assignments=None, *, actor="alice", other=None):
    app.dependency_overrides[get_current_user] = lambda: data[actor]
    app.dependency_overrides[get_db] = lambda: data["db"]
    alice, bob = data["alice"], data["bob"]
    payload = {
        "paid_by": alice.id, "description": "Groceries",
        "assignments": assignments if assignments is not None else [
            {"item_id": data["pizza"].id, "shares": [
                {"user_id": alice.id, "amount": "6.00"},
                {"user_id": bob.id, "amount": "6.00"},
            ]},
            {"item_id": data["soda"].id, "shares": [
                {"user_id": bob.id, "amount": "6.00"},
            ]},
        ],
    }
    payload.update(other or {})
    with TestClient(app) as client:
        return client.post(f"/receipts/{data['receipt'].id}/confirm", json=payload)


def test_confirmation_persists_everything_atomically(scenario):
    response = send(scenario)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == "18.00"
    assert body["shares"] == {str(scenario["alice"].id): "6.00",
                              str(scenario["bob"].id): "12.00"}
    assert body["excluded_item_ids"] == []
    db = scenario["db"]
    receipt = db.get(Receipt, scenario["receipt"].id)
    assert receipt.status == "confirmed"
    assert receipt.expense_id == body["expense_id"]
    assert receipt.file_path == "/tmp/receipt-confirm-test.jpg"
    assert db.query(ItemAssignment).filter_by(receipt_item_id=scenario["pizza"].id).count() == 2
    assert db.query(ExpenseSplit).filter_by(expense_id=body["expense_id"]).count() == 2
    balance = db.query(Balance).filter_by(group_id=scenario["group"].id).one()
    assert balance.indebted_party == scenario["bob"].id
    assert balance.debt == Decimal("12.00")


def test_unassigned_item_is_excluded(scenario):
    response = send(scenario, assignments=[
        {"item_id": scenario["pizza"].id, "shares": [
            {"user_id": scenario["bob"].id, "amount": "12.00"}
        ]}
    ])
    assert response.status_code == 201, response.text
    assert response.json()["amount"] == "12.00"
    assert response.json()["excluded_item_ids"] == [scenario["soda"].id]
    assert scenario["db"].query(ItemAssignment).filter_by(receipt_item_id=scenario["soda"].id).count() == 0


@pytest.mark.parametrize("case", ["under", "over", "duplicate_user", "duplicate_item", "not_member", "foreign_item", "invalid_event"])
def test_invalid_assignments_do_not_create_expenses(scenario, case):
    alice, bob = scenario["alice"], scenario["bob"]
    item = scenario["pizza"].id
    shares = [{"user_id": bob.id, "amount": "11.00" if case == "under" else "13.00" if case == "over" else "12.00"}]
    if case == "duplicate_user":
        shares = [{"user_id": bob.id, "amount": "6.00"}, {"user_id": bob.id, "amount": "6.00"}]
    if case == "not_member":
        shares = [{"user_id": scenario["outsider"].id, "amount": "12.00"}]
    assignments = [{"item_id": item, "shares": shares}]
    if case == "duplicate_item":
        assignments *= 2
    if case == "foreign_item":
        assignments = [{"item_id": 999999999, "shares": shares}]
    other = {"event_id": 999999999} if case == "invalid_event" else None
    response = send(scenario, assignments=assignments, other=other)
    assert response.status_code == 422, response.text
    assert scenario["db"].query(Expense).filter_by(group_id=scenario["group"].id).count() == 0
    assert scenario["receipt"].expense_id is None


def test_double_confirmation_conflicts(scenario):
    assert send(scenario).status_code == 201
    assert send(scenario).status_code == 409
    assert scenario["db"].query(Expense).filter_by(group_id=scenario["group"].id).count() == 1


def test_nonmember_cannot_confirm(scenario):
    assert send(scenario, actor="outsider").status_code == 403


def add_member_and_ten_dollar_item(scenario, email_prefix):
    """Add an accepted member and a $10.00 line to the fixture receipt."""
    db = scenario["db"]
    member = User(email=f"{email_prefix}-{uuid4().hex}@example.com", password_hash="test")
    db.add(member)
    db.flush()
    db.add(UserGroup(
        user_id=member.id, group_id=scenario["group"].id, invite_status="accepted",
    ))
    bread = Item(
        name="Bread", quantity=1, unit_price=Decimal("10.00"),
        line_total=Decimal("10.00"), position=2,
    )
    db.add(bread)
    db.flush()
    db.add(Receipt_Item(receipt_id=scenario["receipt"].id, item_id=bread.id))
    # Commit before the request so a rejected confirm does not drop the fixture.
    db.commit()
    return member, bread


def balances_touching(db, group_id, user_id):
    return db.query(Balance).filter(
        Balance.group_id == group_id,
        or_(Balance.user_1_id == user_id, Balance.user_2_id == user_id),
    ).all()


def test_ten_dollar_line_shared_by_two_of_three_leaves_the_third_unchanged(scenario):
    """Hand-worked: $10.00 shared by Alice and Bob. Casey is in the group and not on the line."""
    casey, bread = add_member_and_ten_dollar_item(scenario, "confirm-c")
    alice, bob = scenario["alice"], scenario["bob"]
    response = send(scenario, assignments=[
        {"item_id": bread.id, "shares": [
            {"user_id": alice.id, "amount": "5.00"},
            {"user_id": bob.id, "amount": "5.00"},
        ]},
    ])
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == "10.00"
    assert scenario["pizza"].id in body["excluded_item_ids"]
    assert scenario["soda"].id in body["excluded_item_ids"]
    db = scenario["db"]
    pair = db.get(Balance, (
        scenario["group"].id, min(alice.id, bob.id), max(alice.id, bob.id),
    ))
    assert pair.indebted_party == bob.id
    assert pair.debt == Decimal("5.00")
    assert balances_touching(db, scenario["group"].id, casey.id) == []


def test_ten_dollars_across_three_people_accepts_the_extra_cent(scenario):
    """Hand-worked: $10.00 is 3.34 + 3.33 + 3.33. The extra cent is assigned and the sum is exact."""
    casey, bread = add_member_and_ten_dollar_item(scenario, "confirm-cent")
    alice, bob = scenario["alice"], scenario["bob"]
    response = send(scenario, assignments=[
        {"item_id": bread.id, "shares": [
            {"user_id": alice.id, "amount": "3.34"},
            {"user_id": bob.id, "amount": "3.33"},
            {"user_id": casey.id, "amount": "3.33"},
        ]},
    ])
    assert response.status_code == 201, response.text
    assert response.json()["amount"] == "10.00"
    db = scenario["db"]
    bob_balance = db.get(Balance, (
        scenario["group"].id, min(alice.id, bob.id), max(alice.id, bob.id),
    ))
    casey_balance = db.get(Balance, (
        scenario["group"].id, min(alice.id, casey.id), max(alice.id, casey.id),
    ))
    assert bob_balance.debt == Decimal("3.33")
    assert bob_balance.indebted_party == bob.id
    assert casey_balance.debt == Decimal("3.33")
    assert casey_balance.indebted_party == casey.id


def test_shares_short_one_cent_are_rejected_and_save_nothing(scenario):
    """3.33 three times is $9.99, not $10.00. Confirm writes no expense and no balance."""
    casey, bread = add_member_and_ten_dollar_item(scenario, "confirm-short")
    alice, bob = scenario["alice"], scenario["bob"]
    response = send(scenario, assignments=[
        {"item_id": bread.id, "shares": [
            {"user_id": alice.id, "amount": "3.33"},
            {"user_id": bob.id, "amount": "3.33"},
            {"user_id": casey.id, "amount": "3.33"},
        ]},
    ])
    assert response.status_code == 422, response.text
    db = scenario["db"]
    assert db.query(Expense).filter_by(group_id=scenario["group"].id).count() == 0
    assert db.query(Balance).filter_by(group_id=scenario["group"].id).count() == 0
    receipt = db.get(Receipt, scenario["receipt"].id)
    assert receipt.status == "read"
    assert receipt.expense_id is None


def test_cancel_confirm_saves_nothing(scenario):
    """Leaving the review without confirming writes no expense and leaves balances alone."""
    db = scenario["db"]
    receipt = db.get(Receipt, scenario["receipt"].id)
    assert receipt.status == "read"
    assert receipt.expense_id is None
    assert db.query(Expense).filter_by(group_id=scenario["group"].id).count() == 0
    assert db.query(Balance).filter_by(group_id=scenario["group"].id).count() == 0
    assert db.query(ItemAssignment).count() == 0


def test_failure_rolls_back_all_records(scenario):
    with patch("app.api.routes.receipt_confirmation.update_balances", side_effect=RuntimeError("forced failure")):
        with pytest.raises(RuntimeError, match="forced failure"):
            send(scenario)
    db = scenario["db"]
    assert db.query(Expense).filter_by(group_id=scenario["group"].id).count() == 0
    assert db.query(ItemAssignment).filter_by(receipt_item_id=scenario["pizza"].id).count() == 0
    assert db.query(ExpenseSplit).count() == 0
    assert db.get(Receipt, scenario["receipt"].id).status == "read"
