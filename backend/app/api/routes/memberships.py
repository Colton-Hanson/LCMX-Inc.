from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.memberships import (
    MemberResponse,
    MemberRemovalResponse,
)
from models import Group, User, UserGroup


router = APIRouter(
    prefix="/groups",
    tags=["Group Memberships"],
)


def get_member_balance(
    group_id: int,
    user_id: int,
) -> float:
    """
    Sprint 3 placeholder.

    Sprint 4 will replace this with actual balance
    calculations from the expense data.
    """
    return 0.0


def require_group_membership(
    group_id: int,
    current_user: User,
    db: Session,
) -> UserGroup:
    group = db.get(Group, group_id)

    if not group:
        raise HTTPException(
            status_code=404,
            detail="Group not found.",
        )

    membership = db.get(
        UserGroup,
        (current_user.id, group_id),
    )

    if (
        not membership
        or membership.invite_status != "accepted"
    ):
        raise HTTPException(
            status_code=403,
            detail="You are not an accepted member of this group.",
        )

    return membership


@router.get(
    "/{group_id}/members",
    response_model=list[MemberResponse],
)
def list_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)

    rows = (
        db.query(UserGroup, User)
        .join(User, UserGroup.user_id == User.id)
        .filter(
            UserGroup.group_id == group_id,
            UserGroup.invite_status == "accepted",
        )
        .all()
    )

    return [
        MemberResponse(
            user_id=user.id,
            email=user.email,
            is_admin=membership.is_admin,
        )
        for membership, user in rows
    ]


@router.delete(
    "/{group_id}/members/{user_id}",
    response_model=MemberRemovalResponse,
)
def remove_member(
    group_id: int,
    user_id: int,
    confirm: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = require_group_membership(
        group_id, current_user, db
    )

    if not requester.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only group administrators can remove members.",
        )

    target = db.get(UserGroup, (user_id, group_id))

    if not target or target.invite_status != "accepted":
        raise HTTPException(
            status_code=404,
            detail="Group member not found.",
        )

    # A group must retain at least one administrator.
    if target.is_admin:
        admin_count = (
            db.query(UserGroup)
            .filter(
                UserGroup.group_id == group_id,
                UserGroup.is_admin.is_(True),
                UserGroup.invite_status == "accepted",
            )
            .count()
        )

        if admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="Cannot remove the group's sole administrator.",
            )

    balance = get_member_balance(group_id, user_id)

    if abs(balance) > 0.001 and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Member has an outstanding balance.",
                "balance": balance,
                "confirmation_required": True,
            },
        )

    db.delete(target)
    db.commit()

    return MemberRemovalResponse(
        message="Member removed successfully.",
        group_id=group_id,
        user_id=user_id,
    )
