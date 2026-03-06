from __future__ import annotations

import os
from datetime import datetime
import time
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import init_firebase_admin
from .database import Base, engine, DATABASE_URL
from .routes.chat import router as chat_router
from .routes.admin_ai import router as admin_ai_router
from .routes.admin_analytics import router as admin_analytics_router
from .routes.admin_settings import router as admin_settings_router
from .routes.health import router as health_router
from .routes.image import router as image_router
from .routes.groups import router as groups_router
from .routes.reports import router as reports_router
from .routes.assignments import router as assignments_router
from .routes.results import router as results_router
from .routes.subgroups import router as subgroups_router
from .routes.users import router as users_router
from .routes.courses import router as courses_router
from .routes.announcements import router as announcements_router
from .routes.attendance import router as attendance_router
from .routes.finance import router as finance_router
from .routes.audit import router as audit_router
from .routes.student_ai import router as student_ai_router
from .routes.tts import router as tts_router
from .utils import err_response


_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(_env_path)
init_firebase_admin()

app = FastAPI(title="ElimuLink API (FastAPI)")
Base.metadata.create_all(bind=engine)

default_origins = [
    "https://elimulink-app-ai.web.app",
    "https://elimulink-student.web.app",
    "https://elimulink-institution.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
cors_from_env = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allowed_origins = cors_from_env or default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
    expose_headers=["X-Request-Id"],
)


@app.middleware("http")
async def request_timing_log(request: Request, call_next):
  request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
  request.state.request_id = request_id
  start = time.perf_counter()
  try:
    response = await call_next(request)
  except Exception:  # noqa: BLE001
    elapsed_ms = (time.perf_counter() - start) * 1000
    uid = getattr(request.state, "uid", None)
    role = getattr(request.state, "role", None)
    institution_id = getattr(request.state, "institution_id", None)
    print(f"[REQ] rid={request_id} uid={uid} role={role} institutionId={institution_id} {request.method} {request.url.path} -> 500 ({elapsed_ms:.1f}ms)")
    raise
  elapsed_ms = (time.perf_counter() - start) * 1000
  uid = getattr(request.state, "uid", None)
  role = getattr(request.state, "role", None)
  institution_id = getattr(request.state, "institution_id", None)
  response.headers["X-Request-Id"] = request_id
  print(f"[REQ] rid={request_id} uid={uid} role={role} institutionId={institution_id} {request.method} {request.url.path} -> {response.status_code} ({elapsed_ms:.1f}ms)")
  return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
  rid = getattr(request.state, "request_id", None)
  print(f"[ERROR] rid={rid} path={request.url.path} error={repr(exc)}", flush=True)
  env = (os.getenv("APP_ENV") or os.getenv("ENV") or "").strip().lower()
  if env != "production":
    return err_response("INTERNAL_SERVER_ERROR", 500, f"{repr(exc)} (requestId={rid})")
  return err_response("INTERNAL_SERVER_ERROR", 500, f"Unexpected error (requestId={rid})")


@app.exception_handler(HTTPException)  # helpful JSON errors for auth/scope/provider failures
async def http_exception_handler(request: Request, exc: HTTPException):
  detail = exc.detail
  if isinstance(detail, dict):
    code = str(detail.get("code") or "REQUEST_ERROR")
    message = str(detail.get("message") or code)
  else:
    code = str(detail or "REQUEST_ERROR")
    message = code
  rid = getattr(request.state, "request_id", None)
  return err_response(code, exc.status_code, f"{message} (requestId={rid})")



@app.on_event("startup")
async def startup_log() -> None:
  app_id = os.getenv("APP_ID") or os.getenv("VITE_APP_ID") or "unset"
  gemini_present = bool(os.getenv("GEMINI_API_KEY"))
  env = (os.getenv("APP_ENV") or os.getenv("ENV") or "").strip().lower()
  if env != "production":
    try:
      from urllib.parse import urlparse

      parsed = urlparse(DATABASE_URL)
      safe_host = parsed.hostname or "unknown"
      print(f"[STARTUP] DATABASE_URL host={safe_host}")
    except Exception:
      print("[STARTUP] DATABASE_URL host=unknown")
  if os.getenv("RUN_MIGRATIONS") == "1":
    try:
      from alembic import command
      from alembic.config import Config

      base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
      alembic_cfg = Config(os.path.join(base_dir, "alembic.ini"))
      command.upgrade(alembic_cfg, "head")
      print("[STARTUP] Alembic migrations applied")
    except Exception as exc:  # noqa: BLE001
      print(f"[STARTUP] Alembic migration failed: {exc}")
  print(f"[STARTUP] API running | gemini_key_present={gemini_present} | APP_ID={app_id}")
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(admin_ai_router)
app.include_router(admin_analytics_router)
app.include_router(admin_settings_router)
app.include_router(student_ai_router)
app.include_router(tts_router)
app.include_router(image_router)
app.include_router(groups_router)
app.include_router(reports_router)
app.include_router(assignments_router)
app.include_router(results_router)
app.include_router(subgroups_router)
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(announcements_router)
app.include_router(attendance_router)
app.include_router(finance_router)
app.include_router(audit_router)

