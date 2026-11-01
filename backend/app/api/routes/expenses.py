
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
    Group,
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

    # Fetch display names in one query, not one lookup per balance row.
    other_user_ids = {
        balance.user_2_id
        if balance.user_1_id == current_user.id
        else balance.user_1_id
        for balance in balances
    }
    names_by_id = (
        dict(db.query(User.id, User.name).filter(User.id.in_(other_user_ids)).all())
        if other_user_ids
        else {}
    )

    # Each entry is the signed contribution of one expense to the balance
    # between the logged-in user and a specific other user. A positive amount
    # means the other user owes you; a negative amount means you owe them.
    # Query once for all relevant expenses to avoid N+1 lookups.
    relevant_group_ids = {balance.group_id for balance in balances}
    expense_rows = (
        db.query(Expense, Split.user_id, Split.amount)
        .join(ExpenseSplit, ExpenseSplit.expense_id == Expense.id)
        .join(Split, Split.id == ExpenseSplit.split_id)
        .filter(
            Expense.group_id.in_(relevant_group_ids),
            or_(
                Expense.paid_by == current_user.id,
                Split.user_id == current_user.id,
            ),
        )
        .order_by(Expense.created_at.desc(), Expense.id.desc())
        .all()
        if relevant_group_ids
        else []
    )

    # Fetch the current user's actual share separately. When this user paid,
    # the rows above contain OTHER participants' shares instead.
    relevant_expense_ids = {expense.id for expense, _, _ in expense_rows}
    current_user_shares = (
        dict(
            db.query(ExpenseSplit.expense_id, Split.amount)
            .join(Split, Split.id == ExpenseSplit.split_id)
            .filter(
                ExpenseSplit.expense_id.in_(relevant_expense_ids),
                Split.user_id == current_user.id,
            )
            .all()
        )
        if relevant_expense_ids
        else {}
    )

    expenses_by_pair = defaultdict(list)
    for expense, participant_id, share in expense_rows:
        if expense.paid_by == current_user.id:
            # The payer's own split does not contribute to a debt.
            if participant_id == current_user.id:
                continue
            other_id = participant_id
            signed_amount = Decimal(share)
        elif participant_id == current_user.id:
            other_id = expense.paid_by
            signed_amount = -Decimal(share)
        else:
            continue

        if signed_amount == 0:
            continue

        expenses_by_pair[(expense.group_id, other_id)].append({
            "id": expense.id,
            "group_id": expense.group_id,
            "description": expense.name,
            "amount": str(expense.amount),
            "paid_by": expense.paid_by,
            "your_share": str(Decimal(current_user_shares.get(expense.id, 0))),
            "counterparty_share": str(Decimal(share)) if expense.paid_by == current_user.id else None,
            "signed_amount": str(signed_amount),
            "created_at": expense.created_at,
        })

    group_names = (
        dict(db.query(Group.id, Group.name).filter(Group.id.in_(relevant_group_ids)).all())
        if relevant_group_ids
        else {}
    )

    group_balances = []
    overall_by_user = defaultdict(lambda: Decimal("0.00"))
    overall_expenses = defaultdict(list)

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

        pair_expenses = expenses_by_pair[(balance.group_id, other_user_id)]
        group_balances.append(
            {
                "group_id": balance.group_id,
                "group_name": group_names.get(balance.group_id),
                "other_user_id": other_user_id,
                "other_user_name": names_by_id.get(other_user_id),
                "net_amount": str(net),
                "you_owe": str(max(-net, Decimal("0.00"))),
                "owed_to_you": str(max(net, Decimal("0.00"))),
                "expenses": pair_expenses,
            }
        )

        overall_by_user[other_user_id] += net
        overall_expenses[other_user_id].extend(pair_expenses)

    overall_balances = [
        {
            "other_user_id": other_user_id,
            "other_user_name": names_by_id.get(other_user_id),
            "net_amount": str(net),
            "you_owe": str(max(-net, Decimal("0.00"))),
            "owed_to_you": str(max(net, Decimal("0.00"))),
            # One overall balance may combine multiple groups.
            "expenses": sorted(
                overall_expenses[other_user_id],
                key=lambda expense: (expense["created_at"], expense["id"]),
                reverse=True,
            ),
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
