from __future__ import annotations

import os
from typing import Any

from ..utils import post_json_with_timeout

DEFAULT_SYSTEM_PROMPT = """You are ElimuLink AI, an intelligent academic assistant for students and universities.

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
3. Use 2–4 sentences minimum unless the question requires a short answer.
4. If explaining something, break it into steps or bullet points when useful.
5. Make responses easy to understand for students.
6. When appropriate, ask a follow-up question to help the student continue learning.
7. Keep a professional but warm academic tone.
8. Never respond with only one sentence unless the user explicitly asks for a short answer.
9. Respond in English or Swahili depending on the user's language.
"""


async def call_gemini_text(
    message: str,
    context: dict[str, Any],
    system_instruction: str | None = None,
) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        raise RuntimeError("MISSING_PROVIDER_KEY")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={gemini_key}"
    )
    system_text = system_instruction or DEFAULT_SYSTEM_PROMPT
    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": f"USER_MESSAGE:\n{message}\n"},
                    {"text": f"GROUNDING_DATA:\n{context}\n"},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.45,
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
