from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
)

class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    photo_url: str | None = Field(default=None, max_length=512)

    notify_group_invite: bool | None = None
    notify_new_expense: bool | None = None
    notify_settlement: bool | None = None
    notify_removed_from_group: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return value

        value = value.strip()

        if not value:
            raise ValueError("Name cannot be blank.")

        return value

    @field_validator("photo_url")
    @classmethod
    def validate_photo_url(cls, value):
        if value is None:
            return value

        if value.startswith("/") or ".." in value:
            raise ValueError("Photo path must be a safe relative path.")

        if not value.startswith("uploads/"):
            raise ValueError("Photo path must be inside the uploads folder.")

        return value


class ProfileResponse(BaseModel):
    id: int
    name: str | None
    email: str
    photo_url: str | None

    notify_group_invite: bool
    notify_new_expense: bool
    notify_settlement: bool
    notify_removed_from_group: bool

    email_verified: bool
    pending_email: str | None


class EmailChangeRequest(BaseModel):
    new_email: EmailStr


class EmailChangeConfirmRequest(BaseModel):
    token: str