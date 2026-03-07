from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from ..rubric_engine import rubric_engine
from ..rubric_schemas import RubricCreateIn, RubricOut


router = APIRouter(prefix="/api/rubrics", tags=["rubrics"])


@router.post("", response_model=RubricOut)
def create_rubric(payload: RubricCreateIn):
    rubric = rubric_engine.create_rubric(
        title=payload.title,
        course_id=payload.courseId,
        department_id=payload.departmentId,
        assessment_type=payload.assessmentType,
        total_marks=payload.totalMarks,
        criteria=[
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "maxMarks": c.maxMarks,
                "weight": c.weight,
                "expectedEvidence": c.expectedEvidence,
                "feedbackHints": c.feedbackHints,
            }
            for c in payload.criteria
        ],
    )
    return RubricOut.model_validate(asdict(rubric))


@router.get("", response_model=list[RubricOut])
def list_rubrics(
    courseId: str | None = Query(default=None),
    departmentId: str | None = Query(default=None),
):
    items = rubric_engine.list_rubrics(course_id=courseId, department_id=departmentId)
    return [RubricOut.model_validate(asdict(item)) for item in items]


@router.get("/{rubric_id}", response_model=RubricOut)
def get_rubric(rubric_id: str):
    try:
        rubric = rubric_engine.get_rubric(rubric_id)
        return RubricOut.model_validate(asdict(rubric))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

