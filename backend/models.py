"""
SQLAlchemy models — built directly from the ERD draft
(database_tables_expenses_app.txt).

FLAGGED GAPS (confirm with team before treating this as final):
  1. `items` table is referenced by item_splits and item_and_expense but
     was never defined in the draft. Added a minimal placeholder below —
     needs real columns (name? price? quantity?).
  2. `splits` / `expense_splits` have no amount/portion column, so there's
     currently no way to store how much each person owes.
  3. `balances` has no amount column, so it can track THAT two users have
     a balance but not WHAT it is.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    ForeignKey,
    PrimaryKeyConstraint,
    Numeric,
    DateTime,
    Boolean,
    CheckConstraint,
)

from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import declarative_base

def utcnow():
    return datetime.now(timezone.utc)


Base = declarative_base()


# === Users and Groups ===

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    photo_url = Column(String(512), nullable=True)

    notify_group_invite = Column(
        Boolean,
        nullable=False,
        server_default="true",
    )
    notify_new_expense = Column(
        Boolean,
        nullable=False,
        server_default="true",
    )
    notify_settlement = Column(
        Boolean,
        nullable=False,
        server_default="true",
    )
    notify_removed_from_group = Column(
        Boolean,
        nullable=False,
        server_default="true",
    )

    email_verified = Column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    pending_email = Column(String(255), nullable=True)

class Group(Base):
    __tablename__ = "groups"

    __table_args__ = (
        CheckConstraint(
            "group_type IN ('roommate', 'partner', 'family', 'outing')",
            name="ck_groups_group_type",
        ),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    group_type = Column(String(20), nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)

class UserGroup(Base):
    __tablename__ = "user_groups"

    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
    )

    group_id = Column(
        BigInteger,
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    is_admin = Column(Boolean, nullable=False, server_default="false")
    invite_status = Column(
        String(20),
        nullable=False,
        server_default="pending",
    )
    split_percentage = Column(Numeric(5, 2), nullable=True)

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "group_id"),
        CheckConstraint(
            "invite_status IN ('pending', 'accepted', 'declined')",
            name="ck_user_groups_invite_status",
        ),
    )

# === Things associated with one group ===

class Event(Base):
    __tablename__ = "events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    group_id = Column(
        BigInteger,
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(100), nullable=False)
    paid = Column(Boolean, server_default = 'false')
    category = Column(String(20), nullable = True)

    __table_args__ = (
        CheckConstraint(
            "category IN ('food', 'rent', 'entertainment', 'other')",
            name="ck_events_category",
        ),
    )


class EventMember(Base):
    __tablename__ = "event_members"

    event_id = Column(
        BigInteger,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
    )

    __table_args__ = (
        PrimaryKeyConstraint("event_id", "user_id"),
    )

class ItemizedExpense(Base):
    """A receipt-derived expense made up of individual line items."""
    __tablename__ = "itemized_expenses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)


class Expense(Base):
    """A manually-entered flat expense (no line items)."""
    __tablename__ = "expenses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable = True)
    paid = Column(Boolean, server_default = 'false')
    category = Column(String(20), nullable = True)

    __table_args__ = (
        CheckConstraint(
            "category IN ('food', 'rent', 'entertainment', 'other')",
            name="ck_expenses_category",
        ),
    )

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)


# === Items (NOT in original draft — inferred placeholder, see note above) ===

class Item(Base):
    """
    Placeholder: referenced by item_splits and item_and_expense but never
    defined in the ERD draft. Fill in real columns once confirmed
    (likely name, price, quantity).
    """
    __tablename__ = "items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)


# === Splits ===

class Split(Base):
    __tablename__ = "splits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=True)


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    expense_id = Column(BigInteger, ForeignKey("expenses.id"), nullable=False)
    split_id = Column(BigInteger, ForeignKey("splits.id"), nullable=False)

    __table_args__ = (PrimaryKeyConstraint("expense_id", "split_id"),)


class ItemSplit(Base):
    __tablename__ = "item_splits"

    item_id = Column(BigInteger, ForeignKey("items.id"), nullable=False)
    split_id = Column(BigInteger, ForeignKey("splits.id"), nullable=False)

    __table_args__ = (PrimaryKeyConstraint("item_id", "split_id"),)


class EventSplit(Base):
    __tablename__ = "event_splits"

    event_id = Column(BigInteger, ForeignKey("events.id"), nullable=False)
    split_id = Column(BigInteger, ForeignKey("splits.id"), nullable=False)

    __table_args__ = (PrimaryKeyConstraint("event_id", "split_id"),)


# === Objects w/ multiple parts ===

class ItemAndExpense(Base):
    """Join table: which items belong to which itemized expense."""
    __tablename__ = "item_and_expense"

    item_id = Column(BigInteger, ForeignKey("items.id"), nullable=False)
    itemized_expense_id = Column(
        BigInteger, ForeignKey("itemized_expenses.id"), nullable=False
    )

    __table_args__ = (
        PrimaryKeyConstraint("item_id", "itemized_expense_id"),
    )


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    budget_id = Column(BigInteger, ForeignKey("budgets.id"), nullable=False)


class Balance(Base):
    __tablename__ = "balances"

    user_1_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    user_2_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    indebted_party = Column(BigInteger, ForeignKey("users.id"), nullable=True) # Null means no one owes anyone
    debt = Column(Numeric(10, 2), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("user_1_id", "user_2_id"),
        CheckConstraint("owed_party IN (user_1_id, user_2_id)", name="ck_balances_owed_party"),
        CheckConstraint("debt >= 0", name="ck_balances_debt_nonneg"),
        CheckConstraint("user_1_id < user_2_id", name="ck_balances_user_order"),
    )

class UserSession(Base):
    __tablename__ = "sessions"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    token_hash = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    revoked = Column(
        Boolean,
        nullable=False,
        server_default="false",
    )




# === Audit Log ===

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    table_name = Column(Text, nullable=False)
    record_id = Column(BigInteger, nullable=False)
    action = Column(Text, nullable=False)
    old_data = Column(JSONB, nullable=True)
    new_data = Column(JSONB, nullable=True)
    changed_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    changed_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
