import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import Balance, Group, User, UserGroup, UserSession


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
            db.query(User).filter(User.id == user_ids["member"]).update(
                {User.name: "Member Test Name"}
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
    member = next(m for m in members if m["user_id"] == setup["user_ids"]["member"])
    assert member["name"] == "Member Test Name"
    admin = next(m for m in members if m["user_id"] == setup["user_ids"]["admin"])
    assert admin["name"] is None


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


# Removal case 1: a zero balance is removed immediately, and the user account stays.
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


# Removal case 3: the group's only administrator cannot be removed.
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


def add_outstanding_balance(setup, indebted_user_id: int):
    """Store a real debt between the admin and member for removal tests."""
    admin_id = setup["user_ids"]["admin"]
    member_id = setup["user_ids"]["member"]
    user_1_id, user_2_id = sorted((admin_id, member_id))

    with SessionLocal() as db:
        db.add(
            Balance(
                group_id=setup["group_id"],
                user_1_id=user_1_id,
                user_2_id=user_2_id,
                indebted_party=indebted_user_id,
                debt=Decimal("25.00"),
            )
        )
        db.commit()


# Warn when a member owes money OR is owed money.
@pytest.mark.parametrize("indebted_role", ["member", "admin"])
def test_balance_requires_confirmation(membership_setup, indebted_role):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]
    add_outstanding_balance(setup, setup["user_ids"][indebted_role])

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}"
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["confirmation_required"] is True
    assert detail["balance"] == 25.0

    with SessionLocal() as db:
        assert db.get(UserGroup, (member_id, setup["group_id"])) is not None


# An administrator can intentionally confirm removal despite outstanding debt.
def test_balance_removal_with_confirmation(membership_setup):
    setup = membership_setup
    member_id = setup["user_ids"]["member"]
    add_outstanding_balance(setup, member_id)

    response = setup["clients"]["admin"].delete(
        f"/groups/{setup['group_id']}/members/{member_id}",
        params={"confirm": "true"},
    )

    assert response.status_code == 200
    with SessionLocal() as db:
        assert db.get(UserGroup, (member_id, setup["group_id"])) is None


# Persistent group default split: any accepted group member can read/save it.
def test_split_default_round_trip_and_reset(membership_setup):
    setup = membership_setup
    client = setup["clients"]["member"]
    group_id = setup["group_id"]
    admin_id = setup["user_ids"]["admin"]
    member_id = setup["user_ids"]["member"]
    path = f"/groups/{group_id}/split-default"

    original = client.get(path)
    assert original.status_code == 200
    assert original.json() == {"method": "even", "percents": {}}

    payload = {"method": "percentage", "percents": {str(admin_id): 6000, str(member_id): 4000}}
    saved = client.put(path, json=payload)
    assert saved.status_code == 200
    assert saved.json() == payload
    assert setup["clients"]["admin"].get(path).json() == payload

    members_response = client.get(f"/groups/{group_id}/members")
    by_id = {m["user_id"]: m for m in members_response.json()}
    assert by_id[admin_id]["split_percentage"] == 60.0
    assert by_id[member_id]["split_percentage"] == 40.0

    reset = client.put(path, json={"method": "even", "percents": {}})
    assert reset.status_code == 200
    assert client.get(path).json() == {"method": "even", "percents": {}}
    assert all(m["split_percentage"] is None for m in client.get(f"/groups/{group_id}/members").json())


def test_split_default_rejects_invalid_data_without_partial_writes(membership_setup):
    setup = membership_setup
    client = setup["clients"]["admin"]
    gid = setup["group_id"]
    ids = setup["user_ids"]
    path = f"/groups/{gid}/split-default"
    valid = {"method": "percentage", "percents": {str(ids["admin"]): 2500, str(ids["member"]): 7500}}
    assert client.put(path, json=valid).status_code == 200

    invalid = [
        {"method": "percentage", "percents": {str(ids["admin"]): 5000}},  # missing member
        {"method": "percentage", "percents": {str(ids["admin"]): 5000, str(ids["member"]): 4999}},
        {"method": "percentage", "percents": {str(ids["admin"]): 5000, str(ids["member"]): 4000, str(ids["outsider"]): 1000}},
        {"method": "percentage", "percents": {str(ids["admin"]): -10, str(ids["member"]): 10010}},
        {"method": "even", "percents": {str(ids["admin"]): 10000}},
    ]
    for payload in invalid:
        result = client.put(path, json=payload)
        assert result.status_code == 422
        assert client.get(path).json() == valid


def test_split_default_auth_and_membership(membership_setup):
    setup = membership_setup
    path = f"/groups/{setup['group_id']}/split-default"
    payload = {"method": "even", "percents": {}}
    outsider = setup["clients"]["outsider"]
    for method in ("get", "put"):
        response = getattr(outsider, method)(path, **({"json": payload} if method == "put" else {}))
        assert response.status_code == 403
    with TestClient(app) as anonymous:
        assert anonymous.get(path).status_code == 401
        assert anonymous.put(path, json=payload).status_code == 401
    assert setup["clients"]["admin"].get("/groups/999999999999/split-default").status_code == 404


def test_remove_member_resets_saved_default_split(membership_setup):
    setup = membership_setup
    gid = setup["group_id"]
    ids = setup["user_ids"]
    client = setup["clients"]["admin"]
    path = f"/groups/{gid}/split-default"
    assert client.put(path, json={
        "method": "percentage",
        "percents": {str(ids["admin"]): 6000, str(ids["member"]): 4000},
    }).status_code == 200
    response = client.delete(f"/groups/{gid}/members/{ids['member']}")
    assert response.status_code == 200
    assert client.get(path).json() == {"method": "even", "percents": {}}
    with SessionLocal() as db:
        assert db.get(UserGroup, (ids["admin"], gid)).split_percentage is None
