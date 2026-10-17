from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.groups import GroupCreate, GroupResponse
from models import Group, User, UserGroup


router = APIRouter(
    prefix="/groups",
    tags=["Groups"],
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

    return new_group
