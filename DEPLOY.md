# Deployment guide — Productivity Tracker

Target stack: **MongoDB Atlas** (DB) · **Render** (FastAPI backend) · **Vercel** (Next.js frontend).
All services have a free tier suitable for a small team demo.

## APScheduler caveat

The EOD reminder (sets `eod_pending=True` at 5 PM Mon–Fri) runs **in-process** via APScheduler.
On Render's free tier the service spins down after 15 minutes of inactivity, so the cron job
may not fire at exactly 5 PM if no requests have come in recently.

**Acceptable for MVP.** To fix later: upgrade to a Render paid instance (always-on), or add a
Render Cron Job that calls `POST /internal/trigger-eod` on schedule (requires extracting the
scheduler logic into a separate endpoint).

---

## Part B — manual steps (do these in order)

### 1. Push to GitHub

The repo has no remote yet. Choose one of:

**Option A — GitHub CLI (easier)**
```powershell
winget install GitHub.cli          # if not installed
gh auth login                      # follow browser prompts
gh repo create Productivity_Tracker --private --source=. --remote=origin --push
```

**Option B — manual**
1. Go to https://github.com/new → create a **private** repo named `Productivity_Tracker`, no README.
2. Back in this directory:
```powershell
git remote add origin https://github.com/<your-username>/Productivity_Tracker.git
git push -u origin master
```

---

### 2. MongoDB Atlas

1. Go to https://cloud.mongodb.com → create a free account (or log in).
2. **Create a free cluster** (M0, any region close to you).
3. **Database Access** → Add a database user → username + strong password → save both.
4. **Network Access** → Add IP Address → `0.0.0.0/0` (allow all — fine for a demo).
5. **Connect** → Drivers → copy the `mongodb+srv://` connection string.
   Replace `<password>` with the DB user password you just created.
   Keep this string — you'll paste it into Render next.

---

### 3. Render (FastAPI backend)

1. Go to https://render.com → New → **Web Service**.
2. Connect your GitHub account and select the `Productivity_Tracker` repo.
3. Render will detect `render.yaml` automatically. Confirm the settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set environment variables (in the Render dashboard, **Environment** tab):
   | Key | Value |
   |-----|-------|
   | `GROQ_API_KEY` | your Groq API key (https://console.groq.com) |
   | `MONGODB_URI` | the `mongodb+srv://...` string from Atlas |
   | `MONGODB_DB` | `productivity_tracker` |
   | `JWT_SECRET` | any long random string (e.g. 64 hex chars) |
   | `ALLOWED_ORIGINS` | leave blank for now — fill in after Vercel deploy |
5. Click **Deploy**. Wait for the build to finish.
6. Note the backend URL, e.g. `https://productivity-tracker-api.onrender.com`.
   Test it: open `<backend-url>/health` — should return `{"status":"ok"}`.

---

### 4. Vercel (Next.js frontend)

1. Go to https://vercel.com → **Add New Project** → Import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_BASE` | `https://<your-render-url>` (no trailing slash) |
4. Click **Deploy**. Note the Vercel URL, e.g. `https://productivity-tracker.vercel.app`.
5. Go back to **Render → Environment** → set `ALLOWED_ORIGINS` to your Vercel URL:
   ```
   https://productivity-tracker.vercel.app
   ```
   Save and redeploy the Render service (manual deploy or push a commit).

---

### 5. Seed production users

Option A — use the Render shell (easiest):
1. Render dashboard → your web service → **Shell** tab.
2. Run:
```bash
ALLOW_DEMO_SEED=false \
SEED_ADMIN_PASSWORD=<strong-password> \
SEED_LEAD_PASSWORD=<strong-password> \
SEED_MEMBER_PASSWORD=<strong-password> \
python -m app.seed
```

Option B — run locally against Atlas:
```powershell
$env:MONGODB_URI="mongodb+srv://..."   # your Atlas URI
$env:SEED_ADMIN_PASSWORD="<strong>"
$env:SEED_LEAD_PASSWORD="<strong>"
$env:SEED_MEMBER_PASSWORD="<strong>"
cd backend
python -m app.seed
```

> **Never run `seed_demo.py` in production** — it creates users with the hardcoded
> demo passwords `admin123` / `member123`.

---

### 6. Share the link

Send users the Vercel URL. They log in with the accounts created in step 5.
No code is shared; nobody can modify the app without a GitHub push + redeploy.

---

## Local dev quick-start (reminder)

```powershell
# backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload

# frontend (separate terminal)
cd frontend
npm run dev
```

Ensure `.env` at repo root has `GROQ_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, and
optionally `ALLOWED_ORIGINS=http://localhost:3000` (the default).
