from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_db
from ..security import get_current_user


class StatusUpdate(BaseModel):
    status: Literal["in_progress", "done", "blocked"]

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _enrich(tasks, db):
    """Attach owner_name, latest progress note, and active blocker to each task."""
    owner_ids = list({t["owner_id"] for t in tasks})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(i) for i in owner_ids]}}
    ).to_list(length=500)
    name_map = {str(u["_id"]): u["name"] for u in users}

    task_ids = [str(t["_id"]) for t in tasks]

    # latest progress update note per task
    raw_updates = await db.progress_updates.find(
        {"task_id": {"$in": task_ids}}
    ).sort("created_at", -1).to_list(length=5000)
    note_map = {}
    for u in raw_updates:
        tid = u["task_id"]
        if tid not in note_map and u.get("note", "").strip():
            note_map[tid] = u["note"].strip()

    # active blockers keyed by task_id
    raw_blockers = await db.blockers.find(
        {"task_id": {"$in": task_ids}, "resolved_at": None}
    ).to_list(length=500)
    blocker_map = {b["task_id"]: b["reason"] for b in raw_blockers}

    out = []
    for t in tasks:
        tid = str(t["_id"])
        out.append({
            "id": tid,
            "title": t["title"],
            "owner_id": t["owner_id"],
            "owner_name": name_map.get(t["owner_id"], "Unknown"),
            "status": t["status"],
            "progress_pct": t.get("progress_pct", 0),
            "progress_note": note_map.get(tid),
            "first_seen": t.get("first_seen"),
            "completed_at": t.get("completed_at"),
            "due_date": t.get("due_date"),
            "blocker_reason": blocker_map.get(tid),
        })
    return out


@router.get("")
async def list_tasks(user: dict = Depends(get_current_user)):
    db = get_db()
    scope = {} if user["role"] in ("admin", "lead") else {"owner_id": user["id"]}
    tasks = await db.tasks.find(scope).sort("first_seen", -1).to_list(length=1000)
    return await _enrich(tasks, db)


@router.patch("/{task_id}/status")
async def update_status(task_id: str, body: StatusUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(404, "Task not found")
    update = {"status": body.status}
    if body.status == "done":
        update["completed_at"] = datetime.now(timezone.utc)
        update["progress_pct"] = 100
    elif task.get("status") == "done":
        update["completed_at"] = None
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})
    return {"ok": True}


@router.get("/member/{user_id}")
async def member_tasks(user_id: str, _: dict = Depends(get_current_user)):
    db = get_db()
    tasks = await db.tasks.find({"owner_id": user_id}).sort("first_seen", -1).to_list(length=1000)
    enriched = await _enrich(tasks, db)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    eod_reports = await db.eod_reports.find(
        {"user_id": user_id}
    ).sort("date", -1).to_list(length=60)

    return {
        "user": {
            "id": user_id,
            "name": user["name"] if user else "Unknown",
            "email": user.get("email", "") if user else "",
            "role": user.get("role", "") if user else "",
        },
        "tasks": enriched,
        "eod_reports": [
            {"date": r["date"], "summary": r["summary"]} for r in eod_reports
        ],
    }
