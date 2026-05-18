"""APScheduler job that flags members who still owe an EOD report.

In-app only: it sets `eod_pending=True` on members with no report for
today. The frontend surfaces this as a prompt; the chat agent then runs
the interview when they open the chat.
"""
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from ..config import settings
from ..db import get_db

scheduler = AsyncIOScheduler()


async def flag_pending_eod():
    today = date.today().isoformat()
    db = get_db()
    reported = await db.eod_reports.distinct("user_id", {"date": today})
    await db.users.update_many(
        {"role": "member", "active": True},
        {"$set": {"eod_pending": True, "eod_pending_date": today}},
    )
    if reported:
        from bson import ObjectId

        await db.users.update_many(
            {"_id": {"$in": [ObjectId(u) for u in reported]}},
            {"$set": {"eod_pending": False}},
        )


def start_scheduler():
    scheduler.add_job(
        flag_pending_eod,
        CronTrigger(
            day_of_week=settings.eod_days,
            hour=settings.eod_hour,
            minute=settings.eod_minute,
        ),
        id="eod_reminder",
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
