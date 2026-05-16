from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import ensure_indexes
from .routers import auth, blockers, chat, stats, team
from .services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    start_scheduler()
    yield


app = FastAPI(title="Productivity_Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(blockers.router)
app.include_router(stats.router)
app.include_router(team.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
