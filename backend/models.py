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

from datetime import datetime

from sqlalchemy import (
    Column, BigInteger, String, Text, ForeignKey, PrimaryKeyConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import declarative_base

Base = declarative_base()


# === Users and Groups ===

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    # Named "password" per the draft — this must only ever store a hash,
    # never plaintext. Confirm length fits Lukas's hashing library output.
    password = Column(String(255), nullable=False)


class Group(Base):
    __tablename__ = "groups"

    id = Column(BigInteger, primary_key=True, autoincrement=True)


class UserGroup(Base):
    """Join table: which users belong to which groups."""
    __tablename__ = "user_groups"

    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)

    __table_args__ = (PrimaryKeyConstraint("user_id", "group_id"),)


# === Things associated with one group ===

class Event(Base):
    __tablename__ = "events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)


class ItemizedExpense(Base):
    """A receipt-derived expense made up of individual line items."""
    __tablename__ = "itemized_expenses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)


class Expense(Base):
    """A manually-entered flat expense (no line items)."""
    __tablename__ = "expenses"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)


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
    # NOTE: no amount/portion column yet — flagged above.


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
    # NOTE: no amount column yet — flagged above.

    __table_args__ = (PrimaryKeyConstraint("user_1_id", "user_2_id"),)


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
