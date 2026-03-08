from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

from ..repositories.chat_repository import create_session, get_session, save_message
from ..services.auth_service import resolve_app_type, resolve_role
from ..services.gemini_client import generate_answer
from ..services.intent_router import detect_intent
from ..services.memory_service import get_recent_history
from ..services.permission_service import can_access_tool
from ..services.prompt_builder import build_context_prompt
from ..tools.student_tools import (
    get_attendance,
    get_fee_balance,
    get_profile,
    get_results,
    get_timetable,
    get_units,
)
from ..utils.ids import new_session_id


async def run_orchestrator(
    db,
    user,
    message: str,
    session_id: Optional[str],
    app_type: Optional[str],
    mode: Optional[str] = None,
    workspace_context: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str, Optional[str]]:
    resolved_app = resolve_app_type(app_type)
    role = resolve_role(user)
    user_id = getattr(user, "uid", None) or "public"
    tenant_id = getattr(user, "institution_id", None)

    current_session_id = session_id or new_session_id()
    if not get_session(db, current_session_id):
        create_session(db, current_session_id, user_id, resolved_app, tenant_id, title="New Chat")

    intent = detect_intent(message)
    tool_used = None
    tool_data: Dict[str, Any] | None = None

    if intent == "profile" and can_access_tool(role, "profile"):
        tool_used = "get_student_profile"
        tool_data = get_profile(db, user_id)
    elif intent == "timetable" and can_access_tool(role, "timetable"):
        tool_used = "get_student_timetable"
        tool_data = get_timetable(db, user_id)
    elif intent == "fee_balance" and can_access_tool(role, "fee_balance"):
        tool_used = "get_student_fee_balance"
        tool_data = get_fee_balance(db, user_id)
    elif intent == "results" and can_access_tool(role, "results"):
        tool_used = "get_student_results"
        tool_data = get_results(db, user_id)
    elif intent == "attendance" and can_access_tool(role, "attendance"):
        tool_used = "get_student_attendance"
        tool_data = get_attendance(db, user_id)
    elif intent == "units" and can_access_tool(role, "units"):
        tool_used = "get_student_units"
        tool_data = get_units(db, user_id)

    history = get_recent_history(db, current_session_id, limit=6)
    prompt = build_context_prompt(message, intent, tool_data, history)

    save_message(db, current_session_id, "user", message, intent=intent, tool_used=None)
    start = time.perf_counter()
    answer, error_code = await generate_answer(
        prompt,
        {"app_type": resolved_app, "role": role, "tool_data": tool_data or {}, "history": history},
        mode=mode,
        workspace_context=workspace_context,
    )
    latency_ms = int((time.perf_counter() - start) * 1000)
    save_message(
        db,
        current_session_id,
        "assistant",
        answer,
        intent=intent,
        tool_used=tool_used,
        latency_ms=latency_ms,
    )
    if error_code:
        intent = f"{intent}:{error_code}"
    return answer, current_session_id, intent, tool_used
