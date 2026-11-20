"""It7-12 route and transaction tests using a fake session.

These tests verify API contracts and service calls without touching dev data.
The existing PostgreSQL integration suite remains the regression check.
"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user
from app.api.routes import expense_mutations as mutation
from app.db.session import get_db
from app.main import app
from models import Expense


PAYLOAD = {
    "group_id": 17,
    "description": "Updated dinner",
    "amount": "40.00",
    "paid_by": 11,
    "participant_ids": [11, 12],
    "split_method": "even",
}


@pytest.fixture
def ctx(monkeypatch):
    db = MagicMock()
    expense = Expense(group_id=17, name="Dinner", amount=Decimal("50.00"), paid_by=11)
    expense.id = 321
    db.get.side_effect = lambda model, id: expense if model is Expense and id == 321 else None
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.with_for_update.return_value.one_or_none.return_value = expense
    db.query.return_value.filter.return_value.with_for_update.return_value.one.return_value = SimpleNamespace(id=17)
    # The route's access check calls require_group_membership, then validate_expense.
    monkeypatch.setattr(mutation, "require_group_membership", lambda *args: SimpleNamespace(is_admin=True))
    monkeypatch.setattr(mutation, "validate_expense", lambda *args: {
        "shares": {11: Decimal("20.00"), 12: Decimal("20.00")},
        "rounding_adjusted_member_ids": [],
    })
    removed = MagicMock()
    saved = MagicMock()
    monkeypatch.setattr(mutation, "_remove_splits_and_reverse", removed)
    monkeypatch.setattr(mutation, "_save_new_splits", saved)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=11)
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, db=db, expense=expense, removed=removed, saved=saved)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def test_put_reverses_old_then_saves_new_and_commits(ctx):
    r = ctx.client.put("/expenses/321", json=PAYLOAD)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["description"] == "Updated dinner"
    assert body["amount"] == "40.00"
    assert body["shares"] == {"11": "20.00", "12": "20.00"}
    ctx.removed.assert_called_once_with(ctx.expense, ctx.db)
    ctx.saved.assert_called_once()
    assert ctx.saved.call_args.args[1] == {11: Decimal("20.00"), 12: Decimal("20.00")}
    ctx.db.commit.assert_called_once()
    assert ctx.expense.name == "Updated dinner"


def test_delete_reverses_and_removes_expense(ctx):
    r = ctx.client.delete("/expenses/321")
    assert r.status_code == 200, r.text
    assert r.json()["expense_id"] == 321
    ctx.removed.assert_called_once_with(ctx.expense, ctx.db)
    ctx.db.delete.assert_called_once_with(ctx.expense)
    ctx.db.commit.assert_called_once()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_not_found_404(ctx, method):
    call = getattr(ctx.client, method)
    resp = call("/expenses/999", json=PAYLOAD) if method == "put" else call("/expenses/999")
    assert resp.status_code == 404
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_member_not_admin_cannot_mutate(ctx, monkeypatch, method):
    monkeypatch.setattr(mutation, "require_group_membership", lambda *args: SimpleNamespace(is_admin=False))
    call = getattr(ctx.client, method)
    resp = call("/expenses/321", json=PAYLOAD) if method == "put" else call("/expenses/321")
    assert resp.status_code == 403
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_nonmember_cannot_mutate(ctx, monkeypatch, method):
    def forbidden(*args):
        raise HTTPException(status_code=403, detail="Not in group")
    monkeypatch.setattr(mutation, "require_group_membership", forbidden)
    call = getattr(ctx.client, method)
    resp = call("/expenses/321", json=PAYLOAD) if method == "put" else call("/expenses/321")
    assert resp.status_code == 403
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_auth_required(ctx, method):
    app.dependency_overrides.pop(get_current_user)
    call = getattr(ctx.client, method)
    resp = call("/expenses/321", json=PAYLOAD) if method == "put" else call("/expenses/321")
    assert resp.status_code == 401
    ctx.db.commit.assert_not_called()


def test_put_cannot_move_expense_to_other_group(ctx):
    resp = ctx.client.put("/expenses/321", json={**PAYLOAD, "group_id": 18})
    assert resp.status_code == 422
    ctx.removed.assert_not_called()
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("change", [
    {"amount": "-1.00"},
    {"amount": "0.001"},
    {"description": "   "},
    {"participant_ids": [11, 11]},
    {"split_method": "unknown"},
])
def test_put_rejects_invalid_payload(ctx, change):
    resp = ctx.client.put("/expenses/321", json={**PAYLOAD, **change})
    assert resp.status_code == 422
    ctx.removed.assert_not_called()
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_linked_receipt_blocks_change_until_receipt_rules_finalized(ctx, method):
    ctx.db.query.return_value.filter.return_value.first.return_value = (4,)
    call = getattr(ctx.client, method)
    resp = call("/expenses/321", json=PAYLOAD) if method == "put" else call("/expenses/321")
    assert resp.status_code == 409
    ctx.removed.assert_not_called()
    ctx.db.commit.assert_not_called()


@pytest.mark.parametrize("method", ["put", "delete"])
def test_database_failure_rolls_back(ctx, method):
    ctx.removed.side_effect = RuntimeError("database error")
    call = getattr(ctx.client, method)
    with pytest.raises(RuntimeError, match="database error"):
        call("/expenses/321", json=PAYLOAD) if method == "put" else call("/expenses/321")
    ctx.db.rollback.assert_called_once()
    ctx.db.commit.assert_not_called()


def test_reverse_removes_expense_splits_and_applies_negative_contributions(monkeypatch):
    db = MagicMock()
    expense = SimpleNamespace(id=321, group_id=17, paid_by=11)
    a = SimpleNamespace(id=1, user_id=11, amount=Decimal("5.00"))
    b = SimpleNamespace(id=2, user_id=12, amount=Decimal("15.00"))
    link_a = SimpleNamespace(expense_id=321, split_id=1)
    link_b = SimpleNamespace(expense_id=321, split_id=2)
    monkeypatch.setattr(mutation, "_load_splits", lambda *args: [(link_a, a), (link_b, b)])
    updated = MagicMock()
    monkeypatch.setattr(mutation, "update_balances", updated)
    mutation._remove_splits_and_reverse(expense, db)
    updated.assert_called_once_with(
        17, 11, {11: Decimal("-5.00"), 12: Decimal("-15.00")}, db
    )
    assert db.delete.call_count == 4
    db.flush.assert_called_once()


def test_saving_new_splits_updates_balances(monkeypatch):
    db = MagicMock()
    expense = SimpleNamespace(id=321, group_id=17, paid_by=11)
    updated = MagicMock()
    monkeypatch.setattr(mutation, "update_balances", updated)
    shares = {11: Decimal("20.00"), 12: Decimal("20.00")}
    mutation._save_new_splits(expense, shares, db)
    assert db.add.call_count == 4
    assert db.flush.call_count == 2
    updated.assert_called_once_with(17, 11, shares, db)
