# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                # Windows (use source .venv/bin/activate on Unix)
pip install -r requirements.txt
python -m app.seed_demo               # Seed rich demo data (6 users, tasks, blockers, EOD reports)
uvicorn app.main:app --reload         # http://localhost:8000 — API docs at /docs
```

### Frontend
```bash
cd frontend
npm install
echo NEXT_PUBLIC_API_BASE=http://localhost:8000 > .env.local
npm run dev                           # http://localhost:3000
npm run build && npm run start        # Production build
```

### Environment
Copy `.env.example` to `.env` at the repo root (pydantic-settings auto-discovers it even when uvicorn runs from `backend/`). Required vars: `GROQ_API_KEY`, `JWT_SECRET`, `MONGODB_URI`. The `.env.example` still references OpenAI keys — those are unused; the actual config reads `GROQ_API_KEY`.

## Architecture

### Overview
Chat-first team productivity tracker where members do end-of-day (EOD) check-ins by chatting with an AI agent. No manual task entry — tasks are self-reported through conversation and carried over day to day.

### Tech Stack
- **Backend:** FastAPI + Motor (async MongoDB), APScheduler, python-jose JWT, bcrypt
- **Frontend:** Next.js 14 App Router, React 18, Tailwind CSS, Recharts
- **AI:** Groq tool-calling agent (`llama-3.3-70b-versatile`, OpenAI-compatible API) + RAG with local sentence-transformers (`all-MiniLM-L6-v2`, no external API key) and in-process cosine similarity via NumPy
- **Database:** MongoDB (local)

### Key Data Flow

**Member EOD flow:**
1. APScheduler cron sets `eod_pending=True` on member docs at 5 PM Mon–Fri
2. Frontend polls `/chat/history` for the `eod_pending` flag and shows an amber prompt
3. Member chats → `POST /chat` → Groq agent interviews them using tools (`get_my_open_tasks`, `save_eod_report`, `log_blocker`, etc.)
4. Agent saves structured EOD report + progress updates to MongoDB and indexes embeddings

**Lead/admin query flow:**
- Same `/chat` endpoint but the agent runs with a different system prompt and different tools (`query_tasks`, `get_daily_summary`, `search_history`)
- Dashboard (`/dashboard`) and Blockers (`/blockers`) pages pull from `/stats/*` and `/blockers` REST endpoints directly

### Agent Architecture (`backend/app/services/agent.py`)
Single Groq async tool-calling agent with **role-based dual mode** — system prompt and available tools differ between `member` and `lead`/`admin`. All tool implementations call MongoDB directly inside `agent.py`. The agent loop is bounded at 8 tool-call iterations. Embeddings are stored in an `embeddings` collection and retrieved via cosine scan in `rag.py` (suitable for ~20-person teams).

Agent tools are split into two sets:
- `MEMBER_TOOLS`: `get_my_open_tasks`, `match_or_create_task`, `update_task_progress`, `mark_done`, `log_blocker`, `resolve_blocker`, `save_eod_report`, `set_ooo`, `add_calendar_event`
- `LEAD_TOOLS`: `query_tasks`, `get_daily_summary`, `search_history`, `set_ooo`, `add_calendar_event`

### Role-Based Access
Three roles: `admin`, `lead`, `member`. Lead-only endpoints: `/stats/daily`, `/stats/team`, `GET/POST /users`. Admin ≈ lead for most purposes. Role is embedded in the JWT and enforced per-router via FastAPI dependencies in `security.py`.

### MongoDB Collections
`users`, `tasks`, `eod_reports`, `blockers`, `blocker_comments`, `messages`, `progress_updates`, `embeddings`, `calendar_events`

### Frontend Auth
JWT stored in `localStorage`. `frontend/app/lib/api.js` is the central API client — all fetch calls go through it and attach the Bearer token. The `(app)/layout.js` route group handles auth-gating and role-based nav visibility.

### Frontend Pages
- `/` — Chat interface (EOD check-in for members, query assistant for leads)
- `/dashboard` — Team stats charts (leads/admin only)
- `/blockers` — Active blockers with threaded comments
- `/tasks` — Filterable task table with inline status editing and Excel export (`xlsx`)
- `/tasks/[memberId]` — Per-member task history + EOD reports
- `/team` — Team member list with OOO status
- `/profile` — Current user profile

## Demo Accounts (after seeding with `python -m app.seed_demo`)
| Role   | Email               | Password  | Name         |
|--------|---------------------|-----------|--------------|
| admin  | admin@example.com   | admin123  | Admin        |
| lead   | lead@example.com    | lead123   | Sarah Chen   |
| member | member1@example.com | member123 | Alex Rivera  |
| member | member2@example.com | member123 | Jordan Smith |
| member | member3@example.com | member123 | Priya Nair   |
| member | member4@example.com | member123 | Marcus Webb  |
