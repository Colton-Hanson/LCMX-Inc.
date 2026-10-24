
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from app.schemas.expenses import ExpenseCreate
from app.services.expense_validation import validate_expense
from models import User


router = APIRouter(
    tags=["Expenses"],
)


@router.get("/groups/{group_id}/expenses")
def list_group_expenses(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)

    # Database retrieval will be added after Mick's migrations.
    return []


@router.post("/expenses", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def create_expense(
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate the requester, payer, participants, and split.
    validate_expense(expense_data, current_user, db)

    # Never claim an expense was saved before persistence exists.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Expense persistence is not implemented yet.",
    )
