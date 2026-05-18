from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends

from ..db import get_db
from ..models import ChatIn, ChatOut
from ..security import get_current_user
from ..services import rag
from ..services.agent import run_agent

router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_LIMIT = 20


@router.get("/history")
async def history(user: dict = Depends(get_current_user)):
    cur = (
        get_db()
        .messages.find({"user_id": user["id"]})
        .sort("created_at", -1)
        .limit(HISTORY_LIMIT)
    )
    msgs = list(reversed(await cur.to_list(length=HISTORY_LIMIT)))
    return {
        "eod_pending": user.get("eod_pending", False),
        "messages": [
            {"role": m["role"], "content": m["content"]} for m in msgs
        ],
    }


@router.post("", response_model=ChatOut)
async def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    db = get_db()
    cur = (
        db.messages.find({"user_id": user["id"]})
        .sort("created_at", -1)
        .limit(HISTORY_LIMIT)
    )
    hist = list(reversed(await cur.to_list(length=HISTORY_LIMIT)))
    history = [{"role": m["role"], "content": m["content"]} for m in hist]

    reply = await run_agent(user, history, body.message)

    now = datetime.now(timezone.utc)
    await db.messages.insert_many(
        [
            {"user_id": user["id"], "role": "user", "content": body.message, "created_at": now},
            {"user_id": user["id"], "role": "assistant", "content": reply, "created_at": now},
        ]
    )
    await rag.index_text("chat", f"{user['id']}:{now.isoformat()}", user["name"],
                         f"{user['name']}: {body.message}")
    # Clear the EOD prompt once the user has engaged and a report exists.
    today = now.date().isoformat()
    if await db.eod_reports.find_one({"user_id": user["id"], "date": today}):
        await db.users.update_one(
            {"_id": ObjectId(user["id"])}, {"$set": {"eod_pending": False}}
        )
    return ChatOut(reply=reply)
