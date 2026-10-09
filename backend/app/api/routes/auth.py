from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import (
    COOKIE_SECURE,
    SESSION_COOKIE_NAME,
    generate_session_token,
    get_session_expiration,
    get_session_max_age,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.db.session import get_db

from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RegisterRequest,
    RegisterResponse,
)
from models import User, UserSession


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    registration: RegisterRequest,
    db: Session = Depends(get_db),
):
    normalized_email = str(
        registration.email
    ).strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    hashed_password = hash_password(
        registration.password
    )

    new_user = User(
        email=normalized_email,
        password_hash=hashed_password,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login")
def login_user(
    login: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    normalized_email = str(
        login.email
    ).strip().lower()

    user = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    if not user or not verify_password(
        login.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    raw_token = generate_session_token()

    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=get_session_expiration(),
    )

    db.add(session)
    db.commit()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=get_session_max_age(),
        path="/",
    )

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
        },
    }


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
    }


@router.post("/logout")
def logout_user(
    response: Response,
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
):
    if session_token:
        token_hash = hash_session_token(
            session_token
        )

        session = (
            db.query(UserSession)
            .filter(
                UserSession.token_hash == token_hash
            )
            .first()
        )

        if session:
            session.revoked = True
            db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    return {
        "message": "Logout successful"
    }

@router.post("/change-password")
def change_password(
    password_change: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        password_change.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(
        password_change.new_password
    )

    db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.revoked.is_(False),
    ).update(
        {"revoked": True},
        synchronize_session=False,
    )

    db.commit()

    return {
        "message": "Password changed successfully. Please log in again."
    }


