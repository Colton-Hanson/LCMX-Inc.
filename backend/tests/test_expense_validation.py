
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.expenses import ExpenseCreate
from app.services.expense_validation import validate_expense


def make_expense(**overrides):
    data = {
        "group_id": 1,
        "description": "Groceries",
        "amount": "60.00",
        "paid_by": 1,
        "participant_ids": [1, 2, 3],
        "split_method": "even",
    }
    data.update(overrides)
    return ExpenseCreate(**data)


def test_valid_expense_schema():
    expense = make_expense()

    assert expense.amount == Decimal("60.00")
    assert expense.description == "Groceries"


def test_description_is_trimmed():
    expense = make_expense(description="  Dinner  ")
    assert expense.description == "Dinner"


@pytest.mark.parametrize(
    "changes",
    [
        {"amount": "0"},
        {"amount": "-5.00"},
        {"amount": "10.001"},
        {"amount": "NaN"},
        {"description": "   "},
        {"group_id": 0},
        {"paid_by": -1},
        {"participant_ids": []},
        {"participant_ids": [1, 1]},
        {"participant_ids": [1, -2]},
        {"split_method": "random"},
    ],
)
def test_invalid_expense_schema(changes):
    with pytest.raises(ValidationError):
        make_expense(**changes)


def test_valid_expense_calculates_shares():
    expense = make_expense()
    current_user = SimpleNamespace(id=1)
    db = MagicMock()

    # Simulate an accepted group membership.
    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(user_id=1),
        SimpleNamespace(user_id=2),
        SimpleNamespace(user_id=3),
    ]

    with patch(
        "app.services.expense_validation.require_group_membership"
    ):
        result = validate_expense(expense, current_user, db)

    assert result["shares"] == {
        1: Decimal("20.00"),
        2: Decimal("20.00"),
        3: Decimal("20.00"),
    }

    db.commit.assert_not_called()


def test_rejects_nonmember_participant():
    expense = make_expense()
    current_user = SimpleNamespace(id=1)
    db = MagicMock()

    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(user_id=1),
        SimpleNamespace(user_id=2),
    ]

    with patch(
        "app.services.expense_validation.require_group_membership"
    ):
        with pytest.raises(HTTPException) as exc:
            validate_expense(expense, current_user, db)

    assert exc.value.status_code == 422


def test_rejects_invalid_custom_split():
    expense = make_expense(
        split_method="custom",
        split_values={1: "10", 2: "10", 3: "10"},
    )
    current_user = SimpleNamespace(id=1)
    db = MagicMock()

    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(user_id=1),
        SimpleNamespace(user_id=2),
        SimpleNamespace(user_id=3),
    ]

    with patch(
        "app.services.expense_validation.require_group_membership"
    ):
        with pytest.raises(HTTPException) as exc:
            validate_expense(expense, current_user, db)

    assert exc.value.status_code == 422


def test_rejects_unauthorized_creator():
    expense = make_expense()
    current_user = SimpleNamespace(id=99)
    db = MagicMock()

    with patch(
        "app.services.expense_validation.require_group_membership",
        side_effect=HTTPException(
            status_code=403,
            detail="Not an accepted member.",
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            validate_expense(expense, current_user, db)

    assert exc.value.status_code == 403
    db.commit.assert_not_called()


def test_rejects_nonmember_payer():
    expense = make_expense(paid_by=99)
    current_user = SimpleNamespace(id=1)
    db = MagicMock()

    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(user_id=1),
        SimpleNamespace(user_id=2),
        SimpleNamespace(user_id=3),
    ]

    with patch(
        "app.services.expense_validation.require_group_membership"
    ):
        with pytest.raises(HTTPException) as exc:
            validate_expense(expense, current_user, db)

    assert exc.value.status_code == 422
    db.commit.assert_not_called()


def test_percentage_expense_validation():
    expense = make_expense(
        amount="100.00",
        split_method="percentage",
        split_values={1: "50", 2: "30", 3: "20"},
    )
    current_user = SimpleNamespace(id=1)
    db = MagicMock()

    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(user_id=1),
        SimpleNamespace(user_id=2),
        SimpleNamespace(user_id=3),
    ]

    with patch(
        "app.services.expense_validation.require_group_membership"
    ):
        result = validate_expense(expense, current_user, db)

    assert result["shares"] == {
        1: Decimal("50.00"),
        2: Decimal("30.00"),
        3: Decimal("20.00"),
    }
    db.commit.assert_not_called()

