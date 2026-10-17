from typing import Literal

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


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    group_type: str
    created_by: int
