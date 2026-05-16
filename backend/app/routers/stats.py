from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from ..db import get_db
from ..security import get_current_user, require_lead

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
async def daily(days: int = 14, user: dict = Depends(get_current_user)):
    db = get_db()
    scope = {} if user["role"] in ("admin", "lead") else {"owner_id": user["id"]}
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
async def team(_: dict = Depends(require_lead)):
    db = get_db()
    users = await db.users.find({"role": "member"}).to_list(length=200)
    out = []
    for u in users:
        uid = str(u["_id"])
        out.append(
            {
                "name": u["name"],
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
