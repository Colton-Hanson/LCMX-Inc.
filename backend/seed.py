"""
Run this after `alembic upgrade head` to populate sample data.

Usage: python seed.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.security import hash_password

from models import User, Group, UserGroup

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Development-only seed accounts. Passwords are hashed before storage
# using the same password hashing flow as normal registration.
alice = User(
    email="alice@example.com",
    password_hash=hash_password("AlicePassword123!"),
)

bob = User(
    email="bob@example.com",
    password_hash=hash_password("BobPassword123!"),
)

roommates = Group()

session.add_all([alice, bob, roommates])
session.flush()  # assigns IDs without committing yet

session.add_all([
    UserGroup(user_id=alice.id, group_id=roommates.id),
    UserGroup(user_id=bob.id, group_id=roommates.id),
])

session.commit()
print(f"Seed data inserted: users {alice.id}, {bob.id}; group {roommates.id}.")
