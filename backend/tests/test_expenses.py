
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_create_expense_requires_authentication():
    response = client.post(
        "/expenses",
        json={
            "group_id": 1,
            "description": "Groceries",
            "amount": "60.00",
            "paid_by": 1,
            "participant_ids": [1, 2],
            "split_method": "even",
        },
    )

    assert response.status_code == 401


def test_create_expense_invalid_request():
    # Patching authentication lets this test focus on input validation.
    from app.api.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: type(
        "User", (), {"id": 1}
    )()

    try:
        response = client.post(
            "/expenses",
            json={
                "group_id": 1,
                "description": "   ",
                "amount": "-10.00",
                "paid_by": 1,
                "participant_ids": [],
            },
        )

        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_create_expense_not_implemented():
    from app.api.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: type(
        "User", (), {"id": 1}
    )()

    try:
        with patch(
            "app.api.routes.expenses.validate_expense",
            return_value={
                "shares": {1: 30, 2: 30},
                "rounding_adjusted_member_ids": [],
            },
        ):
            response = client.post(
                "/expenses",
                json={
                    "group_id": 1,
                    "description": "Groceries",
                    "amount": "60.00",
                    "paid_by": 1,
                    "participant_ids": [1, 2],
                },
            )

        assert response.status_code == 501
        assert "not implemented" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
