from fastapi import APIRouter, Depends, HTTPException, status
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.groups import (
    GroupCreate, GroupMemberResponse, GroupResponse,
    GroupSplitDefault,
)
from models import Group, User, UserGroup
from app.api.routes.memberships import require_group_membership


router = APIRouter(
    prefix="/groups",
    tags=["Groups"],
)


def _serialize_groups(groups: list[Group], db: Session) -> list[GroupResponse]:
    """Include accepted members with two queries total for a group list."""
    if not groups:
        return []

    rows = (
        db.query(UserGroup, User)
        .join(User, User.id == UserGroup.user_id)
        .filter(
            UserGroup.group_id.in_([group.id for group in groups]),
            UserGroup.invite_status == "accepted",
        )
        .order_by(UserGroup.group_id, User.id)
        .all()
    )
    members_by_group = defaultdict(list)
    for membership, user in rows:
        members_by_group[membership.group_id].append(
            GroupMemberResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                is_admin=membership.is_admin,
            )
        )

    return [
        GroupResponse(
            id=group.id,
            name=group.name,
            group_type=group.group_type,
            created_by=group.created_by,
            members=members_by_group[group.id],
        )
        for group in groups
    ]


@router.get("", response_model=list[GroupResponse])
def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    groups = (
        db.query(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .filter(
            UserGroup.user_id == current_user.id,
            UserGroup.invite_status == "accepted",
        )
        .order_by(Group.id)
        .all()
    )
    return _serialize_groups(groups, db)


@router.get("/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)
    group = db.get(Group, group_id)
    return _serialize_groups([group], db)[0]


@router.get("/{group_id}/split-default", response_model=GroupSplitDefault)
def get_group_split_default(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)
    members = _accepted_split_members(group_id, db)
    saved = [member.split_percentage for member in members]
    if all(value is None for value in saved):
        return GroupSplitDefault(method="even", percents={})

    # Do not silently reinterpret incomplete/corrupted saved percentages as even.
    if any(value is None for value in saved) or sum(saved) != 100:
        raise HTTPException(status_code=409, detail="Saved split default is inconsistent.")

    return GroupSplitDefault(
        method="percentage",
        percents={member.user_id: int(member.split_percentage * 100) for member in members},
    )


@router.put("/{group_id}/split-default", response_model=GroupSplitDefault)
def put_group_split_default(
    value: GroupSplitDefault,
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Like the existing frontend setting, any accepted member may change the default.
    require_group_membership(group_id, current_user, db)
    members = _accepted_split_members(group_id, db)
    member_ids = {member.user_id for member in members}

    if value.method == "even":
        if value.percents:
            raise HTTPException(status_code=422, detail="Even split must have empty percents.")
        for member in members:
            member.split_percentage = None
    else:
        if set(value.percents) != member_ids:
            raise HTTPException(status_code=422, detail="Percentages must cover exactly the accepted group members.")
        if sum(value.percents.values()) != 10000:
            raise HTTPException(status_code=422, detail="Split percentages must total 100%.")
        for member in members:
            member.split_percentage = Decimal(value.percents[member.user_id]) / Decimal(100)

    db.commit()
    return value


def _accepted_split_members(group_id: int, db: Session) -> list[UserGroup]:
    return (
        db.query(UserGroup)
        .filter(UserGroup.group_id == group_id, UserGroup.invite_status == "accepted")
        .order_by(UserGroup.user_id)
        .all()
    )


@router.post(
    "",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    group_data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Create the group.
    new_group = Group(
        name=group_data.name,
        group_type=group_data.group_type,
        created_by=current_user.id,
    )

    db.add(new_group)
    db.flush()

    # Add its creator as an accepted administrator.
    membership = UserGroup(
        user_id=current_user.id,
        group_id=new_group.id,
        is_admin=True,
        invite_status="accepted",
    )

    db.add(membership)

    # Save both records in one transaction.
    db.commit()
    db.refresh(new_group)

    return _serialize_groups([new_group], db)[0]
