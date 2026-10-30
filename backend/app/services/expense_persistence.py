
from decimal import Decimal

from sqlalchemy.orm import Session

from models import Balance, Expense, ExpenseSplit, Group, Split


def save_expense(expense_data, shares: dict[int, Decimal], db: Session) -> Expense:
    """Save an expense and its individual participant shares."""

    expense = Expense(
        group_id=expense_data.group_id,
        name=expense_data.description,
        amount=expense_data.amount,
        paid_by=expense_data.paid_by,
    )

    db.add(expense)
    db.flush()

    for user_id, amount in shares.items():
        split = Split(user_id=user_id, amount=amount)
        db.add(split)
        db.flush()

        db.add(
            ExpenseSplit(
                expense_id=expense.id,
                split_id=split.id,
            )
        )

    return expense


def update_balances(
    group_id: int,
    paid_by: int,
    shares: dict[int, Decimal],
    db: Session,
) -> None:
    """Net each participant's debt against the payer's existing balance."""

    for participant_id, share in shares.items():
        # Someone cannot owe themselves money.
        if participant_id == paid_by or share == 0:
            continue

        user_1, user_2 = sorted((participant_id, paid_by))

        balance = (
            db.query(Balance)
            .filter(
                Balance.group_id == group_id,
                Balance.user_1_id == user_1,
                Balance.user_2_id == user_2,
            )
            .one_or_none()
        )

        # Positive means user_1 owes user_2.
        # Negative means user_2 owes user_1.
        signed_debt = Decimal("0.00")

        if balance is not None and balance.indebted_party is not None:
            signed_debt = (
                balance.debt
                if balance.indebted_party == user_1
                else -balance.debt
            )

        change = share if participant_id == user_1 else -share
        new_debt = signed_debt + change

        if balance is None:
            balance = Balance(
                group_id=group_id,
                user_1_id=user_1,
                user_2_id=user_2,
            )
            db.add(balance)

        balance.debt = abs(new_debt)
        balance.indebted_party = (
            user_1 if new_debt > 0
            else user_2 if new_debt < 0
            else None
        )


def create_expense_transaction(expense_data, shares, db: Session) -> Expense:
    """Save the expense, splits, and balances in one transaction."""

    try:
        # Serialize expense updates within the same group.
        # This prevents simultaneous requests from overwriting balances.
        db.query(Group).filter(
            Group.id == expense_data.group_id
        ).with_for_update().one()

        expense = save_expense(expense_data, shares, db)

        update_balances(
            group_id=expense_data.group_id,
            paid_by=expense_data.paid_by,
            shares=shares,
            db=db,
        )

        db.commit()
        db.refresh(expense)
        return expense

    except Exception:
        db.rollback()
        raise
