from __future__ import annotations

import time

from sqlalchemy import text

from ..database import engine

from fastapi import APIRouter


router = APIRouter()


def build_health_payload() -> dict:
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"ok": db_ok, "db": "ok" if db_ok else "error", "ts": int(time.time() * 1000)}


@router.get("/health")
async def health() -> object:
    return build_health_payload()


@router.get("/api/health")
async def api_health() -> object:
    return build_health_payload()
