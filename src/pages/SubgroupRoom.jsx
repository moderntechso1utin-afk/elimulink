import { useEffect, useRef, useState } from "react";
import {
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  Link2,
  Mail,
  MessagesSquare,
  NotebookText,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Share2,
  Pencil,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";
import NotebookPage from "./NotebookPage";
import { apiGet, apiPost } from "../lib/apiClient";
import { auth } from "../lib/firebase";
import { readScopedJson, writeScopedJson } from "../lib/userScopedStorage";

const leftNav = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "board", label: "Board", icon: KanbanSquare },
  { key: "notes", label: "Notes", icon: NotebookText },
  { key: "assignments", label: "Assignments", icon: ClipboardList },
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "members", label: "Members", icon: Users },
  { key: "admin", label: "Admin", icon: Shield },
  { key: "settings", label: "Settings", icon: Settings },
];
const RIGHT_PANEL_TABS = [
  { key: "chat", label: "Chat", icon: MessagesSquare },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "comments", label: "Comments", icon: NotebookText },
  { key: "activity", label: "Activity", icon: ClipboardList },
];

const GROUP_ASSIGNMENTS_STORAGE_PREFIX = "subgroup_assignments_v1_";
const GROUP_NOTES_FOLDERS_STORAGE_PREFIX = "subgroup_note_folders_v1_";
const GROUP_BOARD_STROKES_STORAGE_PREFIX = "subgroup_board_strokes_v1_";
const GROUP_BOARD_TYPING_STORAGE_PREFIX = "subgroup_board_typing_v1_";
const GROUP_CHAT_STORAGE_PREFIX = "subgroup_chat_v1_";
const GROUP_AI_THREAD_STORAGE_PREFIX = "subgroup_ai_thread_v1_";
const GROUP_COMMENTS_STORAGE_PREFIX = "subgroup_ai_comments_v1_";
const GROUP_ACTIVITY_STORAGE_PREFIX = "subgroup_activity_v1_";
const GROUP_JOIN_REQUESTS_STORAGE_PREFIX = "subgroup_join_requests_v1_";
const GROUP_ACCESS_DECISIONS_STORAGE_PREFIX = "subgroup_access_decisions_v1_";
const GROUP_REGISTRY_STORAGE_KEY = "subgroup_groups_registry_v1";
const INSTITUTION_NOTIFICATIONS_KEY = "institution_notifications_v1";
const MAX_PANEL_ITEMS = 120;
const INVITE_QUERY_PARAM = "subgroupInvite";
const DEFAULT_GROUP = {
  id: "grp_123",
  name: "CSC 202 - Study Group",
  course: "Computer Science",
  locked: false,
  role: "group_admin",
  visibility: "private",
  inviteCode: "ELI-1234",
  avatarUrl: "",
};
const DEFAULT_MEMBER_PERMISSIONS = {
  canUploadAssignments: true,
  canSaveNotes: true,
  canShareLinks: true,
};
const DEFAULT_MEMBERS = [
  {
    id: "mbr_alice",
    name: "Alice K.",
    email: "alice.k@students.seku.ac.ke",
    registrationNumber: "CSC/2023/001",
    status: "online",
    groupRole: "member",
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  },
  {
    id: "mbr_tony",
    name: "Tony M.",
    email: "tony.m@students.seku.ac.ke",
    registrationNumber: "CSC/2023/014",
    status: "online",
    groupRole: "member",
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  },
  {
    id: "mbr_sarah",
    name: "Sarah W.",
    email: "sarah.w@students.seku.ac.ke",
    registrationNumber: "CSC/2022/089",
    status: "away",
    groupRole: "member",
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  },
  {
    id: "mbr_matthew",
    name: "Matthew O.",
    email: "matthew.o@students.seku.ac.ke",
    registrationNumber: "CSC/2021/113",
    status: "offline",
    groupRole: "member",
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  },
];

function makeAssignmentId() {
  return `g-assg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultAssignments(ownerUid) {
  return [
    {
      id: makeAssignmentId(),
      ownerUid,
      title: "Group Assignment 1",
      description: "Compare sorting algorithms with examples from your course notes.",
      body: "Write a concise comparison of at least 3 sorting algorithms and include complexity analysis.",
      status: "saved",
      submittedTo: "",
      submittedBy: "",
      submittedByRole: "",
      submittedAt: 0,
      uploadedBy: "Alice",
      uploaderRole: "group_admin",
      createdAt: Date.now() - 1000 * 60 * 60 * 8,
      updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    },
  ];
}

function makeFolderId() {
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeNoteId() {
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeStrokeId() {
  return `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeMemberId() {
  return `mbr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeInviteCode() {
  return `ELI-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeActivityId() {
  return `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeJoinRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeText(value) {
  return String(value || "").trim();
}

function ownItem(item, ownerUid) {
  return { ...item, ownerUid: item?.ownerUid || ownerUid };
}

function normalizeOwnedList(items, ownerUid, normalizer) {
  if (!ownerUid || !Array.isArray(items)) return [];
  return items
    .map((item) => ownItem(item, ownerUid))
    .filter((item) => (item?.ownerUid || ownerUid) === ownerUid)
    .map((item) => normalizer(item))
    .filter(Boolean);
}

function withOwnerList(items, ownerUid) {
  if (!ownerUid || !Array.isArray(items)) return [];
  return items
    .map((item) => ownItem(item, ownerUid))
    .filter((item) => (item?.ownerUid || ownerUid) === ownerUid);
}

function loadStoredList(ownerUid, storageKey, normalizer, fallback = []) {
  if (!ownerUid) return fallback;
  const raw = readScopedJson(ownerUid, storageKey, fallback);
  const normalized = normalizeOwnedList(raw, ownerUid, normalizer);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDiscussionMessage(entry) {
  const text = safeText(entry?.text);
  if (!text) return null;
  const senderId = safeText(entry?.senderId) || "you";
  const senderName = safeText(entry?.senderName) || "You";
  const createdAt = Number(entry?.createdAt || Date.now());
  return {
    id: safeText(entry?.id) || makeMessageId(),
    senderId,
    senderName,
    text,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function normalizeActivityItem(entry) {
  const title = safeText(entry?.title);
  if (!title) return null;
  const detail = safeText(entry?.detail);
  const actorName = safeText(entry?.actorName) || "System";
  const type = safeText(entry?.type) || "info";
  const createdAt = Number(entry?.createdAt || Date.now());
  return {
    id: safeText(entry?.id) || makeActivityId(),
    type,
    title,
    detail,
    actorName,
    sharedMembers: Number(entry?.sharedMembers || 0),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function normalizeJoinRequestItem(entry) {
  const name = safeText(entry?.name);
  const email = safeText(entry?.email).toLowerCase();
  const registrationNumber = safeText(entry?.registrationNumber);
  if (!name || !email || !registrationNumber) return null;
  const createdAt = Number(entry?.createdAt || Date.now());
  return {
    id: safeText(entry?.id) || makeJoinRequestId(),
    name,
    email,
    registrationNumber,
    status: safeText(entry?.status) || "pending",
    source: safeText(entry?.source) || "join_form",
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function normalizeAccessDecisionItem(entry) {
  const email = safeText(entry?.email).toLowerCase();
  const registrationNumber = safeText(entry?.registrationNumber);
  if (!email || !registrationNumber) return null;
  const createdAt = Number(entry?.createdAt || Date.now());
  return {
    id: safeText(entry?.id) || `dec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: safeText(entry?.name) || "Requester",
    email,
    registrationNumber,
    status: safeText(entry?.status) || "pending",
    message: safeText(entry?.message),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number(entry?.updatedAt || Date.now()),
  };
}

function normalizeGroupRegistryItem(entry) {
  const id = safeText(entry?.id);
  const name = safeText(entry?.name);
  if (!id || !name) return null;
  const course = safeText(entry?.course) || "Course";
  const visibility = safeText(entry?.visibility) === "public" ? "public" : "private";
  const inviteCode = safeText(entry?.inviteCode) || makeInviteCode();
  const avatarUrl = safeText(entry?.avatarUrl);
  const role = safeText(entry?.role) || "group_admin";
  const locked = Boolean(entry?.locked);
  const updatedAt = Number(entry?.updatedAt || Date.now());
  return {
    id,
    name,
    course,
    visibility,
    inviteCode,
    avatarUrl,
    role,
    locked,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}

function encodeInvitePayload(payload) {
  try {
    return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return "";
  }
}

function decodeInvitePayload(value) {
  try {
    if (!value) return null;
    const json = decodeURIComponent(escape(window.atob(String(value))));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function inferNoteTitle(text) {
  const firstLine = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Untitled Note";
  return firstLine.slice(0, 56);
}

function memberInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("") || "M";
}

function memberStatusDotClass(status) {
  return status === "online" ? "bg-emerald-500" : "bg-slate-400";
}

function memberStatusTextClass(status) {
  return status === "online" ? "text-emerald-600" : "text-slate-500";
}

function createDefaultNoteFolders(ownerUid = null) {
  return [
    {
      id: makeFolderId(),
      ownerUid,
      name: "General Notes",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: [],
    },
  ];
}

function normalizeNoteFolders(raw, ownerUid) {
  if (!Array.isArray(raw) || raw.length === 0) return createDefaultNoteFolders(ownerUid);
  const normalized = raw
    .map((folder) => {
      const ownedFolder = ownItem(folder, ownerUid);
      if ((ownedFolder?.ownerUid || ownerUid) !== ownerUid) return null;
      return {
        id: String(ownedFolder?.id || makeFolderId()),
        ownerUid,
        name: String(ownedFolder?.name || "Folder"),
        createdAt: Number(ownedFolder?.createdAt || Date.now()),
        updatedAt: Number(ownedFolder?.updatedAt || Date.now()),
        notes: Array.isArray(ownedFolder?.notes)
          ? ownedFolder.notes.map((note) => ({
              id: String(note?.id || makeNoteId()),
              ownerUid,
              title: String(note?.title || "Untitled Note"),
              content: String(note?.content || ""),
              createdAt: Number(note?.createdAt || Date.now()),
              updatedAt: Number(note?.updatedAt || Date.now()),
            }))
          : [],
      };
    })
    .filter((folder) => folder && folder.name.trim().length > 0);
  return normalized.length > 0 ? normalized : createDefaultNoteFolders(ownerUid);
}

function loadStoredNoteFolders(ownerUid, storageKey) {
  if (!ownerUid) return createDefaultNoteFolders(ownerUid);
  const raw = readScopedJson(ownerUid, storageKey, []);
  return normalizeNoteFolders(raw, ownerUid);
}

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapePdfText(input) {
  return String(input || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createSimplePdfBlob(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      if (line.length <= 90) return [line];
      const chunks = [];
      let remaining = line;
      while (remaining.length > 90) {
        chunks.push(remaining.slice(0, 90));
        remaining = remaining.slice(90);
      }
      if (remaining) chunks.push(remaining);
      return chunks;
    })
    .slice(0, 46);

  const contentLines = lines.length > 0 ? lines : [" "];
  const stream =
    "BT\n/F1 11 Tf\n72 780 Td\n" +
    contentLines
      .map((line, idx) => (idx === 0 ? `(${escapePdfText(line)}) Tj` : `0 -16 Td\n(${escapePdfText(line)}) Tj`))
      .join("\n") +
    "\nET";

  const streamLength = new TextEncoder().encode(stream).length;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${streamLength} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function createWordBlob(title, text) {
  const safeTitle = String(title || "Assignment").replace(/[<>]/g, "");
  const safeBody = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><h2>${safeTitle}</h2><pre>${safeBody}</pre></body></html>`;
  return new Blob([html], { type: "application/msword" });
}

function createTextBlob(text) {
  return new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function NavItem({ active, label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2.5",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      {Icon ? <Icon size={16} /> : null}
      <span>{label}</span>
    </button>
  );
}

function Pill({ text }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
      {text}
    </span>
  );
}

function Dropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {label} {"\u25BE"}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-20">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick?.();
              }}
              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              type="button"
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RightTabs({ tab, setTab }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {RIGHT_PANEL_TABS.map((t) => {
        const Icon = t.icon;
        return (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={[
            "px-3 py-2 rounded-lg text-sm border inline-flex items-center gap-1.5",
            tab === t.key
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
          ].join(" ")}
          type="button"
        >
          {Icon ? <Icon size={14} /> : null}
          {t.label}
        </button>
        );
      })}
    </div>
  );
}

export default function SubgroupRoom({ onPushNotification }) {
  const [currentUid, setCurrentUid] = useState(auth.currentUser?.uid || null);
  const previousUidRef = useRef(auth.currentUser?.uid || null);
  const [active, setActive] = useState("board");
  const [rightTab, setRightTab] = useState("chat");
  const [groupRegistry, setGroupRegistry] = useState([]);
  const [isGroupListPopupOpen, setIsGroupListPopupOpen] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isLeftPanelsOpen, setIsLeftPanelsOpen] = useState(true);
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [createClassDraft, setCreateClassDraft] = useState({
    name: "",
    course: "",
    visibility: "private",
    inviteCode: makeInviteCode(),
    avatarUrl: "",
  });
  const [joinCode, setJoinCode] = useState("");
  const [joinRequesterDraft, setJoinRequesterDraft] = useState({
    name: "",
    email: "",
    registrationNumber: "",
  });
  const [joinStatus, setJoinStatus] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [handoverMemberId, setHandoverMemberId] = useState("");
  const [isInviteProfileDialogOpen, setIsInviteProfileDialogOpen] = useState(false);
  const [inviteLanding, setInviteLanding] = useState(null);
  const [inviteProfileDraft, setInviteProfileDraft] = useState({
    name: "",
    email: "",
    registrationNumber: "",
    status: "online",
  });
  const createMenuRef = useRef(null);
  const subgroupMenuRef = useRef(null);
  const pendingJoinRequestIdsRef = useRef(new Set());
  const hasSeededJoinRequestNotifierRef = useRef(false);
  const createAvatarInputRef = useRef(null);
  const adminGroupAvatarInputRef = useRef(null);
  const [members, setMembers] = useState(() =>
    DEFAULT_MEMBERS.map((member) => ({
      ...member,
      groupRole: member.groupRole === "admin" ? "admin" : "member",
      permissions: { ...DEFAULT_MEMBER_PERMISSIONS, ...(member.permissions || {}) },
    }))
  );
  const [mutedMemberIds, setMutedMemberIds] = useState([]);

  const canAdmin = group.role === "group_admin";
  const subgroupList = [...groupRegistry].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const visibleNavItems = leftNav.filter((x) => (x.key === "admin" ? canAdmin : true));
  const onlineMembers = members.filter((m) => m.status === "online").length;
  const mutedMembersCount = members.filter((member) => mutedMemberIds.includes(member.id)).length;
  const isBoardLocked = Boolean(group.locked);
  const activeRightTabMeta = RIGHT_PANEL_TABS.find((item) => item.key === rightTab) || RIGHT_PANEL_TABS[0];
  const ActiveRightTabIcon = activeRightTabMeta?.icon || MessagesSquare;
  const canUploadAssignments = canAdmin || (group.role === "member" && memberPolicy.canUploadAssignments);
  const canSaveNotes = canAdmin || (group.role === "member" && memberPolicy.canSaveNotes);
  const canShareAssignmentLinks = canAdmin || (group.role === "member" && memberPolicy.canShareLinks);
  const assignmentsStorageKey = `${GROUP_ASSIGNMENTS_STORAGE_PREFIX}${group.id}`;
  const notesFoldersStorageKey = `${GROUP_NOTES_FOLDERS_STORAGE_PREFIX}${group.id}`;
  const boardStrokesStorageKey = `${GROUP_BOARD_STROKES_STORAGE_PREFIX}${group.id}`;
  const boardTypingStorageKey = `${GROUP_BOARD_TYPING_STORAGE_PREFIX}${group.id}`;
  const groupChatStorageKey = `${GROUP_CHAT_STORAGE_PREFIX}${group.id}`;
  const groupAiThreadStorageKey = `${GROUP_AI_THREAD_STORAGE_PREFIX}${group.id}`;
  const groupCommentsStorageKey = `${GROUP_COMMENTS_STORAGE_PREFIX}${group.id}`;
  const groupActivityStorageKey = `${GROUP_ACTIVITY_STORAGE_PREFIX}${group.id}`;
  const groupJoinRequestsStorageKey = `${GROUP_JOIN_REQUESTS_STORAGE_PREFIX}${group.id}`;
  const groupAccessDecisionsStorageKey = `${GROUP_ACCESS_DECISIONS_STORAGE_PREFIX}${group.id}`;
  const [boardText, setBoardText] = useState("");
  const [isSharedTypingOpen, setIsSharedTypingOpen] = useState(false);
  const [sharedTypingStatus, setSharedTypingStatus] = useState("");
  const [boardStrokes, setBoardStrokes] = useState([]);
  const [currentBoardStroke, setCurrentBoardStroke] = useState(null);
  const [isBoardDrawing, setIsBoardDrawing] = useState(false);
  const [boardTool, setBoardTool] = useState("pen");
  const [boardColor, setBoardColor] = useState("#0f172a");
  const [boardStrokeWidth, setBoardStrokeWidth] = useState(3);
  const [boardCursors, setBoardCursors] = useState({});
  const [boardSurfaceSize, setBoardSurfaceSize] = useState({ width: 0, height: 0 });
  const [boardStatus, setBoardStatus] = useState("");
  const boardCanvasRef = useRef(null);
  const boardCanvasWrapRef = useRef(null);
  const [noteFolders, setNoteFolders] = useState(() => createDefaultNoteFolders(currentUid));
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isFolderCreateOpen, setIsFolderCreateOpen] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState("");
  const [isGeneralSettingsSheetOpen, setIsGeneralSettingsSheetOpen] = useState(false);
  const [isGeneralSectionOpen, setIsGeneralSectionOpen] = useState(true);
  const [generalSettings, setGeneralSettings] = useState({
    autoSave: true,
    showPresence: true,
    muteAlerts: false,
  });
  const [generalLanguage, setGeneralLanguage] = useState("english");
  const [adminStatus, setAdminStatus] = useState("");
  const [adminGroupDraft, setAdminGroupDraft] = useState({
    name: DEFAULT_GROUP.name,
    course: DEFAULT_GROUP.course,
    visibility: DEFAULT_GROUP.visibility || "private",
    inviteCode: DEFAULT_GROUP.inviteCode || makeInviteCode(),
    avatarUrl: DEFAULT_GROUP.avatarUrl,
  });
  const [newMemberDraft, setNewMemberDraft] = useState({
    name: "",
    email: "",
    registrationNumber: "",
    status: "offline",
  });
  const [memberPolicy, setMemberPolicy] = useState({
    canUploadAssignments: true,
    canSaveNotes: true,
    canShareLinks: true,
  });
  const [notesStatus, setNotesStatus] = useState("");
  const [noteEditorSeed, setNoteEditorSeed] = useState({
    title: "",
    content: "",
    token: "",
  });

  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    description: "",
    body: "",
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSenderId, setChatSenderId] = useState("you");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiRequesterId, setAiRequesterId] = useState("you");
  const [aiThinking, setAiThinking] = useState(false);
  const [commentMessages, setCommentMessages] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentAuthorId, setCommentAuthorId] = useState("you");
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityFilter, setActivityFilter] = useState("all");
  const [joinRequests, setJoinRequests] = useState([]);
  const [accessDecisions, setAccessDecisions] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      const nextUid = firebaseUser?.uid || null;
      if (previousUidRef.current !== nextUid) {
        setAssignments([]);
        setChatMessages([]);
        setAiMessages([]);
        setCommentMessages([]);
        setActivityFeed([]);
        setJoinRequests([]);
        setAccessDecisions([]);
        setBoardText("");
        setBoardStrokes([]);
        setNoteFolders([]);
        setSelectedAssignmentId("");
      }
      previousUidRef.current = nextUid;
      setCurrentUid(nextUid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUid) {
      setGroupRegistry([]);
      return;
    }
    const registryFallback = [normalizeGroupRegistryItem({ ...DEFAULT_GROUP, updatedAt: Date.now(), ownerUid: currentUid })].filter(Boolean);
    setGroupRegistry(loadStoredList(currentUid, GROUP_REGISTRY_STORAGE_KEY, normalizeGroupRegistryItem, registryFallback).filter(Boolean));
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    const loaded = readScopedJson(currentUid, assignmentsStorageKey, defaultAssignments(currentUid));
    const owned = withOwnerList(loaded, currentUid);
    setAssignments(owned.length > 0 ? owned : defaultAssignments(currentUid));
  }, [currentUid, assignmentsStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(currentUid, assignmentsStorageKey, withOwnerList(assignments, currentUid));
  }, [currentUid, assignments, assignmentsStorageKey]);

  useEffect(() => {
    if (selectedAssignmentId && assignments.some((item) => item.id === selectedAssignmentId)) return;
    setSelectedAssignmentId(assignments[0]?.id || "");
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    const fallback = [
      {
        id: makeMessageId(),
        senderId: "mbr_alice",
        senderName: "Alice K.",
        text: "Welcome to subgroup chat. Share updates here.",
        createdAt: Date.now() - 1000 * 60 * 10,
      },
    ];
    setChatMessages(loadStoredList(currentUid, groupChatStorageKey, normalizeDiscussionMessage, fallback));
    setChatInput("");
    setChatSenderId("you");
  }, [currentUid, groupChatStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupChatStorageKey,
      withOwnerList(chatMessages.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupChatStorageKey, chatMessages]);

  useEffect(() => {
    const fallback = [
      {
        id: makeMessageId(),
        senderId: "ai",
        senderName: "Subgroup AI",
        text: "Ask me about members, files/library notes, assignments, or request assignment updates.",
        createdAt: Date.now() - 1000 * 60 * 8,
      },
    ];
    setAiMessages(loadStoredList(currentUid, groupAiThreadStorageKey, normalizeDiscussionMessage, fallback));
    setAiInput("");
    setAiRequesterId("you");
    setAiThinking(false);
  }, [currentUid, groupAiThreadStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupAiThreadStorageKey,
      withOwnerList(aiMessages.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupAiThreadStorageKey, aiMessages]);

  useEffect(() => {
    const fallback = [
      {
        id: makeMessageId(),
        senderId: "ai",
        senderName: "Subgroup AI",
        text: "Post comments for AI review. I will respond and keep this thread organized.",
        createdAt: Date.now() - 1000 * 60 * 6,
      },
    ];
    setCommentMessages(loadStoredList(currentUid, groupCommentsStorageKey, normalizeDiscussionMessage, fallback));
    setCommentInput("");
    setCommentAuthorId("you");
  }, [currentUid, groupCommentsStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupCommentsStorageKey,
      withOwnerList(commentMessages.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupCommentsStorageKey, commentMessages]);

  useEffect(() => {
    const fallback = [
      {
        id: makeActivityId(),
        type: "system",
        title: "Subgroup room ready",
        detail: "Chat, AI, comments, assignments, and board data are available in this frontend workspace.",
        actorName: "System",
        sharedMembers: members.length,
        createdAt: Date.now() - 1000 * 60 * 4,
      },
    ];
    setActivityFeed(loadStoredList(currentUid, groupActivityStorageKey, normalizeActivityItem, fallback));
    setActivityFilter("all");
  }, [currentUid, groupActivityStorageKey, members.length]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupActivityStorageKey,
      withOwnerList(activityFeed.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupActivityStorageKey, activityFeed]);

  useEffect(() => {
    setJoinRequests(loadStoredList(currentUid, groupJoinRequestsStorageKey, normalizeJoinRequestItem, []));
  }, [currentUid, groupJoinRequestsStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupJoinRequestsStorageKey,
      withOwnerList(joinRequests.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupJoinRequestsStorageKey, joinRequests]);

  useEffect(() => {
    setAccessDecisions(loadStoredList(currentUid, groupAccessDecisionsStorageKey, normalizeAccessDecisionItem, []));
  }, [currentUid, groupAccessDecisionsStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      groupAccessDecisionsStorageKey,
      withOwnerList(accessDecisions.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupAccessDecisionsStorageKey, accessDecisions]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUid) return;
    const onStorage = (event) => {
      if (!event?.key) return;
      if (event.key.endsWith(`:${groupJoinRequestsStorageKey}`)) {
        setJoinRequests(loadStoredList(currentUid, groupJoinRequestsStorageKey, normalizeJoinRequestItem, []));
      }
      if (event.key.endsWith(`:${groupAccessDecisionsStorageKey}`)) {
        setAccessDecisions(loadStoredList(currentUid, groupAccessDecisionsStorageKey, normalizeAccessDecisionItem, []));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentUid, groupJoinRequestsStorageKey, groupAccessDecisionsStorageKey]);

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId) || null;
  const selectedFolder = noteFolders.find((folder) => folder.id === selectedFolderId) || noteFolders[0] || null;
  const collaborationActors = [
    {
      id: "you",
      name: canAdmin ? "Admin (You)" : "You",
      status: "online",
      role: canAdmin ? "group_admin" : "member",
      email: "you@subgroup.local",
      registrationNumber: "SELF",
    },
    ...members.map((member) => ({
      id: member.id,
      name: member.name,
      status: member.status,
      role: member.groupRole === "admin" ? "group_admin" : "member",
      email: member.email,
      registrationNumber: member.registrationNumber,
    })),
  ];
  const aiModeActive = rightTab === "ai" && (aiThinking || aiMessages.length > 0);
  const activitySummary = {
    total: activityFeed.length,
    chat: activityFeed.filter((entry) => entry.type === "chat").length,
    ai: activityFeed.filter((entry) => entry.type === "ai").length,
    comments: activityFeed.filter((entry) => entry.type === "comments").length,
    files: activityFeed.filter((entry) => entry.type === "files").length,
    assignments: activityFeed.filter((entry) => entry.type === "assignments").length,
    members: activityFeed.filter((entry) => entry.type === "members").length,
    admin: activityFeed.filter((entry) => entry.type === "admin").length,
  };
  const pendingJoinRequests = joinRequests.filter((request) => request.status === "pending");
  const inviteDecision = accessDecisions.find((decision) => {
    const email = safeText(inviteProfileDraft.email).toLowerCase();
    const reg = safeText(inviteProfileDraft.registrationNumber).toLowerCase();
    if (!email || !reg) return false;
    return (
      String(decision.email || "").toLowerCase() === email &&
      String(decision.registrationNumber || "").toLowerCase() === reg
    );
  });
  const inviteDecisionStatus = inviteDecision?.status || "";
  const inviteDecisionMessage = safeText(inviteDecision?.message);
  const inviteWaitingForApproval =
    inviteDecisionStatus === "pending" || inviteDecisionMessage.toLowerCase().includes("waiting");
  const inviteAccepted = inviteDecisionStatus === "accepted";
  const inviteDenied = inviteDecisionStatus === "denied";
  const filteredActivityFeed =
    activityFilter === "all" ? activityFeed : activityFeed.filter((entry) => entry.type === activityFilter);
  const boardParticipants = [
    { id: "you", name: "You", color: "#0f172a", type: "member" },
    ...members
      .filter((member) => !mutedMemberIds.includes(member.id))
      .slice(0, 3)
      .map((member, index) => ({
      id: member.id,
      name: member.name,
      color: ["#0ea5e9", "#f97316", "#16a34a"][index % 3],
      type: "member",
      })),
    { id: "ai_board", name: "AI", color: "#7c3aed", type: "ai" },
  ];

  useEffect(() => {
    const loaded = loadStoredNoteFolders(currentUid, notesFoldersStorageKey);
    setNoteFolders(loaded);
  }, [currentUid, notesFoldersStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(currentUid, notesFoldersStorageKey, withOwnerList(noteFolders, currentUid));
  }, [currentUid, noteFolders, notesFoldersStorageKey]);

  useEffect(() => {
    if (selectedFolderId && noteFolders.some((folder) => folder.id === selectedFolderId)) return;
    setSelectedFolderId(noteFolders[0]?.id || "");
  }, [noteFolders, selectedFolderId]);

  useEffect(() => {
    if (handoverMemberId && !members.some((member) => member.id === handoverMemberId)) {
      setHandoverMemberId("");
    }
  }, [handoverMemberId, members]);

  useEffect(() => {
    setAdminGroupDraft({
      name: String(group.name || ""),
      course: String(group.course || ""),
      visibility: String(group.visibility || "private"),
      inviteCode: String(group.inviteCode || makeInviteCode()),
      avatarUrl: String(group.avatarUrl || ""),
    });
  }, [group.id, group.name, group.course, group.visibility, group.inviteCode, group.avatarUrl]);

  useEffect(() => {
    if (!isCreateMenuOpen) return;
    const onDocumentMouseDown = (event) => {
      if (!createMenuRef.current) return;
      if (!createMenuRef.current.contains(event.target)) {
        setIsCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isCreateMenuOpen]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      GROUP_REGISTRY_STORAGE_KEY,
      withOwnerList(groupRegistry.slice(0, MAX_PANEL_ITEMS), currentUid)
    );
  }, [currentUid, groupRegistry]);

  useEffect(() => {
    const nextEntry = normalizeGroupRegistryItem({ ...group, updatedAt: Date.now() });
    if (!nextEntry) return;
    setGroupRegistry((prev) => {
      const current = prev.find((item) => item.id === nextEntry.id);
      const unchanged =
        current &&
        current.name === nextEntry.name &&
        current.course === nextEntry.course &&
        current.visibility === nextEntry.visibility &&
        current.inviteCode === nextEntry.inviteCode &&
        current.avatarUrl === nextEntry.avatarUrl &&
        current.role === nextEntry.role &&
        Boolean(current.locked) === Boolean(nextEntry.locked);
      if (unchanged) return prev;
      return [nextEntry, ...prev.filter((item) => item.id !== nextEntry.id)].slice(0, MAX_PANEL_ITEMS);
    });
  }, [group.id, group.name, group.course, group.visibility, group.inviteCode, group.avatarUrl, group.role, group.locked]);

  useEffect(() => {
    if (!isGroupListPopupOpen) return;
    const onDocumentMouseDown = (event) => {
      if (!subgroupMenuRef.current) return;
      if (!subgroupMenuRef.current.contains(event.target)) {
        setIsGroupListPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isGroupListPopupOpen]);

  useEffect(() => {
    pendingJoinRequestIdsRef.current = new Set();
    hasSeededJoinRequestNotifierRef.current = false;
  }, [group.id]);

  useEffect(() => {
    const pending = joinRequests.filter((request) => request.status === "pending");
    if (!hasSeededJoinRequestNotifierRef.current) {
      pendingJoinRequestIdsRef.current = new Set(pending.map((request) => request.id));
      hasSeededJoinRequestNotifierRef.current = true;
      return;
    }

    const seenIds = pendingJoinRequestIdsRef.current;
    if (canAdmin) {
      pending.forEach((request) => {
        if (seenIds.has(request.id)) return;
        pushInstitutionNotification({
          title: `[${group.name}] New join request`,
          detail: `${request.name} requested access. Open Admin > Join Requests.`,
          type: "warning",
        });
      });
    }
    pendingJoinRequestIdsRef.current = new Set(pending.map((request) => request.id));
  }, [joinRequests, canAdmin, group.name]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const encoded = params.get(INVITE_QUERY_PARAM);
    if (!encoded) return;
    const payload = decodeInvitePayload(encoded);
    if (!payload) return;
    const payloadGroupId = safeText(payload.groupId);
    const matchedGroup = payloadGroupId
      ? groupRegistry.find((item) => item.id === payloadGroupId)
      : null;
    if (matchedGroup && matchedGroup.id !== group.id) {
      setGroup((prev) => ({
        ...prev,
        id: matchedGroup.id,
        name: matchedGroup.name,
        course: matchedGroup.course,
        visibility: matchedGroup.visibility,
        inviteCode: matchedGroup.inviteCode,
        avatarUrl: matchedGroup.avatarUrl,
        role: matchedGroup.role || prev.role || "group_admin",
        locked: Boolean(matchedGroup.locked),
      }));
    }

    setInviteLanding({
      groupId: payloadGroupId || matchedGroup?.id || group.id,
      groupName: safeText(payload.groupName) || matchedGroup?.name || group.name,
      course: safeText(payload.course) || matchedGroup?.course || group.course,
      visibility: safeText(payload.visibility) === "public" ? "public" : "private",
      inviteCode: safeText(payload.inviteCode) || matchedGroup?.inviteCode || group.inviteCode,
    });
    setInviteProfileDraft((prev) => ({
      ...prev,
      name: prev.name || "",
      email: prev.email || "",
      registrationNumber: prev.registrationNumber || "",
    }));
    setIsInviteProfileDialogOpen(true);
  }, [group.id, group.name, group.course, group.visibility, group.inviteCode, groupRegistry]);

  useEffect(() => {
    if (!currentUid) {
      setBoardText("");
      setSharedTypingStatus("");
      return;
    }
    const raw = readScopedJson(currentUid, boardTypingStorageKey, "");
    setBoardText(typeof raw === "string" ? raw : String(raw || ""));
    setSharedTypingStatus("");
  }, [currentUid, boardTypingStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(currentUid, boardTypingStorageKey, String(boardText || ""));
  }, [currentUid, boardText, boardTypingStorageKey]);

  useEffect(() => {
    if (!currentUid) {
      setBoardStrokes([]);
      setCurrentBoardStroke(null);
      setIsBoardDrawing(false);
      setBoardCursors({});
      return;
    }
    const raw = readScopedJson(currentUid, boardStrokesStorageKey, []);
    const source = Array.isArray(raw)
      ? raw.filter((stroke) => (stroke?.ownerUid || currentUid) === currentUid)
      : [];
    const normalized = source
      .map((stroke) => ({
        id: String(stroke?.id || makeStrokeId()),
        ownerUid: currentUid,
        authorId: String(stroke?.authorId || "unknown"),
        authorName: String(stroke?.authorName || "Unknown"),
        color: String(stroke?.color || "#0f172a"),
        width: Number(stroke?.width || 3),
        createdAt: Number(stroke?.createdAt || Date.now()),
        points: Array.isArray(stroke?.points)
          ? stroke.points
              .map((point) => ({
                x: Number(point?.x || 0),
                y: Number(point?.y || 0),
              }))
              .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
          : [],
      }))
      .filter((stroke) => stroke.points.length > 1)
      .slice(-600);
    setBoardStrokes(normalized);
    setCurrentBoardStroke(null);
    setIsBoardDrawing(false);
    setBoardCursors({});
  }, [currentUid, boardStrokesStorageKey]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(
      currentUid,
      boardStrokesStorageKey,
      withOwnerList(boardStrokes.slice(-600), currentUid)
    );
  }, [currentUid, boardStrokes, boardStrokesStorageKey]);

  useEffect(() => {
    if (active !== "board") return;
    const resizeCanvas = () => {
      const wrap = boardCanvasWrapRef.current;
      const canvas = boardCanvasRef.current;
      if (!wrap || !canvas) return;
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(320, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      setBoardSurfaceSize({ width, height });
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [active, isLeftSidebarCollapsed, isLeftPanelsOpen]);

  useEffect(() => {
    if (active !== "board") return;
    if (!boardSurfaceSize.width || !boardSurfaceSize.height) return;
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, boardSurfaceSize.width, boardSurfaceSize.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, boardSurfaceSize.width, boardSurfaceSize.height);

    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 40; x < boardSurfaceSize.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, boardSurfaceSize.height);
      ctx.stroke();
    }
    for (let y = 40; y < boardSurfaceSize.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(boardSurfaceSize.width, y);
      ctx.stroke();
    }
    ctx.restore();

    boardStrokes.forEach((stroke) => drawBoardStroke(ctx, stroke));
    if (currentBoardStroke) {
      drawBoardStroke(ctx, currentBoardStroke);
    }
  }, [active, boardSurfaceSize.width, boardSurfaceSize.height, boardStrokes, currentBoardStroke]);

  useEffect(() => {
    if (active !== "board" || !generalSettings.showPresence) return;
    if (!boardSurfaceSize.width || !boardSurfaceSize.height) return;
    const remoteParticipants = boardParticipants.filter((item) => item.id !== "you");
    if (remoteParticipants.length === 0) return;

    setBoardCursors((prev) => {
      const next = { ...prev };
      if (!next.you) {
        next.you = {
          id: "you",
          label: "You",
          color: "#0f172a",
          x: boardSurfaceSize.width * 0.15,
          y: boardSurfaceSize.height * 0.18,
        };
      }
      remoteParticipants.forEach((participant, idx) => {
        if (!next[participant.id]) {
          next[participant.id] = {
            id: participant.id,
            label: participant.name,
            color: participant.color,
            x: Math.max(8, Math.min(boardSurfaceSize.width - 8, boardSurfaceSize.width * (0.25 + idx * 0.18))),
            y: Math.max(8, Math.min(boardSurfaceSize.height - 8, boardSurfaceSize.height * (0.2 + idx * 0.15))),
          };
        }
      });
      return next;
    });

    const interval = setInterval(() => {
      setBoardCursors((prev) => {
        const next = { ...prev };
        remoteParticipants.forEach((participant) => {
          const current = next[participant.id] || {
            id: participant.id,
            label: participant.name,
            color: participant.color,
            x: boardSurfaceSize.width * 0.4,
            y: boardSurfaceSize.height * 0.4,
          };
          const nextX = Math.max(
            8,
            Math.min(boardSurfaceSize.width - 8, Number(current.x || 0) + (Math.random() - 0.5) * 56)
          );
          const nextY = Math.max(
            8,
            Math.min(boardSurfaceSize.height - 8, Number(current.y || 0) + (Math.random() - 0.5) * 56)
          );
          next[participant.id] = {
            ...current,
            x: nextX,
            y: nextY,
            label: participant.name,
            color: participant.color,
          };
        });
        return next;
      });
    }, 950);

    return () => clearInterval(interval);
  }, [
    active,
    generalSettings.showPresence,
    boardSurfaceSize.width,
    boardSurfaceSize.height,
    members.length,
  ]);

  useEffect(() => {
    if (!isBoardDrawing) return;
    const onWindowPointerUp = () => endBoardStroke();
    window.addEventListener("pointerup", onWindowPointerUp);
    return () => window.removeEventListener("pointerup", onWindowPointerUp);
  }, [isBoardDrawing]);

  function toggleLeftPanels() {
    setIsLeftPanelsOpen((prev) => {
      const next = !prev;
      if (!next) setIsLeftSidebarCollapsed(true);
      if (!next) setIsGroupListPopupOpen(false);
      return next;
    });
  }

  function expandLeftSidebar() {
    setIsLeftSidebarCollapsed(false);
    setIsLeftPanelsOpen(true);
    setIsGroupListPopupOpen(false);
  }

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  }

  function drawBoardStroke(ctx, stroke) {
    const points = Array.isArray(stroke?.points) ? stroke.points : [];
    if (points.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = String(stroke?.color || "#0f172a");
    ctx.lineWidth = Number(stroke?.width || 3);
    ctx.beginPath();
    ctx.moveTo(Number(points[0].x || 0), Number(points[0].y || 0));
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(Number(points[i].x || 0), Number(points[i].y || 0));
    }
    ctx.stroke();
    ctx.restore();
  }

  function getBoardPointFromEvent(event) {
    const canvas = boardCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = typeof event?.clientX === "number" ? event.clientX : null;
    const clientY = typeof event?.clientY === "number" ? event.clientY : null;
    if (clientX === null || clientY === null) return null;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return { x, y };
  }

  function handleBoardPointerDown(event) {
    if (isBoardLocked) {
      setBoardStatus("Board is locked by admin.");
      setTimeout(() => setBoardStatus(""), 1600);
      return;
    }
    if (typeof event.button === "number" && event.button !== 0) return;
    const point = getBoardPointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    const strokeColor = boardTool === "eraser" ? "#ffffff" : boardColor;
    const strokeWidth = boardTool === "eraser" ? Math.max(8, boardStrokeWidth * 2) : boardStrokeWidth;
    setCurrentBoardStroke({
      id: makeStrokeId(),
      authorId: "you",
      authorName: "You",
      color: strokeColor,
      width: strokeWidth,
      points: [point],
      createdAt: Date.now(),
    });
    setIsBoardDrawing(true);
    setBoardCursors((prev) => ({
      ...prev,
      you: {
        id: "you",
        label: "You",
        color: "#0f172a",
        x: point.x,
        y: point.y,
      },
    }));
  }

  function handleBoardPointerMove(event) {
    const point = getBoardPointFromEvent(event);
    if (!point) return;
    setBoardCursors((prev) => ({
      ...prev,
      you: {
        id: "you",
        label: "You",
        color: "#0f172a",
        x: point.x,
        y: point.y,
      },
    }));
    if (!isBoardDrawing) return;
    setCurrentBoardStroke((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        points: [...prev.points, point],
      };
    });
  }

  function endBoardStroke() {
    if (!isBoardDrawing) return;
    setIsBoardDrawing(false);
    setCurrentBoardStroke((prev) => {
      if (prev && Array.isArray(prev.points) && prev.points.length > 1) {
        setBoardStrokes((existing) => [...existing, prev].slice(-600));
      }
      return null;
    });
  }

  function clearBoardCanvas() {
    if (isBoardLocked) {
      setBoardStatus("Board is locked by admin.");
      setTimeout(() => setBoardStatus(""), 1600);
      return;
    }
    setBoardStrokes([]);
    setCurrentBoardStroke(null);
    setBoardStatus("Board cleared.");
    setTimeout(() => setBoardStatus(""), 1800);
  }

  function undoBoardStroke() {
    if (isBoardLocked) {
      setBoardStatus("Board is locked by admin.");
      setTimeout(() => setBoardStatus(""), 1600);
      return;
    }
    setBoardStrokes((prev) => prev.slice(0, -1));
  }

  function createAutoStroke(participantId) {
    if (isBoardLocked) {
      setBoardStatus("Board is locked by admin.");
      setTimeout(() => setBoardStatus(""), 1600);
      return;
    }
    if (!boardSurfaceSize.width || !boardSurfaceSize.height) return;
    const participant = boardParticipants.find((item) => item.id === participantId);
    if (!participant) return;

    const points = [];
    let cursorX = Math.random() * (boardSurfaceSize.width * 0.8) + boardSurfaceSize.width * 0.1;
    let cursorY = Math.random() * (boardSurfaceSize.height * 0.8) + boardSurfaceSize.height * 0.1;
    const pointCount = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < pointCount; i += 1) {
      cursorX = Math.max(8, Math.min(boardSurfaceSize.width - 8, cursorX + (Math.random() - 0.5) * 90));
      cursorY = Math.max(8, Math.min(boardSurfaceSize.height - 8, cursorY + (Math.random() - 0.5) * 90));
      points.push({ x: cursorX, y: cursorY });
    }

    const stroke = {
      id: makeStrokeId(),
      authorId: participant.id,
      authorName: participant.name,
      color: participant.color,
      width: 3,
      points,
      createdAt: Date.now(),
    };
    setBoardStrokes((prev) => [...prev, stroke].slice(-600));
    const lastPoint = points[points.length - 1];
    setBoardCursors((prev) => ({
      ...prev,
      [participant.id]: {
        id: participant.id,
        label: participant.name,
        color: participant.color,
        x: lastPoint.x,
        y: lastPoint.y,
      },
    }));
    setBoardStatus(`${participant.name} added to the whiteboard.`);
    setTimeout(() => setBoardStatus(""), 1600);
  }

  function addAiStroke() {
    if (isBoardLocked) return;
    createAutoStroke("ai_board");
  }

  function addMemberStroke() {
    if (isBoardLocked) return;
    const memberActors = boardParticipants.filter((item) => item.type === "member" && item.id !== "you");
    if (memberActors.length === 0) return;
    const picked = memberActors[Math.floor(Math.random() * memberActors.length)];
    createAutoStroke(picked.id);
  }

  function buildBoardSnapshotText() {
    const allStrokes = currentBoardStroke ? [...boardStrokes, currentBoardStroke] : boardStrokes;
    const typingText = String(boardText || "").trim();
    if (allStrokes.length === 0 && !typingText) return "";
    const byAuthor = {};
    allStrokes.forEach((stroke) => {
      const name = String(stroke?.authorName || "Unknown");
      byAuthor[name] = Number(byAuthor[name] || 0) + 1;
    });
    const authorSummary = Object.entries(byAuthor)
      .map(([name, count]) => `${name}: ${count}`)
      .join(" | ");

    return [
      "Subgroup Whiteboard Snapshot",
      `Group: ${group.name}`,
      `Captured: ${formatDateTime(Date.now())}`,
      `Total strokes: ${allStrokes.length}`,
      `Contributors: ${authorSummary || "None"}`,
      "",
      "Canvas board content was captured from local frontend whiteboard state.",
      typingText ? "Shared Typing Space" : "",
      typingText ? typingText : "",
    ].join("\n");
  }

  function toggleSubgroupListPopup() {
    setIsGroupListPopupOpen((prev) => !prev);
  }

  async function openGroupFromPopup(groupId) {
    const target = subgroupList.find((item) => item.id === groupId);
    if (!target) return;
    setGroup((prev) => ({
      ...prev,
      id: target.id,
      name: target.name,
      course: target.course,
      visibility: target.visibility,
      inviteCode: target.inviteCode,
      avatarUrl: target.avatarUrl,
      role: target.role || prev.role || "group_admin",
      locked: Boolean(target.locked),
    }));
    setActive("overview");
    setIsLeftPanelsOpen(true);
    setIsLeftSidebarCollapsed(false);
    setIsGroupListPopupOpen(false);
    setJoinStatus(`Opened "${target.name}".`);
    setTimeout(() => setJoinStatus(""), 1800);
    await fetchMembersFromServer(groupId);
  }

  async function shareGroupFromPopup(groupId) {
    const target = subgroupList.find((item) => item.id === groupId);
    if (!target) return;
    const copied = await copyInviteLinkForGroup(target);
    if (copied) {
      setInviteStatus(`Invite link copied for "${target.name}".`);
      setTimeout(() => setInviteStatus(""), 2200);
      logGroupActivity({
        type: "admin",
        title: "Invite link copied",
        detail: `Invite link copied for ${target.name}.`,
        actorName: "You",
      });
    } else {
      setInviteStatus(`Failed to copy invite link for "${target.name}".`);
      setTimeout(() => setInviteStatus(""), 2200);
    }
  }

  function editGroupFromPopup(groupId) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = subgroupList.find((item) => item.id === groupId);
    if (!target) return;
    setGroup((prev) => ({
      ...prev,
      id: target.id,
      name: target.name,
      course: target.course,
      visibility: target.visibility,
      inviteCode: target.inviteCode,
      avatarUrl: target.avatarUrl,
      role: target.role || prev.role || "group_admin",
      locked: Boolean(target.locked),
    }));
    setAdminGroupDraft({
      name: target.name,
      course: target.course,
      visibility: target.visibility,
      inviteCode: target.inviteCode,
      avatarUrl: target.avatarUrl || "",
    });
    setActive("admin");
    setIsLeftPanelsOpen(true);
    setIsLeftSidebarCollapsed(false);
    setIsGroupListPopupOpen(false);
    setAdminStatus(`Editing "${target.name}".`);
    setTimeout(() => setAdminStatus(""), 1800);
  }

  function deleteGroupFromPopup(groupId) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = subgroupList.find((item) => item.id === groupId);
    if (!target) return;
    if (target.id === group.id) {
      deleteCurrentGroup();
      return;
    }
    const confirmed = window.confirm(`Delete subgroup "${target.name}"?`);
    if (!confirmed) return;
    setGroupRegistry((prev) => prev.filter((entry) => entry.id !== target.id));
    setAdminStatus(`Deleted "${target.name}".`);
    setTimeout(() => setAdminStatus(""), 2000);
  }

  function renderGroupListPopup(positionClassName) {
    return (
      <div
        className={[
          "absolute w-[min(92vw,26rem)] rounded-xl border border-blue-200/60 bg-blue-500/20 backdrop-blur-sm p-1.5 space-y-1 z-40 shadow-xl",
          positionClassName,
        ].join(" ")}
      >
        <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-600">GROUPS LIST</div>
        <div className="max-h-64 overflow-auto smart-scrollbar space-y-1">
          {subgroupList.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-600">No groups yet.</div>
          ) : (
            subgroupList.map((item) => {
              const isActiveGroup = item.id === group.id;
              const initials = (item.name || "G")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0] || "")
                .join("")
                .toUpperCase();
              return (
                <div
                  key={item.id}
                  className={[
                    "w-full rounded-lg border px-2 py-2",
                    isActiveGroup
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                      : "border-slate-200 bg-white/80 hover:bg-blue-500/20 text-slate-700",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => openGroupFromPopup(item.id)}
                      className="min-w-0 flex-1 text-left inline-flex items-start gap-2"
                    >
                      <div className="h-7 w-7 rounded-lg border border-slate-200 bg-white/90 text-[10px] font-semibold text-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={["text-sm truncate", isActiveGroup ? "font-semibold text-white" : "font-medium text-slate-800"].join(" ")}>
                          {item.name}
                        </div>
                        <div className={["text-[11px] truncate", isActiveGroup ? "text-indigo-100" : "text-slate-500"].join(" ")}>
                          {item.course} | {item.visibility === "public" ? "Public" : "Private"}
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => shareGroupFromPopup(item.id)}
                        className={["h-7 w-7 rounded-md border inline-flex items-center justify-center", isActiveGroup ? "border-white/35 text-white hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100"].join(" ")}
                        title="Share invite"
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => editGroupFromPopup(item.id)}
                        className={["h-7 w-7 rounded-md border inline-flex items-center justify-center", isActiveGroup ? "border-white/35 text-white hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100"].join(" ")}
                        title="Edit group"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGroupFromPopup(item.id)}
                        className={["h-7 w-7 rounded-md border inline-flex items-center justify-center", isActiveGroup ? "border-white/35 text-white hover:bg-white/10" : "border-slate-200 text-rose-600 hover:bg-rose-50"].join(" ")}
                        title="Delete group"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function handleLeftNavSelect(itemKey) {
    setIsGroupListPopupOpen(false);
    if (itemKey === "settings" && isMobileViewport()) {
      setIsLeftPanelsOpen(false);
      setIsLeftSidebarCollapsed(true);
      setIsGeneralSettingsSheetOpen(true);
      return;
    }
    setIsGeneralSettingsSheetOpen(false);
    setActive(itemKey);
    setIsLeftPanelsOpen(false);
    setIsLeftSidebarCollapsed(true);
  }

  function openJoinDialog() {
    setIsCreateMenuOpen(false);
    setJoinRequesterDraft({
      name: "",
      email: "",
      registrationNumber: "",
    });
    setIsJoinDialogOpen(true);
  }

  function openCreateClassDialog() {
    setIsCreateMenuOpen(false);
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    setCreateClassDraft({
      name: "",
      course: "",
      visibility: "private",
      inviteCode: makeInviteCode(),
      avatarUrl: "",
    });
    setIsCreateClassDialogOpen(true);
  }

  function openRequestAccessDialog() {
    setIsCreateMenuOpen(false);
    setIsAccessDialogOpen(true);
  }

  function handleCreateAvatarSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setCreateClassDraft((prev) => ({ ...prev, avatarUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function createClassNow() {
    const name = String(createClassDraft?.name || "").trim();
    if (!name) {
      alert("Class/Subgroup name is required.");
      return;
    }
    const serverId = await createGroupOnServer({
      name,
      course: createClassDraft?.course,
      visibility: createClassDraft?.visibility,
    });
    const success = applyGroupDraft(createClassDraft, { asNewClass: true, serverId });
    if (success) {
      setIsCreateClassDialogOpen(false);
    }
    if (serverId) {
      await fetchMembersFromServer(serverId);
    }
  }

  function applyGroupDraft(draft, options = {}) {
    const { asNewClass = false, serverId = null } = options;
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return false;
    }
    const name = String(draft?.name || "").trim();
    if (!name) {
      alert("Class/Subgroup name is required.");
      return false;
    }
    const course = String(draft?.course || "").trim();
    const visibility = String(draft?.visibility || "private") === "public" ? "public" : "private";
    const inviteCode = (String(draft?.inviteCode || "").trim().toUpperCase() || makeInviteCode());
    const nextGroupId = asNewClass ? String(serverId || `grp_${Date.now()}`) : group.id;
    setGroup((prev) => ({
      ...prev,
      id: nextGroupId,
      name,
      course: course || prev.course || "Course",
      visibility,
      inviteCode,
      avatarUrl: String(draft?.avatarUrl || prev.avatarUrl || ""),
    }));
    if (asNewClass) {
      setMembers([]);
      setMutedMemberIds([]);
      setJoinRequests([]);
      setExpandedMemberId("");
      setAssignments([]);
      setSelectedAssignmentId("");
      setBoardText("");
      setBoardStrokes([]);
      setCurrentBoardStroke(null);
      setBoardCursors({});
      setChatMessages([]);
      setAiMessages([]);
      setCommentMessages([]);
      setActivityFeed([]);
      setNoteFolders(createDefaultNoteFolders());
      setSelectedFolderId("");
      setHandoverMemberId("");
    }
    setAdminStatus(asNewClass ? `Class "${name}" created.` : `Group "${name}" saved.`);
    logGroupActivity({
      type: "admin",
      title: asNewClass ? "Class created" : "Group profile updated",
      detail: asNewClass
        ? `Admin created new class "${name}" with empty members list.`
        : `Admin updated group profile to "${name}".`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2000);
    return true;
  }

  async function createGroupOnServer(payload) {
    try {
      const response = await apiPost("/api/groups/create", payload || {});
      const nextId = response?.group?.id ?? response?.group_id ?? response?.id;
      if (nextId) {
        setAdminStatus("Backend: group created.");
        setTimeout(() => setAdminStatus(""), 1800);
      }
      return nextId ? String(nextId) : null;
    } catch (error) {
      setAdminStatus(`Backend error: ${error?.message || "Failed to create group"}`);
      setTimeout(() => setAdminStatus(""), 2200);
      return null;
    }
  }

  function normalizeServerGroupId(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const idNum = Number.parseInt(raw, 10);
    if (Number.isFinite(idNum)) return idNum;
    return null;
  }

  function mapServerMember(member) {
    const userId = String(member?.user_id || member?.userId || member?.id || "").trim() || "member";
    return {
      id: `srv_${member?.id ?? userId}`,
      name: userId,
      email: `${userId}@local`,
      registrationNumber: userId,
      status: "online",
      groupRole: String(member?.role || "member") === "admin" ? "admin" : "member",
      permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
    };
  }

  async function fetchMembersFromServer(groupId) {
    const serverId = normalizeServerGroupId(groupId);
    if (!serverId) return;
    try {
      const response = await apiGet(`/api/groups/${serverId}/members`);
      const membersList = Array.isArray(response) ? response : Array.isArray(response?.members) ? response.members : null;
      if (membersList && membersList.length >= 0) {
        setMembers(membersList.map(mapServerMember));
        setAdminStatus("Backend: members synced.");
        setTimeout(() => setAdminStatus(""), 1800);
      }
    } catch (error) {
      setAdminStatus(`Backend error: ${error?.message || "Failed to sync members"}`);
      setTimeout(() => setAdminStatus(""), 2200);
    }
  }

  async function joinGroupOnServer(groupId, userId) {
    const serverId = normalizeServerGroupId(groupId);
    if (!serverId) return false;
    try {
      await apiPost("/api/groups/join", { group_id: serverId, user_id: String(userId || "").trim() || undefined });
      return true;
    } catch (error) {
      setAdminStatus(`Backend error: ${error?.message || "Failed to join group"}`);
      setTimeout(() => setAdminStatus(""), 2200);
      return false;
    }
  }

  function hasExistingMember({ email, registrationNumber }) {
    const safeEmail = safeText(email).toLowerCase();
    const safeReg = safeText(registrationNumber).toLowerCase();
    return members.some(
      (member) =>
        String(member.email || "").toLowerCase() === safeEmail ||
        String(member.registrationNumber || "").toLowerCase() === safeReg
    );
  }

  function hasPendingJoinRequest({ email, registrationNumber }) {
    const safeEmail = safeText(email).toLowerCase();
    const safeReg = safeText(registrationNumber).toLowerCase();
    return joinRequests.some(
      (request) =>
        request.status === "pending" &&
        (String(request.email || "").toLowerCase() === safeEmail ||
          String(request.registrationNumber || "").toLowerCase() === safeReg)
    );
  }

  function upsertAccessDecision({ name, email, registrationNumber, status, message }) {
    const cleanEmail = safeText(email).toLowerCase();
    const cleanReg = safeText(registrationNumber);
    if (!cleanEmail || !cleanReg) return;
    setAccessDecisions((prev) => {
      const nextItem = {
        id: `dec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: safeText(name) || "Requester",
        email: cleanEmail,
        registrationNumber: cleanReg,
        status: safeText(status) || "pending",
        message: safeText(message),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const filtered = prev.filter(
        (item) =>
          String(item.email || "").toLowerCase() !== cleanEmail &&
          String(item.registrationNumber || "").toLowerCase() !== cleanReg.toLowerCase()
      );
      return [nextItem, ...filtered].slice(0, MAX_PANEL_ITEMS);
    });
  }

  function enqueueJoinRequest({ name, email, registrationNumber, source = "join_form" }) {
    const cleanName = safeText(name);
    const cleanEmail = safeText(email).toLowerCase();
    const cleanReg = safeText(registrationNumber);
    if (!cleanName || !cleanEmail || !cleanReg) {
      return { ok: false, reason: "Name, email, and registration number are required." };
    }
    if (hasExistingMember({ email: cleanEmail, registrationNumber: cleanReg })) {
      return { ok: false, reason: "This member already exists in the group." };
    }
    if (hasPendingJoinRequest({ email: cleanEmail, registrationNumber: cleanReg })) {
      return { ok: false, reason: "Request already pending for this member." };
    }
    const nextRequest = {
      id: makeJoinRequestId(),
      name: cleanName,
      email: cleanEmail,
      registrationNumber: cleanReg,
      source,
      status: "pending",
      createdAt: Date.now(),
    };
    setJoinRequests((prev) => [nextRequest, ...prev].slice(0, MAX_PANEL_ITEMS));
    upsertAccessDecision({
      name: cleanName,
      email: cleanEmail,
      registrationNumber: cleanReg,
      status: "pending",
      message: "Waiting for admin approval.",
    });
    pushInstitutionNotification({
      title: `[${group.name}] New join request`,
      detail: `${cleanName} requested access. Open Admin > Join Requests.`,
      type: "warning",
    });
    logGroupActivity({
      type: "members",
      title: "Join request submitted",
      detail: `${cleanName} requested access (${source}).`,
      actorName: cleanName,
      notify: false,
    });
    return { ok: true, request: nextRequest };
  }

  function admitJoinRequest(requestId) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = joinRequests.find((request) => request.id === requestId && request.status === "pending");
    if (!target) return;
    if (hasExistingMember({ email: target.email, registrationNumber: target.registrationNumber })) {
      setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
      setAdminStatus(`"${target.name}" already exists. Request removed.`);
      setTimeout(() => setAdminStatus(""), 2200);
      return;
    }
    const nextMember = {
      id: makeMemberId(),
      name: target.name,
      email: target.email,
      registrationNumber: target.registrationNumber,
      status: "online",
      groupRole: "member",
      permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
    };
    setMembers((prev) => [nextMember, ...prev]);
    joinGroupOnServer(group.id, target.email || target.registrationNumber);
    fetchMembersFromServer(group.id);
    setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
    upsertAccessDecision({
      name: target.name,
      email: target.email,
      registrationNumber: target.registrationNumber,
      status: "accepted",
      message: "Request accepted. You can go to group.",
    });
    pushInstitutionNotification({
      title: `[${group.name}] Request accepted`,
      detail: `${target.name}, your join request was accepted. Tap "Go to Group".`,
      type: "success",
    });
    setAdminStatus(`Admitted ${target.name}.`);
    logGroupActivity({
      type: "members",
      title: "Join request admitted",
      detail: `${target.name} was admitted by admin.`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2400);
  }

  function denyJoinRequest(requestId) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = joinRequests.find((request) => request.id === requestId && request.status === "pending");
    if (!target) return;
    setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
    upsertAccessDecision({
      name: target.name,
      email: target.email,
      registrationNumber: target.registrationNumber,
      status: "denied",
      message: "Request denied by admin.",
    });
    pushInstitutionNotification({
      title: `[${group.name}] Request denied`,
      detail: `${target.name}, your join request was denied.`,
      type: "warning",
    });
    setAdminStatus(`Denied ${target.name}'s request.`);
    logGroupActivity({
      type: "members",
      title: "Join request denied",
      detail: `${target.name}'s request was denied by admin.`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2400);
  }

  function submitJoinRequest() {
    const code = String(joinCode || "").trim();
    if (!code) {
      alert("Enter class code or invite link.");
      return;
    }
    const requesterName = safeText(joinRequesterDraft.name);
    const requesterEmail = safeText(joinRequesterDraft.email).toLowerCase();
    const requesterReg = safeText(joinRequesterDraft.registrationNumber);
    if (!requesterName || !requesterEmail || !requesterReg) {
      alert("Fill requester name, email, and registration number.");
      return;
    }
    if (group.visibility === "public" || code.toUpperCase() === String(group.inviteCode || "").toUpperCase()) {
      if (!hasExistingMember({ email: requesterEmail, registrationNumber: requesterReg })) {
        const nextMember = {
          id: makeMemberId(),
          name: requesterName,
          email: requesterEmail,
          registrationNumber: requesterReg,
          status: "online",
          groupRole: "member",
          permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
        };
        setMembers((prev) => [nextMember, ...prev]);
      }
      joinGroupOnServer(group.id, requesterEmail || requesterReg);
      fetchMembersFromServer(group.id);
      setJoinStatus(`Welcome ${requesterName}. Joined group directly.`);
      logGroupActivity({
        type: "members",
        title: "Member joined",
        detail: `${requesterName} joined using join code/invite link.`,
        actorName: requesterName,
      });
    } else {
      const result = enqueueJoinRequest({
        name: requesterName,
        email: requesterEmail,
        registrationNumber: requesterReg,
        source: "join_dialog",
      });
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      setJoinStatus(`Request submitted. Admin can admit or deny ${requesterName}.`);
    }
    setTimeout(() => setJoinStatus(""), 2200);
    setIsJoinDialogOpen(false);
    setJoinCode("");
    setJoinRequesterDraft({
      name: "",
      email: "",
      registrationNumber: "",
    });
  }

  function handleAdminGroupAvatarSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAdminGroupDraft((prev) => ({ ...prev, avatarUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function saveAdminGroup() {
    const success = applyGroupDraft(adminGroupDraft);
    if (!success) return;
  }

  function deleteCurrentGroup() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const shouldDelete = window.confirm(`Delete subgroup "${group.name}"? This is a local frontend action for now.`);
    if (!shouldDelete) return;
    setGroupRegistry((prev) => prev.filter((entry) => entry.id !== group.id));
    setIsGroupListPopupOpen(false);

    const nextGroup = {
      ...DEFAULT_GROUP,
      id: `grp_${Date.now()}`,
      name: "Untitled Subgroup",
      course: "Course",
      visibility: "private",
      inviteCode: makeInviteCode(),
      role: group.role,
      avatarUrl: "",
    };
    setGroup(nextGroup);
    setMembers([]);
    setMutedMemberIds([]);
    setMemberPolicy({
      canUploadAssignments: true,
      canSaveNotes: true,
      canShareLinks: true,
    });
    setNewMemberDraft({
      name: "",
      email: "",
      registrationNumber: "",
      status: "offline",
    });
    setAssignments([]);
    setSelectedAssignmentId("");
    setBoardText("");
    setBoardStrokes([]);
    setCurrentBoardStroke(null);
    setBoardCursors({});
    setHandoverMemberId("");
    setInviteStatus("");
    setIsInviteProfileDialogOpen(false);
    setInviteLanding(null);
    setChatMessages([]);
    setAiMessages([]);
    setCommentMessages([]);
    setActivityFeed([]);
    setJoinRequests([]);
    setNoteFolders(createDefaultNoteFolders());
    setSelectedFolderId("");
    setAdminGroupDraft({
      name: nextGroup.name,
      course: nextGroup.course,
      visibility: nextGroup.visibility,
      inviteCode: nextGroup.inviteCode,
      avatarUrl: nextGroup.avatarUrl,
    });
    setAdminStatus("Subgroup deleted locally. Create a new subgroup to continue.");
    logGroupActivity({
      type: "admin",
      title: "Subgroup deleted",
      detail: `Admin deleted subgroup "${group.name}" and reset workspace.`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2400);
  }

  function addMemberFromAdmin() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const name = String(newMemberDraft.name || "").trim();
    const email = String(newMemberDraft.email || "").trim();
    const registrationNumber = String(newMemberDraft.registrationNumber || "").trim();
    const status = String(newMemberDraft.status || "offline");
    if (!name) {
      alert("Member name is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      alert("A valid member email is required.");
      return;
    }
    if (!registrationNumber) {
      alert("Registration number is required.");
      return;
    }
    const nextMember = {
      id: makeMemberId(),
      name,
      email,
      registrationNumber,
      status: ["online", "away", "offline"].includes(status) ? status : "offline",
      groupRole: "member",
      permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
    };
    setMembers((prev) => [nextMember, ...prev]);
    setJoinRequests((prev) =>
      prev.filter(
        (request) =>
          String(request.email || "").toLowerCase() !== email.toLowerCase() &&
          String(request.registrationNumber || "").toLowerCase() !== registrationNumber.toLowerCase()
      )
    );
    setNewMemberDraft({
      name: "",
      email: "",
      registrationNumber: "",
      status: "offline",
    });
    setAdminStatus(`Member "${name}" added.`);
    logGroupActivity({
      type: "admin",
      title: "Member added",
      detail: `${name} was added to subgroup by admin.`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2000);
  }

  function removeMemberFromAdmin(memberId) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = members.find((member) => member.id === memberId);
    if (!target) return;
    const ok = window.confirm(`Remove ${target.name} from subgroup?`);
    if (!ok) return;
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
    setMutedMemberIds((prev) => prev.filter((id) => id !== memberId));
    setExpandedMemberId((prev) => (prev === memberId ? "" : prev));
    setAdminStatus(`Member "${target.name}" removed.`);
    logGroupActivity({
      type: "admin",
      title: "Member removed",
      detail: `${target.name} was removed from subgroup.`,
      actorName: "Admin",
    });
    setTimeout(() => setAdminStatus(""), 2000);
  }

  function updateMemberPermission(memberId, permissionKey, enabled) {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId
          ? {
              ...member,
              permissions: {
                ...DEFAULT_MEMBER_PERMISSIONS,
                ...(member.permissions || {}),
                [permissionKey]: Boolean(enabled),
              },
            }
          : member
      )
    );
    logGroupActivity({
      type: "admin",
      title: "Member permission updated",
      detail: `Permission "${permissionKey}" set to ${enabled ? "enabled" : "disabled"}.`,
      actorName: "Admin",
      notify: false,
    });
  }

  function pickMemberFromPrompt(actionLabel) {
    if (members.length === 0) {
      alert("No members available in this subgroup.");
      return null;
    }
    const list = members.map((member, index) => `${index + 1}. ${member.name}`).join("\n");
    const raw = window.prompt(`Select member to ${actionLabel} (number or name):\n${list}`);
    if (raw === null) return null;
    const input = String(raw || "").trim();
    if (!input) return null;

    const asNumber = Number.parseInt(input, 10);
    if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= members.length) {
      return members[asNumber - 1];
    }

    const lowered = input.toLowerCase();
    const exact = members.find(
      (member) =>
        String(member.name || "").toLowerCase() === lowered ||
        String(member.email || "").toLowerCase() === lowered ||
        String(member.registrationNumber || "").toLowerCase() === lowered
    );
    if (exact) return exact;

    const partial = members.find((member) => String(member.name || "").toLowerCase().includes(lowered));
    if (partial) return partial;

    alert("Member not found.");
    return null;
  }

  function toggleBoardLock() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const nextLocked = !Boolean(group.locked);
    setGroup((prev) => ({ ...prev, locked: nextLocked }));
    if (nextLocked) {
      setIsBoardDrawing(false);
      setCurrentBoardStroke(null);
    }
    setBoardStatus(nextLocked ? "Board locked by admin." : "Board unlocked.");
    setAdminStatus(nextLocked ? "Board locked." : "Board unlocked.");
    logGroupActivity({
      type: "admin",
      title: nextLocked ? "Board locked" : "Board unlocked",
      detail: nextLocked
        ? "Admin locked the shared board for all members."
        : "Admin unlocked the shared board for members.",
      actorName: "Admin",
    });
    setTimeout(() => setBoardStatus(""), 1800);
    setTimeout(() => setAdminStatus(""), 1800);
  }

  function toggleMutedMemberFromAdminControls() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = pickMemberFromPrompt("mute/unmute");
    if (!target) return;
    const currentlyMuted = mutedMemberIds.includes(target.id);
    const nextMuted = currentlyMuted
      ? mutedMemberIds.filter((id) => id !== target.id)
      : [...mutedMemberIds, target.id];
    setMutedMemberIds(nextMuted);
    setBoardStatus(currentlyMuted ? `${target.name} unmuted on board.` : `${target.name} muted on board.`);
    setAdminStatus(currentlyMuted ? `Unmuted "${target.name}".` : `Muted "${target.name}".`);
    logGroupActivity({
      type: "admin",
      title: currentlyMuted ? "Member unmuted on board" : "Member muted on board",
      detail: `${target.name} was ${currentlyMuted ? "unmuted" : "muted"} by admin.`,
      actorName: "Admin",
    });
    setTimeout(() => setBoardStatus(""), 1800);
    setTimeout(() => setAdminStatus(""), 1800);
  }

  function removeMemberFromAdminControls() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    const target = pickMemberFromPrompt("remove");
    if (!target) return;
    removeMemberFromAdmin(target.id);
  }

  function resolveActor(actorId) {
    return collaborationActors.find((actor) => actor.id === actorId) || collaborationActors[0];
  }

  function buildInvitePayload(sourceGroup = group) {
    const safeGroup = sourceGroup || group;
    return {
      groupId: safeGroup.id,
      groupName: safeGroup.name,
      course: safeGroup.course,
      visibility: safeGroup.visibility === "public" ? "public" : "private",
      inviteCode: safeGroup.inviteCode || makeInviteCode(),
    };
  }

  function buildInviteLink(sourceGroup = group) {
    if (typeof window === "undefined") return "";
    const payload = buildInvitePayload(sourceGroup);
    const encoded = encodeInvitePayload(payload);
    const url = new URL(window.location.href);
    url.searchParams.set(INVITE_QUERY_PARAM, encoded);
    return url.toString();
  }

  async function copyInviteLinkForGroup(sourceGroup, options = {}) {
    const { closeMenus = false } = options;
    const link = buildInviteLink(sourceGroup);
    if (!link) return false;
    if (closeMenus) {
      setIsCreateMenuOpen(false);
      setIsGroupListPopupOpen(false);
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement("textarea");
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function copyInviteLink() {
    const copied = await copyInviteLinkForGroup(group, { closeMenus: true });
    if (copied) {
      setInviteStatus("Invite link copied.");
      setTimeout(() => setInviteStatus(""), 2000);
      logGroupActivity({
        type: "admin",
        title: "Invite link copied",
        detail: "Group invite link copied to clipboard.",
        actorName: "You",
      });
    } else {
      setInviteStatus("Failed to copy invite link.");
      setTimeout(() => setInviteStatus(""), 2000);
    }
  }

  function shareInviteViaWhatsApp() {
    const link = buildInviteLink();
    if (!link || typeof window === "undefined") return;
    setIsCreateMenuOpen(false);
    const text = encodeURIComponent(`Join ${group.name} on ElimuLink:\n${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    setInviteStatus("Opened WhatsApp share.");
    setTimeout(() => setInviteStatus(""), 2000);
    logGroupActivity({
      type: "admin",
      title: "Invite shared via WhatsApp",
      detail: "WhatsApp share opened for invite link.",
      actorName: "You",
    });
  }

  function shareInviteViaEmail() {
    const link = buildInviteLink();
    if (!link || typeof window === "undefined") return;
    setIsCreateMenuOpen(false);
    const subject = encodeURIComponent(`Invite to join ${group.name}`);
    const body = encodeURIComponent(
      `You are invited to join ${group.name} (${group.course}).\n\nOpen this link:\n${link}\n\nVisibility: ${
        group.visibility === "public" ? "Public" : "Private"
      }\nInvite Code: ${group.inviteCode}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setInviteStatus("Email share opened.");
    setTimeout(() => setInviteStatus(""), 2000);
    logGroupActivity({
      type: "admin",
      title: "Invite shared via Email",
      detail: "Email composer opened with invite link.",
      actorName: "You",
    });
  }

  function closeInviteProfileDialog() {
    setIsInviteProfileDialogOpen(false);
    setInviteLanding(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(INVITE_QUERY_PARAM)) {
      url.searchParams.delete(INVITE_QUERY_PARAM);
      window.history.replaceState(window.history.state || {}, "", url.toString());
    }
  }

  function goToGroupFromInvite() {
    setJoinStatus("Request accepted. You can now access the group.");
    setTimeout(() => setJoinStatus(""), 2400);
    setActive("overview");
    setIsLeftSidebarCollapsed(false);
    setIsLeftPanelsOpen(true);
    closeInviteProfileDialog();
  }

  function submitInviteProfile() {
    const name = safeText(inviteProfileDraft.name);
    const email = safeText(inviteProfileDraft.email).toLowerCase();
    const registrationNumber = safeText(inviteProfileDraft.registrationNumber);
    const visibility = inviteLanding?.visibility || group.visibility || "private";
    if (!name) {
      alert("Name is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      alert("Valid email is required.");
      return;
    }
    if (!registrationNumber) {
      alert("Registration number is required.");
      return;
    }

    const existing = hasExistingMember({ email, registrationNumber });

    if (visibility === "public") {
      if (!existing) {
        const nextMember = {
          id: makeMemberId(),
          name,
          email,
          registrationNumber,
          status: "online",
          groupRole: "member",
          permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
        };
        setMembers((prev) => [nextMember, ...prev]);
      }
      setJoinStatus(existing ? "Profile found. Joined group directly." : `Welcome ${name}. You joined the group.`);
      logGroupActivity({
        type: "members",
        title: "Member joined via invite link",
        detail: `${name} joined from invite link.`,
        actorName: name,
      });
    } else {
      const result = enqueueJoinRequest({
        name,
        email,
        registrationNumber,
        source: "invite_link",
      });
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      setJoinStatus(`Access request sent for ${name}. Waiting for admin approval.`);
      setTimeout(() => setJoinStatus(""), 2600);
      return;
    }
    setTimeout(() => setJoinStatus(""), 2600);
    closeInviteProfileDialog();
  }

  function promoteMemberToAdmin(memberId, options = {}) {
    const { asLeave = false } = options;
    const target = members.find((member) => member.id === memberId);
    if (!target) {
      alert("Select a valid member to promote.");
      return;
    }
    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId
          ? {
              ...member,
              groupRole: "admin",
            }
          : member
      )
    );
    if (asLeave) {
      setGroup((prev) => ({ ...prev, role: "member" }));
      setAdminStatus(`You left admin role. ${target.name} is now subgroup admin.`);
      logGroupActivity({
        type: "admin",
        title: "Admin handover complete",
        detail: `${target.name} is now admin. You left admin role.`,
        actorName: "Admin",
      });
    } else {
      setAdminStatus(`${target.name} promoted to admin.`);
      logGroupActivity({
        type: "admin",
        title: "Member promoted to admin",
        detail: `${target.name} can now perform admin tasks.`,
        actorName: "Admin",
      });
    }
    setTimeout(() => setAdminStatus(""), 2400);
  }

  function leaveGroupAndTransferAdmin() {
    if (!canAdmin) {
      setIsAccessDialogOpen(true);
      return;
    }
    if (!handoverMemberId) {
      alert("Select a member to transfer admin rights.");
      return;
    }
    const target = members.find((member) => member.id === handoverMemberId);
    if (!target) {
      alert("Selected member not found.");
      return;
    }
    const ok = window.confirm(`Transfer admin rights to ${target.name} and leave admin role?`);
    if (!ok) return;
    promoteMemberToAdmin(target.id, { asLeave: true });
  }

  function pushInstitutionNotification({ title, detail, type = "info" }) {
    if (typeof onPushNotification === "function") {
      onPushNotification({ title, detail, type });
      return;
    }
    if (!currentUid) return;
    const current = readScopedJson(currentUid, INSTITUTION_NOTIFICATIONS_KEY, []);
    const nextList = Array.isArray(current) ? current : [];
    const nextItem = {
      id: `ntf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerUid: currentUid,
      title: String(title || "Subgroup update"),
      detail: String(detail || ""),
      type: String(type || "info"),
      read: false,
      createdAt: Date.now(),
    };
    writeScopedJson(currentUid, INSTITUTION_NOTIFICATIONS_KEY, [nextItem, ...nextList].slice(0, 40));
    window.dispatchEvent(new CustomEvent("institution-notifications-updated", { detail: nextItem }));
  }

  function logGroupActivity({ type = "system", title, detail, actorName = "System", notify = true }) {
    const safeTitle = safeText(title) || "Group update";
    const safeDetail = safeText(detail);
    const entry = {
      id: makeActivityId(),
      type: String(type || "system"),
      title: safeTitle,
      detail: safeDetail,
      actorName: safeText(actorName) || "System",
      sharedMembers: members.length,
      createdAt: Date.now(),
    };
    setActivityFeed((prev) => [entry, ...prev].slice(0, MAX_PANEL_ITEMS));
    if (!notify) return;

    const notifyType =
      entry.type === "admin" ? "warning" : entry.type === "ai" || entry.type === "assignments" ? "success" : "info";
    pushInstitutionNotification({
      title: `[${group.name}] ${safeTitle}`,
      detail: safeDetail || `${entry.actorName} posted an update for subgroup members.`,
      type: notifyType,
    });
  }

  function summarizeLibraryContext() {
    const folderCount = noteFolders.length;
    const noteCount = noteFolders.reduce((sum, folder) => sum + (Array.isArray(folder.notes) ? folder.notes.length : 0), 0);
    const activeFolderName = selectedFolder?.name || noteFolders[0]?.name || "General Notes";
    return `${folderCount} folders, ${noteCount} saved notes, active folder "${activeFolderName}".`;
  }

  function summarizeAssignmentsContext() {
    if (!assignments.length) return "No assignments created yet.";
    const stats = assignments.reduce(
      (acc, item) => {
        const status = String(item?.status || "draft");
        acc[status] = Number(acc[status] || 0) + 1;
        return acc;
      },
      {}
    );
    const top = assignments
      .slice(0, 3)
      .map((item) => `${item.title} (${item.status || "draft"})`)
      .join(", ");
    return `${assignments.length} assignments. Status: ${Object.entries(stats)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}. Latest: ${top || "None"}.`;
  }

  function applyAiSuggestionToSelectedAssignment(ideaText, sourceName) {
    if (!selectedAssignmentId) {
      return { ok: false, reason: "Select an assignment first in Assignments tab." };
    }
    const cleanIdea = safeText(ideaText);
    if (!cleanIdea) {
      return { ok: false, reason: "No idea text provided." };
    }
    let targetTitle = "";
    setAssignments((prev) =>
      prev.map((item) => {
        if (item.id !== selectedAssignmentId) return item;
        targetTitle = item.title;
        const appendBlock = `\n\n[AI Update • ${formatDateTime(Date.now())}]\nSource: ${sourceName}\n${cleanIdea}`;
        const nextBody = `${String(item.body || "").trim()}${appendBlock}`.trim();
        return {
          ...item,
          body: nextBody,
          status: item.status === "submitted" ? "submitted" : "saved",
          updatedAt: Date.now(),
        };
      })
    );
    if (!targetTitle) {
      return { ok: false, reason: "Selected assignment was not found." };
    }
    return { ok: true, assignmentTitle: targetTitle };
  }

  function buildAiReplyText(userText, requesterName, channel = "ai") {
    const cleanText = safeText(userText);
    const lower = cleanText.toLowerCase();
    const memberSummary = collaborationActors
      .map((actor) => `${actor.name} (${actor.status || "offline"})`)
      .join(", ");
    const librarySummary = summarizeLibraryContext();
    const assignmentSummary = summarizeAssignmentsContext();

    const blocks = [];
    blocks.push(
      channel === "comments"
        ? `AI comment review for ${requesterName}:`
        : `AI mode active for ${requesterName}. I can use subgroup context to help.`
    );

    if (lower.includes("member") || lower.includes("people") || lower.includes("team")) {
      blocks.push(`Members snapshot: ${memberSummary}.`);
    }

    if (lower.includes("library") || lower.includes("folder") || lower.includes("notes") || lower.includes("file")) {
      blocks.push(`Library/files snapshot: ${librarySummary}`);
    }

    if (lower.includes("assignment") || lower.includes("cat") || lower.includes("task")) {
      blocks.push(`Assignments snapshot: ${assignmentSummary}`);
    }

    let assignmentUpdate = null;
    if (/(update|improve|refine|organize|edit).*(assignment|cat)/i.test(lower) || /assignment.*(idea|suggestion)/i.test(lower)) {
      const extractedIdea = cleanText.includes(":") ? safeText(cleanText.split(":").slice(1).join(":")) : cleanText;
      const updateResult = applyAiSuggestionToSelectedAssignment(extractedIdea, requesterName);
      assignmentUpdate = updateResult;
      if (updateResult.ok) {
        blocks.push(`I updated "${updateResult.assignmentTitle}" using ${requesterName}'s idea and saved it.`);
      } else {
        blocks.push(`I can update assignments, but ${updateResult.reason}`);
      }
    }

    if (blocks.length <= 1) {
      blocks.push(`Members: ${memberSummary}.`);
      blocks.push(`Files/Library: ${librarySummary}`);
      blocks.push(`Assignments: ${assignmentSummary}`);
      blocks.push("Ask me to update assignment, summarize members, or organize tasks.");
    }

    return {
      text: blocks.join("\n\n"),
      assignmentUpdate,
    };
  }

  function sendGroupChatMessage() {
    const text = safeText(chatInput);
    if (!text) return;
    const actor = resolveActor(chatSenderId);
    const nextMessage = {
      id: makeMessageId(),
      senderId: actor.id,
      senderName: actor.name,
      text,
      createdAt: Date.now(),
    };
    setChatMessages((prev) => [...prev, nextMessage].slice(-MAX_PANEL_ITEMS));
    setChatInput("");
    logGroupActivity({
      type: "chat",
      title: "New chat message",
      detail: `${actor.name}: ${text.slice(0, 90)}`,
      actorName: actor.name,
    });
  }

  function sendCommentToAi() {
    const text = safeText(commentInput);
    if (!text) return;
    const actor = resolveActor(commentAuthorId);
    const requesterMessage = {
      id: makeMessageId(),
      senderId: actor.id,
      senderName: actor.name,
      text,
      createdAt: Date.now(),
    };
    setCommentMessages((prev) => [...prev, requesterMessage].slice(-MAX_PANEL_ITEMS));
    setCommentInput("");
    logGroupActivity({
      type: "comments",
      title: "AI comment posted",
      detail: `${actor.name} requested AI review.`,
      actorName: actor.name,
    });

    const aiResult = buildAiReplyText(text, actor.name, "comments");
    const aiMessage = {
      id: makeMessageId(),
      senderId: "ai",
      senderName: "Subgroup AI",
      text: aiResult.text,
      createdAt: Date.now() + 1,
    };
    setTimeout(() => {
      setCommentMessages((prev) => [...prev, aiMessage].slice(-MAX_PANEL_ITEMS));
      logGroupActivity({
        type: "ai",
        title: "AI comment response",
        detail: `AI responded to ${actor.name}.`,
        actorName: "Subgroup AI",
      });
      if (aiResult.assignmentUpdate?.ok) {
        logGroupActivity({
          type: "assignments",
          title: "Assignment updated by AI",
          detail: `${aiResult.assignmentUpdate.assignmentTitle} updated from ${actor.name}'s idea.`,
          actorName: "Subgroup AI",
        });
      }
    }, 220);
  }

  function sendAiPrompt() {
    const text = safeText(aiInput);
    if (!text) return;
    const actor = resolveActor(aiRequesterId);
    const requesterMessage = {
      id: makeMessageId(),
      senderId: actor.id,
      senderName: actor.name,
      text,
      createdAt: Date.now(),
    };
    setAiMessages((prev) => [...prev, requesterMessage].slice(-MAX_PANEL_ITEMS));
    setAiInput("");
    setAiThinking(true);
    logGroupActivity({
      type: "ai",
      title: "AI request sent",
      detail: `${actor.name} asked AI for subgroup help.`,
      actorName: actor.name,
    });

    const aiResult = buildAiReplyText(text, actor.name, "ai");
    const aiMessage = {
      id: makeMessageId(),
      senderId: "ai",
      senderName: "Subgroup AI",
      text: aiResult.text,
      createdAt: Date.now() + 1,
    };
    setTimeout(() => {
      setAiMessages((prev) => [...prev, aiMessage].slice(-MAX_PANEL_ITEMS));
      setAiThinking(false);
      logGroupActivity({
        type: "ai",
        title: "AI response delivered",
        detail: `AI responded with subgroup context for ${actor.name}.`,
        actorName: "Subgroup AI",
      });
      if (aiResult.assignmentUpdate?.ok) {
        logGroupActivity({
          type: "assignments",
          title: "Assignment updated by AI",
          detail: `${aiResult.assignmentUpdate.assignmentTitle} updated from ${actor.name}'s idea.`,
          actorName: "Subgroup AI",
        });
      }
    }, 280);
  }

  function createFolder() {
    if (!canSaveNotes) {
      alert("Members are not allowed to save notes/files right now.");
      return;
    }
    const name = String(newFolderName || "").trim();
    if (!name) {
      alert("Folder name is required.");
      return;
    }
    const nextFolder = {
      id: makeFolderId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: [],
    };
    setNoteFolders((prev) => [nextFolder, ...prev]);
    setSelectedFolderId(nextFolder.id);
    setNewFolderName("");
    setIsFolderCreateOpen(false);
    setNotesStatus(`Folder "${name}" created.`);
    logGroupActivity({
      type: "files",
      title: "Folder created",
      detail: `Folder "${name}" created for subgroup files/notes.`,
      actorName: "You",
    });
    setTimeout(() => setNotesStatus(""), 1800);
  }

  function saveBoardNote() {
    const text = String(buildBoardSnapshotText() || "").trim();
    if (!text) {
      alert("Whiteboard and shared typing space are empty.");
      return;
    }
    const result = saveNoteToFiles({
      title: `Board Snapshot ${new Date().toLocaleDateString()}`,
      content: text,
    });
    if (!result.ok) {
      alert(result.message);
      return;
    }
    setNotesStatus(result.message);
    logGroupActivity({
      type: "files",
      title: "Board snapshot saved",
      detail: result.message,
      actorName: "You",
    });
    setTimeout(() => setNotesStatus(""), 1800);
  }

  function saveSharedTypingNote() {
    const text = String(boardText || "").trim();
    if (!text) {
      alert("Shared typing space is empty.");
      return;
    }
    const result = saveNoteToFiles({
      title: `Shared Typing ${new Date().toLocaleDateString()}`,
      content: text,
    });
    if (!result.ok) {
      alert(result.message);
      return;
    }
    setSharedTypingStatus(result.message);
    logGroupActivity({
      type: "files",
      title: "Shared typing saved",
      detail: result.message,
      actorName: "You",
    });
    setTimeout(() => setSharedTypingStatus(""), 1800);
  }

  function saveNoteToFiles({ title, content, folderId }) {
    if (!canSaveNotes) {
      return { ok: false, message: "Members are not allowed to save notes/files right now." };
    }
    const cleanContent = String(content || "").trim();
    if (!cleanContent) {
      return { ok: false, message: "Note is empty." };
    }
    const preferredFolderId = String(folderId || selectedFolder?.id || "");
    const nextNote = {
      id: makeNoteId(),
      title: String(title || inferNoteTitle(cleanContent)).trim() || "Untitled Note",
      content: cleanContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    let resolvedFolderId = "";
    let resolvedFolderName = "";

    setNoteFolders((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const targetIndex = prev.findIndex((folder) => folder.id === preferredFolderId);
      const safeIndex = targetIndex >= 0 ? targetIndex : 0;
      const targetFolder = prev[safeIndex];
      resolvedFolderId = targetFolder.id;
      resolvedFolderName = targetFolder.name;
      return prev.map((folder, index) =>
        index === safeIndex
          ? { ...folder, notes: [nextNote, ...(folder.notes || [])], updatedAt: Date.now() }
          : folder
      );
    });

    if (!resolvedFolderId) {
      return { ok: false, message: "Create/select a folder first." };
    }
    setSelectedFolderId(resolvedFolderId);
    return {
      ok: true,
      message: `Saved to "${resolvedFolderName}".`,
      folderId: resolvedFolderId,
      folderName: resolvedFolderName,
    };
  }

  function handleNotebookSaveToFiles(notePayload) {
    const result = saveNoteToFiles({
      title: notePayload?.title,
      content: notePayload?.content,
      folderId: selectedFolder?.id || noteFolders[0]?.id,
    });
    if (result.ok) {
      setNotesStatus(`Linked note saved to "${result.folderName}".`);
      logGroupActivity({
        type: "files",
        title: "Note saved to Files",
        detail: `Saved to "${result.folderName}".`,
        actorName: "You",
      });
      setTimeout(() => setNotesStatus(""), 2000);
    }
    return { message: result.message };
  }

  function openNoteInNotes(note) {
    const nextTitle = String(note?.title || "Untitled Note");
    const nextContent = String(note?.content || "");
    setNoteEditorSeed({
      title: nextTitle,
      content: nextContent,
      token: `${note?.id || "note"}-${Date.now()}`,
    });
    setActive("notes");
  }

  function downloadNoteAsText(note) {
    const safeName =
      String(note?.title || "note")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "note";
    triggerDownload(createTextBlob(note?.content || ""), `${safeName}.txt`);
  }

  function flashAssignmentStatus(message, duration = 1800) {
    setAssignmentStatus(String(message || ""));
    if (!message) return;
    setTimeout(() => setAssignmentStatus(""), duration);
  }

  function updateSelectedAssignment(patch) {
    if (!selectedAssignmentId) return;
    setAssignments((prev) =>
      prev.map((item) =>
        item.id === selectedAssignmentId
          ? {
              ...item,
              ...patch,
              updatedAt: Date.now(),
            }
          : item
      )
    );
  }

  function createAssignmentFromDraft() {
    if (!canUploadAssignments) {
      alert("Only subgroup admins or members can upload assignments.");
      return;
    }
    const title = String(assignmentDraft.title || "").trim();
    if (!title) {
      alert("Assignment title is required.");
      return;
    }
    const next = {
      id: makeAssignmentId(),
      title,
      description: String(assignmentDraft.description || "").trim(),
      body: String(assignmentDraft.body || "").trim(),
      status: "draft",
      submittedTo: "",
      submittedBy: "",
      submittedByRole: "",
      submittedAt: 0,
      uploadedBy: "You",
      uploaderRole: group.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setAssignments((prev) => [next, ...prev]);
    setSelectedAssignmentId(next.id);
    setAssignmentDraft({ title: "", description: "", body: "" });
    flashAssignmentStatus(`Saved "${next.title}".`);
    logGroupActivity({
      type: "assignments",
      title: "Assignment uploaded",
      detail: `${next.title} was uploaded by ${next.uploadedBy}.`,
      actorName: "You",
    });
  }

  function uploadAssignmentFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!canUploadAssignments) {
      alert("Only subgroup admins or members can upload assignments.");
      return;
    }

    const next = {
      id: makeAssignmentId(),
      title: file.name.replace(/\.[^/.]+$/, "") || file.name,
      description: "Uploaded file assignment.",
      body: `Attached file: ${file.name}\nType: ${file.type || "unknown"}\nSize: ${Math.ceil(file.size / 1024)} KB`,
      status: "draft",
      submittedTo: "",
      submittedBy: "",
      submittedByRole: "",
      submittedAt: 0,
      uploadedBy: "You",
      uploaderRole: group.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setAssignments((prev) => [next, ...prev]);
    setSelectedAssignmentId(next.id);
    flashAssignmentStatus(`Uploaded file "${next.title}".`);
    logGroupActivity({
      type: "assignments",
      title: "Assignment file uploaded",
      detail: `${next.title} was created from file upload.`,
      actorName: "You",
    });
  }

  function saveAssignment() {
    if (!canUploadAssignments) {
      alert("Your role cannot edit/save assignments.");
      return;
    }
    if (!selectedAssignmentId) return;
    updateSelectedAssignment({ status: "saved" });
    flashAssignmentStatus("Assignment saved.");
    logGroupActivity({
      type: "assignments",
      title: "Assignment saved",
      detail: `${selectedAssignment?.title || "Assignment"} was saved.`,
      actorName: "You",
    });
  }

  function markAssignmentDone() {
    if (!canUploadAssignments) {
      alert("Your role cannot mark assignments as done.");
      return;
    }
    if (!selectedAssignmentId) return;
    updateSelectedAssignment({ status: "done" });
    flashAssignmentStatus("Assignment marked done.");
    logGroupActivity({
      type: "assignments",
      title: "Assignment marked done",
      detail: `${selectedAssignment?.title || "Assignment"} marked as done.`,
      actorName: "You",
    });
  }

  function submitAssignment(target) {
    if (!canAdmin) {
      alert("Only subgroup admin can submit to lecturer or department.");
      return;
    }
    if (!selectedAssignmentId) return;
    const submittedAt = Date.now();
    updateSelectedAssignment({
      status: "submitted",
      submittedTo: target,
      submittedBy: "Admin",
      submittedByRole: group.role,
      submittedAt,
    });
    flashAssignmentStatus(`Submitted to ${target}.`);
    logGroupActivity({
      type: "assignments",
      title: "Assignment submitted",
      detail: `${selectedAssignment?.title || "Assignment"} submitted to ${target}.`,
      actorName: "Admin",
    });
  }

  function requestAdminAssignmentSubmission(target) {
    if (canAdmin) {
      submitAssignment(target);
      return;
    }
    if (!selectedAssignment) return;
    const normalizedTarget = target === "department" ? "department" : "lecturer";
    flashAssignmentStatus(`Submission request sent to admin (${normalizedTarget}).`);
    pushInstitutionNotification({
      title: `[${group.name}] Assignment submission request`,
      detail: `A member requested "${selectedAssignment.title}" to be submitted to ${normalizedTarget}.`,
      type: "warning",
    });
    logGroupActivity({
      type: "assignments",
      title: "Submission requested",
      detail: `${selectedAssignment.title} requested for submission to ${normalizedTarget}.`,
      actorName: "Member",
    });
  }

  function deleteSelectedAssignment() {
    if (!canUploadAssignments) {
      alert("Your role cannot delete assignments.");
      return;
    }
    if (!selectedAssignment) return;
    const ok = window.confirm(`Delete assignment "${selectedAssignment.title}"?`);
    if (!ok) return;
    const removedTitle = selectedAssignment.title;
    setAssignments((prev) => prev.filter((item) => item.id !== selectedAssignment.id));
    setSelectedAssignmentId("");
    flashAssignmentStatus(`Deleted "${removedTitle}".`);
    logGroupActivity({
      type: "assignments",
      title: "Assignment deleted",
      detail: `${removedTitle} was deleted.`,
      actorName: "You",
    });
  }

  async function shareAssignmentLink() {
    if (!canShareAssignmentLinks) {
      alert("Sharing links is disabled for members by admin policy.");
      return;
    }
    if (!selectedAssignment) return;
    const link = `${window.location.origin}/institution/subgroups/${group.id}/assignments/${selectedAssignment.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement("textarea");
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setShareStatus("Share link copied.");
      logGroupActivity({
        type: "assignments",
        title: "Assignment link shared",
        detail: `${selectedAssignment.title} share link copied.`,
        actorName: "You",
      });
      setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus("Could not copy link.");
      setTimeout(() => setShareStatus(""), 1800);
    }
  }

  function buildExportText(item) {
    return [
      `Assignment: ${item.title}`,
      `Description: ${item.description || "-"}`,
      `Status: ${item.status || "draft"}`,
      `Uploaded by: ${item.uploadedBy || "Unknown"} (${item.uploaderRole || "member"})`,
      `Created: ${formatDateTime(item.createdAt)}`,
      `Updated: ${formatDateTime(item.updatedAt)}`,
      `Submitted to: ${item.submittedTo || "Not submitted"}`,
      `Submitted by: ${item.submittedBy ? `${item.submittedBy} (${item.submittedByRole || "admin"})` : "N/A"}`,
      `Submitted at: ${item.submittedAt ? formatDateTime(item.submittedAt) : "N/A"}`,
      "",
      item.body || "No assignment content.",
    ].join("\n");
  }

  function downloadAssignment(kind) {
    if (!selectedAssignment) return;
    const baseName = String(selectedAssignment.title || "assignment")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "assignment";
    const body = buildExportText(selectedAssignment);

    if (kind === "pdf") {
      triggerDownload(createSimplePdfBlob(body), `${baseName}.pdf`);
      return;
    }
    if (kind === "word") {
      triggerDownload(createWordBlob(selectedAssignment.title, body), `${baseName}.doc`);
      return;
    }
    triggerDownload(createTextBlob(body), `${baseName}.txt`);
  }

  const generalSettingsFields = (
    <div className="space-y-2">
      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">Auto-save notes and files</span>
        <input
          type="checkbox"
          checked={generalSettings.autoSave}
          onChange={(event) =>
            setGeneralSettings((prev) => ({ ...prev, autoSave: event.target.checked }))
          }
          className="h-4 w-4"
        />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">Show presence status</span>
        <input
          type="checkbox"
          checked={generalSettings.showPresence}
          onChange={(event) =>
            setGeneralSettings((prev) => ({ ...prev, showPresence: event.target.checked }))
          }
          className="h-4 w-4"
        />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">Mute subgroup alerts</span>
        <input
          type="checkbox"
          checked={generalSettings.muteAlerts}
          onChange={(event) =>
            setGeneralSettings((prev) => ({ ...prev, muteAlerts: event.target.checked }))
          }
          className="h-4 w-4"
        />
      </label>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-xs font-semibold text-slate-500">Language</div>
        <select
          value={generalLanguage}
          onChange={(event) => setGeneralLanguage(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="english">English</option>
          <option value="kiswahili">Kiswahili</option>
          <option value="french">French</option>
          <option value="spanish">Spanish</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center text-sm font-semibold text-slate-700">
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt="Class profile" className="h-full w-full object-cover" />
              ) : (
                (group.name || "G")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((x) => x[0] || "")
                  .join("")
                  .toUpperCase()
              )}
            </div>

            <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900 truncate">{group.name}</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Pill text={group.course} />
              <Pill text={group.visibility === "public" ? "Public Group" : "Private Group"} />
              <Pill text={group.locked ? "Locked" : "Unlocked"} />
              <Pill text={group.role} />
              {canAdmin && pendingJoinRequests.length > 0 ? (
                <Pill text={`${pendingJoinRequests.length} Join Requests`} />
              ) : null}
            </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="hidden md:block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Search notes/files..."
            />

            <div ref={createMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsCreateMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3.5 py-2 text-sm font-semibold hover:bg-slate-800"
                title="Create / Join"
              >
                <Plus size={16} />
                Create
              </button>

              {isCreateMenuOpen ? (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl z-30 overflow-hidden">
                  <button
                    type="button"
                    onClick={openJoinDialog}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    Join class
                  </button>
                  <button
                    type="button"
                    onClick={openCreateClassDialog}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Create class
                  </button>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy invite link
                  </button>
                  <button
                    type="button"
                    onClick={shareInviteViaWhatsApp}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <MessagesSquare size={16} />
                    Share to WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={shareInviteViaEmail}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Mail size={16} />
                    Share via Email
                  </button>
                  <button
                    type="button"
                    onClick={openRequestAccessDialog}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Request access
                  </button>
                </div>
              ) : null}
            </div>

            <Dropdown
              label="More"
              items={[
                { label: "Export board", onClick: () => alert("Export later") },
                { label: "Open audit log", onClick: () => setRightTab("activity") },
                { label: "Report issue", onClick: () => alert("Report later") },
              ]}
            />
          </div>
        </div>
      </div>

      {joinStatus ? (
        <div className="mx-auto max-w-7xl px-6 pt-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {joinStatus}
          </div>
        </div>
      ) : null}
      {inviteStatus ? (
        <div className="mx-auto max-w-7xl px-6 pt-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">{inviteStatus}</div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-12 gap-6">
        <aside
          className={[
            "col-span-12 transition-all",
            isLeftSidebarCollapsed ? "col-span-1 md:col-span-1 lg:col-span-1" : "md:col-span-3 lg:col-span-2",
          ].join(" ")}
        >
          {isLeftSidebarCollapsed ? (
            <div className="relative rounded-2xl bg-white border border-slate-200 shadow-sm h-full min-h-[120px] p-1.5 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={expandLeftSidebar}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-white"
                title="Expand sidebar"
              >
                <ChevronRight size={14} className="mx-auto" />
              </button>
              <div ref={subgroupMenuRef} className="relative">
                <button
                  type="button"
                  onClick={toggleSubgroupListPopup}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
                  title="Open subgroup list"
                >
                  <KanbanSquare size={13} />
                </button>
                <div className="mt-1 text-[10px] font-semibold text-slate-500 text-center uppercase tracking-wide">
                  Menu
                </div>
                {isGroupListPopupOpen ? renderGroupListPopup("left-full top-9 ml-2") : null}
              </div>
              <div className="mt-1 w-full flex flex-col items-center gap-1">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleLeftNavSelect(item.key)}
                      title={item.label}
                      className={[
                        "h-8 w-8 rounded-lg border flex items-center justify-center",
                        active === item.key
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-visible">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div ref={subgroupMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={toggleSubgroupListPopup}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      title="Open subgroup list"
                    >
                      <KanbanSquare size={13} />
                      <span>Subgroup Menu</span>
                      <ChevronDown size={12} className={isGroupListPopupOpen ? "rotate-180" : ""} />
                    </button>

                    {isGroupListPopupOpen ? renderGroupListPopup("left-0 top-full mt-2") : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleLeftPanels}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <ChevronDown size={13} className={isLeftPanelsOpen ? "" : "-rotate-90"} />
                      {isLeftPanelsOpen ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLeftSidebarCollapsed(true)}
                      className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900"
                      title="Collapse left sidebar"
                    >
                      <ChevronLeft size={14} />
                    </button>
                  </div>
                </div>
                {isLeftPanelsOpen ? (
                  <nav className="p-2 space-y-1">
                    {visibleNavItems.map((item) => (
                        <NavItem
                          key={item.key}
                          label={item.label}
                          icon={item.icon}
                          active={active === item.key}
                          onClick={() => handleLeftNavSelect(item.key)}
                        />
                    ))}
                  </nav>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Users size={15} className="text-slate-600" />
                      <span>Live Members</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {onlineMembers}/{members.length} online
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleLeftPanels}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <ChevronDown size={13} className={isLeftPanelsOpen ? "" : "-rotate-90"} />
                    {isLeftPanelsOpen ? "Hide" : "Show"}
                  </button>
                </div>
                {isLeftPanelsOpen ? (
                  <div className="p-4 space-y-2">
                    {members.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        No members yet. Approve requests to populate this list.
                      </div>
                    ) : (
                      members.map((m) => {
                        const isMuted = mutedMemberIds.includes(m.id);
                        return (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <div className="min-w-0 flex items-center gap-2">
                              <div className="relative shrink-0">
                                <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 flex items-center justify-center">
                                  {memberInitials(m.name)}
                                </div>
                                <span
                                  className={[
                                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white",
                                    memberStatusDotClass(m.status),
                                  ].join(" ")}
                                />
                              </div>
                              <div className="text-slate-800 truncate">{m.name}</div>
                            </div>
                            <div
                              className={[
                                "text-xs capitalize",
                                isMuted ? "text-amber-600" : memberStatusTextClass(m.status),
                              ].join(" ")}
                            >
                              {isMuted ? "muted" : m.status}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </aside>

        <main
          className={[
            "col-span-12 transition-all",
            isLeftSidebarCollapsed
              ? isRightPanelCollapsed
                ? "col-span-12 md:col-span-10 lg:col-span-10"
                : "col-span-12 md:col-span-8 lg:col-span-8"
              : isRightPanelCollapsed
                ? "col-span-12 md:col-span-8 lg:col-span-9"
                : "col-span-12 md:col-span-6 lg:col-span-7",
          ].join(" ")}
        >
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {active === "board"
                    ? "Shared Board"
                    : active === "assignments"
                      ? "Group Assignments"
                      : active[0].toUpperCase() + active.slice(1)}
                </div>
                <div className="text-xs text-slate-500">
                  {active === "board"
                    ? "Shared canvas whiteboard with member + AI cursors."
                    : active === "assignments"
                    ? "Frontend workflow for upload, save, export, and role-based submission."
                    : active === "notes"
                      ? "Using full Notes editor tools. Saved notes are linked to Files."
                      : active === "settings"
                        ? "General preferences for subgroup frontend behavior."
                      : active === "admin"
                        ? "Admin controls for group lifecycle, member access, and policy."
                    : "Phase 1: shared notes + presence + uploads"}
                </div>
              </div>

              {active === "board" && canAdmin ? (
                <Dropdown
                  label="Admin Controls"
                  items={[
                    { label: isBoardLocked ? "Unlock board" : "Lock board", onClick: toggleBoardLock },
                    { label: "Mute/Unmute member", onClick: toggleMutedMemberFromAdminControls },
                    { label: "Remove member", onClick: removeMemberFromAdminControls },
                  ]}
                />
              ) : null}
            </div>

            <div className="p-5">
              {active === "board" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-700">
                    Shared whiteboard with members and AI cursors. Draw together and save board snapshots to Files.
                  </div>
                  {isBoardLocked ? (
                    <div className="mt-2 text-xs text-rose-700">Board is locked by admin. Unlock to continue drawing or typing.</div>
                  ) : null}
                  {mutedMembersCount > 0 ? (
                    <div className="mt-1 text-xs text-amber-700">
                      Muted members on board: {mutedMembersCount}
                    </div>
                  ) : null}
                  <div
                    className={[
                      "mt-3 flex flex-wrap items-center gap-2",
                      isBoardLocked ? "opacity-60 pointer-events-none" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setBoardTool("pen")}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                        boardTool === "pen"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Pen
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoardTool("eraser")}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                        boardTool === "eraser"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Eraser
                    </button>
                    <input
                      type="color"
                      value={boardColor}
                      onChange={(event) => setBoardColor(event.target.value)}
                      className="h-8 w-10 rounded-lg border border-slate-200 bg-white p-1"
                      title="Brush color"
                    />
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                      Width
                      <input
                        type="range"
                        min={2}
                        max={14}
                        step={1}
                        value={boardStrokeWidth}
                        onChange={(event) => setBoardStrokeWidth(Number(event.target.value))}
                      />
                      <span className="min-w-[1.25rem] text-right">{boardStrokeWidth}</span>
                    </label>
                    <button
                      type="button"
                      onClick={undoBoardStroke}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={clearBoardCanvas}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={addMemberStroke}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Member Sketch
                    </button>
                    <button
                      type="button"
                      onClick={addAiStroke}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      AI Sketch
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Saving board notes goes to folder: <b>{selectedFolder?.name || "No folder selected"}</b>
                  </div>
                  <div className="mt-3 relative">
                    <div
                      ref={boardCanvasWrapRef}
                      className="relative h-[400px] md:h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white touch-none"
                    >
                      <canvas
                        ref={boardCanvasRef}
                        className="h-full w-full cursor-crosshair select-none touch-none"
                        onPointerDown={handleBoardPointerDown}
                        onPointerMove={handleBoardPointerMove}
                        onPointerUp={endBoardStroke}
                        onPointerLeave={endBoardStroke}
                      />
                      {generalSettings.showPresence
                        ? Object.values(boardCursors || {}).map((cursor) => (
                            <div
                              key={cursor.id}
                              className="absolute pointer-events-none"
                              style={{
                                left: `${Math.max(0, Number(cursor.x || 0))}px`,
                                top: `${Math.max(0, Number(cursor.y || 0))}px`,
                                transform: "translate(-50%, -50%)",
                              }}
                            >
                              <div
                                className="h-3 w-3 rounded-full border-2 border-white shadow"
                                style={{ backgroundColor: String(cursor.color || "#0f172a") }}
                              />
                              <div
                                className="mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
                                style={{ backgroundColor: String(cursor.color || "#0f172a") }}
                              >
                                {cursor.label}
                              </div>
                            </div>
                          ))
                        : null}
                      {isBoardLocked ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/65 text-sm font-semibold text-slate-700">
                          Board locked
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
                    <button
                      type="button"
                      onClick={() => setIsSharedTypingOpen((prev) => !prev)}
                      className="w-full rounded-lg px-2 py-2 flex items-center justify-between text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <span>Shared Typing Space</span>
                      <ChevronDown
                        size={16}
                        className={["text-slate-500 transition-transform", isSharedTypingOpen ? "rotate-180" : ""].join(" ")}
                      />
                    </button>

                    {isSharedTypingOpen ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={boardText}
                          onChange={(event) => setBoardText(event.target.value)}
                          disabled={isBoardLocked}
                          placeholder="Type shared notes here (optional)..."
                          className="w-full min-h-[140px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveSharedTypingNote}
                            disabled={!canSaveNotes || isBoardLocked}
                            className={[
                              "rounded-lg px-3 py-1.5 text-xs font-semibold",
                              canSaveNotes && !isBoardLocked
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "bg-slate-200 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Save Typing to Files
                          </button>
                          <button
                            type="button"
                            onClick={() => setBoardText("")}
                            disabled={isBoardLocked}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            Clear Typing
                          </button>
                        </div>
                        {sharedTypingStatus ? (
                          <div className="text-xs text-emerald-700">{sharedTypingStatus}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={saveBoardNote}
                      disabled={!canSaveNotes}
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-semibold",
                        canSaveNotes
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      Save (local)
                    </button>
                  </div>
                  {boardStatus ? <div className="mt-2 text-xs text-sky-700">{boardStatus}</div> : null}
                  {notesStatus ? <div className="mt-2 text-xs text-emerald-700">{notesStatus}</div> : null}
                </div>
              ) : active === "notes" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <Link2 size={15} />
                      Linked save target: <b>{selectedFolder?.name || "No folder selected"}</b>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActive("files")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open Files
                    </button>
                  </div>
                  {!canSaveNotes ? (
                    <div className="text-xs text-amber-700">
                      Admin has disabled save notes/files for members.
                    </div>
                  ) : null}
                  {notesStatus ? <div className="text-xs text-emerald-700">{notesStatus}</div> : null}
                  <NotebookPage
                    embedded
                    initialTitle={noteEditorSeed.title}
                    initialBody={noteEditorSeed.content}
                    loadToken={noteEditorSeed.token}
                    onSaveNote={handleNotebookSaveToFiles}
                  />
                </div>
              ) : active === "files" ? (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 lg:col-span-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">Folders</div>
                        <button
                          type="button"
                          onClick={() => setIsFolderCreateOpen((prev) => !prev)}
                          disabled={!canSaveNotes}
                          className={[
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                            canSaveNotes
                              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                          ].join(" ")}
                          title={isFolderCreateOpen ? "Hide create folder" : "Create folder"}
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {isFolderCreateOpen ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={newFolderName}
                            onChange={(event) => setNewFolderName(event.target.value)}
                            disabled={!canSaveNotes}
                            placeholder="New folder"
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={createFolder}
                            disabled={!canSaveNotes}
                            className={[
                              "rounded-xl px-3 py-2 text-sm font-semibold",
                              canSaveNotes
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "bg-slate-200 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Add
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-2 max-h-[420px] overflow-auto">
                        {noteFolders.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => setSelectedFolderId(folder.id)}
                            className={[
                              "w-full text-left rounded-xl border px-3 py-3",
                              selectedFolder?.id === folder.id
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen size={15} />
                              <span className="text-sm font-semibold truncate">{folder.name}</span>
                            </div>
                            <div
                              className={
                                selectedFolder?.id === folder.id
                                  ? "mt-1 text-[11px] text-slate-300"
                                  : "mt-1 text-[11px] text-slate-500"
                              }
                            >
                              {(folder.notes || []).length} saved notes
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-8">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedFolder ? selectedFolder.name : "Notes"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedFolder ? `${(selectedFolder.notes || []).length} notes` : "0 notes"}
                        </div>
                      </div>

                      {selectedFolder && (selectedFolder.notes || []).length > 0 ? (
                        <div className="mt-3 space-y-3 max-h-[520px] overflow-auto">
                          {selectedFolder.notes.map((note) => (
                            <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{note.title}</div>
                                  <div className="text-[11px] text-slate-500">{formatDateTime(note.updatedAt)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openNoteInNotes(note)}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadNoteAsText(note)}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
                                {note.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          No saved notes in this folder yet. Save one from Board or Notes.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : active === "members" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">Subgroup Members</div>
                    <div className="text-xs text-slate-500">{members.length} members</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {members.map((member) => {
                      const isOpen = expandedMemberId === member.id;
                      const isMuted = mutedMemberIds.includes(member.id);
                      return (
                        <div key={member.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedMemberId((prev) => (prev === member.id ? "" : member.id))}
                            className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                          >
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                                  {memberInitials(member.name)}
                                </div>
                                <span
                                  className={[
                                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
                                    memberStatusDotClass(member.status),
                                  ].join(" ")}
                                />
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="text-sm font-semibold text-slate-900 truncate">{member.name}</div>
                                <div
                                  className={[
                                    "text-xs capitalize",
                                    isMuted ? "text-amber-600" : memberStatusTextClass(member.status),
                                  ].join(" ")}
                                >
                                  {isMuted ? "muted" : member.status}
                                </div>
                              </div>
                            </div>

                            <ChevronDown
                              size={16}
                              className={["text-slate-500 transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
                            />
                          </button>

                          {isOpen ? (
                            <div className="border-t border-slate-200 px-3 py-2.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Name</span>
                                <span className="text-slate-800 text-right break-all">{member.name}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Email</span>
                                <span className="text-slate-800 text-right break-all">{member.email}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Registration No.</span>
                                <span className="text-slate-800 text-right break-all">{member.registrationNumber}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Group role</span>
                                <span className={member.groupRole === "admin" ? "text-indigo-700" : "text-slate-700"}>
                                  {member.groupRole === "admin" ? "Admin" : "Member"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-500">Board Access</span>
                                <span className={isMuted ? "text-amber-700" : "text-emerald-700"}>
                                  {isMuted ? "Muted" : "Active"}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : active === "admin" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Admin Control Center</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Admin controls: create/delete group, permissions, members, and submission policy.
                    </div>
                    <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Assignments + CAT submission: Admin only
                    </div>
                    {adminStatus ? (
                      <div className="mt-2 text-xs text-emerald-700">{adminStatus}</div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">Join Requests</div>
                      <div className="text-xs text-slate-500">{pendingJoinRequests.length} pending</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {pendingJoinRequests.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          No pending requests.
                        </div>
                      ) : (
                        pendingJoinRequests.map((request) => (
                          <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-900">{request.name}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {request.email} | {request.registrationNumber}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              Source: {request.source} | {formatDateTime(request.createdAt)}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => admitJoinRequest(request.id)}
                                disabled={!canAdmin}
                                className={[
                                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                                  canAdmin
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                    : "bg-slate-200 text-slate-500 cursor-not-allowed",
                                ].join(" ")}
                              >
                                Admit
                              </button>
                              <button
                                type="button"
                                onClick={() => denyJoinRequest(request.id)}
                                disabled={!canAdmin}
                                className={[
                                  "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                                  canAdmin
                                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                                ].join(" ")}
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 xl:col-span-6">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-900">Create / Update Group</div>
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-600">
                            {adminGroupDraft.avatarUrl ? (
                              <img src={adminGroupDraft.avatarUrl} alt="Group avatar" className="h-full w-full object-cover" />
                            ) : (
                              memberInitials(adminGroupDraft.name || "SG")
                            )}
                          </div>
                          <div className="flex-1">
                            <button
                              type="button"
                              onClick={() => adminGroupAvatarInputRef.current?.click()}
                              disabled={!canAdmin}
                              className={[
                                "rounded-xl border px-3 py-2 text-sm font-semibold",
                                canAdmin
                                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                              ].join(" ")}
                            >
                              Add group photo
                            </button>
                            <input
                              ref={adminGroupAvatarInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAdminGroupAvatarSelect}
                            />
                          </div>
                        </div>
                        <input
                          value={adminGroupDraft.name}
                          onChange={(event) =>
                            setAdminGroupDraft((prev) => ({ ...prev, name: event.target.value }))
                          }
                          disabled={!canAdmin}
                          placeholder="Group name"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                        />
                        <input
                          value={adminGroupDraft.course}
                          onChange={(event) =>
                            setAdminGroupDraft((prev) => ({ ...prev, course: event.target.value }))
                          }
                          disabled={!canAdmin}
                          placeholder="Course / Department"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-xs font-semibold text-slate-500">Visibility</div>
                            <select
                              value={adminGroupDraft.visibility}
                              onChange={(event) =>
                                setAdminGroupDraft((prev) => ({ ...prev, visibility: event.target.value }))
                              }
                              disabled={!canAdmin}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none disabled:text-slate-400"
                            >
                              <option value="private">Private (approval required)</option>
                              <option value="public">Public (instant join)</option>
                            </select>
                          </label>
                          <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-xs font-semibold text-slate-500">Invite code</div>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                value={adminGroupDraft.inviteCode}
                                onChange={(event) =>
                                  setAdminGroupDraft((prev) => ({
                                    ...prev,
                                    inviteCode: event.target.value.toUpperCase(),
                                  }))
                                }
                                disabled={!canAdmin}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none disabled:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => setAdminGroupDraft((prev) => ({ ...prev, inviteCode: makeInviteCode() }))}
                                disabled={!canAdmin}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
                              >
                                New
                              </button>
                            </div>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={copyInviteLink}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                          >
                            <Copy size={14} />
                            Copy invite link
                          </button>
                          <button
                            type="button"
                            onClick={shareInviteViaWhatsApp}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                          >
                            <MessagesSquare size={14} />
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={shareInviteViaEmail}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                          >
                            <Mail size={14} />
                            Email
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveAdminGroup}
                            disabled={!canAdmin}
                            className={[
                              "rounded-xl px-4 py-2 text-sm font-semibold",
                              canAdmin
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "bg-slate-200 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Save Group
                          </button>
                          <button
                            type="button"
                            onClick={deleteCurrentGroup}
                            disabled={!canAdmin}
                            className={[
                              "rounded-xl border px-4 py-2 text-sm font-semibold",
                              canAdmin
                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Delete Group
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 xl:col-span-6">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-900">Members Permission Policy</div>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-sm text-slate-700">Allow members to upload assignments</span>
                          <input
                            type="checkbox"
                            checked={memberPolicy.canUploadAssignments}
                            onChange={(event) =>
                              setMemberPolicy((prev) => ({ ...prev, canUploadAssignments: event.target.checked }))
                            }
                            disabled={!canAdmin}
                            className="h-4 w-4"
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-sm text-slate-700">Allow members to save notes/files</span>
                          <input
                            type="checkbox"
                            checked={memberPolicy.canSaveNotes}
                            onChange={(event) =>
                              setMemberPolicy((prev) => ({ ...prev, canSaveNotes: event.target.checked }))
                            }
                            disabled={!canAdmin}
                            className="h-4 w-4"
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-sm text-slate-700">Allow members to share links</span>
                          <input
                            type="checkbox"
                            checked={memberPolicy.canShareLinks}
                            onChange={(event) =>
                              setMemberPolicy((prev) => ({ ...prev, canShareLinks: event.target.checked }))
                            }
                            disabled={!canAdmin}
                            className="h-4 w-4"
                          />
                        </label>
                        <div className="rounded-xl border border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Submitting assignments and CATs to lecturer/department is locked to admin only.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Admin Transfer & Leave Group</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Promote any member to admin. Admin can leave after handing over admin rights.
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select
                        value={handoverMemberId}
                        onChange={(event) => setHandoverMemberId(event.target.value)}
                        disabled={!canAdmin}
                        className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                      >
                        <option value="">Select member to promote</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} ({member.groupRole === "admin" ? "admin" : "member"})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => promoteMemberToAdmin(handoverMemberId)}
                        disabled={!canAdmin || !handoverMemberId}
                        className={[
                          "rounded-xl px-3 py-2 text-sm font-semibold",
                          canAdmin && handoverMemberId
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed",
                        ].join(" ")}
                      >
                        Make Admin
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={leaveGroupAndTransferAdmin}
                      disabled={!canAdmin || !handoverMemberId}
                      className={[
                        "mt-3 rounded-xl border px-3 py-2 text-sm font-semibold",
                        canAdmin && handoverMemberId
                          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                      ].join(" ")}
                    >
                      Leave Group and Transfer Admin
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Add / Remove Members</div>
                    <div className="mt-3 grid grid-cols-12 gap-2">
                      <input
                        value={newMemberDraft.name}
                        onChange={(event) =>
                          setNewMemberDraft((prev) => ({ ...prev, name: event.target.value }))
                        }
                        disabled={!canAdmin}
                        placeholder="Full name"
                        className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                      />
                      <input
                        value={newMemberDraft.email}
                        onChange={(event) =>
                          setNewMemberDraft((prev) => ({ ...prev, email: event.target.value }))
                        }
                        disabled={!canAdmin}
                        placeholder="Email"
                        className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                      />
                      <input
                        value={newMemberDraft.registrationNumber}
                        onChange={(event) =>
                          setNewMemberDraft((prev) => ({ ...prev, registrationNumber: event.target.value }))
                        }
                        disabled={!canAdmin}
                        placeholder="Registration number"
                        className="col-span-12 md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                      />
                      <select
                        value={newMemberDraft.status}
                        onChange={(event) =>
                          setNewMemberDraft((prev) => ({ ...prev, status: event.target.value }))
                        }
                        disabled={!canAdmin}
                        className="col-span-8 md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:text-slate-400"
                      >
                        <option value="online">Online</option>
                        <option value="away">Away</option>
                        <option value="offline">Offline</option>
                      </select>
                      <button
                        type="button"
                        onClick={addMemberFromAdmin}
                        disabled={!canAdmin}
                        className={[
                          "col-span-4 md:col-span-1 rounded-xl px-3 py-2 text-sm font-semibold",
                          canAdmin
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed",
                        ].join(" ")}
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {members.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          No members in this subgroup.
                        </div>
                      ) : (
                        members.map((member) => (
                          <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-3">
                                <div className="relative shrink-0">
                                  <div className="h-9 w-9 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center">
                                    {memberInitials(member.name)}
                                  </div>
                                  <span
                                    className={[
                                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white",
                                      memberStatusDotClass(member.status),
                                    ].join(" ")}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">
                                    {member.name}
                                    {member.groupRole === "admin" ? (
                                      <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                        admin
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {member.email} | {member.registrationNumber}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMemberFromAdmin(member.id)}
                                disabled={!canAdmin}
                                className={[
                                  "rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                                  canAdmin
                                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                                ].join(" ")}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                                Upload assignments
                                <input
                                  type="checkbox"
                                  checked={Boolean(member.permissions?.canUploadAssignments)}
                                  onChange={(event) =>
                                    updateMemberPermission(member.id, "canUploadAssignments", event.target.checked)
                                  }
                                  disabled={!canAdmin}
                                  className="h-4 w-4"
                                />
                              </label>
                              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                                Save notes/files
                                <input
                                  type="checkbox"
                                  checked={Boolean(member.permissions?.canSaveNotes)}
                                  onChange={(event) =>
                                    updateMemberPermission(member.id, "canSaveNotes", event.target.checked)
                                  }
                                  disabled={!canAdmin}
                                  className="h-4 w-4"
                                />
                              </label>
                              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                                Share links
                                <input
                                  type="checkbox"
                                  checked={Boolean(member.permissions?.canShareLinks)}
                                  onChange={(event) =>
                                    updateMemberPermission(member.id, "canShareLinks", event.target.checked)
                                  }
                                  disabled={!canAdmin}
                                  className="h-4 w-4"
                                />
                              </label>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : active === "settings" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">General Settings</div>
                  <div className="mt-1 text-xs text-slate-500">
                    General subgroup preferences.
                  </div>
                  <div className="mt-3">{generalSettingsFields}</div>
                </div>
              ) : active === "assignments" ? (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 xl:col-span-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">Upload Assignment</div>
                        <div className="text-[11px] text-slate-500">
                          {canUploadAssignments ? "Admin/Member" : "Read-only role"}
                        </div>
                      </div>

                      {canUploadAssignments ? (
                        <div className="mt-3 space-y-2">
                          <input
                            value={assignmentDraft.title}
                            onChange={(event) =>
                              setAssignmentDraft((prev) => ({ ...prev, title: event.target.value }))
                            }
                            placeholder="Assignment title"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                          <input
                            value={assignmentDraft.description}
                            onChange={(event) =>
                              setAssignmentDraft((prev) => ({ ...prev, description: event.target.value }))
                            }
                            placeholder="Short description"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                          <textarea
                            value={assignmentDraft.body}
                            onChange={(event) =>
                              setAssignmentDraft((prev) => ({ ...prev, body: event.target.value }))
                            }
                            rows={5}
                            placeholder="Assignment instructions..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={createAssignmentFromDraft}
                              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                            >
                              Save Upload
                            </button>
                            <label className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                              Upload File
                              <input type="file" className="hidden" onChange={uploadAssignmentFile} />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-600">
                          Your role cannot upload assignments. Ask subgroup admin to upload.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Group Assignment List</div>
                      <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
                        {assignments.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            No assignments yet. Upload one to get started.
                          </div>
                        ) : (
                          assignments.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedAssignmentId(item.id)}
                            className={[
                              "w-full text-left rounded-xl border px-3 py-3",
                              selectedAssignmentId === item.id
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  item.status === "submitted"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "done"
                                      ? "bg-sky-100 text-sky-700"
                                      : item.status === "saved"
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-slate-100 text-slate-700",
                                ].join(" ")}
                              >
                                {item.status || "draft"}
                              </span>
                            </div>
                            <div className={selectedAssignmentId === item.id ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"}>
                              {item.description || "No description"}
                            </div>
                            <div className={selectedAssignmentId === item.id ? "mt-1 text-[11px] text-slate-300" : "mt-1 text-[11px] text-slate-500"}>
                              {item.uploadedBy} • {formatDateTime(item.updatedAt || item.createdAt)}
                            </div>
                          </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 xl:col-span-7">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {selectedAssignment ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">Assignment Details</div>
                            <div className="text-xs text-slate-500">
                              Uploaded by {selectedAssignment.uploadedBy} ({selectedAssignment.uploaderRole})
                            </div>
                          </div>

                          <input
                            value={selectedAssignment.title}
                            onChange={(event) => updateSelectedAssignment({ title: event.target.value })}
                            readOnly={!canUploadAssignments}
                            className={[
                              "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none",
                              canUploadAssignments ? "bg-white" : "bg-slate-100 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          />
                          <input
                            value={selectedAssignment.description || ""}
                            onChange={(event) => updateSelectedAssignment({ description: event.target.value })}
                            readOnly={!canUploadAssignments}
                            className={[
                              "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none",
                              canUploadAssignments ? "bg-white" : "bg-slate-100 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          />
                          <textarea
                            value={selectedAssignment.body || ""}
                            onChange={(event) => updateSelectedAssignment({ body: event.target.value })}
                            readOnly={!canUploadAssignments}
                            rows={10}
                            className={[
                              "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none",
                              canUploadAssignments ? "bg-white" : "bg-slate-100 text-slate-500 cursor-not-allowed",
                            ].join(" ")}
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={saveAssignment}
                              disabled={!canUploadAssignments}
                              className={[
                                "rounded-xl border px-4 py-2 text-sm font-semibold",
                                canUploadAssignments
                                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                              ].join(" ")}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={markAssignmentDone}
                              disabled={!canUploadAssignments}
                              className={[
                                "rounded-xl px-4 py-2 text-sm font-semibold",
                                canUploadAssignments
                                  ? "bg-slate-900 text-white hover:bg-slate-800"
                                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
                              ].join(" ")}
                            >
                              Mark Done
                            </button>
                            <button
                              type="button"
                              onClick={deleteSelectedAssignment}
                              disabled={!canUploadAssignments}
                              className={[
                                "rounded-xl border px-3 py-2 text-sm",
                                canUploadAssignments
                                  ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                  : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                              ].join(" ")}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadAssignment("pdf")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadAssignment("word")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Download WORD
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadAssignment("text")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Download TEXT
                            </button>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="text-xs font-semibold text-slate-600">Submission</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  canAdmin ? submitAssignment("lecturer") : requestAdminAssignmentSubmission("lecturer")
                                }
                                className={[
                                  "rounded-xl px-3 py-2 text-sm font-semibold",
                                  canAdmin
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                    : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
                                ].join(" ")}
                              >
                                {canAdmin ? "Submit to Lecturer" : "Request Lecturer Submit"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  canAdmin
                                    ? submitAssignment("department")
                                    : requestAdminAssignmentSubmission("department")
                                }
                                className={[
                                  "rounded-xl px-3 py-2 text-sm font-semibold",
                                  canAdmin
                                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                                    : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50",
                                ].join(" ")}
                              >
                                {canAdmin ? "Submit to Department" : "Request Department Submit"}
                              </button>
                              <button
                                type="button"
                                onClick={shareAssignmentLink}
                                disabled={!canShareAssignmentLinks}
                                className={[
                                  "rounded-xl px-3 py-2 text-sm font-semibold",
                                  canShareAssignmentLinks
                                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
                                ].join(" ")}
                              >
                                Share Link
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              {canAdmin
                                ? "As admin, you can submit to lecturer/department and also share/download."
                                : canShareAssignmentLinks
                                  ? "Members can share links and download, but cannot submit to lecturer or department."
                                  : "Members can download, but sharing links is disabled by admin policy."}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Current destination: {selectedAssignment.submittedTo || "Not submitted"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Submitted by:{" "}
                              {selectedAssignment.submittedBy
                                ? `${selectedAssignment.submittedBy} (${selectedAssignment.submittedByRole || "admin"})`
                                : "N/A"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Submitted at:{" "}
                              {selectedAssignment.submittedAt ? formatDateTime(selectedAssignment.submittedAt) : "N/A"}
                            </div>
                            {assignmentStatus ? <div className="mt-1 text-xs text-indigo-700">{assignmentStatus}</div> : null}
                            {shareStatus ? <div className="mt-1 text-xs text-emerald-700">{shareStatus}</div> : null}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-600">No assignment selected.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-700">
                  This is the <b>{active}</b> page placeholder. We will implement it page-by-page.
                </div>
              )}
            </div>
          </div>
        </main>

        <aside
          className={[
            "col-span-12 transition-all",
            isRightPanelCollapsed ? "md:col-span-1 lg:col-span-1" : "md:col-span-3 lg:col-span-3",
          ].join(" ")}
        >
          {isRightPanelCollapsed ? (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm h-full min-h-[120px] p-1.5 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsRightPanelCollapsed(false)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-white"
                title="Expand side panel"
              >
                <ChevronLeft size={14} className="mx-auto" />
              </button>
              <div className="text-[10px] font-semibold text-slate-500 text-center uppercase tracking-wide inline-flex items-center gap-1">
                <ActiveRightTabIcon size={11} />
                Panel
              </div>
              <div className="mt-1 w-full flex flex-col items-center gap-1">
                {RIGHT_PANEL_TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setRightTab(item.key);
                      setIsRightPanelCollapsed(false);
                    }}
                    title={item.label}
                    className={[
                      "h-8 w-8 rounded-lg border flex items-center justify-center",
                      rightTab === item.key
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {Icon ? <Icon size={14} /> : item.label.slice(0, 1)}
                  </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <ActiveRightTabIcon size={15} className="text-slate-600" />
                    <span>Side Panel</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRightPanelCollapsed(true)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    title="Collapse side panel"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="mt-3">
                  <RightTabs tab={rightTab} setTab={setRightTab} />
                </div>
              </div>

              <div className="p-4">
                {rightTab === "chat" ? (
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-500">
                      Real subgroup chat: each message shows sender name + text and is shared in activity.
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 h-[260px] overflow-auto space-y-2">
                      {chatMessages.length === 0 ? (
                        <div className="text-xs text-slate-500">No messages yet.</div>
                      ) : (
                        chatMessages.map((message) => {
                          const mine = message.senderId === "you";
                          return (
                            <div
                              key={message.id}
                              className={[
                                "rounded-xl border px-3 py-2",
                                mine
                                  ? "ml-6 border-slate-800 bg-slate-900 text-white"
                                  : "mr-6 border-slate-200 bg-white text-slate-800",
                              ].join(" ")}
                            >
                              <div className={mine ? "text-[11px] text-slate-300" : "text-[11px] text-slate-500"}>
                                {message.senderName} • {formatDateTime(message.createdAt)}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap break-words">{message.text}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      <select
                        value={chatSenderId}
                        onChange={(event) => setChatSenderId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                      >
                        {collaborationActors.map((actor) => (
                          <option key={actor.id} value={actor.id}>
                            Send as: {actor.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              sendGroupChatMessage();
                            }
                          }}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                          placeholder="Type group message..."
                        />
                        <button
                          type="button"
                          onClick={sendGroupChatMessage}
                          className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-500"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : rightTab === "ai" ? (
                  <div
                    className={[
                      "rounded-xl border p-3 transition-all",
                      aiModeActive
                        ? "border-slate-700 bg-slate-900 text-white shadow-inner"
                        : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Subgroup AI</div>
                      <div
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          aiModeActive ? "bg-emerald-400/20 text-emerald-200" : "bg-slate-200 text-slate-700",
                        ].join(" ")}
                      >
                        {aiThinking ? "AI thinking..." : aiModeActive ? "AI mode active" : "Ready"}
                      </div>
                    </div>
                    <div className={aiModeActive ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs text-slate-500"}>
                      AI can use members, library/files, and assignments context, and update selected assignments from member ideas.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAiInput("Show all members and statuses")}
                        className={aiModeActive
                          ? "rounded-lg border border-slate-500 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                          : "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"}
                      >
                        Members
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiInput("Summarize library notes and folders")}
                        className={aiModeActive
                          ? "rounded-lg border border-slate-500 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                          : "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"}
                      >
                        Library
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiInput("Summarize assignments and statuses")}
                        className={aiModeActive
                          ? "rounded-lg border border-slate-500 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                          : "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"}
                      >
                        Assignments
                      </button>
                    </div>
                    <div
                      className={[
                        "mt-3 rounded-xl border p-2 h-[250px] overflow-auto space-y-2",
                        aiModeActive ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      {aiMessages.map((message) => {
                        const isAi = message.senderId === "ai";
                        return (
                          <div
                            key={message.id}
                            className={[
                              "rounded-xl border px-3 py-2",
                              isAi
                                ? aiModeActive
                                  ? "border-violet-400/40 bg-violet-500/10 text-slate-100"
                                  : "border-violet-200 bg-violet-50 text-slate-800"
                                : aiModeActive
                                  ? "border-slate-700 bg-slate-800 text-slate-100"
                                  : "border-slate-200 bg-slate-50 text-slate-800",
                            ].join(" ")}
                          >
                            <div className={aiModeActive ? "text-[11px] text-slate-300" : "text-[11px] text-slate-500"}>
                              {message.senderName} • {formatDateTime(message.createdAt)}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words">{message.text}</div>
                          </div>
                        );
                      })}
                      {aiThinking ? (
                        <div className={aiModeActive ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                          AI is composing response...
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      <select
                        value={aiRequesterId}
                        onChange={(event) => setAiRequesterId(event.target.value)}
                        className={[
                          "w-full rounded-xl border px-3 py-2 text-xs outline-none",
                          aiModeActive ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-700",
                        ].join(" ")}
                      >
                        {collaborationActors.map((actor) => (
                          <option key={actor.id} value={actor.id}>
                            Ask as: {actor.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          value={aiInput}
                          onChange={(event) => setAiInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              sendAiPrompt();
                            }
                          }}
                          placeholder='Ask AI (example: "update assignment: add team timeline")'
                          className={[
                            "flex-1 rounded-xl border px-3 py-2 text-sm outline-none",
                            aiModeActive ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800",
                          ].join(" ")}
                        />
                        <button
                          type="button"
                          onClick={sendAiPrompt}
                          disabled={aiThinking}
                          className={[
                            "rounded-xl px-4 py-2 text-sm font-semibold",
                            aiThinking
                              ? "bg-slate-400 text-white cursor-not-allowed"
                              : aiModeActive
                                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                : "bg-slate-900 text-white hover:bg-slate-800",
                          ].join(" ")}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : rightTab === "comments" ? (
                  <div className="text-sm text-slate-700">
                    <div className="text-xs text-slate-500">
                      Comments are routed to AI for threaded feedback and action suggestions.
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 h-[250px] overflow-auto space-y-2">
                      {commentMessages.map((message) => {
                        const isAi = message.senderId === "ai";
                        return (
                          <div
                            key={message.id}
                            className={[
                              "rounded-xl border px-3 py-2",
                              isAi ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white",
                            ].join(" ")}
                          >
                            <div className="text-[11px] text-slate-500">
                              {message.senderName} • {formatDateTime(message.createdAt)}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words">{message.text}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 space-y-2">
                      <select
                        value={commentAuthorId}
                        onChange={(event) => setCommentAuthorId(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                      >
                        {collaborationActors.map((actor) => (
                          <option key={actor.id} value={actor.id}>
                            Comment as: {actor.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          value={commentInput}
                          onChange={(event) => setCommentInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              sendCommentToAi();
                            }
                          }}
                          placeholder="Write comment for AI..."
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={sendCommentToAi}
                          className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">Group Activity</div>
                      <div className="text-[11px] text-slate-500">Shared to member notifications</div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                        <div className="text-[10px] text-slate-500">Total</div>
                        <div className="text-sm font-semibold text-slate-900">{activitySummary.total}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                        <div className="text-[10px] text-slate-500">Chat + AI</div>
                        <div className="text-sm font-semibold text-slate-900">{activitySummary.chat + activitySummary.ai}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                        <div className="text-[10px] text-slate-500">Assignments</div>
                        <div className="text-sm font-semibold text-slate-900">{activitySummary.assignments}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        { key: "all", label: "All" },
                        { key: "chat", label: "Chat" },
                        { key: "ai", label: "AI" },
                        { key: "comments", label: "Comments" },
                        { key: "files", label: "Files" },
                        { key: "assignments", label: "Assignments" },
                        { key: "members", label: "Members" },
                        { key: "admin", label: "Admin" },
                      ].map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setActivityFilter(filter.key)}
                          className={[
                            "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                            activityFilter === filter.key
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 h-[250px] overflow-auto space-y-2">
                      {filteredActivityFeed.length === 0 ? (
                        <div className="text-xs text-slate-500 px-1 py-2">No activity for this filter yet.</div>
                      ) : (
                        filteredActivityFeed.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-900">{entry.title}</div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500">{entry.type}</div>
                            </div>
                            {entry.detail ? <div className="mt-1 text-xs text-slate-700">{entry.detail}</div> : null}
                            <div className="mt-1 text-[11px] text-slate-500">
                              {entry.actorName} | {formatDateTime(entry.createdAt)} | Shared with {entry.sharedMembers || 0} members
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {isGeneralSettingsSheetOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsGeneralSettingsSheetOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white p-3 shadow-2xl"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
              <button
                type="button"
                onClick={() => setIsGeneralSettingsSheetOpen(false)}
                className="absolute right-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Done
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsGeneralSectionOpen((prev) => !prev)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex items-center justify-between"
            >
              <span className="text-sm font-semibold text-slate-900">General</span>
              <ChevronDown
                size={16}
                className={["text-slate-500 transition-transform", isGeneralSectionOpen ? "rotate-180" : ""].join(" ")}
              />
            </button>

            {isGeneralSectionOpen ? <div className="mt-3">{generalSettingsFields}</div> : null}
          </div>
        </div>
      ) : null}

      {isCreateClassDialogOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold text-slate-900">Create Class / Subgroup</div>
              <div className="text-sm text-slate-500">Admins can create and brand subgroup profile.</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                  {createClassDraft.avatarUrl ? (
                    <img src={createClassDraft.avatarUrl} alt="Class avatar" className="h-full w-full object-cover" />
                  ) : (
                    (createClassDraft.name || "CL")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((x) => x[0] || "")
                      .join("")
                      .toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => createAvatarInputRef.current?.click()}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Add profile photo
                  </button>
                  <input
                    ref={createAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCreateAvatarSelect}
                  />
                </div>
              </div>

              <input
                value={createClassDraft.name}
                onChange={(event) => setCreateClassDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Class / subgroup name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
              <input
                value={createClassDraft.course}
                onChange={(event) => setCreateClassDraft((prev) => ({ ...prev, course: event.target.value }))}
                placeholder="Course or department"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-500">Group visibility</div>
                  <select
                    value={createClassDraft.visibility}
                    onChange={(event) => setCreateClassDraft((prev) => ({ ...prev, visibility: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none"
                  >
                    <option value="private">Private (approval required)</option>
                    <option value="public">Public (instant join)</option>
                  </select>
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-500">Invite code</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={createClassDraft.inviteCode}
                      onChange={(event) =>
                        setCreateClassDraft((prev) => ({ ...prev, inviteCode: event.target.value.toUpperCase() }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateClassDraft((prev) => ({ ...prev, inviteCode: makeInviteCode() }))}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      New
                    </button>
                  </div>
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateClassDialogOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createClassNow}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isJoinDialogOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold text-slate-900">Join class</div>
              <div className="text-sm text-slate-500">Enter class code or invitation link.</div>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={joinRequesterDraft.name}
                onChange={(event) =>
                  setJoinRequesterDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
              <input
                value={joinRequesterDraft.email}
                onChange={(event) =>
                  setJoinRequesterDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="Your email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
              <input
                value={joinRequesterDraft.registrationNumber}
                onChange={(event) =>
                  setJoinRequesterDraft((prev) => ({ ...prev, registrationNumber: event.target.value }))
                }
                placeholder="Your registration number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Class code / invite link"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
                <div className="text-xs text-slate-500">
                  Group mode: <b>{group.visibility === "public" ? "Public" : "Private"}</b>. Invite code:{" "}
                  <b>{group.inviteCode}</b>
                </div>
              </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsJoinDialogOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitJoinRequest}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Join / Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isInviteProfileDialogOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold text-slate-900">
                {inviteLanding?.groupName || group.name}
              </div>
              <div className="text-sm text-slate-500">
                {inviteLanding?.course || group.course} •{" "}
                {inviteLanding?.visibility === "public" ? "Public group" : "Private group"}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="grid grid-cols-12 border-b border-slate-200 bg-white text-xs font-semibold text-slate-600">
                  <div className="col-span-4 px-3 py-2">Profile field</div>
                  <div className="col-span-8 px-3 py-2">Value</div>
                </div>
                <label className="grid grid-cols-12 border-b border-slate-200">
                  <div className="col-span-4 px-3 py-2 text-sm text-slate-600">Name</div>
                  <div className="col-span-8 px-3 py-1.5">
                    <input
                      value={inviteProfileDraft.name}
                      onChange={(event) =>
                        setInviteProfileDraft((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none"
                      placeholder="Your full name"
                    />
                  </div>
                </label>
                <label className="grid grid-cols-12 border-b border-slate-200">
                  <div className="col-span-4 px-3 py-2 text-sm text-slate-600">Email</div>
                  <div className="col-span-8 px-3 py-1.5">
                    <input
                      value={inviteProfileDraft.email}
                      onChange={(event) =>
                        setInviteProfileDraft((prev) => ({ ...prev, email: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none"
                      placeholder="you@example.com"
                    />
                  </div>
                </label>
                <label className="grid grid-cols-12">
                  <div className="col-span-4 px-3 py-2 text-sm text-slate-600">Reg. Number</div>
                  <div className="col-span-8 px-3 py-1.5">
                    <input
                      value={inviteProfileDraft.registrationNumber}
                      onChange={(event) =>
                        setInviteProfileDraft((prev) => ({ ...prev, registrationNumber: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none"
                      placeholder="Registration number"
                    />
                  </div>
                </label>
              </div>
              <div className="text-xs text-slate-500">
                Invite code: <b>{inviteLanding?.inviteCode || group.inviteCode}</b>
              </div>
              <div className="text-xs text-slate-600">
                {inviteLanding?.visibility === "public"
                  ? "This group is public. Submitting this profile joins directly."
                  : "This group is private. Submitting this profile sends access request to admin."}
              </div>
              {inviteAccepted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <div className="font-semibold">Request accepted</div>
                  <div className="text-xs text-emerald-700/90">
                    {inviteDecisionMessage || "You can now open the subgroup."}
                  </div>
                </div>
              ) : null}
              {inviteWaitingForApproval ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <div className="font-semibold">Request pending</div>
                  <div className="text-xs text-amber-800/90">
                    {inviteDecisionMessage || "Waiting for admin approval."}
                  </div>
                </div>
              ) : null}
              {inviteDenied ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <div className="font-semibold">Request denied</div>
                  <div className="text-xs text-rose-700/90">
                    {inviteDecisionMessage || "Admin denied your request."}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeInviteProfileDialog}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {inviteAccepted ? (
                <button
                  type="button"
                  onClick={goToGroupFromInvite}
                  className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
                >
                  Go to Group
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitInviteProfile}
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                >
                  {inviteLanding?.visibility === "public" ? "Join Group" : "Request Access"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isAccessDialogOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="text-3xl leading-tight font-medium text-slate-900">Request access from admin?</div>
              <div className="mt-4 text-base text-slate-600">
                You currently don&apos;t have permission for this class action.
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-6">
              <button
                type="button"
                onClick={() => setIsAccessDialogOpen(false)}
                className="text-blue-700 font-semibold text-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAccessDialogOpen(false);
                  setJoinStatus("Access request sent to subgroup admin.");
                  setTimeout(() => setJoinStatus(""), 2200);
                }}
                className="text-blue-700 font-semibold text-lg"
              >
                Request access
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

