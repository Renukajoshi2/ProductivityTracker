from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import ensure_indexes
from .routers import auth, blockers, calendar, chat, stats, tasks, team
from .services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    start_scheduler()
    yield


app = FastAPI(title="Productivity_Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(blockers.router)
app.include_router(calendar.router)
app.include_router(stats.router)
app.include_router(tasks.router)
app.include_router(team.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
