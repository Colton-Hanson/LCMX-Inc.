from pydantic import BaseModel


class MemberResponse(BaseModel):
    user_id: int
    email: str
    name: str | None
    is_admin: bool
    split_percentage: float | None = None


class MemberRemovalResponse(BaseModel):
    message: str
    group_id: int
    user_id: int