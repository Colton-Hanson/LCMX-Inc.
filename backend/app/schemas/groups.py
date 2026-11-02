from typing import Literal, Annotated

from pydantic import BaseModel, Field, ConfigDict, field_validator


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    group_type: Literal["roommate", "partner", "family", "outing"]
    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Group name cannot be blank.")

        return value


class GroupMemberResponse(BaseModel):
    id: int
    name: str | None
    email: str
    is_admin: bool


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    group_type: str
    created_by: int
    members: list[GroupMemberResponse] = Field(default_factory=list)


class GroupSplitDefault(BaseModel):
    # Match frontend splitDefault.js: basis points, 5000 = 50.00%.
    method: Literal["even", "percentage"]
    percents: dict[int, Annotated[int, Field(strict=True, ge=0, le=10000)]]
