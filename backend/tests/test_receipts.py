"""Receipt upload route tests. No real database or AI service required."""

from datetime import date
from decimal import Decimal
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
from models import Receipt

# Upload error codes. A failed read must not use any of these (FR-EXP-17).
UPLOAD_ERROR_CODES = (
    "upload_failed",
    "wrong_format",
    "file_too_large",
    "corrupt_file",
)


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


# A good JPEG or PDF is accepted, stored privately, and left at status uploaded (FR-EXP-10).
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


# The wrong type, a corrupt file, and an empty file are refused with that cause (FR-EXP-16).
@pytest.mark.parametrize("name,mime,data,code,status_code,message", [
    (
        "file.txt",
        "text/plain",
        b"receipt text",
        "wrong_format",
        415,
        "Only JPEG and PDF receipts are supported.",
    ),
    (
        "photo.png",
        "image/png",
        b"\x89PNG\r\n",
        "wrong_format",
        415,
        "Only JPEG and PDF receipts are supported.",
    ),
    (
        "image.jpg",
        "image/jpeg",
        b"broken jpeg",
        "corrupt_file",
        422,
        "This is not a valid JPEG image.",
    ),
    (
        "notes.pdf",
        "application/pdf",
        b"not-a-pdf",
        "corrupt_file",
        422,
        "This is not a valid PDF.",
    ),
    (
        "file.pdf",
        "application/pdf",
        b"%PDF-not-a-real-pdf",
        "corrupt_file",
        422,
        "The PDF could not be read or is password protected.",
    ),
    (
        "image.jpg",
        "application/pdf",
        b"fake",
        "wrong_format",
        415,
        "The file's reported type does not match its extension.",
    ),
    (
        "empty.jpg",
        "image/jpeg",
        b"",
        "corrupt_file",
        422,
        "The uploaded file is empty.",
    ),
])
def test_invalid_upload_reports_cause_and_action(
    receipt_client, name, mime, data, code, status_code, message,
):
    response = send_upload(receipt_client["client"], data, name, mime)
    assert response.status_code == status_code, response.text
    detail = response.json()["detail"]
    assert detail["code"] == code
    assert detail["message"] == message
    assert detail["action"]
    receipt_client["db"].add.assert_not_called()
    assert not receipt_client["storage"].exists()


# A file over the size limit is refused before anything is saved (FR-EXP-16).
def test_oversize_file_is_rejected_before_persisting(receipt_client, monkeypatch):
    monkeypatch.setattr(receipts, "MAX_RECEIPT_BYTES", 25)
    response = send_upload(receipt_client["client"], b"X" * 26)
    assert response.status_code == 413
    detail = response.json()["detail"]
    assert detail["code"] == "file_too_large"
    assert detail["message"] == "The receipt exceeds the upload size limit."
    assert detail["action"]
    receipt_client["db"].add.assert_not_called()


# Someone who is not in the group cannot upload a receipt.
def test_not_group_member_cannot_upload(receipt_client, monkeypatch, sample_jpeg):
    def forbidden(*args):
        raise HTTPException(status_code=403, detail="Not a group member")
    monkeypatch.setattr(receipts, "require_group_membership", forbidden)
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 403
    receipt_client["db"].add.assert_not_called()


# An upload with no session is rejected and nothing is saved.
def test_unauthenticated_upload_is_rejected(receipt_client, sample_jpeg):
    # Remove the authentication override while retaining the fake DB.
    app.dependency_overrides.pop(get_current_user)
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 401
    receipt_client["db"].add.assert_not_called()


# A database failure is an upload failure, and the file that was just written is removed.
def test_failed_database_commit_removes_saved_file(receipt_client, sample_jpeg):
    receipt_client["db"].commit.side_effect = RuntimeError("test DB outage")
    response = send_upload(receipt_client["client"], sample_jpeg)
    assert response.status_code == 500
    detail = response.json()["detail"]
    assert detail["code"] == "upload_failed"
    assert detail["message"] == "The receipt could not be saved."
    receipt_client["db"].rollback.assert_called_once()
    assert list(receipt_client["storage"].glob("*")) == []


# Receipt status after the file has been stored.


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


# A receipt that has only been uploaded has no items and does not expose the file path.
def test_get_receipt_uploaded_returns_empty_items_without_file_path(receipt_detail_client):
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": 321, "group_id": 17, "uploader": 11, "expense_id": None,
        "status": "uploaded", "store": None, "store_location": None,
        "receipt_date": None, "items": [],
    }
    assert receipt_detail_client["seen_groups"] == [(17, 11)]


# A receipt the reader finished returns the line items in order.
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


# Reading in progress and a failed read are statuses on the receipt, not upload errors.
@pytest.mark.parametrize("state", ["reading", "failed"])
def test_get_receipt_processing_states(receipt_detail_client, state):
    receipt_detail_client["receipt"].status = state
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200
    assert response.json()["status"] == state
    assert response.json()["items"] == []


# A failed read is its own state. It is not an upload rejection (FR-EXP-17).
def test_reading_failure_is_its_own_state(receipt_detail_client):
    receipt_detail_client["receipt"].status = "failed"
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "failed"
    assert body["items"] == []
    assert "detail" not in body
    for code in UPLOAD_ERROR_CODES:
        assert code not in response.text


# An unknown receipt id is a not-found response, and membership is not checked.
def test_get_missing_receipt_returns_404(receipt_detail_client):
    response = receipt_detail_client["client"].get("/receipts/999")
    assert response.status_code == 404
    assert receipt_detail_client["seen_groups"] == []


# A person who is not in the group cannot read the receipt status.
def test_get_receipt_requires_accepted_group_membership(receipt_detail_client, monkeypatch):
    def forbidden(*args):
        raise HTTPException(status_code=403, detail="Not a group member")
    monkeypatch.setattr(receipts, "require_group_membership", forbidden)
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 403
    receipt_detail_client["db"].query.assert_not_called()


# Reading a receipt status with no session is rejected.
def test_get_receipt_requires_authentication(receipt_detail_client):
    app.dependency_overrides.pop(get_current_user)
    response = receipt_detail_client["client"].get("/receipts/321")
    assert response.status_code == 401
    receipt_detail_client["db"].get.assert_not_called()
