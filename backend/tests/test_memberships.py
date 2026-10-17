import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.api.routes import memberships
from models import Group, User, UserGroup, UserSession


@pytest.fixture
def membership_setup():
    password = "TestPassword123!"

    emails = {
        role: f"{role}_{uuid.uuid4().hex}@example.com"
        for role in ("admin", "member", "outsider")
    }

    user_ids = {}
    clients = {}

    try:
        # Register and log in three separate users.
        for role, email in emails.items():
            client = TestClient(app)
            clients[role] = client

            response = client.post(
                "/auth/register",
                json={
                    "email": email,
                    "password": password,
                },
            )
            assert response.status_code == 201

            user_ids[role] = response.json()["id"]

            response = client.post(
                "/auth/login",
                json={
                    "email": email,
                    "password": password,
                },
            )
            assert response.status_code == 200

        # The administrator creates a group.
        response = clients["admin"].post(
            "/groups",
            json={
                "name": "Membership Test Group",
                "group_type": "outing",
            },
        )
        assert response.status_code == 201

        group_id = response.json()["id"]

        # Add the second user as an accepted, non-admin member.
        with SessionLocal() as db:
            db.add(
                UserGroup(
                    user_id=user_ids["member"],
                    group_id=group_id,
                    is_admin=False,
                    invite_status="accepted",
                )
            )
            db.commit()

        yield {
            "clients": clients,
            "group_id": group_id,
            "user_ids": user_ids,
        }

    finally:
        for client in clients.values():
            client.close()

        # Only remove data belonging to this test.
        with SessionLocal() as db:
            created_ids = list(user_ids.values())

            groups = (
                db.query(Group)
                .filter(Group.created_by.in_(created_ids))
                .all()
                if created_ids
                else []
            )

            for group in groups:
                db.query(UserGroup).filter(
                    UserGroup.group_id == group.id
                ).delete(synchronize_session=False)

                db.delete(group)

            # Ensure groups are deleted before their creators.
            db.flush()

            if created_ids:
                db.query(UserSession).filter(
                    UserSession.user_id.in_(created_ids)
                ).delete(synchronize_session=False)

                db.query(User).filter(
                    User.id.in_(created_ids)
                ).delete(synchronize_session=False)

            db.commit()


def test_admin_can_list_members(membership_setup):
    setup = membership_setup
    response = setup["clients"]["admin"].get(
        f"/groups/{setup['group_id']}/members"
    )

    assert response.status_code == 200

    members = response.json()
    member_ids = {member["user_id"] for member in members}

    assert setup["user_ids"]["admin"] in member_ids
    assert setup["user_ids"]["member"] in member_ids
    assert setup["user_ids"]["outsider"] not in member_ids


def test_regular_member_can_list_members(membership_setup):
    setup = membership_setup

    response = setup["clients"]["member"].get(
        f"/groups/{setup['group_id']}/members"
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_outsider_cannot_list_members(membership_setup):
    setup = membership_setup

    response = setup["clients"]["outsider"].get(
        f"/groups/{setup['group_id']}/members"
    )

    assert response.status_code == 403


def test_admin_can_remove_member(membership_setup):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}"
    )

    assert response.status_code == 200

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (member_id, setup["group_id"]),
        )
        assert membership is None

        # Removing membership must not delete the user account.
        assert db.get(User, member_id) is not None


def test_regular_member_cannot_remove(membership_setup):
    setup = membership_setup
    admin_id = setup["user_ids"]["admin"]

    response = setup["clients"]["member"].delete(
        f"/groups/{setup['group_id']}/members/{admin_id}"
    )

    assert response.status_code == 403


def test_outsider_cannot_remove(membership_setup):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]

    response = setup["clients"]["outsider"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}"
    )

    assert response.status_code == 403


def test_sole_admin_cannot_remove_self(membership_setup):
    setup = membership_setup
    admin_id = setup["user_ids"]["admin"]

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{admin_id}"
    )

    assert response.status_code == 409

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (admin_id, setup["group_id"]),
        )
        assert membership is not None
        assert membership.is_admin is True


def test_missing_member_returns_404(membership_setup):
    setup = membership_setup

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/999999999"
    )

    assert response.status_code == 404


def test_balance_requires_confirmation(
    membership_setup,
    monkeypatch,
):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]

    # Simulate an outstanding $25 balance.
    monkeypatch.setattr(
        memberships,
        "get_member_balance",
        lambda group_id, user_id: 25.0,
    )

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}"
    )

    assert response.status_code == 409
    assert response.json()["detail"]["confirmation_required"] is True

    # The member must still belong to the group.
    with SessionLocal() as db:
        assert db.get(
            UserGroup,
            (member_id, setup["group_id"]),
        ) is not None


def test_balance_removal_with_confirmation(
    membership_setup,
    monkeypatch,
):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]

    monkeypatch.setattr(
        memberships,
        "get_member_balance",
        lambda group_id, user_id: 25.0,
    )

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}",
        params={"confirm": "true"},
    )

    assert response.status_code == 200

    with SessionLocal() as db:
        assert db.get(
            UserGroup,
            (member_id, setup["group_id"]),
        ) is None