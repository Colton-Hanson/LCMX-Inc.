from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    group_id: int
    member_ids: list[int] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Event name cannot be blank.")

        return value

    @field_validator("member_ids")
    @classmethod
    def validate_member_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate event participants are not allowed.")

        return value


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    name: str
    member_ids: list[int]