"""OpenAI tool-calling agent.

A single agent serves two modes by role:
- member: an EOD interviewer that extracts task progress + blockers and
  writes structured records.
- lead/admin: a query assistant that reports team status using DB tools
  and RAG over history.
"""
import json
from datetime import date, datetime, timezone

from bson import ObjectId
from openai import AsyncOpenAI

from ..config import settings
from ..db import get_db
from . import rag

_client: AsyncOpenAI | None = None


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


def _today() -> str:
    return date.today().isoformat()


# ---------------------------------------------------------------- tool impls

async def t_get_my_open_tasks(user, _):
    cur = get_db().tasks.find(
        {"owner_id": user["id"], "status": {"$ne": "done"}}
    )
    tasks = await cur.to_list(length=200)
    return [
        {
            "id": str(t["_id"]),
            "title": t["title"],
            "status": t["status"],
            "progress_pct": t.get("progress_pct", 0),
        }
        for t in tasks
    ]


async def t_match_or_create_task(user, args):
    title = args["title"].strip()
    existing = await get_db().tasks.find_one(
        {
            "owner_id": user["id"],
            "status": {"$ne": "done"},
            "title": {"$regex": f"^{title[:40]}", "$options": "i"},
        }
    )
    if existing:
        return {"id": str(existing["_id"]), "title": existing["title"], "matched": True}
    doc = {
        "title": title,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "status": "in_progress",
        "progress_pct": 0,
        "first_seen": datetime.now(timezone.utc),
        "completed_at": None,
    }
    res = await get_db().tasks.insert_one(doc)
    return {"id": str(res.inserted_id), "title": title, "matched": False}


async def t_update_task_progress(user, args):
    tid = ObjectId(args["task_id"])
    pct = max(0, min(100, int(args["percent"])))
    note = args.get("note", "")
    status = "done" if pct >= 100 else "in_progress"
    await get_db().tasks.update_one(
        {"_id": tid, "owner_id": user["id"]},
        {
            "$set": {
                "progress_pct": pct,
                "status": status,
                **({"completed_at": datetime.now(timezone.utc)} if status == "done" else {}),
            }
        },
    )
    await get_db().progress_updates.insert_one(
        {
            "task_id": str(tid),
            "owner_id": user["id"],
            "percent": pct,
            "note": note,
            "date": _today(),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"ok": True, "status": status, "percent": pct}


async def t_mark_done(user, args):
    return await t_update_task_progress(user, {"task_id": args["task_id"], "percent": 100, "note": args.get("note", "")})


async def t_log_blocker(user, args):
    tid = args["task_id"]
    await get_db().tasks.update_one(
        {"_id": ObjectId(tid), "owner_id": user["id"]}, {"$set": {"status": "blocked"}}
    )
    res = await get_db().blockers.insert_one(
        {
            "task_id": tid,
            "owner_id": user["id"],
            "owner_name": user["name"],
            "reason": args["reason"],
            "created_at": datetime.now(timezone.utc),
            "resolved_at": None,
        }
    )
    return {"ok": True, "blocker_id": str(res.inserted_id)}


async def t_resolve_blocker(user, args):
    await get_db().blockers.update_one(
        {"task_id": args["task_id"], "owner_id": user["id"], "resolved_at": None},
        {"$set": {"resolved_at": datetime.now(timezone.utc)}},
    )
    await get_db().tasks.update_one(
        {"_id": ObjectId(args["task_id"]), "owner_id": user["id"]},
        {"$set": {"status": "in_progress"}},
    )
    return {"ok": True}


async def t_save_eod_report(user, args):
    today = _today()
    await get_db().eod_reports.update_one(
        {"user_id": user["id"], "date": today},
        {
            "$set": {
                "user_id": user["id"],
                "user_name": user["name"],
                "date": today,
                "summary": args["summary"],
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    await rag.index_text("eod_report", f"{user['id']}:{today}", user["name"],
                         f"EOD {today} — {user['name']}: {args['summary']}")
    return {"ok": True}


async def t_query_tasks(_user, args):
    q = {}
    if args.get("status"):
        q["status"] = args["status"]
    if args.get("owner_name"):
        q["owner_name"] = {"$regex": args["owner_name"], "$options": "i"}
    cur = get_db().tasks.find(q).limit(100)
    return [
        {
            "title": t["title"],
            "owner": t.get("owner_name"),
            "status": t["status"],
            "progress_pct": t.get("progress_pct", 0),
        }
        for t in await cur.to_list(length=100)
    ]


async def t_get_daily_summary(_user, args):
    day = args.get("date") or _today()
    q = {"date": day}
    if args.get("user_name"):
        q["user_name"] = {"$regex": args["user_name"], "$options": "i"}
    reports = await get_db().eod_reports.find(q).to_list(length=100)
    blockers = await get_db().blockers.find({"resolved_at": None}).to_list(length=100)
    return {
        "date": day,
        "reports": [{"user": r["user_name"], "summary": r["summary"]} for r in reports],
        "active_blockers": [
            {"user": b["owner_name"], "reason": b["reason"]} for b in blockers
        ],
    }


async def t_search_history(_user, args):
    return await rag.retrieve(args["query"], k=args.get("k", 5))


TOOL_IMPL = {
    "get_my_open_tasks": t_get_my_open_tasks,
    "match_or_create_task": t_match_or_create_task,
    "update_task_progress": t_update_task_progress,
    "mark_done": t_mark_done,
    "log_blocker": t_log_blocker,
    "resolve_blocker": t_resolve_blocker,
    "save_eod_report": t_save_eod_report,
    "query_tasks": t_query_tasks,
    "get_daily_summary": t_get_daily_summary,
    "search_history": t_search_history,
}

_def = lambda name, desc, props, req: {
    "type": "function",
    "function": {
        "name": name,
        "description": desc,
        "parameters": {"type": "object", "properties": props, "required": req},
    },
}

MEMBER_TOOLS = [
    _def("get_my_open_tasks", "List the current user's open/in-progress/blocked tasks carried over from previous days.", {}, []),
    _def("match_or_create_task", "Find an existing open task by title or create a new one for the user.",
         {"title": {"type": "string"}}, ["title"]),
    _def("update_task_progress", "Record quantified progress on a task (0-100%). Use 100 when finished.",
         {"task_id": {"type": "string"}, "percent": {"type": "integer"}, "note": {"type": "string"}},
         ["task_id", "percent"]),
    _def("mark_done", "Mark a task fully complete.", {"task_id": {"type": "string"}, "note": {"type": "string"}}, ["task_id"]),
    _def("log_blocker", "Record a blocker with a concrete reason for a task.",
         {"task_id": {"type": "string"}, "reason": {"type": "string"}}, ["task_id", "reason"]),
    _def("resolve_blocker", "Clear an existing blocker on a task.", {"task_id": {"type": "string"}}, ["task_id"]),
    _def("save_eod_report", "Save the end-of-day structured summary once the interview is complete.",
         {"summary": {"type": "string"}}, ["summary"]),
]

LEAD_TOOLS = [
    _def("query_tasks", "Query tasks across the team, optionally filtered by status or owner name.",
         {"status": {"type": "string"}, "owner_name": {"type": "string"}}, []),
    _def("get_daily_summary", "Get EOD reports + active blockers for a date (default today), optionally for one person.",
         {"date": {"type": "string"}, "user_name": {"type": "string"}}, []),
    _def("search_history", "Semantic search over past EOD reports and chat history.",
         {"query": {"type": "string"}, "k": {"type": "integer"}}, ["query"]),
]

MEMBER_SYSTEM = """You are the team's EOD (end-of-day) assistant talking to {name}.
Goal: collect an accurate, quantified end-of-day status.

Process:
1. Call get_my_open_tasks first to see tasks carried over from prior days.
2. For each task, ask what progress was made TODAY. Always push for a concrete
   number (percent complete) or exactly what is left — never accept a vague
   "made progress". Ask one focused follow-up at a time.
3. If a task stalled or did not move, ask why; if it is blocked, capture a
   specific reason and call log_blocker.
4. Ask if they started anything new today; use match_or_create_task then
   update_task_progress.
5. Use update_task_progress / mark_done as you confirm numbers with the user.
6. When everything is covered, summarise back in 3-6 bullet points, get the
   user's confirmation, then call save_eod_report with that summary.
Be concise, friendly, and specific. Do not invent progress."""

LEAD_SYSTEM = """You are the team productivity assistant talking to {name}, a lead.
Answer questions about team status, individual task status, blockers, and
daily summaries. Use query_tasks, get_daily_summary, and search_history to
ground every answer in real data. If asked for productivity observations,
be specific (who, what, how stale). Never fabricate; if data is missing,
say so."""


async def run_agent(user: dict, history: list[dict], user_message: str) -> str:
    is_lead = user.get("role") in ("admin", "lead")
    tools = (MEMBER_TOOLS if not is_lead else []) + (LEAD_TOOLS if is_lead else [])
    system = (LEAD_SYSTEM if is_lead else MEMBER_SYSTEM).format(name=user["name"])

    messages = [{"role": "system", "content": system}]
    messages += history
    messages.append({"role": "user", "content": user_message})

    client = _openai()
    for _ in range(8):  # bounded tool loop
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            tools=tools or None,
            temperature=0.3,
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return msg.content or ""
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
            }
        )
        for tc in msg.tool_calls:
            fn = TOOL_IMPL.get(tc.function.name)
            try:
                args = json.loads(tc.function.arguments or "{}")
                result = await fn(user, args) if fn else {"error": "unknown tool"}
            except Exception as e:  # surface tool errors to the model
                result = {"error": str(e)}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                }
            )
    return "Sorry, I couldn't complete that — please try rephrasing."
