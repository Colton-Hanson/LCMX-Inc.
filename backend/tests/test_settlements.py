"""It7-13: PostgreSQL-backed settlement and balance regression tests."""

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
from models import Balance, Group, Settlement, User, UserGroup


test_engine = create_engine(engine.url.set(database="shared_expense_sprint4_test"))


@pytest.fixture
def data():
    connection = test_engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        suffix = uuid4().hex
        users = [User(email=f"settle-{n}-{suffix}@example.com", password_hash="test") for n in range(4)]
        db.add_all(users)
        db.flush()
        group = Group(name="Settlements", group_type="roommate", created_by=users[0].id)
        db.add(group)
        db.flush()
        for i in range(3):
            db.add(UserGroup(user_id=users[i].id, group_id=group.id,
                             invite_status="accepted", is_admin=(i == 2)))
        debtor, creditor = users[0], users[1]
        balance = Balance(group_id=group.id, user_1_id=min(debtor.id, creditor.id),
                          user_2_id=max(debtor.id, creditor.id),
                          indebted_party=debtor.id, debt=Decimal("50.00"))
        db.add(balance)
        db.flush()
        # Establish the test data outside the request savepoint.
        # The outer connection transaction still rolls back during teardown.
        db.commit()
        app.dependency_overrides[get_current_user] = lambda: debtor
        app.dependency_overrides[get_db] = lambda: db
        yield {"db": db, "group": group, "users": users, "balance": balance,
               "debtor": debtor, "creditor": creditor}
    finally:
        app.dependency_overrides.clear()
        db.close()
        transaction.rollback()
        connection.close()


def request(data, amount="20.00", **updates):
    payload = {"paid_by": data["debtor"].id,
               "recipient": data["creditor"].id, "amount": amount}
    payload.update(updates)
    return payload


def post(data, payload):
    with TestClient(app) as client:
        return client.post(f"/groups/{data['group'].id}/settlements", json=payload)


def test_partial_repayment_updates_balance_and_history(data):
    result = post(data, request(data))
    assert result.status_code == 201, result.text
    assert result.json()["amount"] == "20.00"
    assert result.json()["remaining_debt"] == "30.00"
    assert result.json()["recorded_by"] == data["debtor"].id
    data["db"].refresh(data["balance"])
    assert data["balance"].debt == Decimal("30.00")
    assert data["balance"].indebted_party == data["debtor"].id
    assert data["db"].query(Settlement).count() == 1


def test_full_repayment_clears_direction(data):
    assert post(data, request(data, "50.00")).status_code == 201
    data["db"].refresh(data["balance"])
    assert data["balance"].debt == 0
    assert data["balance"].indebted_party is None


def test_multiple_partial_repayments_accumulate(data):
    assert post(data, request(data, "20.00")).status_code == 201
    result = post(data, request(data, "30.00"))
    assert result.status_code == 201, result.text
    assert result.json()["remaining_debt"] == "0.00"
    assert data["db"].query(Settlement).count() == 2


@pytest.mark.parametrize("amount", ["50.01", "100.00"])
def test_overpayment_rejected_without_writes(data, amount):
    result = post(data, request(data, amount))
    assert result.status_code == 422
    data["db"].refresh(data["balance"])
    assert data["balance"].debt == Decimal("50.00")
    assert data["db"].query(Settlement).count() == 0


@pytest.mark.parametrize("amount", ["0", "-2.00", "1.001", "NaN", 5.25])
def test_invalid_amount_rejected(data, amount):
    result = post(data, request(data, amount))
    assert result.status_code == 422
    assert data["db"].query(Settlement).count() == 0


def test_wrong_direction_and_self_payment_rejected(data):
    swapped = request(data, paid_by=data["creditor"].id, recipient=data["debtor"].id)
    assert post(data, swapped).status_code == 409
    same = request(data, recipient=data["debtor"].id)
    assert post(data, same).status_code == 422
    assert data["db"].query(Settlement).count() == 0


def test_nonmember_participant_rejected(data):
    assert post(data, request(data, recipient=data["users"][3].id)).status_code == 422


def test_unrelated_member_cannot_record(data):
    data["db"].query(UserGroup).filter_by(user_id=data["users"][2].id,
                                                group_id=data["group"].id).one().is_admin = False
    app.dependency_overrides[get_current_user] = lambda: data["users"][2]
    assert post(data, request(data)).status_code == 403
    assert data["db"].query(Settlement).count() == 0


def test_admin_can_record(data):
    app.dependency_overrides[get_current_user] = lambda: data["users"][2]
    response = post(data, request(data))
    assert response.status_code == 201, response.text
    assert response.json()["recorded_by"] == data["users"][2].id


def test_outsider_cannot_list_or_record(data):
    app.dependency_overrides[get_current_user] = lambda: data["users"][3]
    with TestClient(app) as client:
        base = f"/groups/{data['group'].id}/settlements"
        assert client.get(base).status_code == 403
        assert client.post(base, json=request(data)).status_code == 403


def test_list_returns_group_history(data):
    assert post(data, request(data, "12.00")).status_code == 201
    with TestClient(app) as client:
        response = client.get(f"/groups/{data['group'].id}/settlements")
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["amount"] == "12.00"
    assert response.json()[0]["settlement_time"] is not None


def test_repayment_after_full_settlement_rejected(data):
    assert post(data, request(data, "50.00")).status_code == 201
    assert post(data, request(data, "1.00")).status_code == 409
    assert data["db"].query(Settlement).count() == 1


def test_failed_insert_rolls_back_balance(data):
    # Inject an exception during flush of the new settlement, after updating
    # the balance. The transaction must roll back both.
    original_flush = data["db"].flush
    def fail_flush(*args, **kwargs):
        if any(isinstance(obj, Settlement) for obj in data["db"].new):
            raise RuntimeError("simulated settlement write failure")
        return original_flush(*args, **kwargs)
    with patch.object(data["db"], "flush", side_effect=fail_flush):
        with pytest.raises(RuntimeError, match="simulated"):
            post(data, request(data))
    data["db"].expire_all()
    saved = data["db"].get(Balance, (data["group"].id,
                                      min(data["debtor"].id, data["creditor"].id),
                                      max(data["debtor"].id, data["creditor"].id)))
    assert saved.debt == Decimal("50.00")
    assert data["db"].query(Settlement).count() == 0


def test_authentication_required():
    with TestClient(app) as client:
        assert client.get("/groups/1/settlements").status_code == 401
        assert client.post("/groups/1/settlements", json={"paid_by": 1, "recipient": 2, "amount": "1.00"}).status_code == 401
