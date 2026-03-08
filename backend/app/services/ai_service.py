from __future__ import annotations

import os
from typing import Any

from ..utils import post_json_with_timeout

STUDENT_SYSTEM_PROMPT = """You are ElimuLink AI, an intelligent academic assistant for students and universities.

Your job is to help students with:
- coursework
- assignments
- exam preparation
- research
- coding help
- academic writing

Guidelines:
1. Always respond in a clear, friendly, and helpful tone.
2. Do not give extremely short answers.
3. Use 2-4 sentences minimum unless the question requires a short answer.
4. If explaining something, break it into steps or bullet points when useful.
5. Make responses easy to understand for students.
6. When appropriate, ask a follow-up question to help the student continue learning.
7. Keep a professional but warm academic tone.
8. Never respond with only one sentence unless the user explicitly asks for a short answer.
9. Respond in English or Swahili depending on the user's language.
"""

ADMIN_SYSTEM_PROMPT = """You are ElimuLink Administrative AI, an intelligent institutional assistant for university administration.

Your role is to support:
- department operations
- workflow oversight
- results management support
- attendance monitoring support
- announcement drafting
- audit/compliance summaries
- department reporting
- staff and lecturer operational insights

Important rules:
1. Respond in a professional, concise, institution-grade tone.
2. Be clear, structured, and helpful.
3. Support decision-making, but do not pretend to have authority you do not have.
4. AI suggestions are drafts only and must not be treated as final approvals.
5. Never autonomously approve, publish, grade, release results, unlock communication, discipline staff, or finalize sensitive institutional actions.
6. When suitable, format responses using:
- Summary
- Key Findings
- Risks
- Recommended Actions
- Approval Needed
7. If the request seems sensitive or governance-related, clearly state that human review/approval is required.
8. Use the provided role/department/workspace context when answering.
9. If department context is missing, answer generally and say that department-scoped confirmation may be needed.
10. Respond in English or Swahili depending on the user's language.
"""

# Backward-compatible alias for existing imports/usages.
DEFAULT_SYSTEM_PROMPT = STUDENT_SYSTEM_PROMPT


def resolve_system_prompt(mode: str | None = None, workspace_context: dict[str, Any] | None = None) -> str:
    normalized_mode = str(mode or "").strip().lower()

    if normalized_mode == "admin":
        return ADMIN_SYSTEM_PROMPT

    if workspace_context and str(workspace_context.get("scope", "")).strip().lower() == "admin":
        return ADMIN_SYSTEM_PROMPT

    return STUDENT_SYSTEM_PROMPT


def build_context_prefix(mode: str | None = None, workspace_context: dict[str, Any] | None = None) -> str:
    _ = mode
    if not workspace_context:
        return ""

    lines: list[str] = []
    scope = workspace_context.get("scope")
    department = workspace_context.get("department")
    role = workspace_context.get("role")
    institution = workspace_context.get("institution")

    if scope:
        lines.append(f"Scope: {scope}")
    if institution:
        lines.append(f"Institution: {institution}")
    if department:
        lines.append(f"Department: {department}")
    if role:
        lines.append(f"Role: {role}")

    if not lines:
        return ""

    return "Context:\n" + "\n".join(lines) + "\n\n"


async def call_gemini_text(
    message: str,
    context: dict[str, Any],
    system_instruction: str | None = None,
    mode: str | None = None,
    workspace_context: dict[str, Any] | None = None,
) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        raise RuntimeError("MISSING_PROVIDER_KEY")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={gemini_key}"
    )
    system_text = system_instruction or resolve_system_prompt(mode, workspace_context)
    context_prefix = build_context_prefix(mode, workspace_context)
    final_user_message = f"{context_prefix}{message}".strip()

    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": f"USER_MESSAGE:\n{final_user_message}\n"},
                    {"text": f"GROUNDING_DATA:\n{context}\n"},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 900,
            "topP": 0.9,
        },
    }
    data = await post_json_with_timeout(url, payload, timeout_seconds=25.0)
    return (
        "".join(
            p.get("text", "")
            for p in (data.get("candidates", [{}])[0].get("content", {}).get("parts", []))
        ).strip()
        or "I couldn't generate a response."
    )
