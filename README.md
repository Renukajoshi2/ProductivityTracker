# Productivity_Tracker

A chat-first team productivity & end-of-day (EOD) tracker. Replaces team
task-tracking spreadsheets with a conversational assistant.

- **Members** chat with an AI assistant that interviews them at end of day,
  pushes for quantified progress, and captures blockers — no manual task
  entry, tasks are self-reported and carried over day to day.
- **Leads/Admins** ask the assistant for team summaries and task status, and
  get visual Dashboard, Blockers, and Team pages.
- A scheduler flags members for a pending EOD update at **5:00 PM, Mon–Fri**.

## Tech

| Layer    | Stack                                            |
|----------|--------------------------------------------------|
| Frontend | Next.js 14 (App Router), Tailwind, Recharts      |
| Backend  | FastAPI, Motor (async MongoDB), APScheduler      |
| AI       | OpenAI (tool-calling agent + embeddings for RAG) |
| DB       | MongoDB (local)                                  |
| Auth     | JWT, bcrypt, per-user roles (admin/lead/member)  |

## Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`)
- An OpenAI API key

## Setup

```bash
git clone <your-repo-url> Productivity_Tracker
cd Productivity_Tracker
cp .env.example .env          # then edit .env (set OPENAI_API_KEY, JWT_SECRET)
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate         # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python -m app.seed             # creates admin/lead/member demo accounts
uvicorn app.main:app --reload  # http://localhost:8000  (docs at /docs)
```

`.env` is read from the **repo root**; run uvicorn from `backend/` and it
still resolves because pydantic-settings looks up `.env`. If it doesn't pick
it up, copy `.env` into `backend/` too.

Seeded accounts (change these in production):

| Role   | Email                | Password   |
|--------|----------------------|------------|
| admin  | admin@example.com    | admin123   |
| lead   | lead@example.com     | lead123    |
| member | member1@example.com  | member123  |
| member | member2@example.com  | member123  |

### Frontend

```bash
cd frontend
npm install
echo NEXT_PUBLIC_API_BASE=http://localhost:8000 > .env.local
npm run dev                    # http://localhost:3000
```

## Usage

- Log in at `http://localhost:3000/login`.
- **Member:** the chat page is home. Say *"starting my EOD"* — the bot pulls
  your carried-over tasks, asks for quantified progress, captures blockers,
  and saves a structured EOD report.
- **Lead:** chat for summaries (*"today's team summary"*, *"status of the
  payments task"*), plus Dashboard / Team / Blockers pages.
- **Blockers:** any team member can comment on any blocker; owners/leads can
  resolve them.

## Configuration (`.env`)

| Var                 | Purpose                                  |
|---------------------|------------------------------------------|
| `OPENAI_API_KEY`    | Required for chat + RAG                   |
| `OPENAI_MODEL`      | Chat model (default `gpt-4o-mini`)       |
| `JWT_SECRET`        | Sign JWTs — set a long random value      |
| `EOD_HOUR/MINUTE`   | Reminder time (default 17:00)            |
| `EOD_DAYS`          | Reminder days (default `mon-fri`)        |

## Notes

- RAG uses an in-process cosine scan over stored embeddings — adequate for a
  ~20-person team, no vector DB required.
- This is an MVP; productivity "suggestions" are produced by the lead-mode
  agent on request rather than as a precomputed panel.

## License

MIT — see [LICENSE](LICENSE).
