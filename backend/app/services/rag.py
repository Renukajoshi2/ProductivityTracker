"""Lightweight RAG over EOD reports / chat messages.

Embeddings are generated locally using sentence-transformers (no API key needed).
Stored in the `embeddings` collection; retrieval uses in-process cosine similarity.
"""
from datetime import datetime, timezone

import numpy as np

from ..db import get_db

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> list[float]:
    return _get_model().encode(text[:8000], normalize_embeddings=True).tolist()


async def index_text(source: str, ref_id: str, user_name: str, text: str):
    """Store an embedding for later retrieval (best-effort)."""
    try:
        vec = embed(text)
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
        qv = np.array(embed(query), dtype=np.float32)
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
