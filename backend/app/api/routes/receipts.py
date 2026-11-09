"""Iteration 6 receipt upload. AI processing and receipt polling are separate steps."""

from datetime import date
from decimal import Decimal
from io import BytesIO
import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from models import Item, Receipt, Receipt_Item, User


router = APIRouter(prefix="/receipts", tags=["Receipts"])

# Defaults until the team agrees on the upload limits; overridable in .env.
MAX_RECEIPT_BYTES = int(os.getenv("MAX_RECEIPT_MB", "10")) * 1024 * 1024
RECEIPT_UPLOAD_DIR = Path(
    os.getenv(
        "RECEIPT_UPLOAD_DIR",
        str(Path(__file__).resolve().parents[3] / "uploads" / "receipts"),
    )
)
MAX_IMAGE_PIXELS = 25_000_000


class ReceiptItemResponse(BaseModel):
    id: int
    name: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    position: int


class ReceiptDetailResponse(BaseModel):
    id: int
    group_id: int
    uploader: int
    expense_id: int | None
    status: str
    store: str | None
    store_location: str | None
    receipt_date: date | None
    items: list[ReceiptItemResponse]


class ReceiptUploadResponse(BaseModel):
    id: int
    group_id: int
    uploader: int
    status: str
    file_type: str
    size: int


def _upload_error(http_status: int, code: str, message: str, action: str):
    raise HTTPException(
        status_code=http_status,
        detail={"code": code, "message": message, "action": action},
    )


def _validate_file(upload: UploadFile, data: bytes) -> str:
    """Return the canonical file type after inspecting the actual file data."""
    if not data:
        _upload_error(422, "corrupt_file", "The uploaded file is empty.",
                      "Choose a nonempty JPEG image or PDF.")

    extension = Path(upload.filename or "").suffix.lower()
    file_type = {".jpg": "jpg", ".jpeg": "jpg", ".pdf": "pdf"}.get(extension)
    if file_type is None:
        _upload_error(415, "wrong_format", "Only JPEG and PDF receipts are supported.",
                      "Choose a .jpg, .jpeg, or .pdf file.")

    mime_type = (upload.content_type or "").lower().split(";", 1)[0].strip()
    expected_types = (
        {"image/jpeg", "image/pjpeg", "application/octet-stream", ""}
        if file_type == "jpg"
        else {"application/pdf", "application/x-pdf", "application/octet-stream", ""}
    )
    if mime_type not in expected_types:
        _upload_error(415, "wrong_format", "The file's reported type does not match its extension.",
                      "Choose a JPEG image or PDF exported from your device.")

    if file_type == "jpg":
        if not data.startswith(b"\xff\xd8\xff"):
            _upload_error(422, "corrupt_file", "This is not a valid JPEG image.",
                          "Try another image or take a new photo.")
        try:
            with Image.open(BytesIO(data)) as image:
                if image.format != "JPEG" or image.width * image.height > MAX_IMAGE_PIXELS:
                    raise ValueError("Invalid JPEG or excessive image dimensions")
                image.verify()
            # verify() checks structure; load() also catches truncated image data.
            with Image.open(BytesIO(data)) as image:
                image.load()
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
            _upload_error(422, "corrupt_file", "The JPEG image could not be read safely.",
                          "Try another image or take a new photo.")
    else:
        if not data.startswith(b"%PDF-"):
            _upload_error(422, "corrupt_file", "This is not a valid PDF.",
                          "Export a new PDF and try again.")
        try:
            pdf = PdfReader(BytesIO(data), strict=False)
            if pdf.is_encrypted or len(pdf.pages) == 0:
                raise ValueError("Encrypted or empty PDF")
        except Exception:
            _upload_error(422, "corrupt_file", "The PDF could not be read or is password protected.",
                          "Upload a readable, unprotected PDF.")

    return file_type


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ReceiptUploadResponse)
def upload_receipt(
    group_id: int = Form(gt=0),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a private receipt and create a row with status=uploaded."""
    require_group_membership(group_id, current_user, db)

    # Only read up to the limit + 1 byte, regardless of reported Content-Length.
    data = file.file.read(MAX_RECEIPT_BYTES + 1)
    if len(data) > MAX_RECEIPT_BYTES:
        _upload_error(413, "file_too_large", "The receipt exceeds the upload size limit.",
                      "Choose a smaller file or compress it before uploading.")

    file_type = _validate_file(file, data)
    destination = RECEIPT_UPLOAD_DIR / f"{uuid4().hex}.{file_type}"

    try:
        RECEIPT_UPLOAD_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Private, exclusive creation. The client-supplied filename is never used.
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)

        receipt = Receipt(
            group_id=group_id,
            uploader=current_user.id,
            expense_id=None,
            file_path=str(destination.resolve()),
            file_type=file_type,
            size=len(data),
            status="uploaded",
        )
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        _upload_error(500, "upload_failed", "The receipt could not be saved.",
                      "Please try uploading again.")

    return ReceiptUploadResponse(
        id=receipt.id,
        group_id=receipt.group_id,
        uploader=receipt.uploader,
        status=receipt.status,
        file_type=receipt.file_type,
        size=receipt.size,
    )


@router.get("/{receipt_id}", response_model=ReceiptDetailResponse)
def get_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Polling endpoint: only accepted members can view receipt metadata and items.

    The private file path is deliberately excluded from the API response.
    """
    receipt = db.get(Receipt, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    require_group_membership(receipt.group_id, current_user, db)

    rows = (
        db.query(Item)
        .join(Receipt_Item, Receipt_Item.item_id == Item.id)
        .filter(Receipt_Item.receipt_id == receipt_id)
        .order_by(Item.position, Item.id)
        .all()
    )

    return ReceiptDetailResponse(
        id=receipt.id,
        group_id=receipt.group_id,
        uploader=receipt.uploader,
        expense_id=receipt.expense_id,
        status=receipt.status,
        store=receipt.store,
        store_location=receipt.store_location,
        receipt_date=receipt.receipt_date,
        items=[
            ReceiptItemResponse(
                id=item.id,
                name=item.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
                position=item.position,
            )
            for item in rows
        ],
    )
