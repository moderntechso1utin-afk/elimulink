import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell, CalendarDays, ClipboardCheck, Clock3, FileCheck2, LayoutDashboard,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FileBarChart2,
  FileSpreadsheet,
  Filter,
  Globe,
  GraduationCap,
  History,
  Link2,
  Lock,
  LogOut, Megaphone, MessageSquareText, PanelLeftClose, PanelLeftOpen, ScrollText,
  Mail,
  MessageSquareWarning,
  Printer,
  Save,
  Search, Settings, UserCircle2, UserCog, Users,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
} from "lucide-react";
import { auth } from "../lib/firebase";
import NewChatLanding from "./NewChatLanding";
import AdminActionMenu from "../components/admin/AdminActionMenu";
import AdminStarterPanel from "../components/admin/AdminStarterPanel";
import {
  approveWorkflow, attachWorkflowRubric, createWorkflow, evaluateWorkflowDraft,
  listWorkflows, moveWorkflowToReview, rejectWorkflow, requestWorkflowApproval,
  resolveWorkflow, saveWorkflowReviewerDecision, setWorkflowCommunication
} from "../lib/workflowsApi";
import { listRubrics } from "../lib/rubricsApi";
import { getAdminSettings, putAdminSettings } from "../lib/adminSettingsApi";
import { getAdminAnalyticsSummary } from "../lib/adminAnalyticsApi";

const ADMIN_CHAT_GREETING = "Welcome to the ElimuLink Administrative Assistant. You can ask about enrollment, fees, academic results, attendance analytics, or institutional reports.";
const AI_RULE = "AI suggestions are drafts only. Final grading, approval, publication, and communication unlock require explicit human action.";
const HEADER_H = 60;
const GROUPS = [
  { title: "MAIN", items: [["analytics", "Analytics", LayoutDashboard], ["chat", "Chat Space", MessageSquareText]] },
  { title: "OPERATIONS", items: [["results", "Results Management", FileCheck2], ["attendance", "Attendance Monitoring", ClipboardCheck], ["subgroups", "Subgroups", Users], ["calendar", "Calendar", CalendarDays], ["workflows", "Workflows", ClipboardCheck]] },
  { title: "MANAGEMENT", items: [["users", "User Management", UserCog], ["announcements", "Announcement Control", Megaphone], ["audit", "Audit Logs", ScrollText]] },
  { title: "SYSTEM", items: [["settings", "Settings", Settings], ["profile", "Profile", UserCircle2]] },
];
const KPI = [["Enrollment KPI", "12,542"], ["GPA KPI", "3.52"], ["Attendance KPI", "84%"], ["At-risk Students", "52"]];
const STATUSES = ["routed", "in_review", "pending_approval", "approved", "rejected", "resolved"];
const TYPES = ["fee_issue", "missing_marks", "assignment_submission", "exam_submission", "transcript_request", "gpa_review"];
const ATTENDANCE_ROWS = [
  { code: "CSC221", mode: "Physical", date: "2026-03-05", present: 72, total: 86, flagged: false },
  { code: "CSC305", mode: "Online", date: "2026-03-06", present: 54, total: 80, flagged: true },
  { code: "BIT110", mode: "Physical", date: "2026-03-06", present: 61, total: 75, flagged: false },
  { code: "MTH140", mode: "Online", date: "2026-03-07", present: 39, total: 70, flagged: true },
];

function Card({ title, subtitle, children, right }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-start justify-between"><div><div className="text-sm font-semibold">{title}</div><div className="text-xs text-slate-500">{subtitle}</div></div>{right}</div>{children}</section>;
}
function Chip({ v }) { const x = String(v || ""); const cls = x === "approved" ? "bg-emerald-100 text-emerald-700" : x === "rejected" ? "bg-rose-100 text-rose-700" : x === "pending_approval" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${cls}`}>{x.replaceAll("_", " ")}</span>; }
function Summary({ label, value, Icon }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between text-xs text-slate-600"><span>{label}</span>{Icon ? <Icon size={13} /> : null}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>; }

function AdminMiniModal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            <div className="text-sm text-slate-500">Administrative action panel</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ResultsManagementPanel({ workflows = [], onOpenWorkflows, onOpenAnalytics }) {
  const [modal, setModal] = useState(null);

  const resultsQuickActions = [
    {
      label: "Review pending approvals",
      onClick: () => {
        setModal("approvals");
        onOpenWorkflows?.();
      },
    },
    {
      label: "View missing marks",
      onClick: () => {
        setModal("missing");
        onOpenWorkflows?.();
      },
    },
    {
      label: "Generate review summary",
      onClick: () => {
        setModal("summary");
        onOpenAnalytics?.();
      },
    },
    {
      label: "Export results snapshot",
      onClick: () => setModal("export"),
    },
  ];

  const resultsMenuItems = [
    {
      key: "review-actions",
      label: "Review Actions",
      children: [
        { key: "pending", label: "Review pending approvals", onClick: () => setModal("approvals") },
        { key: "missing", label: "Inspect missing marks", onClick: () => setModal("missing") },
        { key: "flags", label: "Open flagged issues", onClick: () => setModal("flags") },
      ],
    },
    { type: "separator" },
    {
      key: "reports",
      label: "Reports & Export",
      children: [
        { key: "summary", label: "Generate review summary", onClick: () => setModal("summary") },
        { key: "snapshot", label: "Export results snapshot", onClick: () => setModal("export") },
        { key: "print", label: "Print current overview", onClick: () => window.print() },
      ],
    },
  ];

  const pendingApprovals = useMemo(
    () => workflows.filter((w) => w.status === "pending_approval"),
    [workflows]
  );
  const missingMarks = useMemo(
    () => workflows.filter((w) => w.workflow_type === "missing_marks"),
    [workflows]
  );
  const flaggedRows = useMemo(() => {
    const live = [...missingMarks, ...pendingApprovals].slice(0, 3).map((w) => ({
      code: String(w.course_id || w.metadata?.course || w.title || "Workflow"),
      issue: String(w.description || "Needs review"),
      owner: String(w.current_assignee_role || "Department Reviewer"),
      priority: String(w.metadata?.priority || "Medium").toLowerCase() === "high" ? "High" : "Medium",
    }));
    if (live.length) return live;
    return [
      { code: "CSC 301", issue: "17 marks still missing", owner: "Dr. Mutiso", priority: "High" },
      { code: "BUS 204", issue: "Approval queue delayed", owner: "Department Reviewer", priority: "Medium" },
      { code: "EDU 112", issue: "Outlier grade pattern detected", owner: "AI Review", priority: "High" },
    ];
  }, [missingMarks, pendingApprovals]);

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Results Management"
          subtitle="Oversee academic results, missing marks, approval queues, flagged issues, and export-ready snapshots."
          stats={[
            { label: "Pending approvals", value: String(pendingApprovals.length || 0), note: "Live workflow-backed count" },
            { label: "Missing marks", value: String(missingMarks.length || 0), note: "Workflow items tagged missing_marks" },
            { label: "Flagged issues", value: String(flaggedRows.length || 0), note: "Hybrid live + operational flags" },
          ]}
          actions={resultsQuickActions}
          highlights={[
            "2 units have delayed result approvals past target window.",
            "AI detected unusual score distribution in one course.",
            "Missing marks remain the biggest blocker in this cycle.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Results Oversight</div>
              <div className="text-sm text-slate-500">
                Review current issues, queues, and export actions.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModal("approvals")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ClipboardCheck size={16} />
                Pending approvals
              </button>

              <button
                type="button"
                onClick={() => setModal("missing")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <AlertTriangle size={16} />
                Missing marks
              </button>

              <AdminActionMenu label="Quick Actions" items={resultsMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Flagged Result Issues</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">Unit</th>
                      <th className="py-2 pr-4 font-medium">Issue</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedRows.map((row) => (
                      <tr key={`${row.code}-${row.issue}`} className="border-b border-slate-50">
                        <td className="py-3 pr-4 font-medium text-slate-800">{row.code}</td>
                        <td className="py-3 pr-4 text-slate-600">{row.issue}</td>
                        <td className="py-3 pr-4 text-slate-600">{row.owner}</td>
                        <td className="py-3">
                          <span
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              row.priority === "High"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700",
                            ].join(" ")}
                          >
                            {row.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Administrative Focus</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <GraduationCap size={16} />
                    Approval Queue
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Review bottlenecks affecting semester reporting timelines.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldCheck size={16} />
                    Governance Check
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Sensitive academic actions still require explicit human approval.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <FileBarChart2 size={16} />
                    Export Readiness
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Prepare dean-level or board-facing result summaries from reviewed data only.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal
        open={modal === "approvals"}
        title="Pending Result Approvals"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          {[
            "BSC CSC Semester 2 - awaiting dean confirmation",
            "BED Arts - 12 scripts reviewed, approval pending",
            "BCOM Year 3 - moderation complete, final release blocked",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-medium text-slate-800">{item}</div>
              <div className="mt-1 text-sm text-slate-500">
                Next step: verify reviewer notes and finalize approval chain.
              </div>
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "missing"}
        title="Missing Marks Review"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          {[
            "CSC 301 - 17 learner records missing marks",
            "EDU 112 - moderation submitted but 5 entries incomplete",
            "BUS 204 - lecturer upload succeeded, approval metadata absent",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-medium text-slate-800">{item}</div>
              <div className="mt-1 text-sm text-slate-500">
                Recommended action: contact reviewer or lecturer and reopen review workflow if needed.
              </div>
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "summary"}
        title="Review Summary Draft"
        onClose={() => setModal(null)}
      >
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 leading-7">
          Summary: Most units are progressing normally, but missing marks and delayed approvals remain the
          primary blockers. Key Findings: three academic queues need immediate attention before results can be
          released. Recommended Actions: follow up on incomplete uploads, confirm reviewer decisions, and
          prepare an approval-ready summary for the department head.
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "export"}
        title="Export Results Snapshot"
        onClose={() => setModal(null)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "CSV export", icon: FileSpreadsheet },
            { label: "PDF report", icon: Download },
            { label: "Print overview", icon: Printer },
            { label: "Preview report", icon: Eye },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className="rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <Icon size={16} />
                  {item.label}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Export-ready action placeholder for reviewed result data.
                </div>
              </button>
            );
          })}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "flags"}
        title="Flagged Academic Issues"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="font-medium text-rose-800">Unusual distribution detected</div>
            <div className="mt-1 text-sm text-rose-700">
              One class shows an outlier grading pattern that should be reviewed before publication.
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-medium text-amber-800">Approval delay</div>
            <div className="mt-1 text-sm text-amber-700">
              A moderated result set is complete but remains blocked in the approval chain.
            </div>
          </div>
        </div>
      </AdminMiniModal>
    </>
  );
}

function AttendanceMonitoringPanel() {
  const [modal, setModal] = useState(null);

  const attendanceMenuItems = [
    {
      key: "new",
      label: "New",
      children: [
        { key: "new-doc", label: "Documents", onClick: () => setModal("documents") },
        { key: "new-template", label: "From a template", onClick: () => setModal("templates") },
      ],
    },
    { type: "separator" },
    { key: "copy", label: "Make a copy", onClick: () => setModal("copy") },
    {
      key: "share",
      label: "Share",
      children: [
        { key: "share-others", label: "Share to others", onClick: () => setModal("share") },
        { key: "publish", label: "Publish to web", onClick: () => setModal("publish") },
      ],
    },
    {
      key: "email",
      label: "Email",
      children: [
        { key: "email-file", label: "Email this file", onClick: () => setModal("email-file") },
        { key: "email-collab", label: "Email collaborators", onClick: () => setModal("email-collab") },
      ],
    },
    { key: "rename", label: "Rename", onClick: () => setModal("rename") },
    {
      key: "move",
      label: "Move",
      children: [
        { key: "move-notebook", label: "Notebook", onClick: () => setModal("move-notebook") },
        { key: "move-newchat", label: "NewChat", onClick: () => setModal("move-newchat") },
      ],
    },
    { key: "shortcut", label: "Add shortcut to Drive", onClick: () => setModal("shortcut") },
    { key: "trash", label: "Move to trash", onClick: () => setModal("trash") },
    { key: "page-setup", label: "Page setup", onClick: () => setModal("page-setup") },
    { key: "print", label: "Print (Ctrl+P)", onClick: () => window.print() },
    { key: "language", label: "Language", onClick: () => setModal("language") },
    { key: "security", label: "Security limitations", onClick: () => setModal("security") },
    { key: "details", label: "Details", onClick: () => setModal("details") },
  ];

  const rows = [
    {
      classType: "Physical",
      unit: "CSC 201",
      session: "Mon 8:00 AM",
      lecturer: "Dr. Mutua",
      attendance: "88%",
      risk: "Low",
    },
    {
      classType: "Online",
      unit: "BUS 110",
      session: "Tue 2:00 PM",
      lecturer: "Ms. Ndinda",
      attendance: "63%",
      risk: "Medium",
    },
    {
      classType: "Physical",
      unit: "EDU 101",
      session: "Wed 11:00 AM",
      lecturer: "Mr. Kilonzo",
      attendance: "49%",
      risk: "High",
    },
    {
      classType: "Online",
      unit: "CSC 315",
      session: "Thu 4:00 PM",
      lecturer: "Dr. Wambua",
      attendance: "71%",
      risk: "Medium",
    },
  ];

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Attendance Monitoring"
          subtitle="Track online and physical attendance, export snapshots, and identify participation risks early."
          stats={[
            { label: "Average attendance", value: "84%", note: "Across all monitored sessions" },
            { label: "Flagged classes", value: "5", note: "Require follow-up" },
            { label: "At-risk students", value: "39", note: "Based on threshold rules" },
          ]}
          actions={[
            { label: "Review flagged classes", onClick: () => setModal("flags") },
            { label: "Send attendance alert", onClick: () => setModal("alert") },
            { label: "Export weekly snapshot", onClick: () => setModal("export") },
          ]}
          highlights={[
            "Physical classes remain stronger than online sessions this week.",
            "Two classes fell below the minimum attendance threshold.",
            "Export tools are ready for reporting and departmental review.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Attendance Records</div>
              <div className="text-sm text-slate-500">
                Structured overview for physical and online class attendance.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModal("flags")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <AlertTriangle size={16} />
                Flagged classes
              </button>

              <button
                type="button"
                onClick={() => setModal("export")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download size={16} />
                Export
              </button>

              <AdminActionMenu label="Attendance Actions" items={attendanceMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Class Type</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Lecturer</th>
                  <th className="px-4 py-3 font-medium">Attendance</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.unit}-${row.session}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{row.classType}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.unit}</td>
                    <td className="px-4 py-3 text-slate-600">{row.session}</td>
                    <td className="px-4 py-3 text-slate-600">{row.lecturer}</td>
                    <td className="px-4 py-3 text-slate-800">{row.attendance}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          row.risk === "High"
                            ? "bg-rose-50 text-rose-700"
                            : row.risk === "Medium"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700",
                        ].join(" ")}
                      >
                        {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Users size={16} />
                Participation Trend
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Online participation is weaker in late afternoon sessions and should be watched closely.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserCheck size={16} />
                Lecturer Follow-up
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Two lecturers may need attendance reminders for incomplete weekly records.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CheckCircle2 size={16} />
                Export Readiness
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Weekly attendance snapshots are ready for export to reporting formats.
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal
        open={modal === "flags"}
        title="Flagged Classes"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          {[
            "EDU 101 - attendance dropped below minimum threshold",
            "BUS 110 - online participation remained unstable this week",
            "CSC 315 - lecturer attendance record submission delayed",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-medium text-slate-800">{item}</div>
              <div className="mt-1 text-sm text-slate-500">
                Recommended action: review the class record, notify lecturer, and escalate if repeated.
              </div>
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "export"}
        title="Export Attendance Snapshot"
        onClose={() => setModal(null)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            "Microsoft Word (.docx)",
            "Plain text (.txt)",
            "PDF Document (.pdf)",
            "Rich text Format (.rtf)",
            "Web page (.html, zipped)",
            "EPUB Publication (.epub)",
            "Markdown (.md)",
          ].map((format) => (
            <button
              key={format}
              type="button"
              className="rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
            >
              <div className="font-medium text-slate-800">{format}</div>
              <div className="mt-1 text-sm text-slate-500">
                Export-ready format placeholder for attendance records.
              </div>
            </button>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "documents"}
        title="New Attendance Document"
        onClose={() => setModal(null)}
      >
        <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
          Start a new attendance document workspace for online or physical classes.
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={modal === "templates"}
        title="Attendance Templates"
        onClose={() => setModal(null)}
      >
        <div className="space-y-3">
          {["Weekly class register", "Online session tracker", "Hybrid attendance sheet"].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-medium text-slate-800">{item}</div>
              <div className="mt-1 text-sm text-slate-500">
                Template placeholder for future institutional attendance workflows.
              </div>
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal
        open={Boolean(
          modal &&
            [
              "copy",
              "share",
              "publish",
              "email-file",
              "email-collab",
              "rename",
              "move-notebook",
              "move-newchat",
              "shortcut",
              "trash",
              "page-setup",
              "language",
              "security",
              "details",
              "alert",
            ].includes(modal)
        )}
        title="Attendance Action"
        onClose={() => setModal(null)}
      >
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          This action is prepared in the interface and can be fully wired to storage, export, email, or policy flows next.
        </div>
      </AdminMiniModal>
    </>
  );
}

function SubgroupsPanel({ workflows = [], onOpenWorkflows, onOpenAudit }) {
  const [modal, setModal] = useState(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);

  const queueItems = useMemo(() => {
    const live = workflows
      .filter((w) => ["assignment_submission", "exam_submission"].includes(w.workflow_type))
      .slice(0, 6)
      .map((w, idx) => ({
        id: w.id || `SG-LIVE-${idx + 1}`,
        group: String(w.metadata?.subgroup_id || "Subgroup queue"),
        course: String(w.course_id || w.metadata?.course || "Course"),
        item: String(w.title || w.workflow_type || "Submission review"),
        submissions: Number(w.metadata?.submission_count || 0),
        status: String(w.status || "Pending"),
      }));
    if (live.length) return live;
    return [
      { id: "SG-101", group: "CSC Year 3 - Group A", course: "CSC 301", item: "Assignment submission review", submissions: 18, status: "Pending" },
      { id: "SG-102", group: "BED Arts - Group B", course: "EDU 214", item: "Exam script moderation", submissions: 42, status: "In review" },
      { id: "SG-103", group: "BCOM Year 2 - Group C", course: "BUS 204", item: "Rubric scoring draft", submissions: 26, status: "Pending" },
    ];
  }, [workflows]);

  const subgroupActions = [
    { label: "Open subgroup queue", onClick: () => { setModal("queue"); onOpenWorkflows?.(); } },
    { label: "Review assignment submissions", onClick: () => { setModal("review"); onOpenWorkflows?.(); } },
    { label: "Audit subgroup activity", onClick: () => { setModal("audit"); onOpenAudit?.(); } },
  ];

  const subgroupMenuItems = [
    {
      key: "queue",
      label: "Queue Actions",
      children: [
        { key: "open-queue", label: "Open subgroup queue", onClick: () => setModal("queue") },
        { key: "review-submissions", label: "Review assignment submissions", onClick: () => setModal("review") },
      ],
    },
    { type: "separator" },
    {
      key: "audit",
      label: "Audit & Oversight",
      children: [
        { key: "audit-activity", label: "Audit subgroup activity", onClick: () => setModal("audit") },
        { key: "notif-center", label: "Open review notifications", onClick: () => setModal("notifications") },
      ],
    },
  ];

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Subgroups"
          subtitle="Supervise academic subgroup activity, review submissions, and monitor controlled communication."
          stats={[
            { label: "Active subgroups", value: "28", note: "Across current department scope" },
            { label: "Pending submissions", value: "41", note: "Awaiting review or moderation" },
            { label: "Reviewer queue", value: "12", note: "Needs administrative attention" },
          ]}
          actions={subgroupActions}
          highlights={[
            "Rubric reviews remain pending for 3 subgroup queues.",
            "Communication remains supervised and locked by default.",
            "One assessment queue may require dean-level escalation soon.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Subgroup Operations</div>
              <div className="text-sm text-slate-500">
                Manage review queues, supervised AI marking drafts, and subgroup activity tracking.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModal("queue")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ClipboardList size={16} />
                Queue
              </button>

              <button
                type="button"
                onClick={() => setModal("review")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileCheck2 size={16} />
                Review
              </button>

              <AdminActionMenu label="Quick Actions" items={subgroupMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Live Queue Snapshot</div>
              <div className="mt-3 space-y-3">
                {queueItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedQueueItem(item);
                      setModal("queue-detail");
                    }}
                    className="block w-full rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-800">{item.group}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.course} - {item.item}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">{item.submissions} submissions</div>
                        <div className="mt-1 text-xs text-slate-500">{item.status}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Administrative Focus</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldCheck size={16} />
                    Supervised AI Marking
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    AI may prepare draft scoring support, but final academic judgment stays with human reviewers.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <MessageSquareWarning size={16} />
                    Controlled Communication
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Student-lecturer communication remains blocked unless explicitly unlocked by authorized admin flow.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <BellRing size={16} />
                    Review Notifications
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Submission and moderation alerts are prioritized for active subgroup queues.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "queue"} title="Open Subgroup Queue" onClose={() => setModal(null)}>
        <div className="space-y-3">
          {queueItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{item.group}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.course} • {item.item}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQueueItem(item);
                    setModal("queue-detail");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "queue-detail"} title="Subgroup Queue Detail" onClose={() => setModal(null)}>
        {selectedQueueItem ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-medium text-slate-800">{selectedQueueItem.group}</div>
              <div className="mt-1 text-sm text-slate-500">
                {selectedQueueItem.course} • {selectedQueueItem.item}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Submissions</div>
                <div className="mt-1 text-xl font-semibold text-slate-800">{selectedQueueItem.submissions}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1 text-xl font-semibold text-slate-800">{selectedQueueItem.status}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Review mode</div>
                <div className="mt-1 text-xl font-semibold text-slate-800">Supervised</div>
              </div>
            </div>
          </div>
        ) : null}
      </AdminMiniModal>

      <AdminMiniModal open={modal === "review"} title="Review Assignment Submissions" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">AI draft marking support</div>
            <div className="mt-1 text-sm text-slate-500">
              AI may suggest rubric-aligned draft feedback and provisional notes. Final scoring remains under human supervision.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">Pending review notifications</div>
            <div className="mt-1 text-sm text-slate-500">7 queues currently need lecturer or reviewer attention.</div>
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "audit"} title="Audit Subgroup Activity" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            Recent subgroup events show controlled communication, active submission reviews, and no unauthorized grading actions.
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            One subgroup queue has repeated turnaround delays and may need department follow-up.
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "notifications"} title="Review Notifications" onClose={() => setModal(null)}>
        <div className="space-y-3">
          {[
            "CSC Year 3 Group A - new submissions added",
            "EDU 214 - moderation notes updated",
            "BUS 204 - reviewer action overdue",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </AdminMiniModal>
    </>
  );
}

function UserManagementPanel() {
  const [modal, setModal] = useState(null);

  const inviteMenuItems = [
    { key: "create-link", label: "Create Link", onClick: () => setModal("create-link") },
    { key: "share", label: "Share", onClick: () => setModal("share") },
    { key: "email", label: "Email", onClick: () => setModal("email") },
    { key: "sms", label: "SMS", onClick: () => setModal("sms") },
  ];

  const users = useMemo(
    () => [
      { name: "Dr. Mutiso", role: "Lecturer", status: "Active", area: "Academic Results" },
      { name: "Ms. Ndinda", role: "Department Officer", status: "Pending Invite", area: "Operations" },
      { name: "Mr. Kilonzo", role: "Staff", status: "Active", area: "Attendance" },
      { name: "Prof. Mumo", role: "Department Head", status: "Active", area: "Whole Department" },
    ],
    []
  );

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="User Management"
          subtitle="Manage department members, review role updates, issue access keys, and supervise account status."
          stats={[
            { label: "Department users", value: "128", note: "Current active members" },
            { label: "Accepted invites", value: "26", note: "Included in active access count" },
            { label: "Role changes", value: "9", note: "Awaiting or recently updated" },
          ]}
          actions={[
            { label: "Invite staff", onClick: () => setModal("invite") },
            { label: "Review role updates", onClick: () => setModal("role-updates") },
            { label: "Suspend account", onClick: () => setModal("suspend") },
          ]}
          highlights={[
            "Invite acceptance automatically increases active department membership.",
            "Suspended accounts should invalidate department access and issued path continuity.",
            "Role changes remain visible to authorized director/dean oversight.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Department Members</div>
              <div className="text-sm text-slate-500">
                View users, roles, invitation state, and account supervision actions.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModal("invite")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserPlus size={16} />
                Invite staff
              </button>

              <button
                type="button"
                onClick={() => setModal("role-updates")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserCog size={16} />
                Role updates
              </button>

              <AdminActionMenu label="Invite Actions" items={inviteMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Users size={16} />
                Member Overview
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={`${user.name}-${user.role}`} className="border-b border-slate-50">
                        <td className="py-3 pr-4 font-medium text-slate-800">{user.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{user.role}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              user.status === "Active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700",
                            ].join(" ")}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600">{user.area}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Administrative Notes</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Link2 size={16} />
                    Access Keys
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Invite links/keys are the controlled entry method for department membership.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldAlert size={16} />
                    Suspension Logic
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    When an account is suspended, department access should be revoked and the access path invalidated.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <BookOpen size={16} />
                    Role Visibility
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Directors/deans can see broader role coverage, while scoped users only see their permitted view.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "invite"} title="Invite Staff" onClose={() => setModal(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">Create department access invitation</div>
            <div className="mt-1 text-sm text-slate-500">
              This will later generate the controlled department access key/link used for onboarding staff and lecturers.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300" placeholder="Full name" />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300" placeholder="Institution email" />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300" placeholder="Phone number" />
            <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300">
              <option>Lecturer</option>
              <option>Staff</option>
              <option>Department Officer</option>
            </select>
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "create-link"} title="Create Access Link" onClose={() => setModal(null)}>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="font-medium text-slate-800">Department access link/key</div>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Placeholder: secure single-use access link will be generated here after executive wiring.
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "share"} title="Share Invite" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">Share flow placeholder for secure invite key/link distribution.</div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "email"} title="Email Invite" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">Email flow placeholder for department invite delivery.</div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "sms"} title="SMS Invite" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">SMS flow placeholder for controlled invite delivery.</div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "role-updates"} title="Review Role Updates" onClose={() => setModal(null)}>
        <div className="space-y-3">
          {[
            "Lecturer role request pending confirmation",
            "Department officer reassignment requires approval",
            "One staff member pending privileges downgrade",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "suspend"} title="Suspend Account" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-rose-800 font-medium">
              <UserX size={16} />
              Account suspension is a sensitive action
            </div>
            <div className="mt-1 text-sm text-rose-700">
              Suspension should disable department access and invalidate the active access path until authorized restoration.
            </div>
          </div>
        </div>
      </AdminMiniModal>
    </>
  );
}

function AnnouncementControlPanel() {
  const [modal, setModal] = useState(null);
  const [announcementType, setAnnouncementType] = useState("general");

  const announcementMenuItems = [
    {
      key: "create",
      label: "Create Announcement",
      children: [
        {
          key: "general",
          label: "General",
          onClick: () => {
            setAnnouncementType("general");
            setModal("create");
          },
        },
        {
          key: "departmental",
          label: "Departmental",
          onClick: () => {
            setAnnouncementType("departmental");
            setModal("create");
          },
        },
        {
          key: "student",
          label: "Student",
          onClick: () => {
            setAnnouncementType("student");
            setModal("create");
          },
        },
      ],
    },
    { type: "separator" },
    {
      key: "delivery",
      label: "Delivery",
      children: [
        { key: "email", label: "Send by email", onClick: () => setModal("email") },
        { key: "app", label: "Send app notification", onClick: () => setModal("app") },
      ],
    },
  ];

  const recentAnnouncements = useMemo(
    () => [
      { title: "Results review deadline reminder", audience: "Lecturers", delivery: "Email + App", status: "Sent" },
      { title: "Department meeting update", audience: "Departmental", delivery: "App", status: "Draft" },
      { title: "Student registration advisory", audience: "Students", delivery: "Email + App", status: "Scheduled" },
    ],
    []
  );

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Announcement Control"
          subtitle="Draft, review, and distribute announcements to general, departmental, or student audiences."
          stats={[
            { label: "Announcements sent", value: "18", note: "This month" },
            { label: "Drafts", value: "4", note: "Awaiting review" },
            { label: "Scheduled", value: "3", note: "Pending release" },
          ]}
          actions={[
            { label: "Create general announcement", onClick: () => { setAnnouncementType("general"); setModal("create"); } },
            { label: "Create departmental announcement", onClick: () => { setAnnouncementType("departmental"); setModal("create"); } },
            { label: "Create student announcement", onClick: () => { setAnnouncementType("student"); setModal("create"); } },
          ]}
          highlights={[
            "Student announcements should reach both email and app notifications.",
            "Departmental announcements can stay within scoped operational audiences.",
            "Draft review should happen before sensitive institutional notices are sent.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Announcement Workspace</div>
              <div className="text-sm text-slate-500">
                Manage audience targeting, delivery channels, and recent announcement activity.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setAnnouncementType("general"); setModal("create"); }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Megaphone size={16} />
                Create
              </button>
              <AdminActionMenu label="Announcement Actions" items={announcementMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Recent Announcements</div>
              <div className="mt-3 space-y-3">
                {recentAnnouncements.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-800">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.audience} • {item.delivery}
                        </div>
                      </div>
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          item.status === "Sent"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "Scheduled"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Delivery Guidance</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Mail size={16} />
                    Email delivery
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Use email for formal notices, student-wide updates, and records that should remain traceable.
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Bell size={16} />
                    App notifications
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Use app notifications for fast delivery and urgent operational updates.
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldCheck size={16} />
                    Audience control
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Keep departmental and student messages intentionally scoped to the correct audience.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "create"} title="Create Announcement" onClose={() => setModal(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Announcement type</div>
            <div className="mt-1 text-lg font-semibold text-slate-800 capitalize">{announcementType}</div>
          </div>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300" placeholder="Announcement title" />
          <textarea rows={7} className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-300" placeholder="Write the announcement message..." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Mail size={16} />
              Send to email
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Bell size={16} />
              Send to app notifications
            </button>
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "email"} title="Email Delivery" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          Email announcement delivery flow placeholder. This should later connect to student/staff/department audience delivery logic.
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "app"} title="App Notification Delivery" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          App notification delivery flow placeholder for student and department audience targeting.
        </div>
      </AdminMiniModal>
    </>
  );
}

function AuditLogsPanel() {
  const [modal, setModal] = useState(null);
  const [filterText, setFilterText] = useState("");

  const logs = useMemo(
    () => [
      {
        actor: "Prof. Mumo",
        action: "Approved results release",
        target: "BSC CSC Semester 2",
        level: "High",
        time: "Today • 10:24 AM",
      },
      {
        actor: "Dr. Mutiso",
        action: "Reviewed subgroup submissions",
        target: "CSC 301 Group A",
        level: "Medium",
        time: "Today • 9:05 AM",
      },
      {
        actor: "Admin Officer",
        action: "Created department invite link",
        target: "Lecturer onboarding",
        level: "Medium",
        time: "Yesterday • 4:18 PM",
      },
      {
        actor: "System",
        action: "Communication unlock attempted",
        target: "Student-Lecturer channel",
        level: "High",
        time: "Yesterday • 1:50 PM",
      },
    ],
    []
  );

  const filteredLogs = logs.filter((log) =>
    [log.actor, log.action, log.target, log.level, log.time]
      .join(" ")
      .toLowerCase()
      .includes(filterText.toLowerCase())
  );

  const auditMenuItems = [
    {
      key: "filters",
      label: "Filters",
      children: [
        { key: "high", label: "High-level actions", onClick: () => setFilterText("high") },
        { key: "today", label: "Today", onClick: () => setFilterText("today") },
        { key: "approvals", label: "Approvals", onClick: () => setFilterText("approved") },
      ],
    },
    { type: "separator" },
    {
      key: "review",
      label: "Review",
      children: [
        { key: "suspicious", label: "Suspicious activity", onClick: () => setModal("suspicious") },
        { key: "history", label: "Export audit history", onClick: () => setModal("export") },
      ],
    },
  ];

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Audit Logs"
          subtitle="Track administrative actions, sensitive operations, and institutional accountability trails."
          stats={[
            { label: "Recent actions", value: "184", note: "Last 7 days" },
            { label: "High-level events", value: "19", note: "Requires closer review" },
            { label: "Flagged activity", value: "3", note: "Needs human confirmation" },
          ]}
          actions={[
            { label: "Review suspicious activity", onClick: () => setModal("suspicious") },
            { label: "Export audit history", onClick: () => setModal("export") },
          ]}
          highlights={[
            "Sensitive approvals should remain easily traceable.",
            "Communication unlock attempts should be visible for governance review.",
            "Audit records help protect institutional accountability.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Audit Activity</div>
              <div className="text-sm text-slate-500">
                Review system and human actions across workflows, communications, and approvals.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Search logs..."
                  className="rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-300"
                />
              </div>

              <AdminActionMenu label="Audit Actions" items={auditMenuItems} align="right" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <History size={16} />
                Recent Audit Trail
              </div>

              <div className="mt-3 space-y-3">
                {filteredLogs.map((log, index) => (
                  <div key={`${log.actor}-${log.time}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-800">{log.action}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {log.actor} • {log.target}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            log.level === "High"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          {log.level}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">{log.time}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredLogs.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No audit entries matched your current search.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Oversight Notes</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldAlert size={16} />
                    Sensitive actions
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Result approvals, communication unlocks, and account suspensions should remain clearly auditable.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Eye size={16} />
                    Review visibility
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Directors and department heads can use this view to identify operational risks and unusual actions.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldCheck size={16} />
                    Governance
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Audit logs protect accountability and support institutional reporting.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "suspicious"} title="Suspicious Activity Review" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="font-medium text-rose-800">Communication unlock attempted outside normal review flow</div>
            <div className="mt-1 text-sm text-rose-700">
              Human review is required before treating this as misconduct or escalation.
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-medium text-amber-800">Repeated delay pattern detected</div>
            <div className="mt-1 text-sm text-amber-700">
              This may need dean/director attention if the pattern continues.
            </div>
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "export"} title="Export Audit History" onClose={() => setModal(null)}>
        <div className="space-y-3">
          {["CSV export", "PDF compliance report", "Board-ready summary", "Print current filtered logs"].map((item) => (
            <button
              key={item}
              type="button"
              className="block w-full rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
            >
              <div className="font-medium text-slate-800">{item}</div>
              <div className="mt-1 text-sm text-slate-500">
                Export-ready placeholder for audit reporting workflows.
              </div>
            </button>
          ))}
        </div>
      </AdminMiniModal>
    </>
  );
}

function SettingsPanel({
  settingsData = null,
  loading = false,
  error = "",
  onReload,
  onSave,
  saveState = "idle",
  saveMessage = "",
}) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    departmentName: "Academic Results Department",
    institutionName: "ElimuLink University",
    notificationEmail: "admin@elimulink.ac.ke",
    language: "English",
    communicationLockedByDefault: true,
    aiDraftMode: true,
    weeklyReports: true,
  });

  useEffect(() => {
    if (!settingsData) return;
    setForm((prev) => ({
      ...prev,
      departmentName: settingsData?.institution?.departmentName || prev.departmentName,
      institutionName: settingsData?.institution?.name || prev.institutionName,
      notificationEmail: settingsData?.integrations?.smtpFrom || prev.notificationEmail,
      communicationLockedByDefault: !(settingsData?.communication?.studentLecturerMessagingEnabled === true),
      aiDraftMode: settingsData?.ai?.aiEnabled ?? prev.aiDraftMode,
    }));
  }, [settingsData]);

  const settingsMenuItems = [
    { key: "notifications", label: "Notifications", onClick: () => setModal("notifications") },
    { key: "security", label: "Security", onClick: () => setModal("security") },
    { key: "preferences", label: "Preferences", onClick: () => setModal("preferences") },
  ];

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div className="space-y-5">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading admin settings...</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
            <button type="button" onClick={() => onReload?.()} className="ml-3 rounded-lg border border-rose-200 px-2 py-1 text-xs">Retry</button>
          </div>
        ) : null}
        {saveState === "success" && saveMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{saveMessage}</div>
        ) : null}

        <AdminStarterPanel
          title="Settings"
          subtitle="Configure department behavior, communication defaults, notifications, and administrative preferences."
          stats={[
            { label: "Security mode", value: "Protected", note: "Controlled administrative access" },
            { label: "AI draft mode", value: form.aiDraftMode ? "Enabled" : "Disabled", note: "Human approval still required" },
            { label: "Reports", value: form.weeklyReports ? "Weekly" : "Manual", note: "Operational reporting cadence" },
          ]}
          actions={[
            { label: "Notification settings", onClick: () => setModal("notifications") },
            { label: "Security options", onClick: () => setModal("security") },
            {
              label: "Save settings",
              onClick: async () => {
                await onSave?.({
                  institution: { departmentName: form.departmentName },
                  integrations: { smtpFrom: form.notificationEmail },
                  communication: { studentLecturerMessagingEnabled: !form.communicationLockedByDefault },
                  ai: { aiEnabled: form.aiDraftMode },
                });
                setModal("save");
              },
            },
          ]}
          highlights={[
            "Communication should remain locked by default unless explicitly allowed.",
            "AI should stay in supervised draft mode for sensitive institutional actions.",
            "Administrative settings should remain scoped to department context.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Department Settings</div>
              <div className="text-sm text-slate-500">
                Review institution identity, communication defaults, AI behavior, and reporting preferences.
              </div>
            </div>

            <AdminActionMenu label="Settings Actions" items={settingsMenuItems} align="right" />
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">General Configuration</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-sm text-slate-500">Department name</div>
                  <input
                    value={form.departmentName}
                    onChange={(e) => updateField("departmentName", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm text-slate-500">Institution</div>
                  <input
                    value={form.institutionName}
                    onChange={(e) => updateField("institutionName", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-sm text-slate-500">Notification email</div>
                  <input
                    value={form.notificationEmail}
                    onChange={(e) => updateField("notificationEmail", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm text-slate-500">Language</div>
                  <select
                    value={form.language}
                    onChange={(e) => updateField("language", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  >
                    <option>English</option>
                    <option>Swahili</option>
                  </select>
                </label>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Communication locked by default</div>
                    <div className="text-xs text-slate-500">Student-lecturer communication requires explicit admin action.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.communicationLockedByDefault}
                    onChange={(e) => updateField("communicationLockedByDefault", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">AI draft mode</div>
                    <div className="text-xs text-slate-500">AI may suggest, summarize, and draft, but not finalize sensitive actions.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.aiDraftMode}
                    onChange={(e) => updateField("aiDraftMode", e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Weekly reports</div>
                    <div className="text-xs text-slate-500">Department-level report generation cadence.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.weeklyReports}
                    onChange={(e) => updateField("weeklyReports", e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Administrative Notes</div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Lock size={16} />
                  Governance
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Sensitive institutional actions should remain human-approved even when AI assistance is enabled.
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Bell size={16} />
                  Notifications
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Configure how operational alerts and department notices reach admins and reviewers.
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <ShieldCheck size={16} />
                  Department Scope
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Settings should apply within the current department context and later be governed by executive configuration.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "notifications"} title="Notification Settings" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">Email notifications</div>
            <div className="mt-1 text-sm text-slate-500">
              Enable operational alerts, review notices, and report delivery to departmental email endpoints.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">App notifications</div>
            <div className="mt-1 text-sm text-slate-500">
              Use in-app delivery for urgent workflow and attendance/result events.
            </div>
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "security"} title="Security Settings" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          Security settings placeholder for role restrictions, invite policy, and access behavior. This can later connect to executive-issued department access rules.
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "preferences"} title="Administrative Preferences" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          Preferences placeholder for administrative layout, language, report cadence, and workspace behavior.
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "save"} title="Save Settings" onClose={() => setModal(null)}>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <Save size={16} />
            Settings draft ready
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Persisted now: department name, notification email source, communication lock default, and AI draft mode.
            Frontend-only for now: institution display name, language, and weekly reports cadence.
          </div>
        </div>
      </AdminMiniModal>
    </>
  );
}

function ProfilePanel({ settingsData = null }) {
  const [modal, setModal] = useState(null);

  const profileActions = [
    { key: "account", label: "Account details", onClick: () => setModal("account") },
    { key: "role", label: "Role summary", onClick: () => setModal("role") },
    { key: "activity", label: "Recent activity", onClick: () => setModal("activity") },
  ];

  const profile = {
    name: settingsData?.profile?.name || "Prof. Mumo",
    role: "Department Head",
    department: settingsData?.institution?.departmentName || "Academic Results Department",
    institution: settingsData?.institution?.name || "ElimuLink University",
    email: settingsData?.profile?.email || "prof.mumo@elimulink.ac.ke",
    status: "Active",
  };

  const activity = useMemo(
    () => [
      "Reviewed pending result approvals",
      "Opened subgroup audit queue",
      "Generated department summary draft",
      "Checked workflow escalation items",
    ],
    []
  );

  return (
    <>
      <div className="space-y-5">
        <AdminStarterPanel
          title="Profile"
          subtitle="View your administrative identity, role scope, and recent operational activity."
          stats={[
            { label: "Role", value: "Department Head", note: "Current active administrative scope" },
            { label: "Department", value: "Academic Results", note: "Primary workspace context" },
            { label: "Status", value: "Active", note: "Account is currently enabled" },
          ]}
          actions={[
            { label: "View account details", onClick: () => setModal("account") },
            { label: "Open role summary", onClick: () => setModal("role") },
            { label: "Recent activity", onClick: () => setModal("activity") },
          ]}
          highlights={[
            "Role outputs differ by dean/director, lecturer, and staff scope.",
            "Department membership should later be resolved through executive-issued access keys.",
            "Profile should remain professional, scoped, and audit-friendly.",
          ]}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Administrative Profile</div>
              <div className="text-sm text-slate-500">
                Review account identity, role scope, department placement, and operational footprint.
              </div>
            </div>

            <AdminActionMenu label="Profile Actions" items={profileActions} align="right" />
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <UserCircle2 size={28} />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{profile.name}</div>
                  <div className="text-sm text-slate-500">{profile.role}</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Building2 size={16} />
                    Institution
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{profile.institution}</div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Briefcase size={16} />
                    Department
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{profile.department}</div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Mail size={16} />
                    Email
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{profile.email}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700">Role Scope & Activity</div>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <ShieldCheck size={16} />
                    Administrative scope
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    This role can review department-wide analytics, reports, workflows, and supervised AI outputs.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <SlidersHorizontal size={16} />
                    Role visibility
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Dean/director roles can view wider department outputs than lecturer and staff roles.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-800">Recent activity</div>
                  <div className="mt-2 space-y-2">
                    {activity.map((item) => (
                      <div key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminMiniModal open={modal === "account"} title="Account Details" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-slate-800">{profile.name}</div>
            <div className="mt-1 text-sm text-slate-500">{profile.email}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            Department-linked account details will later be reinforced by executive-issued access key activation.
          </div>
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "role"} title="Role Summary" onClose={() => setModal(null)}>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          As a department head/director role, this account may access department-wide analytics, workflow oversight, role review, reports, and supervised governance actions.
        </div>
      </AdminMiniModal>

      <AdminMiniModal open={modal === "activity"} title="Recent Activity" onClose={() => setModal(null)}>
        <div className="space-y-3">
          {activity.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </AdminMiniModal>
    </>
  );
}

export default function AdminAnalyticsLanding({ userRole }) {
  const [active, setActive] = useState("analytics");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [workflowQuery, setWorkflowQuery] = useState("");
  const [error, setError] = useState("");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ workflow_type: "fee_issue", title: "", description: "", priority: "normal" });
  const [selectedRubricId, setSelectedRubricId] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [draft, setDraft] = useState(null);
  const [decision, setDecision] = useState({ action: "save_draft", final_score: "", override_notes: "" });
  const [adminSettings, setAdminSettings] = useState(null);
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
  const [adminSettingsError, setAdminSettingsError] = useState("");
  const [adminSettingsSaveState, setAdminSettingsSaveState] = useState("idle");
  const [adminSettingsSaveMessage, setAdminSettingsSaveMessage] = useState("");
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");

  const role = String(userRole || "institution_admin").toLowerCase();
  const effectiveDept = role.includes("lecturer") ? "academic_results" : "fees";
  const actorId = auth?.currentUser?.uid || "admin-local";
  const allItems = useMemo(() => GROUPS.flatMap((g) => g.items), []);
  const pageTitle = allItems.find((i) => i[0] === active)?.[1] || "Analytics";
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter(([, l]) => l.toLowerCase().includes(q)) })).filter((g) => g.items.length);
  }, [search]);
  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter(([, l]) => l.toLowerCase().includes(q)).slice(0, 6);
  }, [search, allItems]);
  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || null;
  const filteredWorkflows = useMemo(() => workflows.filter((w) => (!departmentFilter || w.department === departmentFilter) && (!statusFilter || w.status === statusFilter) && (!typeFilter || w.workflow_type === typeFilter) && (!workflowQuery.trim() || `${w.title || ""} ${w.description || ""}`.toLowerCase().includes(workflowQuery.toLowerCase()))), [workflows, departmentFilter, statusFilter, typeFilter, workflowQuery]);
  const subgroupItems = useMemo(() => workflows.filter((w) => ["assignment_submission", "exam_submission"].includes(w.workflow_type)), [workflows]);
  const summary = useMemo(() => ({ total: workflows.length, pending: workflows.filter((w) => w.status === "pending_approval").length, review: workflows.filter((w) => w.status === "in_review").length, resolved: workflows.filter((w) => w.status === "resolved").length, comm: workflows.filter((w) => w.communication_unlocked).length }), [workflows]);
  const analyticsKpi = useMemo(() => {
    if (!analyticsSummary) return KPI;
    return [
      ["Enrollment KPI", String(analyticsSummary?.enrollment?.value ?? "12,542")],
      ["GPA KPI", String(analyticsSummary?.avgGpa?.value ?? "3.52")],
      ["Attendance KPI", "84%"],
      ["At-risk Students", String(summary.pending || 0)],
    ];
  }, [analyticsSummary, summary.pending]);

  async function loadWorkflowData() {
    setWorkflowLoading(true);
    setError("");
    try {
      const [ws, rs] = await Promise.all([listWorkflows({}), listRubrics({ departmentId: effectiveDept }).catch(() => [])]);
      const safe = Array.isArray(ws) ? ws : [];
      setWorkflows(safe);
      setRubrics(Array.isArray(rs) ? rs : []);
      if (!selectedWorkflowId && safe[0]?.id) setSelectedWorkflowId(safe[0].id);
    } catch (e) { setError(String(e?.message || "Load failed")); }
    finally { setWorkflowLoading(false); }
  }
  useEffect(() => { if (["analytics", "workflows", "results", "subgroups", "attendance"].includes(active)) void loadWorkflowData(); }, [active, effectiveDept]);
  useEffect(() => {
    if (active !== "analytics") return;
    let alive = true;
    (async () => {
      setAnalyticsError("");
      try {
        const data = await getAdminAnalyticsSummary();
        if (!alive) return;
        setAnalyticsSummary(data || null);
      } catch (e) {
        if (!alive) return;
        setAnalyticsError(String(e?.message || "Failed to load analytics summary"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [active]);
  useEffect(() => {
    if (!["settings", "profile"].includes(active)) return;
    let alive = true;
    (async () => {
      setAdminSettingsLoading(true);
      setAdminSettingsError("");
      try {
        const settings = await getAdminSettings();
        if (!alive) return;
        setAdminSettings(settings || {});
      } catch (e) {
        if (!alive) return;
        setAdminSettingsError(String(e?.message || "Failed to load admin settings"));
      } finally {
        if (alive) setAdminSettingsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [active]);

  async function saveAdminSettings(updatePayload) {
    setAdminSettingsSaveState("saving");
    setAdminSettingsSaveMessage("");
    setAdminSettingsError("");
    try {
      const updated = await putAdminSettings(updatePayload);
      setAdminSettings(updated || {});
      setAdminSettingsSaveState("success");
      setAdminSettingsSaveMessage("Settings saved successfully.");
    } catch (e) {
      setAdminSettingsSaveState("error");
      setAdminSettingsError(String(e?.message || "Failed to save settings"));
    }
  }
  async function createItem(payload) { setBusy(true); setError(""); try { await createWorkflow({ ...payload, created_by: actorId, created_by_role: role }); await loadWorkflowData(); } catch (e) { setError(String(e?.message || "Create failed")); } finally { setBusy(false); } }
  async function act(name) {
    if (!selectedWorkflow) return;
    setBusy(true);
    setError("");
    try {
      const p = { actor_id: actorId, actor_role: role, note: name };
      if (name === "review") await moveWorkflowToReview(selectedWorkflow.id, p);
      if (name === "request_approval") await requestWorkflowApproval(selectedWorkflow.id, p);
      if (name === "approve") await approveWorkflow(selectedWorkflow.id, p);
      if (name === "reject") await rejectWorkflow(selectedWorkflow.id, p);
      if (name === "resolve") await resolveWorkflow(selectedWorkflow.id, p);
      await loadWorkflowData();
    } catch (e) {
      setError(String(e?.message || "Workflow action failed"));
    } finally {
      setBusy(false);
    }
  }
  async function toggleComm(unlocked) {
    if (!selectedWorkflow) return;
    setBusy(true);
    setError("");
    try {
      await setWorkflowCommunication(selectedWorkflow.id, { actor_id: actorId, actor_role: role, unlocked, note: unlocked ? "unlock" : "lock" });
      await loadWorkflowData();
    } catch (e) {
      setError(String(e?.message || "Communication update failed"));
    } finally {
      setBusy(false);
    }
  }
  async function attachRubric() {
    if (!selectedWorkflow || !selectedRubricId) return;
    setBusy(true);
    setError("");
    try {
      await attachWorkflowRubric(selectedWorkflow.id, { actor_id: actorId, actor_role: role, rubric_id: selectedRubricId, subgroup_id: selectedWorkflow?.metadata?.subgroup_id || "subgroup-csc-202", assessment_type: selectedWorkflow.workflow_type });
      await loadWorkflowData();
    } catch (e) {
      setError(String(e?.message || "Attach rubric failed"));
    } finally {
      setBusy(false);
    }
  }
  async function evalDraft() {
    if (!selectedWorkflow) return;
    setBusy(true);
    setError("");
    try {
      const d = await evaluateWorkflowDraft(selectedWorkflow.id, { actor_id: actorId, actor_role: role, submission_text: submissionText || selectedWorkflow.description || "" });
      setDraft(d);
    } catch (e) {
      setError(String(e?.message || "Draft evaluation failed"));
    } finally {
      setBusy(false);
    }
  }
  async function saveDecision() {
    if (!selectedWorkflow || !draft) return;
    setBusy(true);
    setError("");
    try {
      const marks = {};
      const feedback = {};
      for (const c of draft.criterion_suggestions || []) {
        marks[c.criterion_id] = c.suggested_mark_max;
        feedback[c.criterion_id] = c.draft_feedback;
      }
      await saveWorkflowReviewerDecision(selectedWorkflow.id, { actor_id: actorId, actor_role: role, criterion_marks: marks, criterion_feedback: feedback, final_score: decision.final_score === "" ? null : Number(decision.final_score), override_notes: decision.override_notes || null, action: decision.action });
      await loadWorkflowData();
    } catch (e) {
      setError(String(e?.message || "Save reviewer decision failed"));
    } finally {
      setBusy(false);
    }
  }

  const resultsMenuItems = [{ key: "pending", label: "Review pending approvals", onClick: () => setActive("workflows") }, { key: "missing", label: "View missing marks", onClick: () => setWorkflowQuery("missing") }, { key: "summary", label: "Generate review summary", onClick: () => setActive("analytics") }, { key: "export", label: "Export results snapshot", onClick: () => console.log("export results") }];
  const subgroupMenuItems = [{ key: "queue", label: "Open subgroup queue", onClick: () => setActive("workflows") }, { key: "review", label: "Review assignment submissions", onClick: () => setActive("workflows") }, { key: "audit", label: "Audit subgroup activity", onClick: () => setActive("audit") }];
  const attendanceMenuItems = [{ key: "new", label: "New", children: [{ key: "new-doc", label: "Documents", onClick: () => console.log("New document") }, { key: "new-template", label: "From a template", onClick: () => console.log("From template") }] }, { type: "separator" }, { key: "copy", label: "Make a copy", onClick: () => console.log("copy") }, { key: "share", label: "Share", children: [{ key: "share-others", label: "Share to others", onClick: () => console.log("share") }, { key: "publish-web", label: "Publish to web", onClick: () => console.log("publish") }] }, { key: "email", label: "Email", children: [{ key: "email-file", label: "Email this file", onClick: () => console.log("email file") }, { key: "email-collab", label: "Email collaborators", onClick: () => console.log("email collab") }] }, { key: "rename", label: "Rename", onClick: () => console.log("rename") }, { key: "move", label: "Move", children: [{ key: "move-notebook", label: "notebook", onClick: () => console.log("move notebook") }, { key: "move-newchat", label: "newchat", onClick: () => console.log("move newchat") }] }, { key: "shortcut", label: "Add shortcut to Drive", onClick: () => console.log("shortcut") }, { key: "trash", label: "Move to trash", onClick: () => console.log("trash") }, { key: "page-setup", label: "Page setup", onClick: () => console.log("setup") }, { key: "print", label: "Print", onClick: () => console.log("print") }, { key: "language", label: "Language", onClick: () => console.log("language") }, { key: "security", label: "Security limitations", onClick: () => console.log("security") }, { key: "details", label: "Details", onClick: () => console.log("details") }];

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-100 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 py-2.5 md:px-6 md:py-3">
          <div className="hidden md:grid md:grid-cols-[180px_minmax(0,1fr)_200px] md:items-center md:gap-4">
            <div className="text-base font-semibold">{pageTitle}</div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admin modules..." className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none" />
              {searchMatches.length > 0 ? <div className="absolute left-0 right-0 top-11 z-20 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">{searchMatches.map(([key, label]) => <button key={key} onClick={() => { setActive(key); setSearch(""); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">{label}</button>)}</div> : null}
            </div>
            <div className="justify-self-end flex items-center gap-2">
              <button onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }} className="h-8 w-8 rounded-full border border-slate-200 bg-white grid place-items-center"><Bell size={15} /></button>
              <button onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }} className="h-8 w-8 rounded-full border border-slate-200 bg-white grid place-items-center text-xs font-semibold">A</button>
            </div>
          </div>
          {notifOpen ? <div className="absolute right-3 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg md:right-6"><div className="rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><div className="font-semibold">Pending approvals</div><div className="text-xs text-slate-500">2 workflow items waiting for approval.</div></div></div> : null}
          {profileOpen ? <div className="absolute right-3 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg md:right-6"><button onClick={() => { setActive("profile"); setProfileOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Profile</button><button onClick={() => { setActive("settings"); setProfileOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Settings</button><button onClick={() => { setProfileOpen(false); window.location.href = "/login?returnTo=%2Finstitution"; }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 inline-flex items-center gap-2"><LogOut size={14} />Logout</button></div> : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl overflow-hidden px-3 py-3 md:px-6 md:py-4" style={{ marginTop: `${HEADER_H}px`, height: `calc(100dvh - ${HEADER_H}px)` }}>
        <div className="grid h-full grid-cols-12 gap-4 md:gap-6">
          <aside className={`col-span-12 overflow-hidden ${sidebarCollapsed ? "lg:col-span-2" : "lg:col-span-3"}`}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
              <div className="border-b border-slate-200 px-3 py-2.5 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{sidebarCollapsed ? "Menu" : "Admin Modules"}</div><button onClick={() => setSidebarCollapsed((v) => !v)} className="hidden h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:inline-flex">{sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}</button></div>
              <nav className={["min-h-0 flex-1 overflow-y-auto p-3 space-y-3", mobileMenu ? "block" : "hidden lg:block"].join(" ")}>{filteredGroups.map((group) => <div key={group.title} className="space-y-1.5">{!sidebarCollapsed ? <div className="px-2 text-[10px] uppercase tracking-wide font-semibold text-slate-400">{group.title}</div> : null}{group.items.map(([key, label, Icon]) => <button key={key} onClick={() => { setActive(key); setMobileMenu(false); }} title={sidebarCollapsed ? label : undefined} className={["w-full rounded-xl border px-3 py-2 text-left text-sm transition", sidebarCollapsed ? "flex items-center justify-center px-2" : "", active === key ? "border-sky-500 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}><span className="inline-flex items-center gap-2"><Icon size={15} />{!sidebarCollapsed ? label : null}</span></button>)}</div>)}</nav>
            </div>
          </aside>

          <main className={`col-span-12 min-h-0 overflow-hidden ${sidebarCollapsed ? "lg:col-span-10" : "lg:col-span-9"}`}>
            <div className={["h-full rounded-2xl border border-slate-200 bg-white shadow-sm", active === "chat" ? "overflow-hidden p-0" : "overflow-y-auto p-4 space-y-4"].join(" ")}>
              {active === "analytics" ? <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{analyticsKpi.map(([l, v]) => <Card key={l} title={l} subtitle=""><div className="text-2xl font-bold">{v}</div></Card>)}</div>{analyticsError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{analyticsError}</div> : null}<Card title="Workflow Snapshot" subtitle="Operations at a glance"><div className="grid grid-cols-2 gap-2 md:grid-cols-3"><Summary label="Total" value={summary.total} Icon={ClipboardCheck} /><Summary label="Pending" value={summary.pending} Icon={Clock3} /><Summary label="In review" value={summary.review} Icon={FileCheck2} /><Summary label="Resolved" value={summary.resolved} Icon={ClipboardCheck} /><Summary label="Comm unlocked" value={summary.comm} Icon={ClipboardCheck} /></div></Card><Card title="Supervised AI Rule" subtitle="Human-in-the-loop safety"><div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{AI_RULE}</div></Card></> : null}
              {active === "chat" ? (
                <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <NewChatLanding
                    active="chat"
                    chatMode="admin"
                    embeddedInAdminShell
                    workspaceContext={{ scope: "admin", department: effectiveDept, role: role || "department_head", institution: "university" }}
                    userRole={userRole}
                    initialAssistantMessage={ADMIN_CHAT_GREETING}
                  />
                </div>
              ) : null}

              {active === "workflows" ? <><Card title="Workflow Dashboard" subtitle="Functional list/detail/action flow"><div className="grid grid-cols-1 gap-2 md:grid-cols-5"><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">All departments</option><option value="fees">fees</option><option value="academic_results">academic_results</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><input value={workflowQuery} onChange={(e) => setWorkflowQuery(e.target.value)} placeholder="Search workflow..." className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /><button onClick={() => loadWorkflowData()} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">Refresh</button></div><div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4"><select value={newWorkflow.workflow_type} onChange={(e) => setNewWorkflow((p) => ({ ...p, workflow_type: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><input value={newWorkflow.title} onChange={(e) => setNewWorkflow((p) => ({ ...p, title: e.target.value }))} placeholder="Workflow title" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /><input value={newWorkflow.description} onChange={(e) => setNewWorkflow((p) => ({ ...p, description: e.target.value }))} placeholder="Workflow description" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /><button disabled={busy} onClick={() => createItem({ workflow_type: newWorkflow.workflow_type, title: newWorkflow.title, description: newWorkflow.description, metadata: { priority: newWorkflow.priority } })} className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Create</button></div></Card>{workflowLoading ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Loading workflows...</div> : null}{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}<div className="grid grid-cols-1 gap-4 xl:grid-cols-12"><div className="xl:col-span-5"><Card title="Workflow list" subtitle={`${filteredWorkflows.length} items`}><div className="max-h-[520px] space-y-2 overflow-auto">{filteredWorkflows.map((w) => <button key={w.id} onClick={() => { setSelectedWorkflowId(w.id); setDraft(null); setSubmissionText(w.description || ""); }} className={["w-full rounded-xl border px-3 py-2 text-left", selectedWorkflowId === w.id ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"].join(" ")}><div className="truncate text-sm font-semibold">{w.title}</div><div className="mt-1 flex items-center gap-2"><Chip v={w.status} /><span className="text-[11px] text-slate-500">{w.department}</span></div></button>)}{filteredWorkflows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No workflows found.</div> : null}</div></Card></div><div className="xl:col-span-7"><Card title={selectedWorkflow?.title || "Workflow detail"} subtitle={selectedWorkflow ? `${selectedWorkflow.workflow_type} • ${selectedWorkflow.department}` : "Select workflow"}>{!selectedWorkflow ? <div className="text-sm text-slate-500">Select workflow from list.</div> : <div className="space-y-3"><div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{AI_RULE}</div><div className="grid grid-cols-2 gap-2 md:grid-cols-6"><button disabled={busy} onClick={() => act("review")} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:opacity-60">Review</button><button disabled={busy} onClick={() => act("request_approval")} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:opacity-60">Request approval</button><button disabled={busy} onClick={() => act("approve")} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:opacity-60">Approve</button><button disabled={busy} onClick={() => act("reject")} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:opacity-60">Reject</button><button disabled={busy} onClick={() => act("resolve")} className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:opacity-60">Resolve</button><button disabled={busy} onClick={() => toggleComm(!selectedWorkflow.communication_unlocked)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs disabled:opacity-60">{selectedWorkflow.communication_unlocked ? "Lock comm" : "Unlock comm"}</button></div>{["assignment_submission", "exam_submission"].includes(selectedWorkflow.workflow_type) ? <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold">Supervised AI draft marking</div><textarea value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} placeholder="Submission content..." className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /><div className="grid grid-cols-1 gap-2 md:grid-cols-3"><select value={selectedRubricId} onChange={(e) => setSelectedRubricId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select rubric</option>{rubrics.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select><button disabled={busy} onClick={attachRubric} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60">Attach rubric</button><button disabled={busy} onClick={evalDraft} className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Generate AI draft</button></div>{draft ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-slate-700">Suggested range: {draft.total_suggested_min} - {draft.total_suggested_max}</div> : null}<div className="grid grid-cols-1 gap-2 md:grid-cols-3"><select value={decision.action} onChange={(e) => setDecision((p) => ({ ...p, action: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="save_draft">save_draft</option><option value="finalize_later">finalize_later</option><option value="approve">approve</option><option value="reject">reject</option><option value="publish">publish</option></select><input value={decision.final_score} onChange={(e) => setDecision((p) => ({ ...p, final_score: e.target.value }))} placeholder="Final score" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /><button disabled={busy} onClick={saveDecision} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Save decision</button></div></div> : null}</div>}</Card></div></div></> : null}

              {active === "results" ? <ResultsManagementPanel workflows={workflows} onOpenWorkflows={() => setActive("workflows")} onOpenAnalytics={() => setActive("analytics")} /> : null}
              {active === "subgroups" ? <SubgroupsPanel workflows={workflows} onOpenWorkflows={() => setActive("workflows")} onOpenAudit={() => setActive("audit")} /> : null}
              {active === "attendance" ? <AttendanceMonitoringPanel /> : null}
              {active === "users" ? <UserManagementPanel /> : null}
              {active === "announcements" ? <AnnouncementControlPanel /> : null}
              {active === "audit" ? <AuditLogsPanel /> : null}
              {active === "settings" ? <SettingsPanel settingsData={adminSettings} loading={adminSettingsLoading} error={adminSettingsError} onReload={async () => { try { setAdminSettingsLoading(true); setAdminSettingsError(""); setAdminSettings(await getAdminSettings()); } catch (e) { setAdminSettingsError(String(e?.message || "Failed to load admin settings")); } finally { setAdminSettingsLoading(false); } }} onSave={saveAdminSettings} saveState={adminSettingsSaveState} saveMessage={adminSettingsSaveMessage} /> : null}
              {active === "profile" ? <ProfilePanel settingsData={adminSettings} /> : null}
              {["calendar"].includes(active) ? <AdminStarterPanel title={pageTitle} subtitle="Operational admin workspace module" stats={[{ label: "Open tasks", value: "12" }, { label: "Pending actions", value: "5" }, { label: "Recent updates", value: "9" }]} actions={[{ label: "Open workflow queue", onClick: () => setActive("workflows") }, { label: "Go to analytics", onClick: () => setActive("analytics") }]} highlights={["Module is active with practical starter actions", "Further deep workflows can be layered incrementally"]} /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
