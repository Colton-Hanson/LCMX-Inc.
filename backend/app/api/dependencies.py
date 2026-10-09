from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    SESSION_COOKIE_NAME,
    hash_session_token,
)
from app.db.session import get_db
from models import User, UserSession


def authentication_required():
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
    )


def get_current_user(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
):
    if not session_token:
        authentication_required()

    token_hash = hash_session_token(session_token)

    current_time = datetime.now(timezone.utc)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == token_hash,
            UserSession.revoked.is_(False),
            UserSession.expires_at > current_time,
        )
        .first()
    )

    if not session:
        authentication_required()

    user = (
        db.query(User)
        .filter(User.id == session.user_id)
        .first()
    )

    if not user:
        authentication_required()

    return user