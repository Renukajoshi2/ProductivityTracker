# Claude Code task prompt — make Productivity_Tracker publicly accessible via a link

Paste everything below into a fresh Claude Code session opened in
`C:\Users\renuk\Productivity_Tracker`.

---

## Context (read first)

`Productivity_Tracker` is a chat-first team productivity app:
- **Backend:** FastAPI + Motor (MongoDB), JWT auth with roles, APScheduler
  EOD reminder. Entry point `backend/app/main.py`. Deps in
  `backend/requirements.txt`.
- **Frontend:** Next.js 14 (App Router) + Tailwind in `frontend/`.
- **LLM:** Groq (already wired — do NOT change LLM code or re-add OpenAI).
- It is its own git repo with one commit and currently **no GitHub remote**.

### Hard constraints
- **NEVER** run git operations against `C:\Users\renuk` (the parent folder is
  a separate git repo containing the full Windows profile — pushing it would
  leak sensitive data). Only ever operate inside
  `C:\Users\renuk\Productivity_Tracker`.
- Do not deploy anything yourself or log into any external account. You
  prepare code/config and give the user exact manual steps for account work.
- Do not commit secrets. `.env` stays gitignored; use `.env.example` and
  host dashboard env vars instead.

---

## Goal

Make the app reachable by a shareable URL so non-technical people just open a
link and log in — without anyone receiving or being able to change the code.
Target free-tier stack: **MongoDB Atlas** (DB) + **Render** (FastAPI backend)
+ **Vercel** (Next.js frontend).

---

## Part A — code/config changes you do now (local)

1. **CORS:** in `backend/app/main.py` the CORS `allow_origins` is hardcoded to
   `http://localhost:3000`. Make it read a comma-separated env var
   `ALLOWED_ORIGINS` (fallback to localhost for dev). Add `ALLOWED_ORIGINS`
   to `backend/app/config.py` settings and to `.env.example`.
2. **Frontend API base:** confirm `frontend/lib/api.js` uses
   `process.env.NEXT_PUBLIC_API_BASE`. Document that it must be set to the
   Render backend URL on Vercel. Add a `frontend/.env.example` with
   `NEXT_PUBLIC_API_BASE=`.
3. **Backend start command:** add `render.yaml` at repo root defining a web
   service: build `pip install -r backend/requirements.txt`, start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (working dir `backend`).
   Declare env vars (no values): `GROQ_API_KEY`, `MONGODB_URI`,
   `MONGODB_DB`, `JWT_SECRET`, `ALLOWED_ORIGINS`.
4. **Seed safety:** the seed script ships demo passwords (`admin123`, etc.).
   Change `backend/app/seed.py` to read seed passwords from env vars and
   refuse to create users with the default demo passwords unless
   `ALLOW_DEMO_SEED=true`. Document this.
5. **Scheduler note:** APScheduler runs in-process; on Render free tier the
   service sleeps when idle so the 5PM job may not fire reliably. Add a short
   note about this in `DEPLOY.md` (acceptable for MVP; mention Render cron or
   a paid instance as the fix later).
6. Write **`DEPLOY.md`** with click-by-click instructions for Part B below.
7. Verify: `cd backend && python -m compileall -q app` and
   `cd frontend && npx next build` both succeed. Report results.

## Part B — write these as a checklist in DEPLOY.md (user does this manually)

1. **Push to GitHub:** repo isn't remote yet. Either install `gh`
   (`winget install GitHub.cli`), `gh auth login`, then
   `gh repo create Productivity_Tracker --private --source=. --remote=origin --push`;
   OR have the user create an empty repo on github.com and run
   `git remote add origin <url> && git push -u origin master`.
   (Ask the user which; do not assume.)
2. **MongoDB Atlas:** create free cluster, a DB user, allow network access
   `0.0.0.0/0`, copy the `mongodb+srv://...` connection string.
3. **Render:** New Web Service → connect the GitHub repo → it reads
   `render.yaml` → set env vars (`GROQ_API_KEY`, `MONGODB_URI` = Atlas string,
   `JWT_SECRET` = long random, `ALLOWED_ORIGINS` = the Vercel URL once known).
   Note the backend URL.
4. **Vercel:** Import the repo, root directory `frontend`, set
   `NEXT_PUBLIC_API_BASE` = the Render backend URL. Deploy. Note the Vercel
   URL, then add it to Render's `ALLOWED_ORIGINS` and redeploy backend.
5. **Seed prod users:** run the seed once against Atlas with real passwords
   (env-driven), or create the admin via a one-off Render shell.
6. Share the **Vercel URL**. Users log in with accounts the admin creates;
   no code is shared and no one can modify the app.

---

## Deliverable
Complete Part A, leave the repo with a clean `npx next build` and Python
compile, and a finished `DEPLOY.md`. Summarize what changed and what the user
must do next. Do NOT push or deploy.
