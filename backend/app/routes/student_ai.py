from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import CurrentUser, get_current_user
from ..firestore import get_user_profile
from ..utils import (
    ProviderTimeoutError,
    enforce_payload_limits,
    err_response,
    normalize_message,
    ok_response,
    rate_limit,
    require_department,
    require_institution,
)
from ..services.institution_graph import build_institution_graph, resolve_graph_context
from .chat import call_gemini_text


router = APIRouter()


@router.post("/api/ai/student")
async def student_ai(request: Request, user: CurrentUser = Depends(get_current_user)) -> object:
    print(
        f"[AUTH_ROUTE] rid={getattr(request.state, 'request_id', None)} "
        f"endpoint=/api/ai/student authHeaderExists={bool(request.headers.get('authorization'))} uid={user.uid or 'none'}"
    )
    body = await request.json()
    message = normalize_message(body or {})
    if not message:
        return err_response("MESSAGE_REQUIRED", 400)
    try:
        rate_limit(user.uid, limit=15, window_sec=60)
        enforce_payload_limits(body or {}, message)
    except Exception as exc:  # HTTPException
        status = getattr(exc, "status_code", 400)
        detail = getattr(exc, "detail", {}) or {}
        code = detail.get("code") if isinstance(detail, dict) else None
        return err_response(str(code or "BAD_REQUEST"), status)

    if user.role != "super_admin" and not user.institution_id:
        return err_response("FORBIDDEN", 403)

    requested_institution = (body or {}).get("institutionId")
    requested_department = (body or {}).get("departmentId")
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
        default_department = str(user.department_id or "general")
        requested_department_str = str(requested_department or "").strip()
        if requested_department_str and requested_department_str not in {default_department, "general"}:
            return err_response("FORBIDDEN", 403)
        scoped_department = requested_department_str or default_department

    try:
        require_institution(user, scoped_institution)
        require_department(user, scoped_department)
    except Exception as exc:  # HTTPException
        status = getattr(exc, "status_code", 403)
        detail = getattr(exc, "detail", {}) or {}
        return err_response(str(detail.get("code") or "FORBIDDEN"), status)

    profile = get_user_profile(user.uid) or {}
    context = {
        "uid": user.uid,
        "institutionId": scoped_institution,
        "role": user.role,
        "departmentId": scoped_department,
        "region": (body or {}).get("region"),
        "userName": (body or {}).get("userName"),
        "profileName": profile.get("fullName") or profile.get("name"),
    }

    graph = build_institution_graph(
        institution_id=scoped_institution,
        actor_id=user.uid,
        actor_role=user.role,
        actor_department_id=scoped_department,
    )
    graph_context = resolve_graph_context(
        graph=graph,
        actor_role=user.role,
        question=message,
        explicit_department=scoped_department if scoped_department in {"fees", "academic_results"} else None,
    )
    context["graphContext"] = graph_context

    print(
        f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
        f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
        f"endpoint=/api/ai/student provider=gemini status=started"
    )
    try:
        text = await call_gemini_text(message, context)
        print(
            f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
            f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
            f"endpoint=/api/ai/student provider=gemini status=ok"
        )
    except ProviderTimeoutError:
        print(
            f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
            f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
            f"endpoint=/api/ai/student provider=gemini status=timeout"
        )
        return err_response("AI_TIMEOUT", 504)
    except RuntimeError as exc:
        if str(exc) == "MISSING_PROVIDER_KEY":
            print(
                f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
                f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
                f"endpoint=/api/ai/student provider=gemini status=missing_key"
            )
            return err_response("MISSING_PROVIDER_KEY", 500)
        print(
            f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
            f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
            f"endpoint=/api/ai/student provider=gemini status=provider_error"
        )
        return err_response("PROVIDER_ERROR", 502)
    except Exception:
        print(
            f"[AI_DEBUG] rid={getattr(request.state, 'request_id', None)} "
            f"uid={user.uid} role={user.role} institutionId={scoped_institution} "
            f"endpoint=/api/ai/student provider=gemini status=provider_error"
        )
        return err_response("PROVIDER_ERROR", 502)

    return ok_response(text=text, data=None)
