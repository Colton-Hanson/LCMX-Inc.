from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.events import EventCreate, EventResponse
from models import Event, EventMember, Group, User, UserGroup


router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.get(Group, event_data.group_id)

    if not group:
        raise HTTPException(
            status_code=404,
            detail="Group not found.",
        )

    # The creator must be an accepted member of this group.
    creator_membership = db.get(
        UserGroup,
        (current_user.id, event_data.group_id),
    )

    if (
        not creator_membership
        or creator_membership.invite_status != "accepted"
    ):
        raise HTTPException(
            status_code=403,
            detail="Only accepted members can create group events.",
        )

    # All selected participants must be accepted group members.
    valid_members = (
        db.query(UserGroup.user_id)
        .filter(
            UserGroup.group_id == event_data.group_id,
            UserGroup.invite_status == "accepted",
            UserGroup.user_id.in_(event_data.member_ids),
        )
        .all()
    )

    valid_ids = {row.user_id for row in valid_members}
    requested_ids = set(event_data.member_ids)

    if requested_ids != valid_ids:
        raise HTTPException(
            status_code=422,
            detail="All event participants must be accepted group members.",
        )

    new_event = Event(
        group_id=event_data.group_id,
        name=event_data.name,
    )

    db.add(new_event)
    db.flush()

    for user_id in event_data.member_ids:
        db.add(
            EventMember(
                event_id=new_event.id,
                user_id=user_id,
            )
        )

    db.commit()
    db.refresh(new_event)

    return EventResponse(
        id=new_event.id,
        group_id=new_event.group_id,
        name=new_event.name,
        member_ids=event_data.member_ids,
    )
