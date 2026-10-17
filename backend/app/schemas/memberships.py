from pydantic import BaseModel


class MemberResponse(BaseModel):
    user_id: int
    email: str
    is_admin: bool


class MemberRemovalResponse(BaseModel):
    message: str
    group_id: int
    user_id: int