from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    app_type: Optional[str] = None
    mode: Optional[str] = None
    workspaceContext: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class AIChatResponse(BaseModel):
    answer: str
    session_id: str
    intent: str
    tool_used: Optional[str] = None
    sources: Optional[List[Dict[str, Any]]] = None
