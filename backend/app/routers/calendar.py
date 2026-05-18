from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_db
from ..security import get_current_user

router = APIRouter(prefix="/calendar", tags=["calendar"])


class EventIn(BaseModel):
    date: str          # YYYY-MM-DD
    title: str
    type: str = "milestone"   # milestone | deadline | release | demo
    description: str = ""


@router.get("/events")
async def get_events(_: dict = Depends(get_current_user)):
    events = await get_db().calendar_events.find({}).sort("date", 1).to_list(length=500)
    return [
        {
            "id": str(e["_id"]),
            "date": e["date"],
            "title": e["title"],
            "type": e.get("type", "milestone"),
            "description": e.get("description", ""),
            "created_by": e.get("created_by_name", ""),
        }
        for e in events
    ]


@router.post("/events")
async def add_event(body: EventIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "lead"):
        raise HTTPException(status_code=403, detail="Only admins and leads can add events")
    doc = {
        "date": body.date,
        "title": body.title,
        "type": body.type,
        "description": body.description,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc),
    }
    res = await get_db().calendar_events.insert_one(doc)
    return {"id": str(res.inserted_id), "date": body.date, "title": body.title, "type": body.type}


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "lead"):
        raise HTTPException(status_code=403, detail="Only admins and leads can delete events")
    await get_db().calendar_events.delete_one({"_id": ObjectId(event_id)})
    return {"ok": True}
