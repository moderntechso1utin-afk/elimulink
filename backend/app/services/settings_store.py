from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DATA_DIR = Path("backend/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
SETTINGS_FILE = DATA_DIR / "settings.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    "profile": {
        "name": "Department Admin",
        "email": "admin@institution.edu",
        "phone": "+2547xxxxxxxx",
        "photoUrl": None,
    },
    "institution": {
        "departmentName": "Department of Computer Science",
        "departmentCode": "CSC",
        "academicYear": "2025/2026",
        "semester": "Semester 2",
        "gpaScale": "4.0",
        "attendanceThreshold": 75,
        "qrEnabled": True,
    },
    "rbac": {
        "roles": ["Dean", "HOD", "Lecturer", "Finance", "Registry"],
        "matrix": {},
    },
    "notifications": {
        "email": True,
        "sms": False,
        "push": True,
        "lowAttendanceAlerts": True,
        "feeOverdueAlerts": True,
    },
    "integrations": {
        "googleCalendar": False,
        "mpesaEnabled": True,
        "bankEnabled": False,
        "smtpHost": "smtp.yourdomain.ac.ke",
        "smtpFrom": "noreply@yourdomain.ac.ke",
    },
    "privacy": {
        "retentionMonths": 24,
        "allowExports": True,
        "consentRequired": True,
    },
    "branding": {
        "logoUrl": None,
        "primary": "#2563eb",
        "secondary": "#0f172a",
        "letterheadTemplate": None,
    },
    "ai": {
        "aiEnabled": True,
        "allowFees": True,
        "allowResults": True,
        "allowAttendance": True,
        "guardrails": "Do not reveal private student data to unauthorized users.",
        "auditAI": True,
    },
    "communication": {
        "studentLecturerMessagingEnabled": False,
    },
    "security": {
        "twoFA": False,
        "sessionTimeoutMinutes": 60,
        "ipRestrictions": False,
        "deviceRestrictions": False,
    },
    "theme": {
        "default": "dark",
    },
}


def _read_file() -> dict[str, Any]:
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.write_text(json.dumps(DEFAULT_SETTINGS, indent=2), encoding="utf-8")
        return DEFAULT_SETTINGS
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        SETTINGS_FILE.write_text(json.dumps(DEFAULT_SETTINGS, indent=2), encoding="utf-8")
        return DEFAULT_SETTINGS


def _write_file(data: dict[str, Any]) -> None:
    SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_settings() -> dict[str, Any]:
    return _read_file()


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    current = _read_file()
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k].update(v)
        else:
            current[k] = v
    _write_file(current)
    return current


def update_section(section: str, patch: dict[str, Any]) -> dict[str, Any]:
    current = _read_file()
    if section not in current or not isinstance(current[section], dict):
        current[section] = {}
    current[section].update(patch or {})
    _write_file(current)
    return current
