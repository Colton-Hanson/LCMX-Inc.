from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import User, UserSession


TEST_EMAIL = "auth_test@example.com"
CASE_EMAIL = "auth_case_test@example.com"
TEST_PASSWORD = "TestPassword123!"
NEW_PASSWORD = "NewPassword123!"

# Addresses these tests may store. Case differences are saved lowercase.
TEST_EMAILS = (TEST_EMAIL, CASE_EMAIL)

def delete_test_user():
    db = SessionLocal()

    try:
        users = (
            db.query(User)
            .filter(User.email.in_(TEST_EMAILS))
            .all()
        )

        for user in users:
            db.query(UserSession).filter(
                UserSession.user_id == user.id
            ).delete()

            db.delete(user)

        if users:
            db.commit()

    finally:
        db.close()

@pytest.fixture(autouse=True)
def clean_test_user():
    # Clean up before each test.
    delete_test_user()

    yield

    # Clean up again after each test.
    delete_test_user()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def register_test_user(client, email=TEST_EMAIL, password=TEST_PASSWORD):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
        },
    )


def login_test_user(client, email=TEST_EMAIL, password=TEST_PASSWORD):
    return client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )


def test_registration_succeeds(client):
    response = register_test_user(client)

    assert response.status_code == 201

    data = response.json()

    assert data["email"] == TEST_EMAIL
    assert "id" in data
    assert "password" not in data


def test_duplicate_registration_returns_409(client):
    first_response = register_test_user(client)

    assert first_response.status_code == 201

    second_response = register_test_user(client)

    assert second_response.status_code == 409


def test_invalid_registration_returns_422(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "not-an-email",
            "password": "123",
        },
    )

    assert response.status_code == 422


def test_bad_login_returns_401(client):
    register_test_user(client)

    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_me_logout_flow(client):
    register_test_user(client)

    # Before login, protected route should fail.
    response = client.get("/auth/me")

    assert response.status_code == 401

    # Login.
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    # TestClient remembers the cookie automatically.
    response = client.get("/auth/me")

    assert response.status_code == 200

    data = response.json()

    assert data["email"] == TEST_EMAIL
    assert "id" in data

    # Logout.
    response = client.post("/auth/logout")

    assert response.status_code == 200

    # Cookie should now be gone.
    response = client.get("/auth/me")

    assert response.status_code == 401


# A password change with no session cookie is rejected.
def test_change_password_requires_login(client):
    response = client.post(
        "/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 401


# The current password must match before a new one is accepted.
def test_change_password_rejects_wrong_current_password(client):
    register_test_user(client)
    login_test_user(client)

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": "wrong-password",
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."


# A new password shorter than 8 characters is rejected by the field length limit.
def test_change_password_rejects_short_password(client):
    register_test_user(client)
    login_test_user(client)

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": "Ab!",
        },
    )

    assert response.status_code == 422
    assert "String should have at least 8 characters" in response.text


# A new password with no capital letter is rejected.
def test_change_password_rejects_password_without_capital(client):
    register_test_user(client)
    login_test_user(client)

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": "abcdefg!",
        },
    )

    assert response.status_code == 422
    assert "Password must contain at least one capital letter." in response.text


# A new password with no symbol is rejected.
def test_change_password_rejects_password_without_symbol(client):
    register_test_user(client)
    login_test_user(client)

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": "Abcdefgh",
        },
    )

    assert response.status_code == 422
    assert "Password must contain at least one symbol." in response.text


# A successful change revokes the old session and only the new password works.
def test_change_password_succeeds_and_revokes_session(client):
    register_test_user(client)
    login_test_user(client)

    response = client.post(
        "/auth/change-password",
        json={
            "current_password": TEST_PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == (
        "Password changed successfully. Please log in again."
    )

    # The cookie is still sent, but the session row is revoked.
    response = client.get("/auth/me")

    assert response.status_code == 401

    response = login_test_user(client, password=TEST_PASSWORD)

    assert response.status_code == 401

    response = login_test_user(client, password=NEW_PASSWORD)

    assert response.status_code == 200


# Email matching ignores letter case, so one person cannot get two accounts.
def test_registration_and_login_ignore_email_case(client):
    response = register_test_user(client, email="Auth_Case_Test@Example.com")

    assert response.status_code == 201
    assert response.json()["email"] == CASE_EMAIL

    response = register_test_user(client, email=CASE_EMAIL)

    assert response.status_code == 409

    response = login_test_user(client, email="AUTH_CASE_TEST@example.com")

    assert response.status_code == 200


# An unknown email gets the same message as a wrong password.
def test_unknown_email_login_returns_same_401(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "never_registered@example.com",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


# Logout still succeeds when the browser has no session cookie.
def test_logout_without_cookie_returns_200(client):
    response = client.post("/auth/logout")

    assert response.status_code == 200


# A revoked session cookie can no longer open a protected route.
def test_revoked_session_returns_401(client):
    register_test_user(client)
    login_test_user(client)

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == TEST_EMAIL)
            .first()
        )
        session = (
            db.query(UserSession)
            .filter(UserSession.user_id == user.id)
            .first()
        )
        session.revoked = True
        db.commit()
    finally:
        db.close()

    response = client.get("/auth/me")

    assert response.status_code == 401


# A session past its expiration time is rejected.
def test_expired_session_returns_401(client):
    register_test_user(client)
    login_test_user(client)

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == TEST_EMAIL)
            .first()
        )
        session = (
            db.query(UserSession)
            .filter(UserSession.user_id == user.id)
            .first()
        )
        session.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
    finally:
        db.close()

    response = client.get("/auth/me")

    assert response.status_code == 401