"""
Run this after `alembic upgrade head` to populate sample data.

Usage: python seed.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import User, Group, UserGroup

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# NOTE: plaintext placeholders for seed convenience only. Real registrations
# must go through the hashing flow Lukas builds — never store plaintext
# passwords outside of this throwaway seed data.
alice = User(email="alice@example.com", password="placeholder_hash_1")
bob = User(email="bob@example.com", password="placeholder_hash_2")

roommates = Group()

session.add_all([alice, bob, roommates])
session.flush()  # assigns IDs without committing yet

session.add_all([
    UserGroup(user_id=alice.id, group_id=roommates.id),
    UserGroup(user_id=bob.id, group_id=roommates.id),
])

session.commit()
print(f"Seed data inserted: users {alice.id}, {bob.id}; group {roommates.id}.")
