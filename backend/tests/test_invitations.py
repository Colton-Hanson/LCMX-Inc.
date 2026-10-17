import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import Group, User, UserGroup, UserSession


@pytest.fixture
def invitation_setup():
    email_a = f"inviter_{uuid.uuid4().hex}@example.com"
    email_b = f"invitee_{uuid.uuid4().hex}@example.com"
    email_c = f"outsider_{uuid.uuid4().hex}@example.com"
    password = "TestPassword123!"

    with TestClient(app) as client:
        user_ids = []

        for email in (email_a, email_b, email_c):
            response = client.post(
                "/auth/register",
                json={"email": email, "password": password},
            )
            assert response.status_code == 201
            user_ids.append(response.json()["id"])

        inviter_id, invitee_id, outsider_id = user_ids

        login = client.post(
            "/auth/login",
            json={"email": email_a, "password": password},
        )
        assert login.status_code == 200

        response = client.post(
            "/groups",
            json={"name": "Invitation Test", "group_type": "outing"},
        )
        assert response.status_code == 201
        group_id = response.json()["id"]

        # Store authentication cookies for each user separately.
        clients = {}

        for email, role in (
            (email_a, "inviter"),
            (email_b, "invitee"),
            (email_c, "outsider"),
        ):
            test_client = TestClient(app)
            response = test_client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert response.status_code == 200
            clients[role] = test_client

        yield {
            "clients": clients,
            "group_id": group_id,
            "inviter_id": inviter_id,
            "invitee_id": invitee_id,
            "outsider_id": outsider_id,
            "invitee_email": email_b,
        }

        # Clean up test data.
        for test_client in clients.values():
            test_client.close()

        with SessionLocal() as db:
            db.query(UserGroup).filter(
                UserGroup.group_id == group_id
            ).delete(synchronize_session=False)

            group = db.get(Group, group_id)
            if group:
                db.delete(group)
                db.flush()

            db.query(UserSession).filter(
                UserSession.user_id.in_(user_ids)
            ).delete(synchronize_session=False)

            db.query(User).filter(
                User.id.in_(user_ids)
            ).delete(synchronize_session=False)

            db.commit()


def send_invitation(setup):
    return setup["clients"]["inviter"].post(
        f"/groups/{setup['group_id']}/invitations",
        json={"email": setup["invitee_email"]},
    )


def test_invitation_created(invitation_setup):
    response = send_invitation(invitation_setup)

    assert response.status_code == 201
    assert response.json()["status"] == "pending"

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (
                invitation_setup["invitee_id"],
                invitation_setup["group_id"],
            ),
        )
        assert membership is not None
        assert membership.invite_status == "pending"
        assert membership.is_admin is False


def test_duplicate_invitation_returns_409(invitation_setup):
    assert send_invitation(invitation_setup).status_code == 201
    assert send_invitation(invitation_setup).status_code == 409


def test_accept_invitation(invitation_setup):
    send_invitation(invitation_setup)

    client = invitation_setup["clients"]["invitee"]

    response = client.post(
        f"/groups/{invitation_setup['group_id']}/invitations/accept"
    )

    assert response.status_code == 200

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (
                invitation_setup["invitee_id"],
                invitation_setup["group_id"],
            ),
        )
        assert membership.invite_status == "accepted"


def test_decline_invitation(invitation_setup):
    send_invitation(invitation_setup)

    client = invitation_setup["clients"]["invitee"]

    response = client.post(
        f"/groups/{invitation_setup['group_id']}/invitations/decline"
    )

    assert response.status_code == 200

    with SessionLocal() as db:
        membership = db.get(
            UserGroup,
            (
                invitation_setup["invitee_id"],
                invitation_setup["group_id"],
            ),
        )
        assert membership.invite_status == "declined"
        assert membership.is_admin is False


def test_outsider_cannot_invite(invitation_setup):
    client = invitation_setup["clients"]["outsider"]

    response = client.post(
        f"/groups/{invitation_setup['group_id']}/invitations",
        json={"email": invitation_setup["invitee_email"]},
    )

    assert response.status_code == 403


def test_only_invitee_can_accept(invitation_setup):
    send_invitation(invitation_setup)

    client = invitation_setup["clients"]["outsider"]

    response = client.post(
        f"/groups/{invitation_setup['group_id']}/invitations/accept"
    )

    assert response.status_code == 404


def test_pending_invitations(invitation_setup):
    send_invitation(invitation_setup)

    client = invitation_setup["clients"]["invitee"]

    response = client.get("/groups/invitations/pending")

    assert response.status_code == 200
    assert any(
        invite["group_id"] == invitation_setup["group_id"]
        for invite in response.json()
    )


def test_unregistered_email(invitation_setup):
    client = invitation_setup["clients"]["inviter"]

    response = client.post(
        f"/groups/{invitation_setup['group_id']}/invitations",
        json={"email": "unregistered@example.com"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "registration_required"


def test_accepted_regular_member_can_invite(invitation_setup):
    # Invite the second user.
    assert send_invitation(invitation_setup).status_code == 201

    # Second user accepts.
    member_client = invitation_setup["clients"]["invitee"]
    response = member_client.post(
        f"/groups/{invitation_setup['group_id']}/invitations/accept"
    )
    assert response.status_code == 200

    # Regular member invites the third user.
    response = member_client.post(
        f"/groups/{invitation_setup['group_id']}/invitations",
        json={
            "email": invitation_setup["clients_email"]
            if "clients_email" in invitation_setup
            else get_outsider_email(invitation_setup)
        },
    )

    assert response.status_code == 201


def get_outsider_email(setup):
    with SessionLocal() as db:
        user = db.get(User, setup["outsider_id"])
        return user.email