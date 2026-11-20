"""It7-12: edit/delete a manual expense and its financial effects together.

The edit-rights requirement and event_id migration are not finalized yet. Until
then, restrict mutations to group admins and refuse changing the expense group.
"""

from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from app.schemas.expenses import ExpenseCreate
from app.services.expense_persistence import update_balances
from app.services.expense_validation import validate_expense
from models import Expense, ExpenseSplit, Group, Receipt, Split, User


router = APIRouter(tags=["Expense Mutations"])


class ExpenseUpdate(ExpenseCreate):
    """PUT replaces a manual expense's editable fields and participant shares."""


class ExpenseUpdateResult(BaseModel):
    id: int
    group_id: int
    description: str
    amount: Decimal
    paid_by: int
    event_id: int | None
    shares: dict[int, Decimal]
    rounding_adjusted_member_ids: list[int]


def _expense_and_permission(expense_id: int, user: User, db: Session) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    membership = require_group_membership(expense.group_id, user, db)
    # Conservative temporary rule until Xander records the official edit policy.
    if not membership.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only group administrators may edit or delete expenses for now.",
        )
    return expense


def _load_splits(expense_id: int, db: Session):
    return (
        db.query(ExpenseSplit, Split)
        .join(Split, Split.id == ExpenseSplit.split_id)
        .filter(ExpenseSplit.expense_id == expense_id)
        .all()
    )


def _remove_splits_and_reverse(expense: Expense, db: Session) -> None:
    """Subtract only this expense's contributions from the existing net balances.

    This preserves other expenses' effects, and will also preserve recorded
    settlements once those are introduced in It7-13.
    """
    old_shares = defaultdict(lambda: Decimal("0.00"))
    old_rows = _load_splits(expense.id, db)
    for _, split in old_rows:
        old_shares[split.user_id] += Decimal(split.amount)

    update_balances(
        expense.group_id,
        expense.paid_by,
        {user_id: -amount for user_id, amount in old_shares.items()},
        db,
    )
    # Delete join rows first to avoid FK violations. Split rows are not reused.
    for link, split in old_rows:
        db.delete(link)
    db.flush()
    for _, split in old_rows:
        db.delete(split)


def _save_new_splits(expense: Expense, shares: dict[int, Decimal], db: Session):
    for user_id, amount in shares.items():
        split = Split(user_id=user_id, amount=amount)
        db.add(split)
        db.flush()
        db.add(ExpenseSplit(expense_id=expense.id, split_id=split.id))
    update_balances(expense.group_id, expense.paid_by, shares, db)


def _lock_group_and_expense(expense: Expense, db: Session) -> Expense:
    # Same group lock used by expense creation: serialize balance mutations.
    db.query(Group).filter(Group.id == expense.group_id).with_for_update().one()
    locked = (
        db.query(Expense)
        .filter(Expense.id == expense.id, Expense.group_id == expense.group_id)
        .with_for_update()
        .one_or_none()
    )
    if locked is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return locked


@router.put("/expenses/{expense_id}", response_model=ExpenseUpdateResult)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace an expense's data, splits, and net balance contributions atomically."""
    try:
        expense = _expense_and_permission(expense_id, current_user, db)
        if payload.group_id != expense.group_id:
            raise HTTPException(status_code=422, detail="An expense cannot change groups.")
        validated = validate_expense(payload, current_user, db)
        expense = _lock_group_and_expense(expense, db)

        # A receipt-confirmation workflow will own edits to receipt-derived
        # expenses in a later iteration. Do not silently desynchronize items.
        if db.query(Receipt.id).filter(Receipt.expense_id == expense.id).first():
            raise HTTPException(
                status_code=409,
                detail="This expense has a linked receipt; edit its items through receipt review.",
            )

        _remove_splits_and_reverse(expense, db)
        expense.name = payload.description
        expense.amount = payload.amount
        expense.paid_by = payload.paid_by
        expense.event_id = payload.event_id
        _save_new_splits(expense, validated["shares"], db)
        db.commit()
        db.refresh(expense)
        return ExpenseUpdateResult(
            id=expense.id,
            group_id=expense.group_id,
            description=expense.name,
            amount=expense.amount,
            paid_by=expense.paid_by,
            event_id=expense.event_id,
            shares=validated["shares"],
            rounding_adjusted_member_ids=validated["rounding_adjusted_member_ids"],
        )
    except Exception:
        db.rollback()
        raise


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_200_OK)
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a manual expense and reverse its contributions in one transaction."""
    try:
        expense = _expense_and_permission(expense_id, current_user, db)
        expense = _lock_group_and_expense(expense, db)
        if db.query(Receipt.id).filter(Receipt.expense_id == expense.id).first():
            raise HTTPException(
                status_code=409,
                detail="Expense has a linked receipt; detach or manage the receipt first.",
            )
        _remove_splits_and_reverse(expense, db)
        db.delete(expense)
        db.commit()
        return {"message": "Expense deleted.", "expense_id": expense_id}
    except Exception:
        db.rollback()
        raise
