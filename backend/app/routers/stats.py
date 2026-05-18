from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from ..db import get_db
from ..security import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
async def summary(user: dict = Depends(get_current_user)):
    db = get_db()
    today = date.today().isoformat()
    scope = {} if user["role"] in ("admin", "lead") else {"owner_id": user["id"]}

    completed_today = await db.progress_updates.count_documents(
        {**scope, "percent": 100, "date": today}
    )
    open_tasks = await db.tasks.count_documents(
        {**scope, "status": {"$in": ["open", "in_progress"]}}
    )
    active_blockers = await db.blockers.count_documents(
        {**scope, "resolved_at": None}
    )
    done = await db.tasks.count_documents({**scope, "status": "done"})
    total = await db.tasks.count_documents(scope)
    rate = round(100 * done / total) if total else 0
    return {
        "completed_today": completed_today,
        "open_tasks": open_tasks,
        "active_blockers": active_blockers,
        "completion_rate": rate,
    }


@router.get("/daily")
async def daily(days: int = 14, _: dict = Depends(get_current_user)):
    db = get_db()
    scope = {}
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    cur = db.progress_updates.find(
        {**scope, "percent": 100, "date": {"$gte": start}}
    )
    counts = defaultdict(int)
    for u in await cur.to_list(length=5000):
        counts[u["date"]] += 1
    series = []
    for i in range(days):
        d = (date.today() - timedelta(days=days - 1 - i)).isoformat()
        series.append({"date": d, "completed": counts.get(d, 0)})
    return series


@router.get("/team")
async def team(_: dict = Depends(get_current_user)):
    db = get_db()
    users = await db.users.find({}).to_list(length=200)
    out = []
    for u in users:
        uid = str(u["_id"])
        out.append(
            {
                "name": u["name"],
                "ooo": u.get("ooo", False),
                "open": await db.tasks.count_documents(
                    {"owner_id": uid, "status": {"$in": ["open", "in_progress"]}}
                ),
                "done": await db.tasks.count_documents(
                    {"owner_id": uid, "status": "done"}
                ),
                "blocked": await db.blockers.count_documents(
                    {"owner_id": uid, "resolved_at": None}
                ),
            }
        )
    return out


@router.get("/sprint")
async def sprint(_: dict = Depends(get_current_user)):
    db = get_db()
    today = date.today()

    # Sprint completion (all time)
    total = await db.tasks.count_documents({})
    done  = await db.tasks.count_documents({"status": "done"})
    pct   = round(100 * done / total) if total else 0

    # Burndown — remaining open tasks per day for last 14 days
    all_tasks = await db.tasks.find({}, {"status": 1, "completed_at": 1, "first_seen": 1}).to_list(length=5000)
    burndown = []
    for i in range(14):
        day = today - timedelta(days=13 - i)
        day_end = datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=timezone.utc)
        remaining = sum(
            1 for t in all_tasks
            if (t.get("completed_at") is None or t["completed_at"] > day_end)
            and (t.get("first_seen") is None or t["first_seen"] <= day_end)
        )
        burndown.append({"date": day.isoformat(), "remaining": remaining})

    # Velocity — tasks completed per week for last 6 weeks
    velocity = []
    for i in range(5, -1, -1):
        week_mon = today - timedelta(days=today.weekday() + 7 * i)
        week_sun = week_mon + timedelta(days=6)
        w_start = datetime(week_mon.year, week_mon.month, week_mon.day, tzinfo=timezone.utc)
        w_end   = datetime(week_sun.year, week_sun.month, week_sun.day, 23, 59, 59, tzinfo=timezone.utc)
        completed = sum(
            1 for t in all_tasks
            if t.get("completed_at") and w_start <= t["completed_at"] <= w_end
        )
        velocity.append({"week": f"W{week_mon.strftime('%d %b')}", "completed": completed})

    return {"sprint_completion": {"total": total, "done": done, "pct": pct},
            "burndown": burndown, "velocity": velocity}
