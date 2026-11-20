"""Iteration 7: correct a receipt's line items before expense confirmation."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.api.routes.receipts import ReceiptItemResponse
from app.db.session import get_db
from models import Item, Receipt, Receipt_Item, User

router = APIRouter(prefix="/receipts", tags=["Receipts"])
CENT = Decimal("0.01")
MAX_LINE_TOTAL = Decimal("99999999.99")  # NUMERIC(10, 2) in PostgreSQL


class CorrectedItem(BaseModel):
    # Existing item: supply id. New item: omit id (or supply null).
    id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(strict=True, ge=1)
    unit_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Item name cannot be blank.")
        return cleaned

    @field_validator("unit_price", mode="before")
    @classmethod
    def exact_money_input(cls, value):
        if isinstance(value, (float, bool)):
            raise ValueError("Send prices as decimal strings, e.g. '3.50'.")
        return value


class CorrectedItemsRequest(BaseModel):
    items: list[CorrectedItem] = Field(max_length=200)


class CorrectedItemsResponse(BaseModel):
    receipt_id: int
    items: list[ReceiptItemResponse]


@router.put("/{receipt_id}/items", response_model=CorrectedItemsResponse)
def replace_receipt_items(
    receipt_id: int,
    payload: CorrectedItemsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the editable item list atomically; omit an existing id to remove it.

    This route edits receipt items, NOT assignments or expense balances. Those
    are created only during the separate receipt confirmation operation.
    """
    # Lock the receipt row while verifying/editing to serialize simultaneous saves.
    # The lock also allows the later AI worker/confirm endpoint to synchronize.
    try:
        receipt = db.get(Receipt, receipt_id, with_for_update=True)
        if receipt is None:
            raise HTTPException(status_code=404, detail="Receipt not found.")

        require_group_membership(receipt.group_id, current_user, db)
        if receipt.status != "read" or receipt.expense_id is not None:
            raise HTTPException(
                status_code=409,
                detail="Only fully read, unconfirmed receipts can be edited.",
            )

        previous_items = (
            db.query(Item)
            .join(Receipt_Item, Receipt_Item.item_id == Item.id)
            .filter(Receipt_Item.receipt_id == receipt_id)
            .all()
        )
        previous_by_id = {item.id: item for item in previous_items}
        requested_existing_ids = [item.id for item in payload.items if item.id is not None]
        if len(requested_existing_ids) != len(set(requested_existing_ids)):
            raise HTTPException(status_code=422, detail="An item ID was submitted more than once.")
        if not set(requested_existing_ids).issubset(previous_by_id):
            raise HTTPException(status_code=422, detail="An item does not belong to this receipt.")

        # Validate every computed amount before modifying any rows.
        totals = []
        for item in payload.items:
            total = item.unit_price * item.quantity
            if total > MAX_LINE_TOTAL:
                raise HTTPException(status_code=422, detail="An item's line total is too large.")
            totals.append(total.quantize(CENT))

        # Update existing rows and insert new rows. Position matches request order.
        saved_items = []
        for position, (corrected, total) in enumerate(zip(payload.items, totals)):
            item = Item() if corrected.id is None else previous_by_id[corrected.id]
            item.name = corrected.name
            item.quantity = corrected.quantity
            item.unit_price = corrected.unit_price
            item.line_total = total
            item.position = position
            if corrected.id is None:
                db.add(item)
                db.flush()  # get the new item's primary key after all required fields are set
                db.add(Receipt_Item(receipt_id=receipt_id, item_id=item.id))
            saved_items.append(item)

        # Remove receipt associations first; then remove orphaned item records.
        # Pre-confirmation items belong only to this receipt.
        for removed_id in previous_by_id.keys() - set(requested_existing_ids):
            link = db.get(Receipt_Item, (receipt_id, removed_id))
            if link is not None:
                db.delete(link)
            db.delete(previous_by_id[removed_id])

        db.commit()
        return CorrectedItemsResponse(
            receipt_id=receipt_id,
            items=[
                ReceiptItemResponse(
                    id=item.id,
                    name=item.name,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    line_total=item.line_total,
                    position=item.position,
                )
                for item in saved_items
            ],
        )
    except Exception:
        db.rollback()
        raise
