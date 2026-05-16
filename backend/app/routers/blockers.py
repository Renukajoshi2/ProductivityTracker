from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..models import BlockerCommentIn
from ..security import get_current_user

router = APIRouter(prefix="/blockers", tags=["blockers"])


@router.get("")
async def list_blockers(user: dict = Depends(get_current_user)):
    db = get_db()
    q = {"resolved_at": None}
    if user["role"] == "member":
        q["owner_id"] = user["id"]
    blockers = await db.blockers.find(q).sort("created_at", 1).to_list(length=200)
    out = []
    now = datetime.now(timezone.utc)
    for b in blockers:
        created = b["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_days = (now - created).days
        count = await db.blocker_comments.count_documents(
            {"blocker_id": str(b["_id"]), "deleted": {"$ne": True}}
        )
        out.append(
            {
                "id": str(b["_id"]),
                "task_id": b["task_id"],
                "owner_name": b.get("owner_name"),
                "reason": b["reason"],
                "created_at": created.isoformat(),
                "age_days": age_days,
                "comment_count": count,
            }
        )
    return out


@router.post("/{blocker_id}/resolve")
async def resolve(blocker_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    b = await db.blockers.find_one({"_id": ObjectId(blocker_id)})
    if not b:
        raise HTTPException(404, "Blocker not found")
    if user["role"] == "member" and b["owner_id"] != user["id"]:
        raise HTTPException(403, "Cannot resolve another member's blocker")
    await db.blockers.update_one(
        {"_id": ObjectId(blocker_id)},
        {"$set": {"resolved_at": datetime.now(timezone.utc)}},
    )
    await db.tasks.update_one(
        {"_id": ObjectId(b["task_id"])}, {"$set": {"status": "in_progress"}}
    )
    return {"ok": True}


@router.get("/{blocker_id}/comments")
async def get_comments(blocker_id: str, _: dict = Depends(get_current_user)):
    cur = (
        get_db()
        .blocker_comments.find({"blocker_id": blocker_id, "deleted": {"$ne": True}})
        .sort("created_at", 1)
    )
    return [
        {
            "id": str(c["_id"]),
            "author_id": c["author_id"],
            "author_name": c["author_name"],
            "text": c["text"],
            "created_at": c["created_at"].isoformat(),
        }
        for c in await cur.to_list(length=500)
    ]


@router.post("/{blocker_id}/comments")
async def add_comment(
    blocker_id: str,
    body: BlockerCommentIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    if not await db.blockers.find_one({"_id": ObjectId(blocker_id)}):
        raise HTTPException(404, "Blocker not found")
    res = await db.blocker_comments.insert_one(
        {
            "blocker_id": blocker_id,
            "author_id": user["id"],
            "author_name": user["name"],
            "text": body.text,
            "created_at": datetime.now(timezone.utc),
            "deleted": False,
        }
    )
    return {"id": str(res.inserted_id)}


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    c = await db.blocker_comments.find_one({"_id": ObjectId(comment_id)})
    if not c:
        raise HTTPException(404, "Comment not found")
    if c["author_id"] != user["id"] and user["role"] not in ("admin", "lead"):
        raise HTTPException(403, "Not allowed")
    await db.blocker_comments.update_one(
        {"_id": ObjectId(comment_id)}, {"$set": {"deleted": True}}
    )
    return {"ok": True}
