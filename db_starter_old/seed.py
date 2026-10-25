"""
Seed data that demonstrates the Iteration 2 and Sprint 3 tables.
 
Run after `alembic upgrade head` on an empty database:
    python seed.py
 
What this creates:
  - 4 users (one with every new profile field filled in, one with notifications off)
  - Group "Apartment 4B" (roommate) with a custom split ratio: 50 / 30 / 20
  - Group "Lake Weekend" (outing) with equal split (split_percentage left NULL)
  - Invite statuses: accepted, pending, and declined
  - One event inside "Lake Weekend" with three members
  - One active session for Alice (hashed token, expires in 7 days)
 
Not seeded: splits and event_splits, because they depend on the splits model.
"""
 
import hashlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal
 
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
 
from models import User, Group, UserGroup, Event, EventMember, UserSession
 
# Keep your own existing line here (your password and port).
DATABASE_URL = "postgresql://postgres:splittinIt@localhost:5433/shared_expense_dev"
 
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()
 
# ---------------------------------------------------------------- users
# These password_hash values are throwaway placeholders. Real accounts must
# go through the hashing flow in the backend.
alice = User(
    email="alice@example.com",
    password_hash="placeholder_hash_1",
    photo_url="uploads/alice.jpg",   # relative path, not absolute
    email_verified=True,
)
bob = User(
    email="bob@example.com",
    password_hash="placeholder_hash_2",
    email_verified=True,
    pending_email="bob.new@example.com",  # mid email change, not yet confirmed
    notify_new_expense=False,             # opted out of two notification types
    notify_settlement=False,
)
carol = User(email="carol@example.com", password_hash="placeholder_hash_3")
dave = User(email="dave@example.com", password_hash="placeholder_hash_4")
 
session.add_all([alice, bob, carol, dave])
session.flush()  # assigns ids
 
# --------------------------------------------------------------- groups
apartment = Group(name="Apartment 4B", group_type="roommate", created_by=alice.id)
lake = Group(name="Lake Weekend", group_type="outing", created_by=bob.id)
 
session.add_all([apartment, lake])
session.flush()
 
# ---------------------------------------------------------- user_groups
session.add_all([
    # Apartment 4B: custom ratio, accepted members total 100
    UserGroup(user_id=alice.id, group_id=apartment.id, is_admin=True,
              invite_status="accepted", split_percentage=Decimal("50.00")),
    UserGroup(user_id=bob.id, group_id=apartment.id, is_admin=False,
              invite_status="accepted", split_percentage=Decimal("30.00")),
    UserGroup(user_id=carol.id, group_id=apartment.id, is_admin=False,
              invite_status="accepted", split_percentage=Decimal("20.00")),
    # Dave has been invited but has not responded; he is not counted yet
    UserGroup(user_id=dave.id, group_id=apartment.id, is_admin=False,
              invite_status="pending"),
 
    # Lake Weekend: equal split (split_percentage stays NULL)
    UserGroup(user_id=bob.id, group_id=lake.id, is_admin=True,
              invite_status="accepted"),
    UserGroup(user_id=alice.id, group_id=lake.id, is_admin=False,
              invite_status="accepted"),
    UserGroup(user_id=carol.id, group_id=lake.id, is_admin=False,
              invite_status="accepted"),
    # Dave declined this one
    UserGroup(user_id=dave.id, group_id=lake.id, is_admin=False,
              invite_status="declined"),
])
session.flush()
 
# --------------------------------------------------------------- events
cabin = Event(group_id=lake.id, name="Lake Cabin")
session.add(cabin)
session.flush()
 
session.add_all([
    EventMember(event_id=cabin.id, user_id=bob.id),
    EventMember(event_id=cabin.id, user_id=alice.id),
    EventMember(event_id=cabin.id, user_id=carol.id),
])
 
# ------------------------------------------------------------- sessions
# Only a hash of the token is stored. The raw token would live in the cookie.
raw_token = "demo-session-token-for-alice"
now = datetime.now(timezone.utc)
 
session.add(UserSession(
    user_id=alice.id,
    token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
    expires_at=now + timedelta(days=7),
))
 
session.commit()
 
print("Seed data inserted:")
print("  4 users")
print("  2 groups (custom ratio 50/30/20, and equal split)")
print("  8 user_groups rows (accepted, pending, declined)")
print("  1 event with 3 members")
print("  1 session")
