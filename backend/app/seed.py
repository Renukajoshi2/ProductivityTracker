"""Seed an admin/lead and a few sample members.

Run from the backend/ directory:  python -m app.seed

Passwords are read from environment variables so that you never ship plaintext
demo credentials to production:

  SEED_ADMIN_PASSWORD=...   (default: "admin123" — blocked in prod unless ALLOW_DEMO_SEED=true)
  SEED_LEAD_PASSWORD=...
  SEED_MEMBER_PASSWORD=...
  ALLOW_DEMO_SEED=true      (set this only in local dev to allow the weak defaults)
"""
import asyncio
import os
import sys

from .db import ensure_indexes, get_db
from .security import hash_password

_DEMO_PASSWORDS = {"admin123", "lead123", "member123"}


def _get_password(env_var: str, demo_default: str) -> str:
    pw = os.environ.get(env_var, demo_default)
    if pw in _DEMO_PASSWORDS and os.environ.get("ALLOW_DEMO_SEED", "").lower() != "true":
        print(
            f"ERROR: {env_var} is set to a demo password ('{pw}'). "
            "Set a strong password via the env var, or set ALLOW_DEMO_SEED=true "
            "for local dev only.",
            file=sys.stderr,
        )
        sys.exit(1)
    return pw


SEED_USERS = [
    {"name": "Admin",      "email": "admin@example.com",   "password_env": "SEED_ADMIN_PASSWORD",  "demo_default": "admin123",  "role": "admin"},
    {"name": "Team Lead",  "email": "lead@example.com",    "password_env": "SEED_LEAD_PASSWORD",   "demo_default": "lead123",   "role": "lead"},
    {"name": "Member One", "email": "member1@example.com", "password_env": "SEED_MEMBER_PASSWORD", "demo_default": "member123", "role": "member"},
    {"name": "Member Two", "email": "member2@example.com", "password_env": "SEED_MEMBER_PASSWORD", "demo_default": "member123", "role": "member"},
]


async def main():
    await ensure_indexes()
    db = get_db()
    users = [
        {**u, "password": _get_password(u["password_env"], u["demo_default"])}
        for u in SEED_USERS
    ]
    for u in users:
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
        print(f"created: {u['email']}  ({u['role']})")


if __name__ == "__main__":
    asyncio.run(main())
