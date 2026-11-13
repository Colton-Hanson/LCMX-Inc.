"""Record and list repayments against outstanding pairwise group balances."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.memberships import require_group_membership
from app.db.session import get_db
from models import Balance, Group, Settlement, User, UserGroup

router = APIRouter(prefix="/groups/{group_id}/settlements", tags=["Settlements"])


class SettlementCreate(BaseModel):
    paid_by: int = Field(gt=0)
    recipient: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

    @field_validator("amount", mode="before")
    @classmethod
    def require_exact_decimal(cls, value):
        if isinstance(value, (float, bool)):
            raise ValueError("Send monetary amounts as decimal strings, e.g. '10.25'.")
        return value


class SettlementResponse(BaseModel):
    id: int
    group_id: int
    paid_by: int
    recipient: int
    amount: Decimal
    recorded_by: int | None
    settlement_time: datetime
    remaining_debt: Decimal | None = None


def _active_member_ids(db: Session, group_id: int, ids: set[int]) -> set[int]:
    rows = (
        db.query(UserGroup.user_id)
        .filter(
            UserGroup.group_id == group_id,
            UserGroup.invite_status == "accepted",
            UserGroup.user_id.in_(ids),
        )
        .all()
    )
    return {row.user_id for row in rows}


@router.post("", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
def record_settlement(
    group_id: int,
    payload: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record an actual off-app repayment and reduce the corresponding debt.

    Lock the group before looking up its balance, matching expense creation's
    group lock. This prevents concurrent expense/settlement balance overwrites.
    """
    try:
        db.query(Group).filter(Group.id == group_id).with_for_update().one_or_none()
        requester = require_group_membership(group_id, current_user, db)

        if payload.paid_by == payload.recipient:
            raise HTTPException(status_code=422, detail="A user cannot repay themselves.")

        # Conservative OI-18 policy: one of the parties or a group admin may
        # record a payment. Adjust after the team finalizes the policy.
        if current_user.id not in (payload.paid_by, payload.recipient) and not requester.is_admin:
            raise HTTPException(status_code=403, detail="Only a party or a group administrator can record this settlement.")

        ids = {payload.paid_by, payload.recipient}
        if _active_member_ids(db, group_id, ids) != ids:
            raise HTTPException(status_code=422, detail="Both parties must be accepted group members.")

        first, second = sorted(ids)
        balance = (
            db.query(Balance)
            .filter(
                Balance.group_id == group_id,
                Balance.user_1_id == first,
                Balance.user_2_id == second,
            )
            .one_or_none()
        )

        if balance is None or balance.indebted_party != payload.paid_by or balance.debt <= 0:
            raise HTTPException(status_code=409, detail="The payer does not currently owe this recipient.")
        if payload.amount > balance.debt:
            raise HTTPException(status_code=422, detail="Settlement cannot exceed the outstanding debt.")

        remaining = balance.debt - payload.amount
        balance.debt = remaining
        balance.indebted_party = payload.paid_by if remaining > 0 else None

        payment = Settlement(
            group_id=group_id,
            paid_by=payload.paid_by,
            recipient=payload.recipient,
            amount=payload.amount,
            recorded_by=current_user.id,
            # Column currently uses timezone-naive DateTime; store UTC.
            settlement_time=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db.add(payment)
        db.flush()
        result = SettlementResponse(
            id=payment.id,
            group_id=payment.group_id,
            paid_by=payment.paid_by,
            recipient=payment.recipient,
            amount=payment.amount,
            recorded_by=payment.recorded_by,
            settlement_time=payment.settlement_time,
            remaining_debt=remaining,
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.get("", response_model=list[SettlementResponse])
def list_settlements(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_membership(group_id, current_user, db)
    records = (
        db.query(Settlement)
        .filter(Settlement.group_id == group_id)
        .order_by(Settlement.settlement_time.desc(), Settlement.id.desc())
        .all()
    )
    return [
        SettlementResponse(
            id=record.id,
            group_id=record.group_id,
            paid_by=record.paid_by,
            recipient=record.recipient,
            amount=record.amount,
            recorded_by=record.recorded_by,
            settlement_time=record.settlement_time,
        )
        for record in records
    ]
