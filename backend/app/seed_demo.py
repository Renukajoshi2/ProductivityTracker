"""Seed rich demo data: users, tasks, blockers, comments, EOD reports.

Run from the backend/ directory:  python -m app.seed_demo
"""
import asyncio
from datetime import datetime, timedelta, timezone

from .db import ensure_indexes, get_db
from .security import hash_password

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
USERS = [
    {"name": "Admin",        "email": "admin@example.com",   "password": "admin123",   "role": "admin"},
    {"name": "Sarah Chen",   "email": "lead@example.com",    "password": "lead123",    "role": "lead"},
    {"name": "Alex Rivera",  "email": "member1@example.com", "password": "member123",  "role": "member"},
    {"name": "Jordan Smith", "email": "member2@example.com", "password": "member123",  "role": "member"},
    {"name": "Priya Nair",   "email": "member3@example.com", "password": "member123",  "role": "member"},
    {"name": "Marcus Webb",  "email": "member4@example.com", "password": "member123",  "role": "member"},
]

# ---------------------------------------------------------------------------
# Tasks per member (email -> list of task dicts)
# ---------------------------------------------------------------------------
TASKS = {
    "member1@example.com": [
        {"title": "Redesign login page UI",           "status": "done",        "progress_pct": 100, "days_ago": 3, "due_in": None},
        {"title": "Integrate OAuth2 with Google",     "status": "in_progress", "progress_pct": 65,  "days_ago": 5, "due_in": 3},
        {"title": "Write unit tests for auth module", "status": "in_progress", "progress_pct": 40,  "days_ago": 2, "due_in": 5},
        {"title": "Fix mobile nav overflow bug",      "status": "blocked",     "progress_pct": 20,  "days_ago": 4, "due_in": 1},
        {"title": "Update API documentation",         "status": "open",        "progress_pct": 0,   "days_ago": 1, "due_in": 7},
    ],
    "member2@example.com": [
        {"title": "Set up CI/CD pipeline",            "status": "done",        "progress_pct": 100, "days_ago": 6, "due_in": None},
        {"title": "Migrate DB to MongoDB Atlas",      "status": "in_progress", "progress_pct": 75,  "days_ago": 4, "due_in": 2},
        {"title": "Add rate limiting to API",         "status": "blocked",     "progress_pct": 30,  "days_ago": 3, "due_in": 1},
        {"title": "Deploy staging environment",       "status": "in_progress", "progress_pct": 50,  "days_ago": 2, "due_in": 4},
        {"title": "Configure error alerting (PD)",   "status": "open",        "progress_pct": 0,   "days_ago": 1, "due_in": 6},
    ],
    "member3@example.com": [
        {"title": "Build dashboard analytics page",   "status": "done",        "progress_pct": 100, "days_ago": 5, "due_in": None},
        {"title": "Integrate Recharts for KPIs",      "status": "done",        "progress_pct": 100, "days_ago": 4, "due_in": None},
        {"title": "Add CSV export to reports",        "status": "in_progress", "progress_pct": 55,  "days_ago": 2, "due_in": 3},
        {"title": "Dark mode support",                "status": "blocked",     "progress_pct": 10,  "days_ago": 3, "due_in": 2},
        {"title": "Accessibility audit (WCAG 2.1)",   "status": "open",        "progress_pct": 0,   "days_ago": 1, "due_in": 10},
    ],
    "member4@example.com": [
        {"title": "Research vector DB options",       "status": "done",        "progress_pct": 100, "days_ago": 7, "due_in": None},
        {"title": "Implement RAG search feature",     "status": "in_progress", "progress_pct": 80,  "days_ago": 5, "due_in": 2},
        {"title": "Fine-tune OpenAI prompt templates","status": "in_progress", "progress_pct": 60,  "days_ago": 3, "due_in": 4},
        {"title": "Add streaming to chat endpoint",   "status": "blocked",     "progress_pct": 25,  "days_ago": 2, "due_in": 1},
        {"title": "Evaluate cost optimisation",       "status": "open",        "progress_pct": 0,   "days_ago": 1, "due_in": 8},
    ],
}

# Blocker reasons per blocked task (matched by title)
BLOCKER_REASONS = {
    "Fix mobile nav overflow bug":       "Waiting for design team to confirm breakpoint specs. No response for 2 days.",
    "Add rate limiting to API":          "Redis instance not provisioned yet — blocked on DevOps ticket #204.",
    "Dark mode support":                 "Tailwind config conflicts with third-party chart library colours. Need decision from lead.",
    "Add streaming to chat endpoint":    "OpenAI streaming response format changed in latest SDK; migration docs unclear.",
}

BLOCKER_COMMENTS = {
    "Fix mobile nav overflow bug": [
        ("lead@example.com",    "I've pinged the design team again. Should have specs by EOD tomorrow."),
        ("member1@example.com", "If no response by tomorrow noon I'll proceed with 768px assumption."),
    ],
    "Add rate limiting to API": [
        ("lead@example.com",    "DevOps ticket #204 is assigned to Liam — escalating to him now."),
        ("member2@example.com", "In the meantime I'm using an in-memory fallback for testing."),
        ("admin@example.com",   "Redis instance will be ready by Thursday. Confirmed with infra team."),
    ],
    "Dark mode support": [
        ("lead@example.com",    "Let's go with CSS variable overrides for chart colours — avoids library conflict."),
        ("member3@example.com", "Makes sense, I'll prototype it and share a screenshot today."),
    ],
    "Add streaming to chat endpoint": [
        ("lead@example.com",    "Check the OpenAI migration guide v1.x — there's a new `stream=True` pattern."),
        ("member4@example.com", "Found it, testing now. The `AsyncStream` wrapper should work."),
    ],
}

# EOD report summaries per member per day offset
EOD_REPORTS = {
    "member1@example.com": [
        (1, "Completed 3 auth unit tests. Google OAuth is 65% done — token refresh logic remaining. Nav bug still blocked on design specs."),
        (2, "Made progress on OAuth token refresh. Opened blocker ticket for nav bug breakpoints."),
    ],
    "member2@example.com": [
        (1, "Atlas migration 75% done — data validation scripts running overnight. Rate limiting blocked on Redis provisioning."),
        (2, "Staging deployment at 50%. Resolved 2 minor DNS issues. Blocked on Redis still."),
    ],
    "member3@example.com": [
        (1, "CSV export 55% done — backend endpoint ready, working on frontend download trigger. Dark mode blocked on chart library."),
        (2, "Finished Recharts KPI integration. Started CSV export backend work."),
    ],
    "member4@example.com": [
        (1, "RAG search 80% done — retrieval quality looks good. Streaming endpoint blocked on SDK migration. Prompt templates 60% refined."),
        (2, "Completed vector DB research. Started RAG implementation. Chose ChromaDB approach."),
    ],
}


async def main():
    await ensure_indexes()
    db = get_db()

    now = datetime.now(timezone.utc)

    # -----------------------------------------------------------------------
    # 1. Users
    # -----------------------------------------------------------------------
    user_ids = {}
    for u in USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids[u["email"]] = str(existing["_id"])
            print(f"skip (exists): {u['email']}")
            continue
        result = await db.users.insert_one({
            "name":          u["name"],
            "email":         u["email"],
            "password_hash": hash_password(u["password"]),
            "role":          u["role"],
            "active":        True,
            "eod_pending":   False,
        })
        user_ids[u["email"]] = str(result.inserted_id)
        print(f"created user: {u['email']} ({u['role']})")

    # Rebuild from DB to ensure we have all IDs (including pre-existing)
    async for u in db.users.find():
        user_ids[u["email"]] = str(u["_id"])

    # Name lookup
    user_names = {email: next(x["name"] for x in USERS if x["email"] == email)
                  for email in user_ids}
    # Pick up names already in DB for emails not in USERS list
    async for u in db.users.find():
        user_names[u["email"]] = u["name"]

    # -----------------------------------------------------------------------
    # 2. Tasks + blockers + blocker comments
    # -----------------------------------------------------------------------
    from bson import ObjectId

    task_ids = {}  # title -> inserted id

    for email, tasks in TASKS.items():
        if email not in user_ids:
            continue
        uid = user_ids[email]

        for t in tasks:
            existing = await db.tasks.find_one({"owner_id": uid, "title": t["title"]})
            if existing:
                task_ids[t["title"]] = str(existing["_id"])
                print(f"  skip task (exists): {t['title']}")
                continue

            created_at = now - timedelta(days=t["days_ago"])
            completed_at = now - timedelta(days=t["days_ago"] - 1) if t["status"] == "done" else None

            due_date = (
                (now + timedelta(days=t["due_in"])).date().isoformat()
                if t.get("due_in") is not None else None
            )
            result = await db.tasks.insert_one({
                "title":        t["title"],
                "owner_id":     uid,
                "status":       t["status"],
                "progress_pct": t["progress_pct"],
                "first_seen":   created_at,
                "completed_at": completed_at,
                "due_date":     due_date,
            })
            task_ids[t["title"]] = str(result.inserted_id)
            print(f"  created task: [{t['status']}] {t['title']}")

            # Blocker
            if t["status"] == "blocked" and t["title"] in BLOCKER_REASONS:
                existing_blocker = await db.blockers.find_one(
                    {"task_id": str(result.inserted_id), "resolved_at": None}
                )
                if not existing_blocker:
                    blocker_result = await db.blockers.insert_one({
                        "task_id":    str(result.inserted_id),
                        "owner_id":   uid,
                        "reason":     BLOCKER_REASONS[t["title"]],
                        "created_at": created_at + timedelta(hours=2),
                        "resolved_at": None,
                    })
                    blocker_id = str(blocker_result.inserted_id)
                    print(f"    created blocker for: {t['title']}")

                    # Blocker comments
                    for commenter_email, comment_text in BLOCKER_COMMENTS.get(t["title"], []):
                        commenter_id = user_ids.get(commenter_email, uid)
                        commenter_name = user_names.get(commenter_email, "Unknown")
                        await db.blocker_comments.insert_one({
                            "blocker_id":  blocker_id,
                            "author_id":   commenter_id,
                            "author_name": commenter_name,
                            "text":        comment_text,
                            "created_at":  created_at + timedelta(hours=3),
                            "deleted":     False,
                        })
                    print(f"    added {len(BLOCKER_COMMENTS.get(t['title'], []))} comments")

    # -----------------------------------------------------------------------
    # 3. EOD reports
    # -----------------------------------------------------------------------
    for email, reports in EOD_REPORTS.items():
        if email not in user_ids:
            continue
        uid = user_ids[email]

        for days_ago, summary in reports:
            report_date = (now - timedelta(days=days_ago)).date().isoformat()
            existing = await db.eod_reports.find_one({"user_id": uid, "date": report_date})
            if existing:
                print(f"  skip EOD (exists): {email} {report_date}")
                continue
            await db.eod_reports.insert_one({
                "user_id":    uid,
                "date":       report_date,
                "summary":    summary,
                "created_at": now - timedelta(days=days_ago),
            })
            print(f"  created EOD report: {email} {report_date}")

    print("\nDone! Demo data seeded.")


if __name__ == "__main__":
    asyncio.run(main())
