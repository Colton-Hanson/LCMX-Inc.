
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class ExpenseCreate(BaseModel):
    group_id: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    paid_by: int = Field(gt=0)
    participant_ids: list[int] = Field(min_length=1)
    split_method: str = "even"
    split_values: dict[int, Decimal] | None = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Description cannot be blank.")
        return value

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if not value.is_finite():
            raise ValueError("Amount must be finite.")

        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount cannot exceed two decimal places.")

        return value

    @field_validator("participant_ids")
    @classmethod
    def validate_participants(cls, value: list[int]) -> list[int]:
        if any(member_id <= 0 for member_id in value):
            raise ValueError("Participant IDs must be positive.")

        if len(value) != len(set(value)):
            raise ValueError("Duplicate participants are not allowed.")

        return value

    @field_validator("split_method")
    @classmethod
    def validate_method(cls, value: str) -> str:
        if value not in ("even", "custom", "percentage"):
            raise ValueError("Unsupported split method.")

        return value
