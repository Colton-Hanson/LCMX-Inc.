
import re
from pydantic import BaseModel, EmailStr, Field, field_validator

def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one capital letter.")

    if not re.search(r"[^A-Za-z0-9\s]", password):
        raise ValueError("Password must contain at least one symbol.")

    return password

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        return validate_password_strength(value)


class RegisterResponse(BaseModel):
    id: int
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value):
        return validate_password_strength(value)
    