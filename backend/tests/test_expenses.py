
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import engine
from app.main import app
from models import Group, User, UserGroup


client = TestClient(app)

# Same database the other expense tests use, so this stays off the dev data.
test_engine = create_engine(
    engine.url.set(database="shared_expense_sprint4_test")
)


@pytest.fixture
def member_and_outsider():
    # An outer transaction rolls the rows back when the test ends.
    connection = test_engine.connect()
    transaction = connection.begin()
    db = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    try:
        suffix = uuid4().hex
        member = User(
            email=f"member-{suffix}@example.com",
            password_hash="route-test",
        )
        outsider = User(
            email=f"outsider-{suffix}@example.com",
            password_hash="route-test",
        )
        db.add_all([member, outsider])
        db.flush()

        group = Group(
            name="Route Test Group",
            group_type="roommate",
            created_by=member.id,
        )
        db.add(group)
        db.flush()

        db.add(
            UserGroup(
                user_id=member.id,
                group_id=group.id,
                invite_status="accepted",
            )
        )
        db.flush()

        yield {"db": db, "member": member, "outsider": outsider, "group": group}
    finally:
        db.close()
        transaction.rollback()
        connection.close()


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


def test_create_expense_success():
    from unittest.mock import patch
    from app.api.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: type(
        "User", (), {"id": 1}
    )()

    try:
        with (
            patch(
                "app.api.routes.expenses.validate_expense",
                return_value={
                    "shares": {1: 30, 2: 30},
                    "rounding_adjusted_member_ids": [],
                },
            ),
            patch(
                "app.api.routes.expenses.create_expense_transaction"
            ) as mock_create,
        ):
            mock_create.return_value = type(
                "Expense",
                (),
                {
                    "id": 1,
                    "group_id": 1,
                    "name": "Groceries",
                    "amount": "60.00",
                    "paid_by": 1,
                    "created_at": None,
                },
            )()

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

        assert response.status_code == 201
        assert response.json()["id"] == 1
        assert response.json()["description"] == "Groceries"
        assert response.json()["amount"] == "60.00"
        assert response.json()["shares"] == {"1": "30", "2": "30"}
        mock_create.assert_called_once()

    finally:
        app.dependency_overrides.clear()


def test_list_expenses_requires_authentication():
    # Reading a group's expenses needs a signed-in user.
    response = client.get("/groups/1/expenses")

    assert response.status_code == 401


def test_list_expenses_forbidden_for_non_member(member_and_outsider):
    # Arrange: one accepted member, and another user who is not in the group.
    from app.api.dependencies import get_current_user
    from app.db.session import get_db

    db = member_and_outsider["db"]
    outsider = member_and_outsider["outsider"]
    group = member_and_outsider["group"]

    app.dependency_overrides[get_current_user] = lambda: outsider
    app.dependency_overrides[get_db] = lambda: db

    try:
        # Act: the outsider asks for that group's expenses.
        response = client.get(f"/groups/{group.id}/expenses")

        # Assert: membership is required, so the list is refused.
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
        