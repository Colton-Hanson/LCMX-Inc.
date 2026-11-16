"""It7 financial ledger regression: real expenses, repayments, and edits.

Uses the same isolated PostgreSQL test database as existing integration tests.
The outer connection transaction is rolled back after each test; endpoint
commits use savepoints and do not leak fixtures to the next test.
"""
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
from models import Balance, Event, Expense, Group, Settlement, User, UserGroup

TEST_ENGINE = create_engine(engine.url.set(database="shared_expense_sprint4_test"))


@pytest.fixture
def ledger():
    connection = TEST_ENGINE.connect()
    outer = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        token = uuid4().hex
        alice = User(email=f"ledger-alice-{token}@example.com", password_hash="test")
        bob = User(email=f"ledger-bob-{token}@example.com", password_hash="test")
        db.add_all([alice, bob])
        db.flush()
        group = Group(name="Ledger test", group_type="roommate", created_by=alice.id)
        db.add(group)
        db.flush()
        db.add_all([
            UserGroup(user_id=alice.id, group_id=group.id, invite_status="accepted", is_admin=True),
            UserGroup(user_id=bob.id, group_id=group.id, invite_status="accepted"),
        ])
        db.flush()
        # Establish a savepoint-backed fixture before exercising endpoint rollbacks.
        db.commit()
        app.dependency_overrides[get_current_user] = lambda: alice
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield db, client, group, alice, bob
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
        db.close()
        outer.rollback()
        connection.close()


def balance(db, group, alice, bob):
    return db.get(Balance, (group.id, min(alice.id, bob.id), max(alice.id, bob.id)))


def create_100(db, group, alice, bob, event_id=None):
    payload = ExpenseCreate(
        group_id=group.id, description="Dinner", amount="100.00",
        paid_by=alice.id, participant_ids=[alice.id, bob.id],
        event_id=event_id,
    )
    return create_expense_transaction(payload,
                                      {alice.id: Decimal("50.00"), bob.id: Decimal("50.00")}, db)


def repay_20(client, group, bob, alice):
    response = client.post(f"/groups/{group.id}/settlements", json={
        "paid_by": bob.id, "recipient": alice.id, "amount": "20.00"
    })
    assert response.status_code == 201, response.text


def edit_request(group, alice, bob, amount="80.00", event_id=None):
    return {"group_id": group.id, "description": "Updated dinner",
            "amount": amount, "paid_by": alice.id, "participant_ids": [alice.id, bob.id],
            "split_method": "even", "event_id": event_id}


def test_edit_after_partial_repayment_recalculates_remaining_debt(ledger):
    db, client, group, alice, bob = ledger
    expense = create_100(db, group, alice, bob)
    repay_20(client, group, bob, alice)
    response = client.put(f"/expenses/{expense.id}", json=edit_request(group, alice, bob))
    assert response.status_code == 200, response.text
    db.expire_all()
    remaining = balance(db, group, alice, bob)
    assert remaining.debt == Decimal("20.00")
    assert remaining.indebted_party == bob.id
    assert db.query(Settlement).filter_by(group_id=group.id).count() == 1
    assert db.get(Expense, expense.id).amount == Decimal("80.00")


def test_delete_after_repayment_creates_refund_obligation(ledger):
    db, client, group, alice, bob = ledger
    expense = create_100(db, group, alice, bob)
    repay_20(client, group, bob, alice)
    response = client.delete(f"/expenses/{expense.id}")
    assert response.status_code == 200, response.text
    db.expire_all()
    remaining = balance(db, group, alice, bob)
    # The original $50 debt is gone, but Bob already paid $20.
    # Alice now owes Bob $20 back. Keep the settlement audit record.
    assert remaining.debt == Decimal("20.00")
    assert remaining.indebted_party == alice.id
    assert db.query(Settlement).filter_by(group_id=group.id).count() == 1
    assert db.get(Expense, expense.id) is None


def test_create_expense_with_optional_event(ledger):
    db, client, group, alice, bob = ledger
    event = Event(name="Trip", group_id=group.id)
    db.add(event)
    db.commit()
    response = client.post("/expenses", json=edit_request(group, alice, bob, "100.00", event.id))
    assert response.status_code == 201, response.text
    assert response.json()["event_id"] == event.id
    listed = client.get(f"/groups/{group.id}/expenses")
    assert listed.status_code == 200, listed.text
    assert any(e["id"] == response.json()["id"] and e["event_id"] == event.id for e in listed.json())
    db.expire_all()
    assert db.get(Expense, response.json()["id"]).event_id == event.id


def test_edit_expense_event_and_reject_foreign_group_event(ledger):
    db, client, group, alice, bob = ledger
    expense = create_100(db, group, alice, bob)
    event = Event(name="Group event", group_id=group.id)
    other = Group(name="Other", group_type="roommate", created_by=alice.id)
    db.add_all([event, other])
    db.flush()
    foreign = Event(name="Other event", group_id=other.id)
    db.add(foreign)
    db.commit()
    ok = client.put(f"/expenses/{expense.id}", json=edit_request(group, alice, bob, "100.00", event.id))
    assert ok.status_code == 200, ok.text
    assert ok.json()["event_id"] == event.id
    invalid = client.put(f"/expenses/{expense.id}", json=edit_request(group, alice, bob, "100.00", foreign.id))
    assert invalid.status_code == 422, invalid.text
    db.expire_all()
    assert db.get(Expense, expense.id).event_id == event.id
