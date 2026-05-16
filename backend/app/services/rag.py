"""Lightweight RAG over EOD reports / chat messages.

Embeddings are stored in the `embeddings` collection. Retrieval is an
in-process cosine similarity scan — fine for a 20-person team's volume,
and avoids requiring a vector DB on an office laptop.
"""
from datetime import datetime, timezone

import numpy as np
from openai import AsyncOpenAI

from ..config import settings
from ..db import get_db

_client: AsyncOpenAI | None = None


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def embed(text: str) -> list[float]:
    resp = await _openai().embeddings.create(
        model=settings.openai_embed_model, input=text[:8000]
    )
    return resp.data[0].embedding


async def index_text(source: str, ref_id: str, user_name: str, text: str):
    """Store an embedding for later retrieval (best-effort)."""
    try:
        vec = await embed(text)
    except Exception:
        return
    await get_db().embeddings.insert_one(
        {
            "source": source,
            "ref_id": ref_id,
            "user_name": user_name,
            "text": text,
            "vector": vec,
            "created_at": datetime.now(timezone.utc),
        }
    )


async def retrieve(query: str, k: int = 5) -> list[dict]:
    try:
        qv = np.array(await embed(query), dtype=np.float32)
    except Exception:
        return []
    docs = await get_db().embeddings.find({}).to_list(length=2000)
    if not docs:
        return []
    scored = []
    qn = np.linalg.norm(qv) or 1.0
    for d in docs:
        v = np.array(d["vector"], dtype=np.float32)
        sim = float(np.dot(qv, v) / (qn * (np.linalg.norm(v) or 1.0)))
        scored.append((sim, d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"text": d["text"], "user": d.get("user_name"), "score": s}
        for s, d in scored[:k]
    ]
