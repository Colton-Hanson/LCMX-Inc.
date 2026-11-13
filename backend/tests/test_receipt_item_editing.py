"""It7-10: editable receipt items, validation, ownership, and atomic saves."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user
from app.api.routes import receipt_items
from app.db.session import get_db
from app.main import app
from models import Item, Receipt, Receipt_Item


def line(name="Bread", quantity=2, unit_price="3.50", item_id=None):
    result = {"name": name, "quantity": quantity, "unit_price": unit_price}
    if item_id is not None:
        result["id"] = item_id
    return result


@pytest.fixture
def editing_client(monkeypatch):
    db = MagicMock()
    receipt = Receipt(group_id=17, uploader=11, expense_id=None, status="read")
    receipt.id = 321
    old = Item(name="Milk", quantity=1, unit_price=Decimal("4.25"),
               line_total=Decimal("4.25"), position=0)
    old.id = 8
    existing = [old]
    next_id = [30]
    additions = []
    seen_groups = []

    def lookup(model, key, **kwargs):
        if model is Receipt:
            return receipt if key == 321 else None
        if model is Receipt_Item and key == (321, 8):
            return Receipt_Item(receipt_id=321, item_id=8)
        return None

    def add(model):
        additions.append(model)

    def flush():
        for obj in additions:
            if isinstance(obj, Item) and obj.id is None:
                obj.id = next_id[0]
                next_id[0] += 1

    db.get.side_effect = lookup
    db.add.side_effect = add
    db.flush.side_effect = flush
    db.query.return_value.join.return_value.filter.return_value.all.side_effect = lambda: list(existing)

    def permitted(group_id, user, session):
        seen_groups.append(group_id)

    monkeypatch.setattr(receipt_items, "require_group_membership", permitted)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=11)
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, db=db, receipt=receipt, old=old,
                                  existing=existing, added=additions, groups=seen_groups)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def put(ctx, items, id=321):
    return ctx.client.put(f"/receipts/{id}/items", json={"items": items})


def test_update_existing_and_add_new_item(editing_client):
    ctx = editing_client
    response = put(ctx, [line("  Milk  ", 2, "2.15", 8), line("Bread", 3, "1.25")])
    assert response.status_code == 200, response.text
    assert response.json() == {
        "receipt_id": 321,
        "items": [
            {"id": 8, "name": "Milk", "quantity": 2, "unit_price": "2.15", "line_total": "4.30", "position": 0},
            {"id": 30, "name": "Bread", "quantity": 3, "unit_price": "1.25", "line_total": "3.75", "position": 1},
        ],
    }
    assert ctx.groups == [17]
    assert ctx.db.commit.call_count == 1
    assert any(isinstance(x, Receipt_Item) and x.item_id == 30 for x in ctx.added)


def test_omit_item_removes_link_and_item(editing_client):
    ctx = editing_client
    response = put(ctx, [line("New", 1, "4.50")])
    assert response.status_code == 200
    deleted = [x.args[0] for x in ctx.db.delete.call_args_list]
    assert ctx.old in deleted
    assert any(isinstance(x, Receipt_Item) and x.item_id == 8 for x in deleted)
    ctx.db.commit.assert_called_once()


@pytest.mark.parametrize("items", [
    [line("  ")],
    [line(quantity=0)],
    [line(quantity=1.5)],
    [line(unit_price="-1.00")],
    [line(unit_price="1.234")],
    [line(unit_price=1.2)],
    [line(quantity=99999999, unit_price="99999999.99")],
    [line(item_id=8), line(item_id=8)],
    [line(item_id=999)],
])
def test_invalid_payloads_do_not_commit(editing_client, items):
    response = put(editing_client, items)
    assert response.status_code == 422, response.text
    editing_client.db.commit.assert_not_called()


def test_receipt_not_found(editing_client):
    response = put(editing_client, [line()], id=222)
    assert response.status_code == 404
    editing_client.db.commit.assert_not_called()


@pytest.mark.parametrize("status,expense_id", [
    ("uploaded", None), ("reading", None), ("failed", None), ("read", 12),
])
def test_not_read_or_confirmed_cannot_edit(editing_client, status, expense_id):
    editing_client.receipt.status = status
    editing_client.receipt.expense_id = expense_id
    response = put(editing_client, [line()])
    assert response.status_code == 409
    editing_client.db.commit.assert_not_called()


def test_nonmember_cannot_edit(editing_client, monkeypatch):
    def reject(*args):
        raise HTTPException(status_code=403, detail="Forbidden")
    monkeypatch.setattr(receipt_items, "require_group_membership", reject)
    response = put(editing_client, [line()])
    assert response.status_code == 403
    editing_client.db.commit.assert_not_called()


def test_auth_required(editing_client):
    app.dependency_overrides.pop(get_current_user)
    response = put(editing_client, [line()])
    assert response.status_code == 401
    editing_client.db.commit.assert_not_called()


def test_database_error_rolls_back(editing_client):
    editing_client.db.commit.side_effect = RuntimeError("DB unavailable")
    with pytest.raises(RuntimeError):
        # No TestClient exception suppression: propagate test database failure.
        put(editing_client, [line(item_id=8)])
    editing_client.db.rollback.assert_called_once()


def test_empty_list_removes_all_items(editing_client):
    response = put(editing_client, [])
    assert response.status_code == 200
    assert response.json()["items"] == []
    editing_client.db.commit.assert_called_once()
