from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from ..services.ai_service import call_gemini_text
from ..utils import ProviderTimeoutError


async def generate_answer(
    message: str,
    context: Dict[str, Any],
    system_instruction: Optional[str] = None,
    mode: Optional[str] = None,
    workspace_context: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Optional[str]]:
    try:
        text = await call_gemini_text(
            message,
            context,
            system_instruction=system_instruction,
            mode=mode,
            workspace_context=workspace_context,
        )
        return text, None
    except ProviderTimeoutError:
        return "The AI service timed out. Please try again.", "AI_TIMEOUT"
    except RuntimeError as exc:
        if str(exc) == "MISSING_PROVIDER_KEY":
            return "AI provider key is missing.", "MISSING_PROVIDER_KEY"
        return "AI provider error. Please try again later.", "PROVIDER_ERROR"
    except Exception:
        return "AI provider error. Please try again later.", "PROVIDER_ERROR"
