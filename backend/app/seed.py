"""Seed an admin/lead and a few sample members.

Run from the backend/ directory:  python -m app.seed
"""
import asyncio

from .db import ensure_indexes, get_db
from .security import hash_password

SEED_USERS = [
    {"name": "Admin", "email": "admin@example.com", "password": "admin123", "role": "admin"},
    {"name": "Team Lead", "email": "lead@example.com", "password": "lead123", "role": "lead"},
    {"name": "Member One", "email": "member1@example.com", "password": "member123", "role": "member"},
    {"name": "Member Two", "email": "member2@example.com", "password": "member123", "role": "member"},
]


async def main():
    await ensure_indexes()
    db = get_db()
    for u in SEED_USERS:
        if await db.users.find_one({"email": u["email"]}):
            print(f"skip (exists): {u['email']}")
            continue
        await db.users.insert_one(
            {
                "name": u["name"],
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "role": u["role"],
                "active": True,
                "eod_pending": False,
            }
        )
        print(f"created: {u['email']} / {u['password']}  ({u['role']})")


if __name__ == "__main__":
    asyncio.run(main())
