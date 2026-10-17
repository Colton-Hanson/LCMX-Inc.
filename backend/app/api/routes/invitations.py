import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.invitations import InvitationCreate, InvitationResponse
from models import Group, User, UserGroup


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/groups",
    tags=["Group Invitations"],
)


@router.post(
    "/{group_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_user(
    group_id: int,
    invitation: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Confirm that the group exists.
    group = db.get(Group, group_id)

    if not group:
        raise HTTPException(
            status_code=404,
            detail="Group not found.",
        )

    # Only accepted members can send invitations.
    inviter_membership = db.get(
        UserGroup,
        (current_user.id, group_id),
    )

    if (
        not inviter_membership
        or inviter_membership.invite_status != "accepted"
    ):
        raise HTTPException(
            status_code=403,
            detail="Only accepted group members can invite users.",
        )

    email = str(invitation.email).strip().lower()

    invited_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    # Unregistered users: log the invitation for now.
    if not invited_user:
        logger.info(
            "Registration invitation requested: group=%s email=%s",
            group_id,
            email,
        )

        return {
            "message": "Registration invitation logged.",
            "group_id": group_id,
            "email": email,
            "status": "registration_required",
        }

    existing_membership = db.get(
        UserGroup,
        (invited_user.id, group_id),
    )

    if existing_membership:
        raise HTTPException(
            status_code=409,
            detail="This user has already been invited or is a member.",
        )

    membership = UserGroup(
        user_id=invited_user.id,
        group_id=group_id,
        is_admin=False,
        invite_status="pending",
    )

    db.add(membership)
    db.commit()

    return {
        "message": "Invitation created.",
        "group_id": group_id,
        "email": email,
        "status": "pending",
    }


@router.get("/invitations/pending")
def get_pending_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitations = (
        db.query(UserGroup, Group)
        .join(Group, UserGroup.group_id == Group.id)
        .filter(
            UserGroup.user_id == current_user.id,
            UserGroup.invite_status == "pending",
        )
        .all()
    )

    return [
        {
            "group_id": group.id,
            "group_name": group.name,
            "group_type": group.group_type,
        }
        for membership, group in invitations
    ]


@router.post("/{group_id}/invitations/accept")
def accept_invitation(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.get(
        UserGroup,
        (current_user.id, group_id),
    )

    if not membership or membership.invite_status != "pending":
        raise HTTPException(
            status_code=404,
            detail="Pending invitation not found.",
        )

    membership.invite_status = "accepted"
    db.commit()

    return {"message": "Invitation accepted."}


@router.post("/{group_id}/invitations/decline")
def decline_invitation(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.get(
        UserGroup,
        (current_user.id, group_id),
    )

    if not membership or membership.invite_status != "pending":
        raise HTTPException(
            status_code=404,
            detail="Pending invitation not found.",
        )

    membership.invite_status = "declined"
    db.commit()

    return {"message": "Invitation declined."}