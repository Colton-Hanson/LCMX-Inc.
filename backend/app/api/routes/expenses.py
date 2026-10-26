
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from app.schemas.expenses import ExpenseCreate
from app.services.expense_validation import validate_expense
from app.services.expense_persistence import create_expense_transaction
from models import (
    Balance,
    Expense,
    ExpenseSplit,
    Split,
    User,
    UserGroup,
)


router = APIRouter(tags=["Expenses"])


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validation = validate_expense(expense_data, current_user, db)

    expense = create_expense_transaction(
        expense_data,
        validation["shares"],
        db,
    )

    return {
        "id": expense.id,
        "group_id": expense.group_id,
        "description": expense.name,
        "amount": str(expense.amount),
        "paid_by": expense.paid_by,
        "created_at": expense.created_at,
        "shares": {
            user_id: str(amount)
            for user_id, amount in validation["shares"].items()
        },
        "rounding_adjusted_member_ids": validation[
            "rounding_adjusted_member_ids"
        ],
    }


@router.get("/groups/{group_id}/expenses")
def list_group_expenses(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)

    expenses = (
        db.query(Expense)
        .filter(Expense.group_id == group_id)
        .order_by(
            Expense.created_at.desc(),
            Expense.id.desc(),
        )
        .all()
    )

    if not expenses:
        return []

    expense_ids = [expense.id for expense in expenses]

    split_rows = (
        db.query(ExpenseSplit.expense_id, Split.user_id, Split.amount)
        .join(Split, Split.id == ExpenseSplit.split_id)
        .filter(ExpenseSplit.expense_id.in_(expense_ids))
        .all()
    )

    shares_by_expense = defaultdict(dict)

    for expense_id, user_id, amount in split_rows:
        shares_by_expense[expense_id][user_id] = str(amount)

    return [
        {
            "id": expense.id,
            "group_id": expense.group_id,
            "description": expense.name,
            "amount": str(expense.amount),
            "paid_by": expense.paid_by,
            "created_at": expense.created_at,
            "shares": shares_by_expense[expense.id],
        }
        for expense in expenses
    ]


@router.get("/balances")
def get_balances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only consider groups the user is an accepted member of.
    accepted_group_ids = (
        db.query(UserGroup.group_id)
        .filter(
            UserGroup.user_id == current_user.id,
            UserGroup.invite_status == "accepted",
        )
    )

    balances = (
        db.query(Balance)
        .filter(
            Balance.group_id.in_(accepted_group_ids),
            or_(
                Balance.user_1_id == current_user.id,
                Balance.user_2_id == current_user.id,
            ),
        )
        .order_by(Balance.group_id)
        .all()
    )

    group_balances = []
    overall_by_user = defaultdict(lambda: Decimal("0.00"))

    for balance in balances:
        other_user_id = (
            balance.user_2_id
            if balance.user_1_id == current_user.id
            else balance.user_1_id
        )

        amount = Decimal(balance.debt)

        # Positive net means the other user owes you.
        # Negative net means you owe the other user.
        if balance.indebted_party is None:
            net = Decimal("0.00")
        elif balance.indebted_party == current_user.id:
            net = -amount
        else:
            net = amount

        group_balances.append(
            {
                "group_id": balance.group_id,
                "other_user_id": other_user_id,
                "net_amount": str(net),
                "you_owe": str(max(-net, Decimal("0.00"))),
                "owed_to_you": str(max(net, Decimal("0.00"))),
            }
        )

        overall_by_user[other_user_id] += net

    overall_balances = [
        {
            "other_user_id": other_user_id,
            "net_amount": str(net),
            "you_owe": str(max(-net, Decimal("0.00"))),
            "owed_to_you": str(max(net, Decimal("0.00"))),
        }
        for other_user_id, net in sorted(overall_by_user.items())
    ]

    total_net = sum(
        overall_by_user.values(),
        Decimal("0.00"),
    )

    return {
        "group_balances": group_balances,
        "overall_balances": overall_balances,
        "total_net": str(total_net),
    }
