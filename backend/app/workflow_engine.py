from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


class Department(str, Enum):
    FEES = "fees"
    ACADEMIC_RESULTS = "academic_results"


class WorkflowType(str, Enum):
    FEE_ISSUE = "fee_issue"
    MISSING_MARKS = "missing_marks"
    ASSIGNMENT_SUBMISSION = "assignment_submission"
    EXAM_SUBMISSION = "exam_submission"
    TRANSCRIPT_REQUEST = "transcript_request"
    GPA_REVIEW = "gpa_review"


class WorkflowStatus(str, Enum):
    OPEN = "open"
    ROUTED = "routed"
    IN_REVIEW = "in_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESOLVED = "resolved"


class RoleLevel(str, Enum):
    INSTITUTION_ADMIN = "institution_admin"
    DEPARTMENT_HEAD = "department_head"
    DEPARTMENT_OFFICER = "department_officer"
    LECTURER = "lecturer"
    STUDENT = "student"


@dataclass
class WorkflowAction:
    actor_id: str
    actor_role: str
    action: str
    note: Optional[str] = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class WorkflowItem:
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
    communication_unlocked: bool = False
    requires_approval: bool = True
    current_assignee_role: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    history: List[WorkflowAction] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class WorkflowEngine:
    """
    Simple in-memory workflow engine for v1.
    Replace storage with DB later without changing routing logic.
    """

    def __init__(self) -> None:
        self._items: Dict[str, WorkflowItem] = {}

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def infer_department(self, workflow_type: WorkflowType) -> Department:
        mapping = {
            WorkflowType.FEE_ISSUE: Department.FEES,
            WorkflowType.MISSING_MARKS: Department.ACADEMIC_RESULTS,
            WorkflowType.ASSIGNMENT_SUBMISSION: Department.ACADEMIC_RESULTS,
            WorkflowType.EXAM_SUBMISSION: Department.ACADEMIC_RESULTS,
            WorkflowType.TRANSCRIPT_REQUEST: Department.ACADEMIC_RESULTS,
            WorkflowType.GPA_REVIEW: Department.ACADEMIC_RESULTS,
        }
        return mapping[workflow_type]

    def default_assignee_role(self, department: Department) -> str:
        mapping = {
            Department.FEES: RoleLevel.DEPARTMENT_OFFICER.value,
            Department.ACADEMIC_RESULTS: RoleLevel.DEPARTMENT_OFFICER.value,
        }
        return mapping[department]

    def create_workflow(
        self,
        *,
        workflow_type: WorkflowType,
        title: str,
        description: str,
        created_by: str,
        created_by_role: str,
        student_id: Optional[str] = None,
        lecturer_id: Optional[str] = None,
        course_id: Optional[str] = None,
        fee_record_id: Optional[str] = None,
        result_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WorkflowItem:
        department = self.infer_department(workflow_type)
        item_id = str(uuid4())

        item = WorkflowItem(
            id=item_id,
            workflow_type=workflow_type,
            title=title,
            description=description,
            department=department,
            status=WorkflowStatus.ROUTED,
            created_by=created_by,
            created_by_role=created_by_role,
            student_id=student_id,
            lecturer_id=lecturer_id,
            course_id=course_id,
            fee_record_id=fee_record_id,
            result_id=result_id,
            communication_unlocked=False,
            requires_approval=True,
            current_assignee_role=self.default_assignee_role(department),
            metadata=metadata or {},
            history=[
                WorkflowAction(
                    actor_id=created_by,
                    actor_role=created_by_role,
                    action="created_and_routed",
                    note=f"Routed to {department.value}",
                )
            ],
        )
        self._items[item_id] = item
        return item

    def list_workflows(
        self,
        *,
        department: Optional[Department] = None,
        status: Optional[WorkflowStatus] = None,
    ) -> List[WorkflowItem]:
        items = list(self._items.values())
        if department:
            items = [i for i in items if i.department == department]
        if status:
            items = [i for i in items if i.status == status]
        return sorted(items, key=lambda x: x.updated_at, reverse=True)

    def get_workflow(self, workflow_id: str) -> WorkflowItem:
        if workflow_id not in self._items:
            raise KeyError(f"Workflow {workflow_id} not found")
        return self._items[workflow_id]

    def add_action(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        action: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        item = self.get_workflow(workflow_id)
        item.history.append(
            WorkflowAction(
                actor_id=actor_id,
                actor_role=actor_role,
                action=action,
                note=note,
            )
        )
        item.updated_at = self._now()
        return item

    def move_to_review(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        item = self.get_workflow(workflow_id)
        item.status = WorkflowStatus.IN_REVIEW
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="moved_to_review",
            note=note,
        )

    def request_approval(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        item = self.get_workflow(workflow_id)
        item.status = WorkflowStatus.PENDING_APPROVAL
        item.current_assignee_role = RoleLevel.DEPARTMENT_HEAD.value
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="approval_requested",
            note=note,
        )

    def approve(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        if actor_role not in {
            RoleLevel.DEPARTMENT_HEAD.value,
            RoleLevel.INSTITUTION_ADMIN.value,
        }:
            raise PermissionError("Only department head or institution admin can approve")

        item = self.get_workflow(workflow_id)
        item.status = WorkflowStatus.APPROVED
        item.current_assignee_role = None
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="approved",
            note=note,
        )

    def reject(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        if actor_role not in {
            RoleLevel.DEPARTMENT_HEAD.value,
            RoleLevel.INSTITUTION_ADMIN.value,
        }:
            raise PermissionError("Only department head or institution admin can reject")

        item = self.get_workflow(workflow_id)
        item.status = WorkflowStatus.REJECTED
        item.current_assignee_role = None
        item.communication_unlocked = False
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="rejected",
            note=note,
        )

    def resolve(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        item = self.get_workflow(workflow_id)
        item.status = WorkflowStatus.RESOLVED
        item.current_assignee_role = None
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="resolved",
            note=note,
        )

    def set_communication_unlock(
        self,
        workflow_id: str,
        *,
        actor_id: str,
        actor_role: str,
        unlocked: bool,
        note: Optional[str] = None,
    ) -> WorkflowItem:
        if actor_role not in {
            RoleLevel.DEPARTMENT_HEAD.value,
            RoleLevel.INSTITUTION_ADMIN.value,
        }:
            raise PermissionError("Only admin/head can control communication unlock")

        item = self.get_workflow(workflow_id)
        item.communication_unlocked = unlocked
        item.updated_at = self._now()
        return self.add_action(
            workflow_id,
            actor_id=actor_id,
            actor_role=actor_role,
            action="communication_unlocked" if unlocked else "communication_locked",
            note=note,
        )


workflow_engine = WorkflowEngine()
