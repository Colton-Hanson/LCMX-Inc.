
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.routes.memberships import require_group_membership
from app.schemas.expenses import ExpenseCreate
from app.services.split_calculator import (
    SplitCalculationError,
    calculate_splits,
)
from models import User, UserGroup


def validate_expense(
    expense: ExpenseCreate,
    current_user: User,
    db: Session,
):
    """
    Validate an expense before saving it.

    Checks group access, payer, participants, and splits.
    Does not write to the database.
    """

    # Only accepted group members can create expenses.
    require_group_membership(
        expense.group_id,
        current_user,
        db,
    )

    # Check that the payer and all participants
    # belong to the group.
    requested_ids = set(expense.participant_ids)
    requested_ids.add(expense.paid_by)

    valid_members = (
        db.query(UserGroup.user_id)
        .filter(
            UserGroup.group_id == expense.group_id,
            UserGroup.invite_status == "accepted",
            UserGroup.user_id.in_(requested_ids),
        )
        .all()
    )

    valid_ids = {row.user_id for row in valid_members}

    if valid_ids != requested_ids:
        raise HTTPException(
            status_code=422,
            detail="Payer and participants must be accepted group members.",
        )

    # Run the calculator built in It4-4.
    try:
        result = calculate_splits(
            total=expense.amount,
            member_ids=expense.participant_ids,
            method=expense.split_method,
            values=expense.split_values,
        )
    except SplitCalculationError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    return result
