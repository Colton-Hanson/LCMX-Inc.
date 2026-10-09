import hashlib
import os
import secrets
import jwt
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pwdlib import PasswordHash


load_dotenv()


SESSION_EXPIRE_HOURS = int(
    os.getenv("SESSION_EXPIRE_HOURS", "168")
)

COOKIE_SECURE = (
    os.getenv("COOKIE_SECURE", "false").lower() == "true"
)

SESSION_COOKIE_NAME = "access_token"

EMAIL_VERIFICATION_SECRET = os.getenv(
    "EMAIL_VERIFICATION_SECRET"
)

EMAIL_VERIFICATION_EXPIRE_MINUTES = int(
    os.getenv(
        "EMAIL_VERIFICATION_EXPIRE_MINUTES",
        "30",
    )
)


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    return password_hash.verify(
        password,
        hashed_password,
    )


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def get_session_expiration() -> datetime:
    return (
        datetime.now(timezone.utc)
        + timedelta(hours=SESSION_EXPIRE_HOURS)
    )


def get_session_max_age() -> int:
    return SESSION_EXPIRE_HOURS * 60 * 60


def create_email_verification_token(
    user_id: int,
    pending_email: str,
) -> str:
    expiration = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "email": pending_email,
        "purpose": "email_change",
        "exp": expiration,
    }

    return jwt.encode(
        payload,
        EMAIL_VERIFICATION_SECRET,
        algorithm="HS256",
    )


def decode_email_verification_token(
    token: str,
) -> tuple[int, str]:
    payload = jwt.decode(
        token,
        EMAIL_VERIFICATION_SECRET,
        algorithms=["HS256"],
    )

    if payload.get("purpose") != "email_change":
        raise jwt.InvalidTokenError(
            "Invalid token purpose."
        )

    return (
        int(payload["sub"]),
        payload["email"],
    )

