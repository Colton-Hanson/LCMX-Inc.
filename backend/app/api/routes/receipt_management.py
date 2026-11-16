"""Iteration 7: manage receipt pictures and link receipts to manual expenses."""

import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.api.routes.receipts import RECEIPT_UPLOAD_DIR
from app.db.session import get_db
from models import Expense, Group, Receipt, User

router = APIRouter(prefix="/receipts", tags=["Receipts"])


class AttachReceiptRequest(BaseModel):
    expense_id: int = Field(gt=0)


class ReceiptPictureResult(BaseModel):
    receipt_id: int
    picture_deleted: bool
    expense_id: int | None


class ReceiptAttachResult(BaseModel):
    receipt_id: int
    expense_id: int
    status: str


def _check_manager(receipt: Receipt, current_user: User, db: Session) -> None:
    membership = require_group_membership(receipt.group_id, current_user, db)
    if receipt.uploader != current_user.id and not membership.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only the receipt uploader or a group administrator can manage this receipt.",
        )


def _safe_picture_path(file_path: str) -> Path:
    """Never unlink an arbitrary path stored in the database."""
    root = RECEIPT_UPLOAD_DIR.resolve()
    candidate = Path(file_path)
    if not candidate.is_absolute() or candidate.is_symlink():
        raise HTTPException(status_code=409, detail="Receipt picture path is invalid.")
    normalized = candidate.resolve()
    if normalized.parent != root or not normalized.is_file():
        raise HTTPException(
            status_code=409,
            detail="Receipt picture is unavailable or outside the private upload folder.",
        )
    return normalized


@router.delete("/{receipt_id}/picture", response_model=ReceiptPictureResult)
def delete_receipt_picture(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preserve extracted items, assignments, and expenses when deleting an image.

    Stage the picture with a same-directory rename before updating PostgreSQL.
    If the database commit fails, rename it back. If the final unlink fails,
    restore both the picture and its database link best-effort. The remaining
    crash window requires the periodic orphan-picture cleanup in It7-9.
    """
    staged = None
    original = None
    committed = False
    try:
        receipt = db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(status_code=404, detail="Receipt not found.")
        # Lock the group first, consistent with expense updates.
        db.query(Group).filter(Group.id == receipt.group_id).with_for_update().one()
        receipt = db.get(Receipt, receipt_id, with_for_update=True, populate_existing=True)
        _check_manager(receipt, current_user, db)
        if receipt.status in ("uploaded", "reading"):
            raise HTTPException(status_code=409, detail="Wait until receipt reading is complete.")
        if receipt.file_path is None:
            raise HTTPException(status_code=409, detail="Receipt picture was already removed.")

        original = _safe_picture_path(receipt.file_path)
        staged = original.with_name(f".{original.name}.delete-{uuid4().hex}")
        # Rename stays on the same filesystem; rollback can restore the file.
        os.replace(original, staged)
        receipt.file_path = None
        expense_id = receipt.expense_id
        db.commit()
        committed = True

        try:
            staged.unlink()
        except OSError as exc:
            # Compensate for an unlink failure: restore original image and row.
            os.replace(staged, original)
            try:
                restored = db.get(Receipt, receipt_id, with_for_update=True)
                restored.file_path = str(original)
                db.commit()
            except Exception:
                db.rollback()
                raise RuntimeError(
                    "Picture deletion failed and the database link could not be restored."
                ) from exc
            raise HTTPException(
                status_code=500,
                detail="Picture could not be deleted; original was preserved.",
            ) from exc

        return ReceiptPictureResult(
            receipt_id=receipt_id, picture_deleted=True, expense_id=expense_id
        )
    except Exception:
        db.rollback()
        if not committed and staged is not None and original is not None and staged.exists():
            os.replace(staged, original)
        raise


@router.post("/{receipt_id}/attach", response_model=ReceiptAttachResult)
def attach_receipt_to_expense(
    receipt_id: int,
    payload: AttachReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach an existing receipt to a manually entered expense; no balance change."""
    try:
        receipt = db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(status_code=404, detail="Receipt not found.")
        db.query(Group).filter(Group.id == receipt.group_id).with_for_update().one()
        receipt = db.get(Receipt, receipt_id, with_for_update=True, populate_existing=True)
        _check_manager(receipt, current_user, db)

        if receipt.expense_id is not None or receipt.status == "confirmed":
            raise HTTPException(status_code=409, detail="Receipt is already linked to an expense.")
        if receipt.status == "reading":
            raise HTTPException(status_code=409, detail="Cannot attach while AI is reading this receipt.")
        if receipt.file_path is None:
            raise HTTPException(status_code=409, detail="Receipt has no picture to attach.")

        expense = db.get(Expense, payload.expense_id)
        if expense is None:
            raise HTTPException(status_code=404, detail="Expense not found.")
        if expense.group_id != receipt.group_id:
            raise HTTPException(status_code=422, detail="Expense and receipt must belong to the same group.")
        existing = (
            db.query(Receipt.id)
            .filter(Receipt.expense_id == expense.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Expense already has an attached receipt.")

        receipt.expense_id = expense.id
        receipt.status = "confirmed"
        db.commit()
        return ReceiptAttachResult(
            receipt_id=receipt.id, expense_id=expense.id, status="confirmed"
        )
    except Exception:
        db.rollback()
        raise
