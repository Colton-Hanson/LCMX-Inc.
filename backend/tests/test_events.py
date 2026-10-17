import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from models import Event, EventMember, Group, User, UserGroup, UserSession


@pytest.fixture
def event_setup():
    password = "TestPassword123!"
    roles = ("creator", "member", "outsider", "pending")
    emails = {
        role: f"event_{role}_{uuid.uuid4().hex}@example.com"
        for role in roles
    }

    clients = {}
    user_ids = {}
    group_id = None

    try:
        for role in roles:
            client = TestClient(app)
            clients[role] = client

            response = client.post(
                "/auth/register",
                json={
                    "email": emails[role],
                    "password": password,
                },
            )
            assert response.status_code == 201
            user_ids[role] = response.json()["id"]

            response = client.post(
                "/auth/login",
                json={
                    "email": emails[role],
                    "password": password,
                },
            )
            assert response.status_code == 200

        response = clients["creator"].post(
            "/groups",
            json={
                "name": "Event Test Group",
                "group_type": "outing",
            },
        )
        assert response.status_code == 201
        group_id = response.json()["id"]

        with SessionLocal() as db:
            db.add_all([
                UserGroup(
                    user_id=user_ids["member"],
                    group_id=group_id,
                    is_admin=False,
                    invite_status="accepted",
                ),
                UserGroup(
                    user_id=user_ids["pending"],
                    group_id=group_id,
                    is_admin=False,
                    invite_status="pending",
                ),
            ])
            db.commit()

        yield {
            "clients": clients,
            "user_ids": user_ids,
            "group_id": group_id,
        }

    finally:
        for client in clients.values():
            client.close()

        with SessionLocal() as db:
            if group_id is not None:
                # Remove event participants before their events.
                event_ids = [
                    event_id
                    for (event_id,) in db.query(Event.id).filter(
                        Event.group_id == group_id
                    ).all()
                ]

                if event_ids:
                    db.query(EventMember).filter(
                        EventMember.event_id.in_(event_ids)
                    ).delete(synchronize_session=False)

                    db.query(Event).filter(
                        Event.id.in_(event_ids)
                    ).delete(synchronize_session=False)

                db.query(UserGroup).filter(
                    UserGroup.group_id == group_id
                ).delete(synchronize_session=False)

                group = db.get(Group, group_id)
                if group:
                    db.delete(group)

                db.flush()

            if user_ids:
                ids = list(user_ids.values())

                db.query(UserSession).filter(
                    UserSession.user_id.in_(ids)
                ).delete(synchronize_session=False)

                db.query(User).filter(
                    User.id.in_(ids)
                ).delete(synchronize_session=False)

            db.commit()


def create_event(setup, member_ids, role="creator"):
    return setup["clients"][role].post(
        "/events",
        json={
            "name": "Friday Dinner",
            "group_id": setup["group_id"],
            "member_ids": member_ids,
        },
    )


def test_create_event_success(event_setup):
    setup = event_setup
    participants = [
        setup["user_ids"]["creator"],
        setup["user_ids"]["member"],
    ]

    response = create_event(setup, participants)

    assert response.status_code == 201
    assert response.json()["name"] == "Friday Dinner"
    assert response.json()["member_ids"] == participants

    event_id = response.json()["id"]

    with SessionLocal() as db:
        event = db.get(Event, event_id)
        assert event is not None

        saved_ids = {
            row.user_id
            for row in db.query(EventMember).filter(
                EventMember.event_id == event_id
            ).all()
        }

        assert saved_ids == set(participants)


def test_event_with_subset_of_members(event_setup):
    setup = event_setup
    creator_id = setup["user_ids"]["creator"]

    response = create_event(setup, [creator_id])

    assert response.status_code == 201
    assert response.json()["member_ids"] == [creator_id]


def test_regular_member_can_create_event(event_setup):
    setup = event_setup

    response = create_event(
        setup,
        [setup["user_ids"]["member"]],
        role="member",
    )

    assert response.status_code == 201


def test_empty_participants_rejected(event_setup):
    response = create_event(event_setup, [])

    assert response.status_code == 422


def test_outsider_participant_rejected(event_setup):
    setup = event_setup

    response = create_event(
        setup,
        [
            setup["user_ids"]["creator"],
            setup["user_ids"]["outsider"],
        ],
    )

    assert response.status_code == 422


def test_pending_participant_rejected(event_setup):
    setup = event_setup

    response = create_event(
        setup,
        [setup["user_ids"]["pending"]],
    )

    assert response.status_code == 422


def test_duplicate_participants_rejected(event_setup):
    setup = event_setup
    creator_id = setup["user_ids"]["creator"]

    response = create_event(
        setup,
        [creator_id, creator_id],
    )

    assert response.status_code == 422


def test_outsider_cannot_create_event(event_setup):
    setup = event_setup

    response = create_event(
        setup,
        [setup["user_ids"]["creator"]],
        role="outsider",
    )

    assert response.status_code == 403


def test_pending_user_cannot_create_event(event_setup):
    setup = event_setup

    response = create_event(
        setup,
        [setup["user_ids"]["creator"]],
        role="pending",
    )

    assert response.status_code == 403


def test_unauthenticated_event_rejected(event_setup):
    setup = event_setup

    with TestClient(app) as client:
        response = client.post(
            "/events",
            json={
                "name": "Unauthorized Event",
                "group_id": setup["group_id"],
                "member_ids": [setup["user_ids"]["creator"]],
            },
        )

    assert response.status_code == 401


def test_whitespace_name_rejected(event_setup):
    setup = event_setup

    response = setup["clients"]["creator"].post(
        "/events",
        json={
            "name": "   ",
            "group_id": setup["group_id"],
            "member_ids": [setup["user_ids"]["creator"]],
        },
    )

    assert response.status_code == 422