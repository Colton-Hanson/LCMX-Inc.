import jwt

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.profile import (
    EmailChangeConfirmRequest,
    EmailChangeRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)
from models import User
from app.core.security import (
    create_email_verification_token,
    decode_email_verification_token,
)


router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


@router.get(
    "",
    response_model=ProfileResponse,
)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.patch(
    "",
    response_model=ProfileResponse,
)
def update_profile(
    profile_update: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = profile_update.model_dump(
        exclude_unset=True
    )

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/email-change")
def request_email_change(
    email_change: EmailChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_email = str(email_change.new_email).strip().lower()

    if new_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email must be different from the current email.",
        )

    existing_user = (
        db.query(User)
        .filter(User.email == new_email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email address is already in use.",
        )

    current_user.pending_email = new_email

    db.commit()

    verification_token = create_email_verification_token(
        current_user.id,
        new_email,
    )

    return {
        "message": "Email change requested. Verification is required before the new email takes effect.",

        # Development/demo only.
        # Replace this with actual email delivery later.
        "verification_token": verification_token,
    }

@router.post("/email-change/confirm")
def confirm_email_change(
    confirmation: EmailChangeConfirmRequest,
    db: Session = Depends(get_db),
):
    try:
        user_id, new_email = (
            decode_email_verification_token(
                confirmation.token
            )
        )

    except (
        jwt.InvalidTokenError,
        ValueError,
        KeyError,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if (
        not user
        or not user.pending_email
        or user.pending_email.lower()
        != new_email.lower()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    existing_user = (
        db.query(User)
        .filter(
            User.email == new_email,
            User.id != user.id,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email address is already in use.",
        )

    user.email = new_email
    user.pending_email = None
    user.email_verified = True

    db.commit()

    return {
        "message": "Email address verified and updated."
    }

