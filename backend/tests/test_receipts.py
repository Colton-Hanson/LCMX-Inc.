"""Receipt upload route tests. No real database or AI service required."""

from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter

from app.api.dependencies import get_current_user
from app.api.routes import receipts
from app.db.session import get_db
from app.main import app


@pytest.fixture
def sample_jpeg():
    image = Image.new("RGB", (4, 4), "white")
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def sample_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=120, height=120)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture
def receipt_client(monkeypatch, tmp_path):
    db = MagicMock()
    db.add.side_effect = lambda receipt: setattr(receipt, "id", 321)
    user = SimpleNamespace(id=11)
    seen_groups = []

    def permitted(group_id, current_user, session):
        seen_groups.append((group_id, current_user.id))

    monkeypatch.setattr(receipts, "require_group_membership", permitted)
    monkeypatch.setattr(receipts, "RECEIPT_UPLOAD_DIR", tmp_path / "private-receipts")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        with TestClient(app) as client:
            yield {"client": client, "db": db, "seen_groups": seen_groups,
                   "storage": tmp_path / "private-receipts"}
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def send_upload(client, data, name="receipt.jpg", mime="image/jpeg", group_id="17"):
    return client.post(
        "/receipts",
        data={"group_id": group_id},
        files={"file": (name, data, mime)},
    )


@pytest.mark.parametrize("format_name,mime,fixture_name", [
    ("scan.jpeg", "image/jpeg", "sample_jpeg"),
    ("scan.pdf", "application/pdf", "sample_pdf"),
])
def test_valid_upload_creates_private_file_and_uploaded_row(
    receipt_client, request, format_name, mime, fixture_name,
):
    data = request.getfixturevalue(fixture_name)
    result = send_upload(receipt_client["client"], data, format_name, mime)

    assert result.status_code == 201, result.text
    body = result.json()
    assert body["id"] == 321
    assert body["status"] == "uploaded"
    assert body["group_id"] == 17
    assert body["uploader"] == 11
    assert body["size"] == len(data)
    assert body["file_type"] in {"jpg", "pdf"}

    assert receipt_client["seen_groups"] == [(17, 11)]
    receipt_client["db"].commit.assert_called_once()
    receipt_client["db"].add.assert_called_once()
    saved = receipt_client["db"].add.call_args.args[0]
    assert saved.file_path.startswith(str(receipt_client["storage"]))
    assert Path(saved.file_path).read_bytes() == data
    assert format_name not in Path(saved.file_path).name
    assert Path(saved.file_path).stat().st_mode & 0o077 == 0  # private permissions


@pytest.mark.parametrize("name,mime,data,code,status_code", [
    ("file.txt", "text/plain", b"receipt text", "wrong_format", 415),
    ("photo.png", "image/png", b"\x89PNG\r\n", "wrong_format", 415),
    ("image.jpg", "image/jpeg", b"broken jpeg", "corrupt_file", 422),
    ("file.pdf", "application/pdf", b"%PDF-not-a-real-pdf", "corrupt_file", 422),
    ("image.jpg", "application/pdf", b"fake", "wrong_format", 415),
    ("empty.jpg", "image/jpeg", b"", "corrupt_file", 422),
])
def test_invalid_upload_reports_cause_and_action(
    receipt_client, name, mime, data, code, status_code,
):
    response = send_upload(receipt_client["client"], data, name, mime)
    assert response.status_code == status_code, response.text
    assert response.json()["detail"]["code"] == code
    assert response.json()["detail"]["action"]
    receipt_client["db"].add.assert_not_called()
    assert not receipt_client["storage"].exists()


def test_oversize_file_is_rejected_before_persisting(receipt_client, monkeypatch):
    monkeypatch.setattr(receipts, "MAX_RECEIPT_BYTES", 25)
    response = send_upload(receipt_client["client"], b"X" * 26)
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "file_too_large"
    receipt_client["db"].add.assert_not_called()


def test_not_group_member_cannot_upload(receipt_client, monkeypatch, sample_jpeg):
    def forbidden(*args):
        raise HTTPException(status_code=403, detail="Not a group member")
    monkeypatch.setattr(receipts, "require_group_membership", forbidden)
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 403
    receipt_client["db"].add.assert_not_called()


def test_unauthenticated_upload_is_rejected(receipt_client, sample_jpeg):
    # Remove the authentication override while retaining the fake DB.
    app.dependency_overrides.pop(get_current_user)
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 401
    receipt_client["db"].add.assert_not_called()


def test_failed_database_commit_removes_saved_file(receipt_client, sample_jpeg):
    receipt_client["db"].commit.side_effect = RuntimeError("test DB outage")
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "upload_failed"
    receipt_client["db"].rollback.assert_called_once()
    assert list(receipt_client["storage"].glob("*")) == []


# Phase 2: receipt polling and private item details.
from datetime import date
from decimal import Decimal

from models import Receipt


@pytest.fixture
def receipt_detail_client(receipt_client):
    db = receipt_client["db"]
    receipt = Receipt(
        group_id=17, uploader=11, expense_id=None, file_path="/private/do-not-expose.jpg",
        file_type="jpg", size=98, status="uploaded", store=None,
        store_location=None, receipt_date=None,
    )
    receipt.id = 321
    db.get.side_effect = lambda model, obj_id: receipt if model is Receipt and obj_id == 321 else None
    db.query.return_value.join.return_value.filter.return_value.order_by.return_value.all.return_value = []
    return {**receipt_client, "receipt": receipt}


def test_get_receipt_uploaded_returns_empty_items_without_file_path(receipt_detail_client):
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": 321, "group_id": 17, "uploader": 11, "expense_id": None,
        "status": "uploaded", "store": None, "store_location": None,
        "receipt_date": None, "items": [],
    }
    assert receipt_detail_client["seen_groups"] == [(17, 11)]


def test_get_receipt_read_returns_ordered_items(receipt_detail_client):
    receipt_detail_client["receipt"].status = "read"
    receipt_detail_client["receipt"].store = "Grocery Market"
    receipt_detail_client["receipt"].store_location = "Kansas City"
    receipt_detail_client["receipt"].receipt_date = date(2026, 11, 6)
    receipt_detail_client["db"].query.return_value.join.return_value.filter.return_value.order_by.return_value.all.return_value = [
        SimpleNamespace(id=8, name="Bread", quantity=2, unit_price=Decimal("3.50"), line_total=Decimal("7.00"), position=0),
        SimpleNamespace(id=9, name="Milk", quantity=1, unit_price=Decimal("4.25"), line_total=Decimal("4.25"), position=1),
    ]
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "read"
    assert data["store"] == "Grocery Market"
    assert data["store_location"] == "Kansas City"
    assert data["receipt_date"] == "2026-11-06"
    assert data["items"] == [
        {"id": 8, "name": "Bread", "quantity": 2, "unit_price": "3.50", "line_total": "7.00", "position": 0},
        {"id": 9, "name": "Milk", "quantity": 1, "unit_price": "4.25", "line_total": "4.25", "position": 1},
    ]


@pytest.mark.parametrize("state", ["reading", "failed"])
def test_get_receipt_processing_states(receipt_detail_client, state):
    receipt_detail_client["receipt"].status = state
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200
    assert response.json()["status"] == state
    assert response.json()["items"] == []


def test_get_missing_receipt_returns_404(receipt_detail_client):
    response = receipt_detail_client["client"].get("/receipts/999")
    assert response.status_code == 404
    assert receipt_detail_client["seen_groups"] == []


def test_get_receipt_requires_accepted_group_membership(receipt_detail_client, monkeypatch):
    def forbidden(*args):
        raise HTTPException(status_code=403, detail="Not a group member")
    monkeypatch.setattr(receipts, "require_group_membership", forbidden)
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 403
    receipt_detail_client["db"].query.assert_not_called()


def test_get_receipt_requires_authentication(receipt_detail_client):
    app.dependency_overrides.pop(get_current_user)
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 401
    receipt_detail_client["db"].get.assert_not_called()
