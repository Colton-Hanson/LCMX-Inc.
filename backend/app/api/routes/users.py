from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from models import User

router = APIRouter()


@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()

    return [
        {
            "id": user.id,
            "email": user.email,
        }
        for user in users
    ]

