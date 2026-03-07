from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from ..rubric_engine import rubric_engine
from ..rubric_schemas import (
    AttachRubricIn,
    ReviewerDecisionIn,
    ReviewerDecisionOut,
    RubricDraftOut,
    RubricOut,
    WorkflowWithRubricOut,
    RubricEvaluateIn,
)
from ..workflow_engine import Department, WorkflowStatus, workflow_engine
from ..workflow_schemas import (
    CommunicationToggleIn,
    WorkflowActionIn,
    WorkflowCreateIn,
    WorkflowOut,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _out(item):
    return WorkflowOut.model_validate(asdict(item))


@router.post("", response_model=WorkflowOut)
def create_workflow(payload: WorkflowCreateIn):
    item = workflow_engine.create_workflow(
        workflow_type=payload.workflow_type,
        title=payload.title,
        description=payload.description,
        created_by=payload.created_by,
        created_by_role=payload.created_by_role,
        student_id=payload.student_id,
        lecturer_id=payload.lecturer_id,
        course_id=payload.course_id,
        fee_record_id=payload.fee_record_id,
        result_id=payload.result_id,
        metadata=payload.metadata,
    )
    return _out(item)


@router.get("", response_model=list[WorkflowOut])
def list_workflows(
    department: Department | None = Query(default=None),
    status: WorkflowStatus | None = Query(default=None),
):
    items = workflow_engine.list_workflows(department=department, status=status)
    return [_out(i) for i in items]


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: str):
    try:
        item = workflow_engine.get_workflow(workflow_id)
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{workflow_id}/review", response_model=WorkflowOut)
def move_to_review(workflow_id: str, payload: WorkflowActionIn):
    try:
        item = workflow_engine.move_to_review(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{workflow_id}/request-approval", response_model=WorkflowOut)
def request_approval(workflow_id: str, payload: WorkflowActionIn):
    try:
        item = workflow_engine.request_approval(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{workflow_id}/approve", response_model=WorkflowOut)
def approve_workflow(workflow_id: str, payload: WorkflowActionIn):
    try:
        item = workflow_engine.approve(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/{workflow_id}/reject", response_model=WorkflowOut)
def reject_workflow(workflow_id: str, payload: WorkflowActionIn):
    try:
        item = workflow_engine.reject(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/{workflow_id}/resolve", response_model=WorkflowOut)
def resolve_workflow(workflow_id: str, payload: WorkflowActionIn):
    try:
        item = workflow_engine.resolve(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{workflow_id}/communication", response_model=WorkflowOut)
def toggle_communication(workflow_id: str, payload: CommunicationToggleIn):
    try:
        item = workflow_engine.set_communication_unlock(
            workflow_id,
            actor_id=payload.actor_id,
            actor_role=payload.actor_role,
            unlocked=payload.unlocked,
            note=payload.note,
        )
        return _out(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/{workflow_id}/rubric/attach", response_model=WorkflowWithRubricOut)
def attach_rubric(workflow_id: str, payload: AttachRubricIn):
    try:
        item = workflow_engine.get_workflow(workflow_id)
        rubric = rubric_engine.get_rubric(payload.rubric_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if payload.actor_role not in {"lecturer", "department_head", "institution_admin"}:
        raise HTTPException(status_code=403, detail="Only lecturer/head/admin can attach rubrics")

    item.metadata["rubric_id"] = rubric.id
    item.metadata["rubric_version"] = rubric.version
    item.metadata["subgroup_id"] = payload.subgroup_id
    item.metadata["assessment_type"] = payload.assessment_type or rubric.assessment_type
    item.updated_at = item.updated_at
    workflow_engine.add_action(
        workflow_id,
        actor_id=payload.actor_id,
        actor_role=payload.actor_role,
        action="rubric_attached",
        note=payload.note or f"Attached rubric {rubric.id}",
    )

    return WorkflowWithRubricOut(
        workflow=asdict(item),
        rubric=RubricOut.model_validate(asdict(rubric)),
        latest_draft=None,
        decisions=[],
    )


@router.post("/{workflow_id}/evaluate-draft", response_model=RubricDraftOut)
def evaluate_workflow_submission_draft(workflow_id: str, payload: RubricEvaluateIn):
    try:
        item = workflow_engine.get_workflow(workflow_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    rubric_id = item.metadata.get("rubric_id")
    if not rubric_id:
        raise HTTPException(status_code=400, detail="Workflow has no attached rubric")
    try:
        rubric = rubric_engine.get_rubric(rubric_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    draft = rubric_engine.evaluate_submission_draft(
        workflow_id=workflow_id,
        rubric=rubric,
        submission_text=payload.submission_text,
        reviewer_role=payload.actor_role,
        submission_id=payload.submission_id,
    )
    item.metadata["latest_draft_id"] = draft.id
    item.metadata["latest_submission_id"] = payload.submission_id
    workflow_engine.add_action(
        workflow_id,
        actor_id=payload.actor_id,
        actor_role=payload.actor_role,
        action="ai_draft_evaluation_generated",
        note=payload.note or "AI draft evaluation generated (not final mark)",
    )
    return RubricDraftOut.model_validate(asdict(draft))


@router.post("/{workflow_id}/reviewer-decision", response_model=ReviewerDecisionOut)
def save_reviewer_decision(workflow_id: str, payload: ReviewerDecisionIn):
    try:
        item = workflow_engine.get_workflow(workflow_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    rubric_id = str(item.metadata.get("rubric_id") or "")
    if not rubric_id:
        raise HTTPException(status_code=400, detail="Workflow has no attached rubric")
    try:
        rubric = rubric_engine.get_rubric(rubric_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if payload.action in {"approve", "publish"} and payload.actor_role not in {"department_head", "institution_admin"}:
        raise HTTPException(status_code=403, detail="Only department head or institution admin can approve/publish")
    if payload.action in {"save_draft", "finalize_later", "reject"} and payload.actor_role not in {"lecturer", "department_officer", "department_head", "institution_admin"}:
        raise HTTPException(status_code=403, detail="Role not allowed for this reviewer action")

    decision = rubric_engine.save_reviewer_decision(
        workflow_id=workflow_id,
        rubric_id=rubric.id,
        rubric_version=rubric.version,
        reviewer_id=payload.actor_id,
        reviewer_role=payload.actor_role,
        criterion_marks=payload.criterion_marks,
        criterion_feedback=payload.criterion_feedback,
        final_score=payload.final_score,
        override_notes=payload.override_notes,
        action=payload.action,
    )

    workflow_engine.add_action(
        workflow_id,
        actor_id=payload.actor_id,
        actor_role=payload.actor_role,
        action=f"reviewer_{payload.action}",
        note="Human supervised reviewer decision saved",
    )
    return ReviewerDecisionOut.model_validate(asdict(decision))
