from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Header, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse

from ..auth import CurrentUser
from ..core.dependencies import get_db
from ..schemas.ai import AIChatRequest
from ..services.ai_orchestrator import run_orchestrator
from ..services.auth_service import resolve_user_from_header
from ..utils import enforce_payload_limits, err_response, normalize_message, ok_response, rate_limit


router = APIRouter()


@router.post("/api/ai/chat")
async def ai_chat(request: Request, authorization: Optional[str] = Header(default=None)) -> object:
    body = await request.json()
    message = normalize_message(body or {})
    if not message:
        return err_response("MESSAGE_REQUIRED", 400)
    try:
        enforce_payload_limits(body or {}, message)
    except Exception as exc:  # HTTPException
        status = getattr(exc, "status_code", 400)
        detail = getattr(exc, "detail", {}) or {}
        return err_response(str(detail.get("code") or "BAD_REQUEST"), status)

    try:
        user = resolve_user_from_header(authorization)
    except HTTPException:
        user = None
    user = user or CurrentUser(uid="public", role="public")
    rate_limit(user.uid, limit=15, window_sec=60)
    payload = AIChatRequest(**(body or {}))

    with get_db() as db:
        answer, session_id, intent, tool_used = await run_orchestrator(
            db,
            user,
            payload.message,
            payload.session_id,
            payload.app_type,
        )

    stream_requested = str(request.query_params.get("stream", "")).strip() in {"1", "true", "yes"}
    if stream_requested:
        async def event_stream() -> object:
            # First event confirms stream readiness.
            yield "event: start\ndata: {\"ok\":true}\n\n"
            text = str(answer or "")
            if not text:
                yield "event: done\ndata: {\"text\":\"\"}\n\n"
                return

            chunk_size = 40
            for i in range(0, len(text), chunk_size):
                chunk = text[i : i + chunk_size]
                payload_chunk = json.dumps({"delta": chunk}, ensure_ascii=False)
                yield f"event: chunk\ndata: {payload_chunk}\n\n"
                await asyncio.sleep(0.01)

            payload_done = json.dumps({"text": text}, ensure_ascii=False)
            yield f"event: done\ndata: {payload_done}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return ok_response(
        text=answer,
        data={
            "answer": answer,
            "session_id": session_id,
            "intent": intent,
            "tool_used": tool_used,
        },
    )


@router.post("/api/ai/student")
async def ai_student(request: Request, authorization: Optional[str] = Header(default=None)) -> object:
    body = await request.json()
    message = normalize_message(body or {})
    if not message:
        return err_response("MESSAGE_REQUIRED", 400)
    try:
        enforce_payload_limits(body or {}, message)
    except Exception as exc:  # HTTPException
        status = getattr(exc, "status_code", 400)
        detail = getattr(exc, "detail", {}) or {}
        return err_response(str(detail.get("code") or "BAD_REQUEST"), status)

    if not authorization:
        return err_response("AUTH_REQUIRED", 401)
    try:
        user = resolve_user_from_header(authorization)
    except HTTPException:
        return err_response("AUTH_INVALID", 401)
    if not user:
        return err_response("AUTH_REQUIRED", 401)
    rate_limit(user.uid, limit=15, window_sec=60)
    payload = AIChatRequest(**(body or {}))

    with get_db() as db:
        answer, session_id, intent, tool_used = await run_orchestrator(
            db,
            user,
            payload.message,
            payload.session_id,
            payload.app_type or "student",
        )

    return ok_response(
        text=answer,
        data={
            "answer": answer,
            "session_id": session_id,
            "intent": intent,
            "tool_used": tool_used,
        },
    )
