"""Groq tool-calling agent (OpenAI-compatible API).

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


def _groq() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
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


async def t_add_calendar_event(user, args):
    doc = {
        "date": args["date"],
        "title": args["title"],
        "type": args.get("type", "milestone"),
        "description": args.get("description", ""),
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc),
    }
    res = await get_db().calendar_events.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id), "date": args["date"], "title": args["title"], "type": doc["type"]}


async def t_set_ooo(user, args):
    ooo = bool(args.get("ooo", True))
    user_name = args.get("user_name", "").strip()

    if user_name and user.get("role") in ("admin", "lead"):
        # lead/admin can set OOO for any team member by name
        target = await get_db().users.find_one(
            {"name": {"$regex": user_name[:40], "$options": "i"}}
        )
    else:
        # members only set their own OOO
        target = await get_db().users.find_one({"_id": ObjectId(user["id"])})

    if not target:
        return {"error": f"User '{user_name}' not found"}

    await get_db().users.update_one(
        {"_id": target["_id"]}, {"$set": {"ooo": ooo}}
    )
    status = "out of office" if ooo else "back in office"
    return {"ok": True, "user": target["name"], "ooo": ooo, "status": status}


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
    "set_ooo": t_set_ooo,
    "add_calendar_event": t_add_calendar_event,
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
    _def("update_task_progress", "Record progress on a task. `note` MUST be the user's own words describing what they did — this is shown verbatim in the dashboard.",
         {"task_id": {"type": "string"}, "percent": {"type": "integer"}, "note": {"type": "string"}},
         ["task_id", "percent", "note"]),
    _def("mark_done", "Mark a task fully complete.", {"task_id": {"type": "string"}, "note": {"type": "string"}}, ["task_id"]),
    _def("log_blocker", "Record a blocker with a concrete reason for a task.",
         {"task_id": {"type": "string"}, "reason": {"type": "string"}}, ["task_id", "reason"]),
    _def("resolve_blocker", "Clear an existing blocker on a task.", {"task_id": {"type": "string"}}, ["task_id"]),
    _def("save_eod_report", "Save the end-of-day structured summary once the interview is complete.",
         {"summary": {"type": "string"}}, ["summary"]),
    _def("set_ooo", "Mark yourself as Out of Office (ooo=true) or back in office (ooo=false). "
         "Call this whenever the user says they are OOO, taking a day off, on leave, or unavailable.",
         {"ooo": {"type": "boolean"}}, ["ooo"]),
    _def("add_calendar_event", "Add an event to the team calendar. Use for any deadline, demo, release, or milestone mention that includes a date. "
         "date must be YYYY-MM-DD. type must be one of: milestone, deadline, release, demo.",
         {"date": {"type": "string"}, "title": {"type": "string"},
          "type": {"type": "string"}, "description": {"type": "string"}},
         ["date", "title"]),
]

LEAD_TOOLS = [
    _def("query_tasks", "Query tasks across the team, optionally filtered by status or owner name.",
         {"status": {"type": "string"}, "owner_name": {"type": "string"}}, []),
    _def("get_daily_summary", "Get EOD reports + active blockers for a date (default today), optionally for one person.",
         {"date": {"type": "string"}, "user_name": {"type": "string"}}, []),
    _def("search_history", "Semantic search over past EOD reports and chat history.",
         {"query": {"type": "string"}, "k": {"type": "integer"}}, ["query"]),
    _def("set_ooo", "Mark a team member as Out of Office (ooo=true) or back in office (ooo=false). "
         "Use when anyone reports themselves or a colleague as OOO, on leave, or unavailable. "
         "Pass user_name to set OOO for a specific person.",
         {"ooo": {"type": "boolean"}, "user_name": {"type": "string"}}, ["ooo"]),
    _def("add_calendar_event", "Add an event to the team calendar. Use for milestones, deadlines, releases, or demos. "
         "date must be YYYY-MM-DD. type must be one of: milestone, deadline, release, demo.",
         {"date": {"type": "string"}, "title": {"type": "string"},
          "type": {"type": "string"}, "description": {"type": "string"}},
         ["date", "title"]),
]

MEMBER_SYSTEM = """You are the team's task-update assistant for {name}.
Today's date is {today}.

CALENDAR — HIGHEST PRIORITY RULE: If the user's message mentions any event word
(deadline, demo, release, milestone, meeting, review) AND any date or time reference,
you MUST immediately call add_calendar_event — before doing anything else.
Do NOT treat it as a task query. Do NOT ask for confirmation. Just call the tool.
Examples (today = {today}):
  "add development deadline to 18th May"  → type=deadline, title="Development Deadline", date={year}-05-18
  "deadline on 20th"                      → type=deadline, title="Deadline",              date={year}-05-20
  "demo next Friday"                      → type=demo,     compute next Friday from {today}
  "release on June 3"                     → type=release,  title="Release",               date={year}-06-03
  "add this deadline in the calendar"     → type=deadline, infer title from context
Date rules: "18th May" / "May 18" → {year}-05-18. If date already passed, use next year.
Always output date as YYYY-MM-DD.

Your main job: interview {name} one task at a time and record exactly what they say.

STRICT RULES:
1. When the user wants to give an update, immediately call get_my_open_tasks.
2. Work through each open task STRICTLY ONE AT A TIME:
   — Show the task name and ask ONE focused question about it.
   — Do NOT mention the next task until the current one is fully addressed.
   — Never ask two questions in the same message.
3. For each task, ask: what did you do on this today / what is the current status?
4. When the user responds:
   — Call update_task_progress using their EXACT WORDS (verbatim or very close)
     as the `note` parameter. This text appears in the team dashboard — make it
     the user's own voice, not a paraphrase.
   — Derive the percent from context (done = 100, no progress = keep current,
     partial = estimate from their description).
   — If the task seems stuck, ask "Is anything blocking you?" — if yes, call log_blocker.
5. After all carried-over tasks, ask: "Did you start anything new today?"
   Use match_or_create_task + update_task_progress for any new work.
6. Once all tasks are done, summarise in 3-6 bullet points, confirm with the user,
   then call save_eod_report.
7. OOO: if at any point the user says they are out of office, taking a day off,
   on leave, or unavailable, immediately call set_ooo(ooo=true) and confirm.
   If they say they're back, call set_ooo(ooo=false).

ONE QUESTION PER MESSAGE — always. Be brief, warm, and specific."""

LEAD_SYSTEM = """You are the team productivity assistant talking to {name}, a lead.
Today's date is {today}.

CALENDAR — HIGHEST PRIORITY RULE: If the user's message mentions any event word
(deadline, demo, release, milestone, meeting, review) AND any date or time reference,
you MUST immediately call add_calendar_event — before doing anything else.
Do NOT treat it as a task query. Do NOT ask for confirmation. Just call the tool.
Examples (today = {today}):
  "Demo on 27th May"              → type=demo,      title="Demo",                date={year}-05-27
  "development deadline 18th May" → type=deadline,  title="Development Deadline", date={year}-05-18
  "release next Friday"           → type=release,   compute next Friday from {today}
  "sprint review on June 3"       → type=milestone, title="Sprint Review",        date={year}-06-03
  "add a milestone for ..."       → type=milestone, infer title from context
  "add this deadline in calendar" → type=deadline,  infer title from context
Date rules: "18th May" / "May 18" → {year}-05-18. "next Friday" → compute from {today}.
If no year given, assume {year} unless date already passed (then next year).
Always output date as YYYY-MM-DD. type must be: milestone, deadline, release, or demo.

OOO: if {name} says any team member (including themselves) is out of office,
on leave, or unavailable — or is back — immediately call set_ooo with the
member's name and ooo=true/false. Confirm the update in your reply.

For all other questions: answer about team status, task status, blockers, and
daily summaries. Use query_tasks, get_daily_summary, and search_history to
ground every answer in real data. Never fabricate; if data is missing, say so."""


async def run_agent(user: dict, history: list[dict], user_message: str) -> str:
    is_lead = user.get("role") in ("admin", "lead")
    tools = (MEMBER_TOOLS if not is_lead else []) + (LEAD_TOOLS if is_lead else [])
    today = _today()
    year = today.split("-")[0]
    system = (LEAD_SYSTEM if is_lead else MEMBER_SYSTEM).format(
        name=user["name"], today=today, year=year
    )

    messages = [{"role": "system", "content": system}]
    messages += history
    messages.append({"role": "user", "content": user_message})

    client = _groq()
    for _ in range(8):  # bounded tool loop
        resp = await client.chat.completions.create(
            model=settings.groq_model,
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
