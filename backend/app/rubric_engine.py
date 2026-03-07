from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class RubricCriterion:
    id: str
    title: str
    description: str
    max_marks: float
    weight: Optional[float] = None
    expected_evidence: str = ""
    feedback_hints: str = ""


@dataclass
class Rubric:
    id: str
    title: str
    course_id: str
    department_id: str
    assessment_type: str
    total_marks: float
    criteria: List[RubricCriterion] = field(default_factory=list)
    version: int = 1
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class CriterionSuggestion:
    criterion_id: str
    criterion_title: str
    summary: str
    evidence_found: str
    missing_evidence: str
    suggested_mark_min: float
    suggested_mark_max: float
    draft_feedback: str


@dataclass
class RubricEvaluationDraft:
    id: str
    workflow_id: str
    rubric_id: str
    rubric_version: int
    reviewer_role: str
    submission_id: Optional[str]
    assessment_type: str
    criterion_suggestions: List[CriterionSuggestion] = field(default_factory=list)
    total_suggested_min: float = 0.0
    total_suggested_max: float = 0.0
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    reviewer_attention_flags: List[str] = field(default_factory=list)
    confidence_note: str = "AI draft evaluation only. Human reviewer must confirm all marks."
    ai_label: str = "AI recommendation - not final grade"
    created_at: str = field(default_factory=_now)


@dataclass
class ReviewerDecision:
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
    created_at: str = field(default_factory=_now)


class RubricEngine:
    def __init__(self) -> None:
        self._rubrics: Dict[str, Rubric] = {}
        self._drafts: Dict[str, RubricEvaluationDraft] = {}
        self._review_decisions: Dict[str, ReviewerDecision] = {}

    def create_rubric(
        self,
        *,
        title: str,
        course_id: str,
        department_id: str,
        assessment_type: str,
        total_marks: float,
        criteria: List[Dict[str, Any]],
    ) -> Rubric:
        rubric_id = str(uuid4())
        normalized_criteria: List[RubricCriterion] = []
        for idx, criterion in enumerate(criteria or []):
            normalized_criteria.append(
                RubricCriterion(
                    id=str(criterion.get("id") or f"criterion_{idx+1}"),
                    title=str(criterion.get("title") or f"Criterion {idx+1}"),
                    description=str(criterion.get("description") or ""),
                    max_marks=float(criterion.get("max_marks") or criterion.get("maxMarks") or 0),
                    weight=float(criterion["weight"]) if criterion.get("weight") is not None else None,
                    expected_evidence=str(criterion.get("expected_evidence") or criterion.get("expectedEvidence") or ""),
                    feedback_hints=str(criterion.get("feedback_hints") or criterion.get("feedbackHints") or ""),
                )
            )
        rubric = Rubric(
            id=rubric_id,
            title=title,
            course_id=course_id,
            department_id=department_id,
            assessment_type=assessment_type,
            total_marks=float(total_marks),
            criteria=normalized_criteria,
        )
        self._rubrics[rubric_id] = rubric
        return rubric

    def list_rubrics(self, *, course_id: Optional[str] = None, department_id: Optional[str] = None) -> List[Rubric]:
        rubrics = list(self._rubrics.values())
        if course_id:
            rubrics = [r for r in rubrics if r.course_id == course_id]
        if department_id:
            rubrics = [r for r in rubrics if r.department_id == department_id]
        return sorted(rubrics, key=lambda r: r.updated_at, reverse=True)

    def get_rubric(self, rubric_id: str) -> Rubric:
        if rubric_id not in self._rubrics:
            raise KeyError(f"Rubric {rubric_id} not found")
        return self._rubrics[rubric_id]

    def evaluate_submission_draft(
        self,
        *,
        workflow_id: str,
        rubric: Rubric,
        submission_text: str,
        reviewer_role: str,
        submission_id: Optional[str] = None,
    ) -> RubricEvaluationDraft:
        text = str(submission_text or "").lower()
        suggestions: List[CriterionSuggestion] = []
        total_min = 0.0
        total_max = 0.0
        strengths: List[str] = []
        weaknesses: List[str] = []
        flags: List[str] = []

        for criterion in rubric.criteria:
            evidence_terms = [term.strip().lower() for term in criterion.expected_evidence.split(",") if term.strip()]
            found = [term for term in evidence_terms if term in text]
            coverage = (len(found) / max(len(evidence_terms), 1)) if evidence_terms else 0.5
            min_mark = round(max(0.0, criterion.max_marks * max(0.2, coverage - 0.2)), 2)
            max_mark = round(max(min_mark, criterion.max_marks * min(1.0, coverage + 0.2)), 2)
            missing = [term for term in evidence_terms if term not in found]
            if coverage >= 0.65:
                strengths.append(f"{criterion.title}: strong evidence coverage")
            else:
                weaknesses.append(f"{criterion.title}: weak evidence coverage")
                flags.append(f"{criterion.title}: lecturer should review missing evidence")

            suggestions.append(
                CriterionSuggestion(
                    criterion_id=criterion.id,
                    criterion_title=criterion.title,
                    summary=f"Draft rubric analysis for {criterion.title}.",
                    evidence_found=", ".join(found) if found else "Limited direct evidence identified.",
                    missing_evidence=", ".join(missing) if missing else "No critical gaps identified.",
                    suggested_mark_min=min_mark,
                    suggested_mark_max=max_mark,
                    draft_feedback=(
                        criterion.feedback_hints
                        or f"Consider strengthening: {criterion.description or criterion.title}."
                    ),
                )
            )
            total_min += min_mark
            total_max += max_mark

        draft = RubricEvaluationDraft(
            id=str(uuid4()),
            workflow_id=workflow_id,
            rubric_id=rubric.id,
            rubric_version=rubric.version,
            reviewer_role=reviewer_role,
            submission_id=submission_id,
            assessment_type=rubric.assessment_type,
            criterion_suggestions=suggestions,
            total_suggested_min=round(total_min, 2),
            total_suggested_max=round(total_max, 2),
            strengths=strengths[:5],
            weaknesses=weaknesses[:5],
            reviewer_attention_flags=flags[:5],
        )
        self._drafts[draft.id] = draft
        return draft

    def save_reviewer_decision(
        self,
        *,
        workflow_id: str,
        rubric_id: str,
        rubric_version: int,
        reviewer_id: str,
        reviewer_role: str,
        criterion_marks: Dict[str, float],
        criterion_feedback: Dict[str, str],
        final_score: Optional[float],
        override_notes: Optional[str],
        action: str,
    ) -> ReviewerDecision:
        decision = ReviewerDecision(
            id=str(uuid4()),
            workflow_id=workflow_id,
            rubric_id=rubric_id,
            rubric_version=rubric_version,
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            criterion_marks=criterion_marks,
            criterion_feedback=criterion_feedback,
            final_score=final_score,
            override_notes=override_notes,
            action=action,
        )
        self._review_decisions[decision.id] = decision
        return decision

    def list_workflow_decisions(self, workflow_id: str) -> List[ReviewerDecision]:
        return sorted(
            [item for item in self._review_decisions.values() if item.workflow_id == workflow_id],
            key=lambda item: item.created_at,
            reverse=True,
        )


rubric_engine = RubricEngine()

