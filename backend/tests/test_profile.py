import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.main import app
from app.db.session import SessionLocal
from models import User, UserSession


PROFILE_EMAIL = "profile_test@example.com"
OTHER_EMAIL = "profile_other@example.com"
NEW_EMAIL = "profile_new@example.com"
PASSWORD = "TestPassword123!"

# Addresses these tests may store, including an email after it is confirmed.
PROFILE_EMAILS = (PROFILE_EMAIL, OTHER_EMAIL, NEW_EMAIL)


def delete_profile_users():
    db = SessionLocal()

    try:
        users = (
            db.query(User)
            .filter(User.email.in_(PROFILE_EMAILS))
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
def email_verification_secret(monkeypatch):
    # Token tests need a signing key even when the local env file omits one.
    monkeypatch.setattr(
        security,
        "EMAIL_VERIFICATION_SECRET",
        "test-email-verification-secret-key",
    )


@pytest.fixture(autouse=True)
def clean_profile_users():
    # Clean up before each test.
    delete_profile_users()

    yield

    # Clean up again after each test.
    delete_profile_users()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def register_user(client, email):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
        },
    )


def register_and_login(client, email=PROFILE_EMAIL):
    register_response = register_user(client, email)
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": PASSWORD,
        },
    )
    assert login_response.status_code == 200


# Reading or updating a profile requires a session cookie.
def test_profile_requires_login(client):
    get_response = client.get("/profile")
    patch_response = client.patch(
        "/profile",
        json={"name": "Ada"},
    )

    assert get_response.status_code == 401
    assert patch_response.status_code == 401


# A new account's profile includes the fields the settings page reads.
def test_get_profile_returns_saved_fields(client):
    register_and_login(client)

    response = client.get("/profile")

    assert response.status_code == 200

    data = response.json()

    assert "id" in data
    assert data["email"] == PROFILE_EMAIL
    assert data["name"] is None
    assert data["photo_url"] is None
    assert data["notify_group_invite"] is True
    assert data["notify_new_expense"] is True
    assert data["notify_settlement"] is True
    assert data["notify_removed_from_group"] is True
    assert data["email_verified"] is False
    assert data["pending_email"] is None


# A name update leaves the other profile fields alone, and padding is trimmed.
def test_patch_name_does_not_change_other_fields(client):
    register_and_login(client)

    response = client.patch(
        "/profile",
        json={"name": "  Ada  "},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ada"
    assert data["notify_group_invite"] is True
    assert data["notify_new_expense"] is True
    assert data["notify_settlement"] is True
    assert data["notify_removed_from_group"] is True

    response = client.patch(
        "/profile",
        json={"notify_settlement": False},
    )

    assert response.status_code == 200
    assert response.json()["notify_settlement"] is False
    assert response.json()["name"] == "Ada"

    response = client.patch(
        "/profile",
        json={"name": "Ada Lovelace"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ada Lovelace"
    assert data["notify_settlement"] is False


# A blank name is rejected instead of being saved.
def test_patch_rejects_blank_name(client):
    register_and_login(client)

    for blank_name in ("", "   "):
        response = client.patch(
            "/profile",
            json={"name": blank_name},
        )

        assert response.status_code == 422
        assert "Name cannot be blank." in response.text

    profile = client.get("/profile")

    assert profile.json()["name"] is None


# A photo path inside the uploads folder is saved.
def test_patch_accepts_uploads_photo(client):
    register_and_login(client)

    response = client.patch(
        "/profile",
        json={"photo_url": "uploads/avatar.png"},
    )

    assert response.status_code == 200
    assert response.json()["photo_url"] == "uploads/avatar.png"


# An absolute photo path is rejected.
def test_patch_rejects_absolute_photo_path(client):
    register_and_login(client)

    response = client.patch(
        "/profile",
        json={"photo_url": "/etc/passwd"},
    )

    assert response.status_code == 422
    assert "Photo path must be a safe relative path." in response.text


# A photo path that climbs out of its folder is rejected.
def test_patch_rejects_photo_path_with_parent_segment(client):
    register_and_login(client)

    response = client.patch(
        "/profile",
        json={"photo_url": "uploads/../secret"},
    )

    assert response.status_code == 422
    assert "Photo path must be a safe relative path." in response.text


# A photo path outside the uploads folder is rejected.
def test_patch_rejects_photo_outside_uploads(client):
    register_and_login(client)

    response = client.patch(
        "/profile",
        json={"photo_url": "photos/avatar.png"},
    )

    assert response.status_code == 422
    assert "Photo path must be inside the uploads folder." in response.text


# Starting an email change requires a session cookie.
def test_email_change_requires_login(client):
    response = client.post(
        "/profile/email-change",
        json={"new_email": NEW_EMAIL},
    )

    assert response.status_code == 401


# The new address has to be different from the one already on the account.
def test_email_change_rejects_same_email(client):
    register_and_login(client)

    response = client.post(
        "/profile/email-change",
        json={"new_email": PROFILE_EMAIL},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "New email must be different from the current email."
    )


# An address that already belongs to someone else is rejected.
def test_email_change_rejects_taken_email(client):
    register_user(client, OTHER_EMAIL)
    register_and_login(client)

    response = client.post(
        "/profile/email-change",
        json={"new_email": OTHER_EMAIL},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "That email address is already in use."


# A free address is stored as pending and a verification token is returned.
def test_email_change_stores_pending_email(client):
    register_and_login(client)

    response = client.post(
        "/profile/email-change",
        json={"new_email": NEW_EMAIL},
    )

    assert response.status_code == 200
    assert response.json()["verification_token"]

    profile = client.get("/profile")

    assert profile.status_code == 200
    assert profile.json()["email"] == PROFILE_EMAIL
    assert profile.json()["pending_email"] == NEW_EMAIL


# A token that is not a real verification token is rejected.
def test_confirm_rejects_garbage_token(client):
    response = client.post(
        "/profile/email-change/confirm",
        json={"token": "not-a-real-token"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired verification token."


# Confirm fails when the pending address no longer matches the token.
def test_confirm_rejects_token_that_does_not_match_pending_email(client):
    register_and_login(client)

    requested = client.post(
        "/profile/email-change",
        json={"new_email": NEW_EMAIL},
    )
    token = requested.json()["verification_token"]

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == PROFILE_EMAIL)
            .first()
        )
        user.pending_email = "profile_mismatch@example.com"
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/profile/email-change/confirm",
        json={"token": token},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired verification token."


# Confirm fails if another account takes the address before the token is used.
def test_confirm_rejects_email_taken_after_request(client):
    register_and_login(client)

    requested = client.post(
        "/profile/email-change",
        json={"new_email": NEW_EMAIL},
    )
    token = requested.json()["verification_token"]

    taken = register_user(client, NEW_EMAIL)

    assert taken.status_code == 201

    response = client.post(
        "/profile/email-change/confirm",
        json={"token": token},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "That email address is already in use."


# A matching token replaces the email and marks it verified.
def test_confirm_updates_email(client):
    register_and_login(client)

    requested = client.post(
        "/profile/email-change",
        json={"new_email": NEW_EMAIL},
    )
    token = requested.json()["verification_token"]

    response = client.post(
        "/profile/email-change/confirm",
        json={"token": token},
    )

    assert response.status_code == 200

    profile = client.get("/profile")

    assert profile.status_code == 200
    assert profile.json()["email"] == NEW_EMAIL
    assert profile.json()["pending_email"] is None
    assert profile.json()["email_verified"] is True
