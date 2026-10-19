import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import Group, User, UserGroup, UserSession


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def authenticated_user(client):
    # Generate a unique email for each test.
    email = f"group_test_{uuid.uuid4().hex}@example.com"
    password = "TestPassword123!"

    registration = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert registration.status_code == 201

    user_id = registration.json()["id"]

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200

    yield user_id

    # Remove any groups created by this test user.
    with SessionLocal() as db:
        groups = db.query(Group).filter(
            Group.created_by == user_id
        ).all()

        for group in groups:
            db.delete(group)

        db.query(UserGroup).filter(
            UserGroup.user_id == user_id
        ).delete(synchronize_session=False)

        db.query(UserSession).filter(
            UserSession.user_id == user_id
        ).delete(synchronize_session=False)

        user = db.get(User, user_id)

        if user:
            db.delete(user)

        db.commit()


# Required case: create a group. The creator becomes an accepted administrator.
def test_create_group_success(client, authenticated_user):
    response = client.post(
        "/groups",
        json={
            "name": "Test Roommates",
            "group_type": "roommate",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == "Test Roommates"
    assert data["group_type"] == "roommate"
    assert data["created_by"] == authenticated_user

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (authenticated_user, data["id"]),
        )

        assert membership is not None
        assert membership.is_admin is True
        assert membership.invite_status == "accepted"


def test_create_group_invalid_type(client, authenticated_user):
    response = client.post(
        "/groups",
        json={
            "name": "Invalid Group",
            "group_type": "business",
        },
    )

    assert response.status_code == 422


def test_create_group_unauthenticated(client):
    response = client.post(
        "/groups",
        json={
            "name": "Unauthorized Group",
            "group_type": "family",
        },
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "group_type",
    ["roommate", "partner", "family", "outing"],
)
def test_all_valid_group_types(
    client,
    authenticated_user,
    group_type,
):
    response = client.post(
        "/groups",
        json={
            "name": f"Test {group_type}",
            "group_type": group_type,
        },
    )

    assert response.status_code == 201
    assert response.json()["group_type"] == group_type
