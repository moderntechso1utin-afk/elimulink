from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any


DEFAULT_DEPARTMENTS = (
    {
        "id": "fees",
        "name": "Fees Department",
        "code": "FIN",
        "enabledModules": ["fees", "payments", "arrears", "finance_reports"],
    },
    {
        "id": "academic_results",
        "name": "Academic Results Department",
        "code": "ARD",
        "enabledModules": ["results", "marks", "gpa", "transcripts", "approvals"],
    },
)

DEPARTMENT_OWNERSHIP = {
    "fees": {"fee", "fees", "payment", "balance", "arrears", "fee_record", "finance"},
    "academic_results": {"result", "results", "marks", "grade", "gpa", "transcript", "course"},
}

ROLE_LEVELS = ("institution_admin", "department_head", "department_officer", "lecturer", "student")


@dataclass
class Institution:
    id: str
    name: str
    type: str = "university"
    departments: list[str] = field(default_factory=list)


@dataclass
class Department:
    id: str
    name: str
    code: str
    institutionId: str
    lecturers: list[str] = field(default_factory=list)
    courses: list[str] = field(default_factory=list)
    enabledModules: list[str] = field(default_factory=list)


@dataclass
class Lecturer:
    id: str
    name: str
    departmentId: str
    roleLevel: str = "lecturer"
    subgroupIds: list[str] = field(default_factory=list)
    title: str = "Lecturer"
    email: str | None = None
    phone: str | None = None
    staffNumber: str | None = None


@dataclass
class Student:
    id: str
    name: str
    registrationNumber: str
    departmentId: str | None = None
    courseIds: list[str] = field(default_factory=list)
    feeRecordIds: list[str] = field(default_factory=list)
    resultIds: list[str] = field(default_factory=list)


@dataclass
class Course:
    id: str
    code: str
    title: str
    departmentId: str
    lecturerIds: list[str] = field(default_factory=list)


@dataclass
class Result:
    id: str
    studentId: str
    courseId: str
    grade: str
    semester: str
    departmentId: str


@dataclass
class FeeRecord:
    id: str
    studentId: str
    departmentId: str
    balance: float
    status: str


@dataclass
class Subgroup:
    id: str
    name: str
    departmentId: str
    lecturerIds: list[str] = field(default_factory=list)
    studentIds: list[str] = field(default_factory=list)


@dataclass
class AdminUser:
    id: str
    role: str
    institutionId: str
    departmentId: str | None = None


@dataclass
class InstitutionGraph:
    institution: Institution
    departments: dict[str, Department] = field(default_factory=dict)
    lecturers: dict[str, Lecturer] = field(default_factory=dict)
    students: dict[str, Student] = field(default_factory=dict)
    courses: dict[str, Course] = field(default_factory=dict)
    results: dict[str, Result] = field(default_factory=dict)
    feeRecords: dict[str, FeeRecord] = field(default_factory=dict)
    subgroups: dict[str, Subgroup] = field(default_factory=dict)
    adminUsers: dict[str, AdminUser] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "institution": asdict(self.institution),
            "departments": {k: asdict(v) for k, v in self.departments.items()},
            "lecturers": {k: asdict(v) for k, v in self.lecturers.items()},
            "students": {k: asdict(v) for k, v in self.students.items()},
            "courses": {k: asdict(v) for k, v in self.courses.items()},
            "results": {k: asdict(v) for k, v in self.results.items()},
            "feeRecords": {k: asdict(v) for k, v in self.feeRecords.items()},
            "subgroups": {k: asdict(v) for k, v in self.subgroups.items()},
            "adminUsers": {k: asdict(v) for k, v in self.adminUsers.items()},
        }


def _norm_role(role: str | None) -> str:
    value = str(role or "").strip().lower()
    if value in {"institutionadmin", "institution_admin"}:
        return "institution_admin"
    if value in {"department_head", "departmenthead", "hod"}:
        return "department_head"
    if value in {"department_officer", "departmentofficer"}:
        return "department_officer"
    if value in {"super_admin", "superadmin"}:
        return "institution_admin"
    if value in {"staff", "lecturer"}:
        return "lecturer"
    if value in {"student", "institution_student", "student_general"}:
        return "student"
    return value if value in ROLE_LEVELS else "institution_admin"


def build_institution_graph(
    *,
    institution_id: str,
    institution_name: str = "ElimuLink University",
    actor_id: str | None = None,
    actor_role: str | None = None,
    actor_department_id: str | None = None,
) -> InstitutionGraph:
    departments: dict[str, Department] = {}
    for dep in DEFAULT_DEPARTMENTS:
        departments[dep["id"]] = Department(
            id=dep["id"],
            name=dep["name"],
            code=dep["code"],
            institutionId=institution_id,
            enabledModules=list(dep["enabledModules"]),
        )

    institution = Institution(
        id=institution_id,
        name=institution_name,
        type="university",
        departments=list(departments.keys()),
    )
    graph = InstitutionGraph(institution=institution, departments=departments)
    if actor_id:
        graph.adminUsers[actor_id] = AdminUser(
            id=actor_id,
            role=_norm_role(actor_role),
            institutionId=institution_id,
            departmentId=actor_department_id,
        )
    return graph


def resolve_department_ownership(question: str, explicit_department: str | None = None) -> dict[str, Any]:
    value = str(explicit_department or "").strip().lower()
    if value in {"fees", "finance"}:
        return {"departmentId": "fees", "ownership": "Fees Department", "resolved": True}
    if value in {"academic_results", "results", "academic"}:
        return {"departmentId": "academic_results", "ownership": "Academic Results Department", "resolved": True}

    q = str(question or "").lower()
    for dep_id, keywords in DEPARTMENT_OWNERSHIP.items():
        if any(keyword in q for keyword in keywords):
            return {
                "departmentId": dep_id,
                "ownership": "Fees Department" if dep_id == "fees" else "Academic Results Department",
                "resolved": True,
            }
    return {"departmentId": None, "ownership": None, "resolved": False}


def _extract_entity_ids(question: str) -> dict[str, str | None]:
    q = str(question or "")
    student_match = re.search(r"\b(\d{6,12})\b", q)
    course_match = re.search(r"\b([A-Z]{2,4}\d{2,4})\b", q)
    return {
        "studentId": student_match.group(1) if student_match else None,
        "courseId": course_match.group(1) if course_match else None,
    }


def _entity_type_for_question(question: str, department_id: str | None) -> str:
    q = str(question or "").lower()
    if "subgroup" in q:
        return "Subgroup"
    if department_id == "fees":
        return "FeeRecord"
    if department_id == "academic_results":
        if "course" in q:
            return "Course"
        return "Result"
    if "student" in q:
        return "Student"
    return "Institution"


def role_scoped_graph_view(role: str, graph: InstitutionGraph) -> dict[str, Any]:
    normalized_role = _norm_role(role)
    base = graph.to_dict()
    if normalized_role in {"institution_admin", "department_head", "department_officer"}:
        return base

    if normalized_role == "lecturer":
        base["feeRecords"] = {}
        return base

    if normalized_role == "student":
        base["adminUsers"] = {}
        base["feeRecords"] = {}
        # Student-facing subgroup lecturer privacy view.
        base["lecturers"] = {
            lecturer_id: {
                "id": lecturer.id,
                "name": lecturer.name,
                "departmentId": lecturer.departmentId,
                "title": lecturer.title,
            }
            for lecturer_id, lecturer in graph.lecturers.items()
        }
        return base

    return base


def resolve_graph_context(
    *,
    graph: InstitutionGraph,
    actor_role: str,
    question: str,
    explicit_department: str | None = None,
) -> dict[str, Any]:
    ownership = resolve_department_ownership(question, explicit_department)
    entity_refs = _extract_entity_ids(question)
    entity_type = _entity_type_for_question(question, ownership.get("departmentId"))
    role = _norm_role(actor_role)

    reasoning_paths = [
        "Student -> FeeRecord -> Fees Department",
        "Student -> Result -> Course -> Academic Results Department",
        "Lecturer -> Department -> Workspace",
        "Department -> Institution",
        "Subgroup -> Lecturer -> Department",
    ]

    context = {
        "actorRole": role,
        "institutionId": graph.institution.id,
        "institutionName": graph.institution.name,
        "departmentId": ownership.get("departmentId"),
        "ownership": ownership.get("ownership"),
        "ownershipResolved": bool(ownership.get("resolved")),
        "entityType": entity_type,
        "relatedEntities": {
            "student": entity_refs.get("studentId"),
            "course": entity_refs.get("courseId"),
            "result": entity_refs.get("studentId") if entity_type == "Result" else None,
            "feeRecord": entity_refs.get("studentId") if entity_type == "FeeRecord" else None,
        },
        "reasoningPaths": reasoning_paths,
        "roleScopedGraph": role_scoped_graph_view(role, graph),
    }
    if not ownership.get("resolved"):
        context["routingWarning"] = "Department ownership not configured for this question. Do not invent ownership paths."
    return context

