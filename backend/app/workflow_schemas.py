from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .workflow_engine import Department, WorkflowStatus, WorkflowType


class WorkflowActionOut(BaseModel):
    actor_id: str
    actor_role: str
    action: str
    note: Optional[str] = None
    created_at: str


class WorkflowCreateIn(BaseModel):
    workflow_type: WorkflowType
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=4000)
    created_by: str
    created_by_role: str
    student_id: Optional[str] = None
    lecturer_id: Optional[str] = None
    course_id: Optional[str] = None
    fee_record_id: Optional[str] = None
    result_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowActionIn(BaseModel):
    actor_id: str
    actor_role: str
    note: Optional[str] = None


class CommunicationToggleIn(BaseModel):
    actor_id: str
    actor_role: str
    unlocked: bool
    note: Optional[str] = None


class WorkflowOut(BaseModel):
    id: str
    workflow_type: WorkflowType
    title: str
    description: str
    department: Department
    status: WorkflowStatus
    created_by: str
    created_by_role: str
    student_id: Optional[str] = None
    lecturer_id: Optional[str] = None
    course_id: Optional[str] = None
    fee_record_id: Optional[str] = None
    result_id: Optional[str] = None
    communication_unlocked: bool
    requires_approval: bool
    current_assignee_role: Optional[str] = None
    metadata: Dict[str, Any]
    history: List[WorkflowActionOut]
    created_at: str
    updated_at: str
