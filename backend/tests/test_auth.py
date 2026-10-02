import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import User


TEST_EMAIL = "auth_test@example.com"
TEST_PASSWORD = "testing123"


def delete_test_user():
    db = SessionLocal()

    try:
        db.query(User).filter(User.email == TEST_EMAIL).delete()
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


def register_test_user(client):
    return client.post(
        "/auth/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
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