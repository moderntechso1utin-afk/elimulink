from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RubricCriterionIn(BaseModel):
    id: Optional[str] = None
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    maxMarks: float = Field(gt=0)
    weight: Optional[float] = None
    expectedEvidence: str = ""
    feedbackHints: str = ""


class RubricCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    courseId: str = Field(min_length=1, max_length=128)
    departmentId: str = Field(min_length=1, max_length=128)
    assessmentType: str = Field(min_length=1, max_length=64)
    totalMarks: float = Field(gt=0)
    criteria: List[RubricCriterionIn] = Field(default_factory=list)


class RubricCriterionOut(BaseModel):
    id: str
    title: str
    description: str
    max_marks: float
    weight: Optional[float] = None
    expected_evidence: str = ""
    feedback_hints: str = ""


class RubricOut(BaseModel):
    id: str
    title: str
    course_id: str
    department_id: str
    assessment_type: str
    total_marks: float
    criteria: List[RubricCriterionOut]
    version: int
    created_at: str
    updated_at: str


class AttachRubricIn(BaseModel):
    actor_id: str
    actor_role: str
    rubric_id: str
    subgroup_id: Optional[str] = None
    assessment_type: Optional[str] = None
    note: Optional[str] = None


class RubricEvaluateIn(BaseModel):
    actor_id: str
    actor_role: str
    submission_text: str = Field(min_length=1)
    submission_id: Optional[str] = None
    note: Optional[str] = None


class CriterionSuggestionOut(BaseModel):
    criterion_id: str
    criterion_title: str
    summary: str
    evidence_found: str
    missing_evidence: str
    suggested_mark_min: float
    suggested_mark_max: float
    draft_feedback: str


class RubricDraftOut(BaseModel):
    id: str
    workflow_id: str
    rubric_id: str
    rubric_version: int
    reviewer_role: str
    submission_id: Optional[str]
    assessment_type: str
    criterion_suggestions: List[CriterionSuggestionOut]
    total_suggested_min: float
    total_suggested_max: float
    strengths: List[str]
    weaknesses: List[str]
    reviewer_attention_flags: List[str]
    confidence_note: str
    ai_label: str
    created_at: str


class ReviewerDecisionIn(BaseModel):
    actor_id: str
    actor_role: str
    criterion_marks: Dict[str, float] = Field(default_factory=dict)
    criterion_feedback: Dict[str, str] = Field(default_factory=dict)
    final_score: Optional[float] = None
    override_notes: Optional[str] = None
    action: str = Field(
        description="Human-supervised action only: save_draft, finalize_later, approve, reject, publish"
    )


class ReviewerDecisionOut(BaseModel):
    id: str
    workflow_id: str
    rubric_id: str
    rubric_version: int
    reviewer_id: str
    reviewer_role: str
    criterion_marks: Dict[str, float]
    criterion_feedback: Dict[str, str]
    final_score: Optional[float]
    override_notes: Optional[str]
    action: str
    created_at: str


class WorkflowWithRubricOut(BaseModel):
    workflow: Dict[str, Any]
    rubric: Optional[RubricOut] = None
    latest_draft: Optional[RubricDraftOut] = None
    decisions: List[ReviewerDecisionOut] = Field(default_factory=list)
    warning: str = "AI suggestions are drafts only. Final marking and publication require explicit human action."

