from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db():
    return get_client()[settings.mongodb_db]


async def ensure_indexes():
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.tasks.create_index([("owner_id", 1), ("status", 1)])
    await db.progress_updates.create_index([("task_id", 1), ("date", 1)])
    await db.blockers.create_index([("owner_id", 1), ("resolved_at", 1)])
    await db.blocker_comments.create_index("blocker_id")
    await db.messages.create_index([("user_id", 1), ("created_at", 1)])
    await db.eod_reports.create_index([("user_id", 1), ("date", 1)], unique=True)
