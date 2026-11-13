"""Confirm reviewed receipt items into an expense and persist item shares."""

from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from app.services.expense_persistence import save_expense, update_balances
from app.services.split_calculator import SplitCalculationError, calculate_splits
from models import Event, Group, Item, ItemAssignment, Receipt, Receipt_Item, User, UserGroup

router = APIRouter(prefix="/receipts", tags=["Receipts"])
MAX_MONEY = Decimal("99999999.99")


class ItemShare(BaseModel):
    user_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

    @field_validator("amount", mode="before")
    @classmethod
    def no_floats(cls, value):
        if isinstance(value, (bool, float)):
            raise ValueError("Use decimal strings for amounts, e.g. '3.50'.")
        return value


class AssignedReceiptItem(BaseModel):
    item_id: int = Field(gt=0)
    shares: list[ItemShare] = Field(min_length=1, max_length=100)


class ReceiptConfirmationRequest(BaseModel):
    paid_by: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=100)
    assignments: list[AssignedReceiptItem] = Field(min_length=1, max_length=200)
    event_id: int | None = Field(default=None, gt=0)

    @field_validator("description")
    @classmethod
    def nonempty_description(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Description cannot be blank.")
        return value


class ConfirmationResponse(BaseModel):
    receipt_id: int
    expense_id: int
    status: str
    amount: Decimal
    shares: dict[int, Decimal]
    excluded_item_ids: list[int]


@router.post("/{receipt_id}/confirm", response_model=ConfirmationResponse, status_code=201)
def confirm_receipt(
    receipt_id: int,
    payload: ReceiptConfirmationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create expense, splits, item assignments, balances, receipt link atomically.

    Items not present in `assignments` are excluded from the expense. An
    included item's positive shares must sum exactly to its stored line total.
    Image deletion is handled separately by the picture-retention workflow.
    """
    try:
        # Lock group first (same order as ordinary expense creation) to avoid
        # concurrent balance updates and to serialize receipt confirmations.
        receipt_group_id = db.query(Receipt.group_id).filter(Receipt.id == receipt_id).scalar()
        if receipt_group_id is None:
            raise HTTPException(status_code=404, detail="Receipt not found.")

        db.query(Group).filter(Group.id == receipt_group_id).with_for_update().one()
        receipt = db.get(Receipt, receipt_id, with_for_update=True)
        require_group_membership(receipt.group_id, current_user, db)

        if receipt.status != "read" or receipt.expense_id is not None:
            raise HTTPException(status_code=409, detail="Receipt is not ready for confirmation.")

        items = (
            db.query(Item)
            .join(Receipt_Item, Receipt_Item.item_id == Item.id)
            .filter(Receipt_Item.receipt_id == receipt_id)
            .all()
        )
        items_by_id = {item.id: item for item in items}
        chosen_ids = [assignment.item_id for assignment in payload.assignments]
        if len(chosen_ids) != len(set(chosen_ids)) or not set(chosen_ids).issubset(items_by_id):
            raise HTTPException(status_code=422, detail="Assignments contain duplicate or foreign item IDs.")

        requested_users = {payload.paid_by}
        totals = defaultdict(lambda: Decimal("0.00"))
        rows = []
        total = Decimal("0.00")
        for assignment in payload.assignments:
            item = items_by_id[assignment.item_id]
            if item.line_total <= 0:
                raise HTTPException(status_code=422, detail="Only positive-priced items can be assigned.")
            users = [entry.user_id for entry in assignment.shares]
            if len(users) != len(set(users)):
                raise HTTPException(status_code=422, detail="An item cannot assign the same member twice.")
            subtotal = sum((entry.amount for entry in assignment.shares), Decimal("0.00"))
            if subtotal != item.line_total:
                raise HTTPException(status_code=422, detail=f"Shares for item {item.id} do not equal its line total.")
            total += item.line_total
            for entry in assignment.shares:
                requested_users.add(entry.user_id)
                totals[entry.user_id] += entry.amount
                rows.append((item.id, entry.user_id, entry.amount))

        if total > MAX_MONEY:
            raise HTTPException(status_code=422, detail="Expense exceeds the supported amount.")

        accepted_users = {
            row.user_id
            for row in db.query(UserGroup.user_id)
            .filter(
                UserGroup.group_id == receipt.group_id,
                UserGroup.invite_status == "accepted",
                UserGroup.user_id.in_(requested_users),
            )
            .all()
        }
        if accepted_users != requested_users:
            raise HTTPException(status_code=422, detail="Payer and assigned users must be accepted group members.")

        if payload.event_id is not None:
            event = db.get(Event, payload.event_id)
            if event is None or event.group_id != receipt.group_id:
                raise HTTPException(status_code=422, detail="Event must belong to the receipt's group.")

        try:
            calculation = calculate_splits(
                total=total,
                member_ids=sorted(totals),
                method="custom",
                values=dict(totals),
            )
        except SplitCalculationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        # save_expense deliberately does not commit, so all writes below are
        # part of the same transaction as the receipt and balances.
        expense_input = type("ReceiptExpenseData", (), {
            "group_id": receipt.group_id,
            "description": payload.description,
            "amount": total,
            "paid_by": payload.paid_by,
        })()
        expense = save_expense(expense_input, calculation["shares"], db)
        expense.event_id = payload.event_id
        for item_id, user_id, share in rows:
            db.add(ItemAssignment(receipt_item_id=item_id, user_id=user_id, share=share))
        update_balances(receipt.group_id, payload.paid_by, calculation["shares"], db)
        receipt.expense_id = expense.id
        receipt.status = "confirmed"
        db.commit()
        return ConfirmationResponse(
            receipt_id=receipt.id,
            expense_id=expense.id,
            status=receipt.status,
            amount=total,
            shares=calculation["shares"],
            excluded_item_ids=sorted(set(items_by_id) - set(chosen_ids)),
        )
    except Exception:
        db.rollback()
        raise
