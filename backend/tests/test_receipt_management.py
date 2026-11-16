"""Real PostgreSQL tests; existing dev data is untouched."""
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import engine, get_db
from app.main import app
from models import Expense, Group, Item, Receipt, Receipt_Item, User, UserGroup


test_engine = create_engine(engine.url.set(database="shared_expense_sprint4_test"))


@pytest.fixture
def scenario(tmp_path, monkeypatch):
    import app.api.routes.receipt_management as management

    monkeypatch.setattr(management, "RECEIPT_UPLOAD_DIR", tmp_path)
    connection = test_engine.connect()
    outer = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        suffix = uuid4().hex
        owner = User(email=f"rm-owner-{suffix}@example.com", password_hash="test")
        other = User(email=f"rm-other-{suffix}@example.com", password_hash="test")
        outsider = User(email=f"rm-outside-{suffix}@example.com", password_hash="test")
        db.add_all([owner, other, outsider]); db.flush()
        group = Group(name="Receipt management", group_type="roommate", created_by=owner.id)
        second_group = Group(name="Other group", group_type="roommate", created_by=outsider.id)
        db.add_all([group, second_group]); db.flush()
        db.add_all([
            UserGroup(user_id=owner.id, group_id=group.id, invite_status="accepted", is_admin=True),
            UserGroup(user_id=other.id, group_id=group.id, invite_status="accepted", is_admin=False),
        ]); db.flush()
        expense = Expense(group_id=group.id, name="Manual purchase", amount="12.00", paid_by=owner.id)
        foreign_expense = Expense(group_id=second_group.id, name="Other purchase", amount="10.00", paid_by=outsider.id)
        db.add_all([expense, foreign_expense]); db.flush()
        photo = tmp_path / "receipt.jpg"
        photo.write_bytes(b"a picture")
        receipt = Receipt(group_id=group.id, uploader=owner.id, file_path=str(photo), file_type="jpg", size=9, status="read")
        db.add(receipt); db.flush()
        item = Item(name="Bread", quantity=1, unit_price="4.00", line_total="4.00", position=0)
        db.add(item); db.flush()
        db.add(Receipt_Item(receipt_id=receipt.id, item_id=item.id)); db.flush()
        db.commit()  # commit only the setup savepoint; outer rollback isolates tests
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: owner
        yield locals()
    finally:
        app.dependency_overrides.clear()
        db.close()
        outer.rollback()
        connection.close()


def test_delete_picture_preserves_items_expense_and_receipt(scenario):
    s = scenario
    response = TestClient(app).delete(f'/receipts/{s["receipt"].id}/picture')
    assert response.status_code == 200, response.text
    s['db'].expire_all()
    assert s['db'].get(Receipt, s['receipt'].id).file_path is None
    assert not s['photo'].exists()
    assert s['db'].query(Receipt_Item).filter_by(receipt_id=s['receipt'].id).count() == 1
    assert s['db'].get(Expense, s['expense'].id) is not None


def test_reject_unauthorized_picture_deletion(scenario):
    s = scenario
    app.dependency_overrides[get_current_user] = lambda: s['other']
    response = TestClient(app).delete(f'/receipts/{s["receipt"].id}/picture')
    assert response.status_code == 403
    assert s['photo'].exists()


def test_failed_commit_restores_original_picture(scenario):
    s = scenario
    with patch.object(s['db'], 'commit', side_effect=RuntimeError('DB down')):
        with pytest.raises(RuntimeError, match='DB down'):
            TestClient(app).delete(f'/receipts/{s["receipt"].id}/picture')
    assert s['photo'].exists()
    assert s['db'].get(Receipt, s['receipt'].id).file_path == str(s['photo'])


def test_unlink_failure_restores_picture_and_db_record(scenario):
    s = scenario
    original_unlink = Path.unlink
    def fail_staged(self, *args, **kwargs):
        if '.delete-' in self.name:
            raise OSError('unlink denied')
        return original_unlink(self, *args, **kwargs)
    with patch.object(Path, 'unlink', autospec=True, side_effect=fail_staged):
        response = TestClient(app).delete(f'/receipts/{s["receipt"].id}/picture')
    assert response.status_code == 500
    assert s['photo'].exists()
    assert s['db'].get(Receipt, s['receipt'].id).file_path == str(s['photo'])


def test_reject_deletion_while_reading(scenario):
    s = scenario
    s['receipt'].status = 'reading'; s['db'].commit()
    response = TestClient(app).delete(f'/receipts/{s["receipt"].id}/picture')
    assert response.status_code == 409
    assert s['photo'].exists()


def test_attach_receipt_to_manual_expense(scenario):
    s = scenario
    response = TestClient(app).post(f'/receipts/{s["receipt"].id}/attach', json={'expense_id':s['expense'].id})
    assert response.status_code == 200, response.text
    s['db'].expire_all()
    saved = s['db'].get(Receipt, s['receipt'].id)
    assert saved.expense_id == s['expense'].id
    assert saved.status == 'confirmed'
    assert s['db'].get(Expense, s['expense'].id).amount == 12
    assert TestClient(app).post(f'/receipts/{s["receipt"].id}/attach', json={'expense_id':s['expense'].id}).status_code == 409


def test_attach_cross_group_rejected(scenario):
    s = scenario
    response = TestClient(app).post(f'/receipts/{s["receipt"].id}/attach', json={'expense_id':s['foreign_expense'].id})
    assert response.status_code == 422
    assert s['db'].get(Receipt, s['receipt'].id).expense_id is None


def test_attach_requires_uploader_or_admin(scenario):
    s = scenario
    app.dependency_overrides[get_current_user] = lambda: s['other']
    response = TestClient(app).post(f'/receipts/{s["receipt"].id}/attach', json={'expense_id':s['expense'].id})
    assert response.status_code == 403


def test_attachment_rejects_expense_already_linked(scenario):
    s = scenario
    second = Receipt(group_id=s['group'].id, uploader=s['owner'].id,
                     file_path=str(s['photo']), file_type='jpg', size=9,
                     status='confirmed', expense_id=s['expense'].id)
    s['db'].add(second); s['db'].commit()
    response = TestClient(app).post(f'/receipts/{s["receipt"].id}/attach', json={'expense_id':s['expense'].id})
    assert response.status_code == 409


def test_auth_required():
    assert TestClient(app).delete('/receipts/1/picture').status_code == 401
    assert TestClient(app).post('/receipts/1/attach', json={'expense_id':1}).status_code == 401
