from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import CurrentUser, get_current_user
from ..firestore import get_user_profile
from ..services.ai_service import call_gemini_text
from ..services.institution_graph import build_institution_graph, resolve_graph_context
from ..services.settings_store import get_settings
from ..utils import (
    ProviderTimeoutError,
    err_response,
    normalize_message,
    ok_response,
    require_department,
    require_institution,
)


router = APIRouter()

DEPARTMENT_ALIASES = {
    "fees": {"fees", "fee", "payments", "payment", "arrears", "balance"},
    "academic_results": {
        "academic_results",
        "results",
        "result",
        "marks",
        "gpa",
        "transcript",
        "assignment",
        "exam",
        "submission",
        "rubric",
    },
}


def _detect_department(prompt: str, explicit_department: str | None) -> str | None:
    value = str(explicit_department or "").strip().lower()
    if value:
        if value in {"fees", "finance"}:
            return "fees"
        if value in {"academic_results", "results", "academic", "result"}:
            return "academic_results"
        return None

    text = str(prompt or "").lower()
    for department, keywords in DEPARTMENT_ALIASES.items():
        if any(keyword in text for keyword in keywords):
            return department
    return None


@router.post("/api/admin/ai")
async def admin_ai(request: Request, user: CurrentUser = Depends(get_current_user)) -> object:
    body = await request.json()
    prompt = normalize_message(body or {})
    if not prompt:
        return err_response("MESSAGE_REQUIRED", 400)

    if user.role not in {"super_admin", "institution_admin", "department_head", "lecturer"}:
        return err_response("FORBIDDEN", 403)

    requested_institution = (body or {}).get("institutionId")
    requested_department = (body or {}).get("departmentId")
    requested_department_hint = (body or {}).get("department")
    requested_role = str((body or {}).get("role") or user.role or "").strip().lower()
    institution_scope = str((body or {}).get("institutionScope") or "university").strip().lower()

    scoped_institution = (
        str(requested_institution or user.institution_id or "")
        if user.role == "super_admin"
        else str(user.institution_id or "")
    )
    if not scoped_institution:
        return err_response("FORBIDDEN", 403)

    if user.role in {"super_admin", "institution_admin"}:
        scoped_department = str(requested_department or user.department_id or "general")
    else:
        scoped_department = str(user.department_id or "general")

    routed_department = _detect_department(prompt, requested_department_hint)
    if requested_department_hint and not routed_department:
        return ok_response(
            text="I cannot route this request because that department is not configured (supported: fees, academic_results).",
            data={"supportedDepartments": ["fees", "academic_results"]},
            reply="I cannot route this request because that department is not configured (supported: fees, academic_results).",
        )

    settings = get_settings() or {}
    communication_cfg = settings.get("communication") or {}
    student_lecturer_enabled = bool(communication_cfg.get("studentLecturerMessagingEnabled", False))
    prompt_lower = prompt.lower()
    asks_student_lecturer_comm = (
        ("student" in prompt_lower and "lecturer" in prompt_lower and ("message" in prompt_lower or "chat" in prompt_lower or "communication" in prompt_lower))
    )
    if asks_student_lecturer_comm and not student_lecturer_enabled:
        return ok_response(
            text="Student <-> lecturer communication is currently blocked by admin policy. Enable it first in communication settings.",
            data={"communicationAllowed": False},
            reply="Student <-> lecturer communication is currently blocked by admin policy. Enable it first in communication settings.",
        )

    try:
        require_institution(user, scoped_institution)
        require_department(user, scoped_department)
    except Exception as exc:  # HTTPException
        status = getattr(exc, "status_code", 403)
        detail = getattr(exc, "detail", {}) or {}
        return err_response(str(detail.get("code") or "FORBIDDEN"), status)

    profile = get_user_profile(user.uid) or {}
    context: dict[str, Any] = {
        "uid": user.uid,
        "role": requested_role or user.role,
        "institutionId": scoped_institution,
        "departmentId": scoped_department,
        "departmentRouting": routed_department or "unmapped",
        "institutionScope": institution_scope or "university",
        "communication": {
            "studentLecturerEnabled": student_lecturer_enabled,
        },
        "profileName": profile.get("fullName") or profile.get("name"),
        "profileEmail": profile.get("email"),
        "mode": "admin_insight",
    }

    graph = build_institution_graph(
        institution_id=scoped_institution,
        actor_id=user.uid,
        actor_role=requested_role or user.role,
        actor_department_id=scoped_department,
    )
    graph_context = resolve_graph_context(
        graph=graph,
        actor_role=requested_role or user.role,
        question=prompt,
        explicit_department=routed_department,
    )
    context["graphContext"] = graph_context

    try:
        text = await call_gemini_text(prompt, context)
    except ProviderTimeoutError:
        return err_response("AI_TIMEOUT", 504)
    except RuntimeError as exc:
        if str(exc) == "MISSING_PROVIDER_KEY":
            return err_response("MISSING_PROVIDER_KEY", 500)
        return err_response("PROVIDER_ERROR", 502)
    except Exception:
        return err_response("PROVIDER_ERROR", 502)

    return ok_response(text=text, data=None, reply=text)
