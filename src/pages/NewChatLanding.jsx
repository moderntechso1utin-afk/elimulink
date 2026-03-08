import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Ellipsis,
  Paperclip,
  GraduationCap,
  IdCard,
  Image,
  LayoutGrid,
  Menu,
  MessagesSquare,
  RefreshCcw,
  NotebookPen,
  Pencil,
  Plus,
  Volume2,
  ScanLine,
  Send,
  Settings,
  Shield,
  Sparkles,
  LogOut,
  UserCircle2,
  Users,
  Wallet,
  Mic,
  MicOff,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { apiUrl } from "../lib/apiUrl";
import { readScopedJson, writeScopedJson } from "../lib/userScopedStorage";
import { getStoredPreferences, getStoredProfile } from "../lib/userSettings";
import SettingsPage from "./SettingsPage";
import NotebookPage from "./NotebookPage";
import SubgroupRoom from "./SubgroupRoom";
import CoursesDashboard from "./CoursesDashboard";
import AssignmentsPage from "./AssignmentsPage";
import ResultsPage from "./ResultsPage";
import AdminAnalyticsLanding from "./AdminAnalyticsLanding";

const MAIN_ITEMS = [
  { key: "newchat", label: "NewChat", icon: LayoutGrid },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "notebook", label: "Notebook", icon: NotebookPen },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "assignments", label: "Assignments", icon: ClipboardList },
  { key: "results", label: "Results", icon: GraduationCap },
];

const COLLABORATION_ITEMS = [
  { key: "subgroups", label: "Subgroups", icon: Users },
  { key: "messaging", label: "Messaging", icon: MessagesSquare },
];

const SETTINGS_ITEM = { key: "settings", label: "Settings", icon: Settings };
const MORE_ITEMS_BASE = [
  { key: "attendance", label: "Attendance", icon: BarChart3 },
  { key: "fees", label: "Fees Portal", icon: Wallet },
  { key: "profile", label: "Profile", icon: IdCard },
];

const CHAT_HISTORY_KEY = "institution_chat_threads_v1";
const CHAT_ACTIVE_KEY = "institution_chat_active_v1";
const ACTIVE_VIEW_KEY = "institution_active_view_v1";
const UNTITLED_CHAT_BASE = "New Chat";
const AI_PATH = "/api/ai/chat";

const CHAT_MODE_CONFIG = {
  student: {
    title: "Hi Victor, where should we start?",
    subtitle:
      "Ask anything about coursework, assignments, revision, research, or coding.",
    starters: [
      {
        key: "assignment_help",
        label: "Assignment help",
        emoji: "📝",
        prefill: "Help me with this assignment...",
        suggestions: [
          "Help me answer this assignment step by step",
          "Explain this assignment question in simple terms",
          "Help me structure my response",
          "Give me a similar practice question",
        ],
      },
      {
        key: "notes_summary",
        label: "Notes summary",
        emoji: "📚",
        prefill: "Summarize these notes...",
        suggestions: [
          "Turn these notes into revision points",
          "Summarize this lecture in simple terms",
          "Create flashcards from this topic",
          "Extract the key ideas only",
        ],
      },
      {
        key: "exam_prep",
        label: "Exam prep",
        emoji: "🎯",
        prefill: "Help me revise...",
        suggestions: [
          "Quiz me on this topic",
          "Give me likely exam questions",
          "Explain this topic for revision",
          "Create a short revision guide",
        ],
      },
      {
        key: "research",
        label: "Research",
        emoji: "🔎",
        prefill: "Help me research...",
        suggestions: [
          "Help me find sources for this topic",
          "Turn this topic into research questions",
          "Summarize the background of this topic",
          "Help me build a research outline",
        ],
      },
      {
        key: "writing_help",
        label: "Writing help",
        emoji: "✍️",
        prefill: "Help me write...",
        suggestions: [
          "Help me write an introduction",
          "Improve this paragraph academically",
          "Rewrite this in a formal tone",
          "Help me organize my ideas",
        ],
      },
      {
        key: "code_help",
        label: "Code help",
        emoji: "💻",
        prefill: "Help me debug this code...",
        suggestions: [
          "Help me debug my code",
          "Help me write a function",
          "Help me simplify my code",
          "Help me learn this programming concept",
        ],
      },
    ],
  },

  admin: {
    title: "Welcome to the ElimuLink Administrative Assistant.",
    subtitle:
      "Ask about workflows, results, attendance, announcements, compliance, or department operations.",
    starters: [
      {
        key: "workflow_review",
        label: "Workflow review",
        emoji: "🗂️",
        prefill: "Summarize the current workflow situation...",
        suggestions: [
          "Show me pending approvals",
          "Summarize workflows needing attention",
          "Which issues are blocked right now?",
          "Give me today's workflow snapshot",
        ],
      },
      {
        key: "results_oversight",
        label: "Results oversight",
        emoji: "📘",
        prefill: "Help me review academic results activity...",
        suggestions: [
          "Summarize missing marks issues",
          "Show result risks needing review",
          "Explain the current approval queue",
          "Generate a results oversight summary",
        ],
      },
      {
        key: "attendance_alerts",
        label: "Attendance alerts",
        emoji: "📊",
        prefill: "Analyze attendance patterns...",
        suggestions: [
          "Show attendance risks by subgroup",
          "Which classes have low participation?",
          "Summarize attendance concerns",
          "Generate an attendance alert summary",
        ],
      },
      {
        key: "announcements",
        label: "Announcements",
        emoji: "📣",
        prefill: "Help me draft an announcement...",
        suggestions: [
          "Draft a notice to lecturers",
          "Draft a notice to students",
          "Rewrite this announcement professionally",
          "Summarize recent communication activity",
        ],
      },
      {
        key: "audit_and_compliance",
        label: "Audit & compliance",
        emoji: "🛡️",
        prefill: "Summarize recent audit activity...",
        suggestions: [
          "Show recent sensitive actions",
          "Summarize compliance-related events",
          "Flag unusual operational activity",
          "Draft a dean-level audit summary",
        ],
      },
      {
        key: "department_report",
        label: "Department report",
        emoji: "🧠",
        prefill: "Generate a department performance summary...",
        suggestions: [
          "Create a weekly department summary",
          "Summarize staff and lecturer activity",
          "Highlight operational risks",
          "Draft a board-ready department report",
        ],
      },
    ],
  },
};

const COMPOSER_TOOL_PRESETS = [
  { key: "create_image", label: "Create image", prompt: "Create an image concept for this topic..." },
  { key: "deep_research", label: "Deep research", prompt: "Help me do deep research on this topic..." },
  { key: "web_search", label: "Web search", prompt: "Find current web sources for this topic..." },
  { key: "study_learn", label: "Study / Learn", prompt: "Teach me this topic with a clear study plan..." },
  { key: "quizzes", label: "Quizzes", prompt: "Create a short quiz for this topic..." },
  { key: "explore_apps", label: "Explore apps", prompt: "Recommend useful academic apps for this task..." },
];

const EMPTY_ACADEMIC_CONTEXT = Object.freeze({
  course: "",
  topic: "",
  lecture: "",
  assignment: "",
  studyMode: "",
});

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function resolveProfileName(firebaseUser) {
  const displayName = String(firebaseUser?.displayName || "").trim();
  if (displayName) return displayName;
  const email = String(firebaseUser?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0].replace(/[._-]+/g, " ");
  return "Scholar";
}

function firstNameOf(name) {
  const normalized = String(name || "").trim();
  if (!normalized) return "there";
  return normalized.split(/\s+/)[0];
}

function initialsOf(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function buildWelcomeMessage(name) {
  return `${timeGreeting()}, ${firstNameOf(name)}! I'm ElimuLink AI. What would you like to research today?`;
}

function getDefaultAssistantMessage(mode = "student", name = "Scholar") {
  if (mode === "admin") {
    return "Welcome to the ElimuLink Administrative Assistant. I can help with workflows, analytics, reports, results, attendance, and department operations.";
  }
  return buildWelcomeMessage(name);
}

function makeChatId() {
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isUntitledChatTitle(title) {
  return /^New Chat(?: \d+)?$/i.test(String(title || "").trim());
}

function nextUntitledChatTitle(chats = []) {
  const used = new Set((chats || []).map((chat) => String(chat?.title || "").trim()));
  if (!used.has(UNTITLED_CHAT_BASE)) return UNTITLED_CHAT_BASE;
  let i = 2;
  while (used.has(`${UNTITLED_CHAT_BASE} ${i}`)) i += 1;
  return `${UNTITLED_CHAT_BASE} ${i}`;
}

function normalizeChatTitles(chats = []) {
  const used = new Set();
  let untitledCounter = 1;

  return chats.map((chat) => {
    const next = { ...(chat || {}) };
    let title = String(next.title || "").trim();

    if (!title || isUntitledChatTitle(title)) {
      let candidate = untitledCounter === 1 ? UNTITLED_CHAT_BASE : `${UNTITLED_CHAT_BASE} ${untitledCounter}`;
      while (used.has(candidate)) {
        untitledCounter += 1;
        candidate = untitledCounter === 1 ? UNTITLED_CHAT_BASE : `${UNTITLED_CHAT_BASE} ${untitledCounter}`;
      }
      title = candidate;
      untitledCounter += 1;
    } else if (used.has(title)) {
      let i = 2;
      let candidate = `${title} (${i})`;
      while (used.has(candidate)) {
        i += 1;
        candidate = `${title} (${i})`;
      }
      title = candidate;
    }

    used.add(title);
    return { ...next, title };
  });
}

function formatChatStamp(timestamp) {
  try {
    const date = new Date(timestamp || Date.now());
    if (Number.isNaN(date.getTime())) return "Now";
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Now";
  }
}

function resolveSpeechLanguage(languageCode) {
  const code = String(languageCode || "en").trim().toLowerCase();
  const map = {
    en: "en-US",
    sw: "sw-KE",
    fr: "fr-FR",
    es: "es-ES",
    pt: "pt-PT",
    de: "de-DE",
    it: "it-IT",
    nl: "nl-NL",
    ru: "ru-RU",
    ar: "ar-SA",
    hi: "hi-IN",
    bn: "bn-BD",
    ta: "ta-IN",
    te: "te-IN",
    zh: "zh-CN",
    "zh-tw": "zh-TW",
    ja: "ja-JP",
    ko: "ko-KR",
    tr: "tr-TR",
    vi: "vi-VN",
  };
  if (map[code]) return map[code];
  if (code.includes("-")) return code;
  return "en-US";
}

function autoResizeTextarea(el, maxHeight = 176) {
  if (!el) return;
  el.style.height = "0px";
  const nextHeight = Math.min(Math.max(el.scrollHeight, 44), maxHeight);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

function detectAcademicContext(message, previousContext = EMPTY_ACADEMIC_CONTEXT) {
  const raw = String(message || "").trim();
  const text = raw.toLowerCase();
  const next = { ...EMPTY_ACADEMIC_CONTEXT, ...previousContext };

  const courseMatch = raw.match(
    /\b(biology|chemistry|physics|mathematics|math|history|geography|economics|accounting|english|kiswahili|computer science|programming)\b/i
  );
  if (courseMatch) next.course = courseMatch[1];

  const topicMatch =
    raw.match(/\babout\s+([^.!?\n]+)/i) ||
    raw.match(/\bon\s+([^.!?\n]{4,80})/i) ||
    raw.match(/\btopic[:\s]+([^.!?\n]+)/i);
  if (topicMatch?.[1]) next.topic = topicMatch[1].trim();

  const lectureMatch = raw.match(/\blecture(?:\s+about|\s+on)?\s+([^.!?\n]+)/i);
  if (lectureMatch?.[1]) next.lecture = lectureMatch[1].trim();
  if (!next.lecture && text.includes("today") && text.includes("lecture")) {
    next.lecture = "Today's lecture";
  }

  const assignmentMatch = raw.match(/\bassignment\b[:\s-]*([^.!?\n]+)/i);
  if (assignmentMatch?.[1]) next.assignment = assignmentMatch[1].trim();
  if (!next.assignment && /\bassignment|homework|coursework\b/i.test(raw)) {
    next.assignment = "Current assignment";
  }

  if (/flashcard|revision card/i.test(raw)) next.studyMode = "flashcards";
  else if (/note|notes/i.test(raw)) next.studyMode = "notes";
  else if (/summari[sz]e/i.test(raw)) next.studyMode = "summary";
  else if (/simplif|explain simpler/i.test(raw)) next.studyMode = "simplify";
  else if (/quiz|revise|exam/i.test(raw)) next.studyMode = "revision";

  return next;
}

function mergeAcademicContext(previousContext, detectedContext, message) {
  const prev = { ...EMPTY_ACADEMIC_CONTEXT, ...(previousContext || {}) };
  const next = { ...prev, ...(detectedContext || {}) };
  const text = String(message || "").toLowerCase();

  const explicitReset = /\b(new topic|change topic|switch topic|different subject|start over)\b/.test(text);
  if (explicitReset) {
    return { ...EMPTY_ACADEMIC_CONTEXT, ...(detectedContext || {}) };
  }

  if (
    prev.course &&
    next.course &&
    String(prev.course).toLowerCase() !== String(next.course).toLowerCase()
  ) {
    return {
      ...EMPTY_ACADEMIC_CONTEXT,
      course: next.course,
      topic: next.topic,
      lecture: next.lecture,
      assignment: next.assignment,
      studyMode: next.studyMode || prev.studyMode,
    };
  }

  return next;
}

function buildAcademicContextBlock(context) {
  const ctx = { ...EMPTY_ACADEMIC_CONTEXT, ...(context || {}) };
  const lines = [];
  if (ctx.course) lines.push(`Course: ${ctx.course}`);
  if (ctx.topic) lines.push(`Topic: ${ctx.topic}`);
  if (ctx.lecture) lines.push(`Lecture: ${ctx.lecture}`);
  if (ctx.assignment) lines.push(`Assignment: ${ctx.assignment}`);
  if (ctx.studyMode) lines.push(`Study mode: ${ctx.studyMode}`);
  if (!lines.length) return "";
  return `Academic context:\n${lines.join("\n")}`;
}

function contextLabel(context) {
  const ctx = { ...EMPTY_ACADEMIC_CONTEXT, ...(context || {}) };
  const left = ctx.course ? String(ctx.course) : "";
  const right = ctx.topic ? String(ctx.topic) : "";
  if (left && right) return `${left} -> ${right}`;
  return left || right || "";
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sectionLabelFromTimestamp(timestamp, now = Date.now()) {
  const ts = Number(timestamp || 0);
  const date = new Date(ts || now);
  const nowDate = new Date(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((startOfDay(nowDate) - startOfDay(date)) / dayMs);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Earlier this week";
  if (date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear()) {
    return "Earlier this month";
  }
  return date.toLocaleDateString([], { month: "short", year: "numeric" });
}

function createDefaultChat(title = UNTITLED_CHAT_BASE, assistantText = "", ownerUid = null) {
  return {
    id: makeChatId(),
    ownerUid,
    title,
    updatedAt: Date.now(),
    messages: assistantText
      ? [{ role: "assistant", text: assistantText, ownerUid, createdAt: Date.now() }]
      : [],
  };
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200/90 shadow-sm px-4 py-3 min-h-[92px]">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{title}</div>
        <div className="mt-1 text-xl leading-tight font-bold text-slate-900 break-words">{value}</div>
        {subtitle ? <div className="text-[12px] text-slate-500 mt-0.5">{subtitle}</div> : null}
      </div>
      <div className="text-slate-400 shrink-0 ml-3">
        <BarChart3 size={18} />
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const delta = Date.now() - date.getTime();
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function PlaceholderPanel({ title, bullets = [] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600 mt-1">Coming next</div>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
      >
        Connect backend
      </button>
    </div>
  );
}

function isErrorText(text) {
  const value = String(text || "").toLowerCase();
  return value.includes("failed to reach ai service") || value.includes("error (");
}

function Bubble({
  role,
  text,
  streaming = false,
  onAssistantSpeak,
  onRetry,
  onLearnMore,
  onCopy,
  onEdit,
  isCopied,
  isSpeaking,
  speakingText,
  reaction = null,
  onLike,
  onDislike,
  onShare,
  onRetryMessage,
  onSimplify,
  onDetailed,
  onSummarizeTool,
  onNotesTool,
  onFlashcardsTool,
  onSimplerTool,
}) {
  const isUser = role === "user";
  const isError = !isUser && isErrorText(text);
  const isActiveSpeak = !isUser && isSpeaking && speakingText === text;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [renderedAssistantText, setRenderedAssistantText] = useState(() =>
    isUser ? String(text || "") : ""
  );
  const [isTypingAnim, setIsTypingAnim] = useState(false);
  const typingFrameRef = useRef(null);
  const showActionRow = !streaming && !isTypingAnim && (Boolean(reaction) || isMoreOpen);
  const assistantParagraphs = String(isUser ? text || "" : renderedAssistantText || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  useEffect(() => {
    if (isUser) return;
    const target = String(text || "");

    if (streaming) {
      setIsTypingAnim(true);
      setRenderedAssistantText(target);
      return;
    }

    if (typingFrameRef.current) {
      cancelAnimationFrame(typingFrameRef.current);
      typingFrameRef.current = null;
    }

    const current = String(renderedAssistantText || "");
    if (current === target) {
      setIsTypingAnim(false);
      return;
    }

    setIsTypingAnim(true);
    let i = current && target.startsWith(current) ? current.length : 0;
    if (i === 0) setRenderedAssistantText("");

    const step = () => {
      const remaining = target.length - i;
      const jump = Math.max(2, Math.ceil(remaining / 18));
      i = Math.min(target.length, i + jump);
      setRenderedAssistantText(target.slice(0, i));
      if (i < target.length) {
        typingFrameRef.current = requestAnimationFrame(step);
      } else {
        typingFrameRef.current = null;
        setIsTypingAnim(false);
      }
    };
    typingFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (typingFrameRef.current) {
        cancelAnimationFrame(typingFrameRef.current);
        typingFrameRef.current = null;
      }
    };
  }, [isUser, text, streaming]);

  function renderAssistantBlock(block, index) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isBulletLike =
      lines.length > 1 &&
      lines.every((line) => /^([-*•]|\d+\.)\s+/.test(line));

    if (isBulletLike) {
      return (
        <ul key={`blk-${index}`} className="list-disc pl-5 space-y-1.5">
          {lines.map((line, i) => (
            <li key={`li-${index}-${i}`}>{line.replace(/^([-*•]|\d+\.)\s+/, "")}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={`blk-${index}`} className="leading-[1.72]">
        {block}
      </p>
    );
  }

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[92%] md:max-w-[80%] text-[15px]",
          isUser
            ? "user-msg-bubble rounded-2xl px-4 py-3 md:px-4.5 md:py-3.5 bg-sky-500 text-white rounded-br-md shadow-sm"
            : "assistant-msg-surface px-1 py-1 md:py-1.5 text-slate-900",
        ].join(" ")}
      >
        {isUser ? (
          <div className="leading-relaxed">{text}</div>
        ) : (
          <div className="space-y-3.5 md:space-y-4 text-[15px] leading-7 md:leading-[1.78] text-slate-800/95">
            {assistantParagraphs.length ? (
              assistantParagraphs.map((block, idx) => renderAssistantBlock(block, idx))
            ) : streaming ? (
              <div className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="typing-dot" />
                <span className="typing-dot typing-dot-delay-1" />
                <span className="typing-dot typing-dot-delay-2" />
              </div>
            ) : (
              <p className="leading-[1.72]">{String(text || "")}</p>
            )}
            {streaming || isTypingAnim ? <span className="typing-caret">▌</span> : null}
          </div>
        )}

        {!isUser ? (
          <div
            className={[
              "mt-2.5 md:mt-3 flex items-center gap-0.5 md:gap-1 transition-opacity",
              showActionRow ? "opacity-100" : "opacity-100 md:opacity-100",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={onCopy}
              className="assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700"
              title="Copy response"
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              onClick={onLike}
              className={[
                "assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md transition",
                reaction === "like"
                  ? "bg-sky-50/90 text-sky-700"
                  : "text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700",
              ].join(" ")}
              title="Like"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              type="button"
              onClick={onDislike}
              className={[
                "assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md transition",
                reaction === "dislike"
                  ? "bg-slate-200/75 text-slate-700"
                  : "text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700",
              ].join(" ")}
              title="Dislike"
            >
              <ThumbsDown size={14} />
            </button>
            <button
              type="button"
              onClick={onShare}
              className="assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700"
              title="Share"
            >
              <Share2 size={14} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className="assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700"
                title="More"
              >
                <Ellipsis size={14} />
              </button>
              {isMoreOpen ? (
                <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onRetryMessage?.();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onSimplify?.();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Simplify answer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onDetailed?.();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Make it more detailed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onCopy?.();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Copy text
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onAssistantSpeak?.(text)}
              className={[
                "assistant-action-btn h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md",
                isActiveSpeak
                  ? "bg-sky-50/90 text-sky-700"
                  : "text-slate-500/90 hover:bg-slate-100/80 hover:text-slate-700",
              ].join(" ")}
              title="Play audio"
            >
              <Volume2 size={14} />
            </button>
          </div>
        ) : null}

        {!isUser && !streaming && !isTypingAnim && String(text || "").trim() ? (
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/70">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onSummarizeTool}
                className="rounded-full border border-slate-200/80 bg-slate-50/85 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Summarize this
              </button>
              <button
                type="button"
                onClick={onNotesTool}
                className="rounded-full border border-slate-200/80 bg-slate-50/85 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Turn into notes
              </button>
              <button
                type="button"
                onClick={onFlashcardsTool}
                className="rounded-full border border-slate-200/80 bg-slate-50/85 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Generate flashcards
              </button>
              <button
                type="button"
                onClick={onSimplerTool}
                className="rounded-full border border-slate-200/80 bg-slate-50/85 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Explain simpler
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Next step: choose a study action above to continue with this answer.
            </div>
          </div>
        ) : null}

        {isUser ? (
          <div className="mt-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/25"
              title="Edit prompt"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/25"
              title="Copy prompt"
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              {isCopied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        {isError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw size={12} />
              Retry
            </button>
            <button
              type="button"
              onClick={onLearnMore}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Learn more
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidebarButton({ active, label, onClick, collapsed, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
        collapsed ? "justify-center px-2.5" : "",
        active
          ? "bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
          : "text-slate-700 hover:bg-slate-100/90",
      ].join(" ")}
      title={collapsed ? label : undefined}
    >
      <span className={["text-base", active ? "text-white" : "text-slate-500"].join(" ")}>
        {Icon ? <Icon size={16} /> : null}
      </span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function SectionLabel({ collapsed, children }) {
  if (collapsed) return null;
  return <div className="px-3 pt-2 text-[10px] font-semibold tracking-[0.1em] text-slate-400">{children}</div>;
}

export default function NewChatLanding({
  active: initialView = "chat",
  onOpenAdmin,
  chatMode = "student",
  workspaceContext = null,
  userRole: initialUserRole,
  initialAssistantMessage,
}) {
  const firebaseUser = auth?.currentUser || null;
  const profileName = resolveProfileName(firebaseUser);
  const resolvedChatMode = chatMode === "admin" ? "admin" : "student";
  const modeConfig = CHAT_MODE_CONFIG[resolvedChatMode];
  const starterSet = modeConfig.starters;
  const defaultAssistantMessage =
    String(initialAssistantMessage || "").trim() ||
    getDefaultAssistantMessage(resolvedChatMode, profileName);

  const [active, setActive] = useState(initialView === "chat" ? "newchat" : (initialView || "newchat"));
  const [userRole, setUserRole] = useState(initialUserRole || null);
  const [input, setInput] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [isNewChatMenuOpen, setIsNewChatMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsMenuOpen, setIsNotificationsMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [notifications, setNotifications] = useState(() => [
    {
      id: "n1",
      title: "New announcement posted",
      detail: "Check the latest update from your institution.",
      read: false,
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
      type: "info",
    },
    {
      id: "n2",
      title: "Assignment due tomorrow",
      detail: "Reminder: one assignment is due by 5 PM.",
      read: false,
      createdAt: Date.now() - 30 * 60 * 1000,
      type: "assignments",
    },
  ]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(() => {
    try {
      return localStorage.getItem("sidebar_more_open") === "1";
    } catch {
      return false;
    }
  });
  const [isMorePopupOpen, setIsMorePopupOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [isAiModeOn, setIsAiModeOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState([]);
  const [kbHeight, setKbHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(108);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState({});
  const [feedbackToast, setFeedbackToast] = useState({ open: false, text: "" });
  const [isChatScrolling, setIsChatScrolling] = useState(false);
  const [chatScrollProgress, setChatScrollProgress] = useState(0);
  const [chatScrollLabel, setChatScrollLabel] = useState("Today");
  const [contextByChat, setContextByChat] = useState({});
  const [mobileScrollTop, setMobileScrollTop] = useState(0);
  const [desktopScrollTop, setDesktopScrollTop] = useState(0);
  const [mobileViewportHeight, setMobileViewportHeight] = useState(0);
  const [desktopViewportHeight, setDesktopViewportHeight] = useState(0);
  const [virtualizationTick, setVirtualizationTick] = useState(0);
  const [selectedStarter, setSelectedStarter] = useState(null);
  const [starterSuggestions, setStarterSuggestions] = useState([]);
  const [currentUid, setCurrentUid] = useState(auth.currentUser?.uid || null);
  const recognitionRef = useRef(null);
  const mobileAttachmentMenuRef = useRef(null);
  const desktopAttachmentMenuRef = useRef(null);
  const newChatMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const notifBtnRef = useRef(null);
  const globalSearchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mobileMessagesRef = useRef(null);
  const desktopMessagesRef = useRef(null);
  const mobileComposerRef = useRef(null);
  const mobilePromptInputRef = useRef(null);
  const desktopPromptInputRef = useRef(null);
  const lastSpokenRef = useRef({ text: "", at: 0 });
  const renderCountRef = useRef(0);
  const previousUidRef = useRef(auth.currentUser?.uid || null);
  const scrollHideTimerRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const scrollLabelRef = useRef("Today");
  const mobileHeightMapRef = useRef(new Map());
  const desktopHeightMapRef = useRef(new Map());

  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const attachmentSourceRef = useRef("file");
  const [fileAcceptMode, setFileAcceptMode] = useState("");
  const [fileCaptureMode, setFileCaptureMode] = useState("");

  function clearSessionUiState() {
    setChats([]);
    setActiveChatId(null);
    setInput("");
    setAttachments([]);
    setNotifications([]);
    setSelectedStarter?.(null);
    setStarterSuggestions?.([]);
  }

  function normalizeOwnedChats(items, uid) {
    if (!uid || !Array.isArray(items)) return [];
    return items
      .map((chat) => ({
        ...chat,
        ownerUid: chat.ownerUid || uid,
        messages: Array.isArray(chat.messages) ? chat.messages : [],
      }))
      .filter((chat) => (chat.ownerUid || uid) === uid);
  }

  function syncActiveView(next, mode = "replace") {
    if (typeof window !== "undefined") {
      const currentState = window.history.state || {};
      const nextState = { ...currentState, [ACTIVE_VIEW_KEY]: next };
      if (mode === "push") {
        window.history.pushState(nextState, "", window.location.href);
      } else {
        window.history.replaceState(nextState, "", window.location.href);
      }
    }
    setActive(next);
  }

  useEffect(() => {
    try {
      localStorage.setItem("sidebar_more_open", isMoreOpen ? "1" : "0");
    } catch {
      // no-op
    }
  }, [isMoreOpen]);

  useEffect(() => {
    let mounted = true;
    const resolveRole = async () => {
      try {
        const tokenResult = await auth.currentUser?.getIdTokenResult();
        const roleClaim = tokenResult?.claims?.role || tokenResult?.claims?.userRole;
        if (mounted && roleClaim) setUserRole(roleClaim);
      } catch {
        // no-op
      }
      if (import.meta.env.DEV) {
        const devRole = localStorage.getItem("dev_role");
        if (mounted && devRole) setUserRole(devRole);
      }
    };
    resolveRole();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => setVoices(synth.getVoices());
    updateVoices();
    synth.onvoiceschanged = updateVoices;
    return () => {
      if (synth.onvoiceschanged === updateVoices) synth.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKbHeight(keyboard);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!isAttachOpen) return;
    const onDocumentMouseDown = (event) => {
      const inMobile = mobileAttachmentMenuRef.current?.contains(event.target);
      const inDesktop = desktopAttachmentMenuRef.current?.contains(event.target);
      if (!inMobile && !inDesktop) {
        setIsAttachOpen(false);
        setIsToolsPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isAttachOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen && !isNotificationsMenuOpen) return;
    const onDocumentMouseDown = (event) => {
      const target = event.target;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        notificationsMenuRef.current &&
        !notificationsMenuRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
        setIsNotificationsMenuOpen(false);
        return;
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(target)) {
        setIsNotificationsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isProfileMenuOpen, isNotificationsMenuOpen]);

  useEffect(() => {
    if (!isNotificationsMenuOpen) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, [isNotificationsMenuOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isProfileSheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isProfileSheetOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentState = window.history.state || {};
    const currentView = currentState[ACTIVE_VIEW_KEY];
    if (!currentView) {
      window.history.replaceState({ ...currentState, [ACTIVE_VIEW_KEY]: active }, "", window.location.href);
    } else if (currentView !== active) {
      setActive(currentView);
    }
    const onPopState = () => {
      const nextView = window.history.state?.[ACTIVE_VIEW_KEY] || "newchat";
      setActive(nextView);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const unsubscribe = auth?.onAuthStateChanged
      ? auth.onAuthStateChanged((firebaseUser) => {
      const newUid = firebaseUser?.uid || null;
      const previousUid = previousUidRef.current;

      if (previousUid && previousUid !== newUid) {
        clearSessionUiState();
      }

      previousUidRef.current = newUid;
      setCurrentUid(newUid);
      })
      : () => {};

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUid) {
      clearSessionUiState();
      return;
    }

    const savedChats = readScopedJson(currentUid, "institution_chats", []);
    const savedActiveChatId = readScopedJson(currentUid, "institution_active_chat", null);
    const ownedChats = normalizeOwnedChats(savedChats, currentUid);

    const nextChats =
      ownedChats.length > 0
        ? ownedChats
        : [createDefaultChat(UNTITLED_CHAT_BASE, defaultAssistantMessage, currentUid)];

    setChats(nextChats);
    setActiveChatId(
      nextChats.some((chat) => chat.id === savedActiveChatId)
        ? savedActiveChatId
        : nextChats[0]?.id || null
    );
  }, [currentUid, defaultAssistantMessage]);

  useEffect(() => {
    if (!currentUid) return;
    const ownedChats = normalizeOwnedChats(chats, currentUid);
    writeScopedJson(currentUid, "institution_chats", ownedChats);
  }, [currentUid, chats]);

  useEffect(() => {
    const ownedChats = normalizeOwnedChats(chats, currentUid);
    if (activeChatId && ownedChats.some((chat) => chat.id === activeChatId)) return;
    setActiveChatId(ownedChats[0]?.id || null);
  }, [activeChatId, chats, currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    writeScopedJson(currentUid, "institution_active_chat", activeChatId);
  }, [currentUid, activeChatId]);

  useEffect(() => {
    if (!isNewChatMenuOpen) return;
    const onDocumentMouseDown = (event) => {
      if (!newChatMenuRef.current) return;
      if (!newChatMenuRef.current.contains(event.target)) setIsNewChatMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isNewChatMenuOpen]);

  useEffect(() => {
    const timers = new WeakMap();
    const onScroll = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("smart-scrollbar")) return;
      target.classList.add("is-scrolling");
      const prev = timers.get(target);
      if (prev) clearTimeout(prev);
      const next = setTimeout(() => target.classList.remove("is-scrolling"), 220);
      timers.set(target, next);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    renderCountRef.current += 1;
    console.debug("[NewChatLanding] render", {
      count: renderCountRef.current,
      active,
      chats: chats.length,
      messages: messages.length,
      attachments: attachments.length,
    });
  });

  const isAdminRole = [
    "admin",
    "department_head",
    "institution_admin",
    "staff",
    "departmentadmin",
    "superadmin",
  ].includes(String(userRole || "").toLowerCase());
  // TEMP FLAG — set to false later when role security is restored.
  const FORCE_SHOW_ADMIN = true;
  const canShowAdmin = FORCE_SHOW_ADMIN || import.meta.env.DEV || isAdminRole;
  const moreItems = useMemo(() => {
    if (!canShowAdmin) return MORE_ITEMS_BASE;
    return [...MORE_ITEMS_BASE, { key: "admin", label: "Admin", icon: Shield }];
  }, [canShowAdmin]);

  const moreKeys = useMemo(() => moreItems.map((item) => item.key), [moreItems]);

  const settingsProfile = useMemo(
    () =>
      getStoredProfile({
        name: profileName,
        email: firebaseUser?.email || "student@elimulink.co.ke",
        phone: "+2547xx xxx xxx",
        avatarUrl: "",
      }, currentUid),
    [active, profileName, firebaseUser, currentUid]
  );
  const settingsPrefs = useMemo(
    () =>
      getStoredPreferences({
        muteNotifications: false,
        keyboardShortcuts: false,
        language: "en-KE",
      }, currentUid),
    [active, currentUid]
  );

  const user = useMemo(
    () => ({
      name: settingsProfile?.name || profileName,
      email: settingsProfile?.email || firebaseUser?.email || "student@elimulink.co.ke",
      phone: settingsProfile?.phone || "+2547xx xxx xxx",
      avatarUrl: settingsProfile?.avatarUrl || "",
      nextClass: "Biology 101 at 10:00 AM",
      balance: "KES 12,000",
      attendance: "85%",
      gpa: "3.8",
    }),
    [settingsProfile, profileName, firebaseUser]
  );

  const preferredSpeechLanguage = useMemo(
    () => resolveSpeechLanguage(settingsPrefs?.language || "en-KE"),
    [settingsPrefs?.language]
  );

  const placeholderConfig = useMemo(
    () => ({
      calendar: {
        title: "Calendar",
        bullets: ["Connect schedules", "Sync classes and exams", "Set reminders"],
      },
      messaging: {
        title: "Messaging",
        bullets: ["Group chats", "Direct messages", "Admin announcements"],
      },
      attendance: {
        title: "Attendance",
        bullets: ["Track sessions", "Mark participation", "Export reports"],
      },
      fees: {
        title: "Fees Portal",
        bullets: ["View balances", "Payment history", "Download statements"],
      },
      profile: {
        title: "Profile",
        bullets: ["Update personal info", "Manage preferences", "View account status"],
      },
    }),
    []
  );

  const activePlaceholder = placeholderConfig[active];

  const safeChats = normalizeOwnedChats(chats, currentUid);
  const activeChat =
    safeChats.find((chat) => chat.id === activeChatId) || safeChats[0] || null;
  const messages = activeChat?.messages || [];
  const resolveMessageTimestamp = (message, idx) => {
    if (message?.createdAt) return Number(message.createdAt);
    if (activeChat?.updatedAt) return Number(activeChat.updatedAt) + idx;
    return Date.now() + idx;
  };
  const sectionLabelForIndex = (idx) => sectionLabelFromTimestamp(resolveMessageTimestamp(messages[idx], idx));
  const sectionKeyForIndex = (idx) => {
    const ts = resolveMessageTimestamp(messages[idx], idx);
    return `${sectionLabelFromTimestamp(ts)}::${new Date(ts).getFullYear()}-${new Date(ts).getMonth()}`;
  };
  const shouldShowSectionAnchor = (idx) => idx === 0 || sectionKeyForIndex(idx) !== sectionKeyForIndex(idx - 1);
  const activeAcademicContext = contextByChat[activeChat?.id || ""] || EMPTY_ACADEMIC_CONTEXT;
  const activeContextLabel = contextLabel(activeAcademicContext);
  const hasConversation = messages.length > 0;
  const canSend = input.trim().length > 0 || attachments.length > 0;
  const hasText = input.trim().length > 0;
  const hasStarterSuggestions = !hasConversation && starterSuggestions.length > 0;
  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const normalizedNotifications = useMemo(
    () =>
      notifications.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.detail || "",
        createdAt: item.createdAt || null,
        type: item.type || "info",
        read: item.read,
      })),
    [notifications]
  );
  const profileInitials = initialsOf(user.name);

  const estimateMessageHeight = (message, mode) => {
    const text = String(message?.text || "");
    const charsPerLine = mode === "desktop" ? 90 : 44;
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const base = message?.role === "user" ? 72 : 94;
    return Math.min(420, base + lines * 20);
  };

  const getMeasuredOrEstimatedHeight = (index, message, mode) => {
    const mapRef = mode === "desktop" ? desktopHeightMapRef : mobileHeightMapRef;
    return mapRef.current.get(index) || estimateMessageHeight(message, mode);
  };

  const buildVirtualWindow = (mode) => {
    const viewportHeight = mode === "desktop" ? desktopViewportHeight : mobileViewportHeight;
    const scrollTop = mode === "desktop" ? desktopScrollTop : mobileScrollTop;
    const overscan = 8;
    if (!messages.length) {
      return { items: [], paddingTop: 0, paddingBottom: 0 };
    }

    const heights = messages.map((m, idx) => {
      const base = getMeasuredOrEstimatedHeight(idx, m, mode);
      const hasSection = idx === 0 || sectionKeyForIndex(idx) !== sectionKeyForIndex(idx - 1);
      return base + (hasSection ? (mode === "desktop" ? 34 : 30) : 0);
    });
    const totalHeight = heights.reduce((sum, h) => sum + h, 0);
    const targetBottom = scrollTop + Math.max(viewportHeight, 1);

    let offset = 0;
    let start = 0;
    while (start < heights.length && offset + heights[start] < scrollTop) {
      offset += heights[start];
      start += 1;
    }

    let end = start;
    let running = offset;
    while (end < heights.length && running < targetBottom) {
      running += heights[end];
      end += 1;
    }

    const from = Math.max(0, start - overscan);
    const to = Math.min(heights.length, end + overscan);
    const paddingTop = heights.slice(0, from).reduce((sum, h) => sum + h, 0);
    const renderedHeight = heights.slice(from, to).reduce((sum, h) => sum + h, 0);
    const paddingBottom = Math.max(0, totalHeight - paddingTop - renderedHeight);

    return {
      items: messages.slice(from, to).map((message, localIndex) => ({
        index: from + localIndex,
        message,
      })),
      paddingTop,
      paddingBottom,
    };
  };

  const mobileVirtualWindow = useMemo(
    () => buildVirtualWindow("mobile"),
    [messages, mobileScrollTop, mobileViewportHeight, virtualizationTick]
  );

  const desktopVirtualWindow = useMemo(
    () => buildVirtualWindow("desktop"),
    [messages, desktopScrollTop, desktopViewportHeight, virtualizationTick]
  );

  const getActivePromptInput = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return desktopPromptInputRef.current || mobilePromptInputRef.current;
    }
    return mobilePromptInputRef.current || desktopPromptInputRef.current;
  };

  const focusPromptInput = () => {
    const node = getActivePromptInput();
    if (!node) return;
    node.focus();
    const value = String(node.value || "");
    if (typeof node.setSelectionRange === "function") {
      node.setSelectionRange(value.length, value.length);
    }
  };

  const resizeComposerInputs = () => {
    autoResizeTextarea(mobilePromptInputRef.current, 168);
    autoResizeTextarea(desktopPromptInputRef.current, 192);
  };

  const handleComposerInputChange = (value, target) => {
    setInput(value);
    requestAnimationFrame(() => {
      if (target) {
        const maxHeight = Number(target.dataset?.maxheight || 176);
        autoResizeTextarea(target, Number.isFinite(maxHeight) ? maxHeight : 176);
      } else {
        resizeComposerInputs();
      }
    });
  };

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    if (mobileMessagesRef.current) {
      mobileMessagesRef.current.scrollTo({ top: mobileMessagesRef.current.scrollHeight, behavior });
    }
    if (desktopMessagesRef.current) {
      desktopMessagesRef.current.scrollTo({ top: desktopMessagesRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToBottom("smooth"));
    return () => cancelAnimationFrame(id);
  }, [messages.length, activeChatId]);

  useEffect(() => {
    const id = setTimeout(() => scrollToBottom("auto"), 50);
    return () => clearTimeout(id);
  }, [kbHeight]);

  useEffect(() => {
    if (!mobileComposerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.ceil(entry.contentRect.height);
      if (next > 0) setComposerHeight(next);
    });
    observer.observe(mobileComposerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => resizeComposerInputs());
    return () => cancelAnimationFrame(id);
  }, [input, attachments.length, kbHeight]);

  useEffect(() => {
    const syncViewport = () => {
      setMobileViewportHeight(mobileMessagesRef.current?.clientHeight || 0);
      setDesktopViewportHeight(desktopMessagesRef.current?.clientHeight || 0);
    };
    syncViewport();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(syncViewport);
    if (mobileMessagesRef.current) observer.observe(mobileMessagesRef.current);
    if (desktopMessagesRef.current) observer.observe(desktopMessagesRef.current);
    return () => observer.disconnect();
  }, [active, kbHeight]);

  useEffect(() => {
    if (!feedbackToast.open) return;
    const id = setTimeout(() => setFeedbackToast({ open: false, text: "" }), 2200);
    return () => clearTimeout(id);
  }, [feedbackToast]);

  useEffect(() => {
    return () => {
      if (scrollHideTimerRef.current) clearTimeout(scrollHideTimerRef.current);
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  useEffect(() => {
    mobileHeightMapRef.current = new Map();
    desktopHeightMapRef.current = new Map();
    setVirtualizationTick((v) => v + 1);
  }, [activeChatId]);

  useEffect(() => {
    if (!messages.length) {
      scrollLabelRef.current = "Today";
      setChatScrollLabel("Today");
      return;
    }
    const next = sectionLabelForIndex(Math.max(0, messages.length - 1));
    scrollLabelRef.current = next;
    setChatScrollLabel(next);
  }, [messages.length, activeChatId]);

  function updateActiveChatMessages(updater, titleHint) {
    const currentId = activeChat?.id;
    if (!currentId) return;
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentId) return chat;
        const rawMessages = updater(chat.messages || []);
        let cursor = Date.now();
        const nextMessages = (rawMessages || []).map((msg) => {
          if (msg?.createdAt) {
            cursor = Math.max(cursor, Number(msg.createdAt));
            return msg;
          }
          cursor += 1;
          return { ...(msg || {}), createdAt: cursor };
        });
        const currentTitle = String(chat.title || "").trim();
        const nextTitle =
          isUntitledChatTitle(currentTitle) && titleHint
            ? titleHint.slice(0, 40)
            : currentTitle || nextUntitledChatTitle(prev);
        return { ...chat, messages: nextMessages, title: nextTitle, updatedAt: Date.now() };
      })
    );
  }

  function openSettingsPanel() {
    setIsProfileMenuOpen(false);
    setIsNotificationsMenuOpen(false);
    syncActiveView("settings", "push");
  }

  function openAdminPanel() {
    setIsProfileMenuOpen(false);
    setIsNotificationsMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setIsMobileMoreOpen(false);
    setIsMorePopupOpen(false);
    syncActiveView("admin", "push");
  }

  function toggleNotificationsMenu() {
    setIsNotificationsMenuOpen((prev) => !prev);
    setIsProfileMenuOpen(false);
  }

  function openMobileNotifications() {
    const btn = notifBtnRef.current;
    if (!btn || typeof window === "undefined") {
      setIsNotifOpen((prev) => !prev);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(360, window.innerWidth - 24);
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const left = clamp(rect.right - panelWidth, 12, window.innerWidth - panelWidth - 12);
    const top = rect.bottom + 10;
    setNotifAnchor({ top, left, width: panelWidth });
    setIsNotifOpen(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  function markAllNotificationsRead() {
    setNotifications([]);
  }

  function toggleProfileMenu() {
    setIsProfileMenuOpen((prev) => !prev);
    setIsNotificationsMenuOpen(false);
  }

  function runGlobalSearch() {
    const query = String(globalSearch || "").trim();
    if (!query) return;
    const queryLower = query.toLowerCase();
    const matchingChat = chats.find((chat) =>
      String(chat?.title || "")
        .toLowerCase()
        .includes(queryLower)
    );

    syncActiveView("newchat", "push");
    if (matchingChat?.id) {
      setActiveChatId(matchingChat.id);
      setGlobalSearch("");
      return;
    }

    setInput(query);
    setGlobalSearch("");
    setTimeout(() => focusPromptInput(), 0);
  }

  async function handleLogout() {
    clearSessionUiState();
    setIsProfileMenuOpen(false);
    setIsProfileSheetOpen(false);
    try {
      await signOut(auth);
    } catch {
      // no-op, keep frontend flow
    }
    try {
      localStorage.removeItem("elimulink_admin_token");
    } catch {
      // no-op
    }
    window.location.href = "/login?returnTo=%2Finstitution";
  }

  function startNewChat() {
    const next = createDefaultChat(nextUntitledChatTitle(chats), "", currentUid);
    setChats((prev) => [next, ...prev]);
    setActiveChatId(next.id);
    setContextByChat((prev) => ({ ...prev, [next.id]: { ...EMPTY_ACADEMIC_CONTEXT } }));
    syncActiveView("newchat", "push");
    setIsNewChatMenuOpen(false);
  }

  function renameChatById(chatId) {
    const target = chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const nextTitle = window.prompt("Rename chat", target.title || UNTITLED_CHAT_BASE);
    if (!nextTitle || !nextTitle.trim()) return;
    setChats((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, title: nextTitle.trim() } : chat))
    );
  }

  function deleteChatById(chatId) {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (filtered.length === 0) {
        const fallback = createDefaultChat(UNTITLED_CHAT_BASE, "", currentUid);
        setActiveChatId(fallback.id);
        return [fallback];
      }
      if (activeChatId === chatId) setActiveChatId(filtered[0].id);
      return filtered;
    });
  }

  function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function openAttachmentPicker({ accept = "", capture = "", source = "file" } = {}) {
    setIsAttachOpen(false);
    setIsToolsPanelOpen(false);
    setFileAcceptMode(accept);
    setFileCaptureMode(capture);
    attachmentSourceRef.current = source;
    setTimeout(() => {
      if (!fileInputRef.current) return;
      fileInputRef.current.accept = accept;
      if (capture) {
        fileInputRef.current.setAttribute("capture", capture);
      } else {
        fileInputRef.current.removeAttribute("capture");
      }
      fileInputRef.current.click();
    }, 0);
  }

  function addFiles(fileList, source = "file") {
    if (!fileList || fileList.length === 0) return;
    const next = [];
    for (const f of Array.from(fileList)) {
      const url = URL.createObjectURL(f);
      next.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(16).slice(2)}`,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        url,
        file: f,
        source,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function toggleAttachmentPanel() {
    setIsAttachOpen((prev) => {
      const next = !prev;
      if (!next) setIsToolsPanelOpen(false);
      return next;
    });
  }

  function applyToolPreset(prompt) {
    setIsAttachOpen(false);
    setIsToolsPanelOpen(false);
    setInput(prompt);
    requestAnimationFrame(() => focusPromptInput());
  }

  function applyStarter(starter) {
    setSelectedStarter(starter.key);
    setInput(starter.prefill);
    setStarterSuggestions(starter.suggestions);
    requestAnimationFrame(() => focusPromptInput());
  }

  function applySuggestion(suggestion) {
    setInput(suggestion);
    requestAnimationFrame(() => focusPromptInput());
  }

  function setMessageFeedback(messageKey, reaction) {
    setFeedbackByMessage((prev) => {
      const current = prev[messageKey];
      const next = current === reaction ? null : reaction;
      return { ...prev, [messageKey]: next };
    });
    setFeedbackToast({ open: true, text: "Thank you for your feedback!" });
  }

  function resolveScrollLabelFromPosition(mode, scrollTop) {
    if (!messages.length) return "Today";
    const heights = messages.map((m, idx) => {
      const base = getMeasuredOrEstimatedHeight(idx, m, mode);
      const hasSection = idx === 0 || sectionKeyForIndex(idx) !== sectionKeyForIndex(idx - 1);
      return base + (hasSection ? (mode === "desktop" ? 34 : 30) : 0);
    });
    let offset = 0;
    let visibleIdx = 0;
    while (visibleIdx < heights.length && offset + heights[visibleIdx] < scrollTop + 12) {
      offset += heights[visibleIdx];
      visibleIdx += 1;
    }
    const bounded = Math.max(0, Math.min(messages.length - 1, visibleIdx));
    return sectionLabelForIndex(bounded);
  }

  function measureVirtualRow(mode, index, node) {
    if (!node) return;
    const mapRef = mode === "desktop" ? desktopHeightMapRef : mobileHeightMapRef;
    const nextHeight = Math.ceil(node.getBoundingClientRect().height);
    if (!nextHeight) return;
    const prev = mapRef.current.get(index);
    if (prev === nextHeight) return;
    mapRef.current.set(index, nextHeight);
    setVirtualizationTick((v) => v + 1);
  }

  function handleChatScroll(event) {
    const el = event.currentTarget;
    if (!el) return;
    if (el === mobileMessagesRef.current) {
      setMobileScrollTop(el.scrollTop);
      setMobileViewportHeight(el.clientHeight || 0);
    } else if (el === desktopMessagesRef.current) {
      setDesktopScrollTop(el.scrollTop);
      setDesktopViewportHeight(el.clientHeight || 0);
    }
    if (isAttachOpen) {
      setIsAttachOpen(false);
      setIsToolsPanelOpen(false);
    }
    const mode = el === desktopMessagesRef.current ? "desktop" : "mobile";
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const progress = Math.min(1, Math.max(0, el.scrollTop / max));
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      setChatScrollProgress(progress);
      const nextLabel = resolveScrollLabelFromPosition(mode, el.scrollTop);
      if (scrollLabelRef.current !== nextLabel) {
        scrollLabelRef.current = nextLabel;
        setChatScrollLabel(nextLabel);
      }
    });
    setIsChatScrolling(true);
    if (scrollHideTimerRef.current) clearTimeout(scrollHideTimerRef.current);
    scrollHideTimerRef.current = setTimeout(() => setIsChatScrolling(false), 900);
  }

  async function shareAssistantMessage(text) {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      if (navigator.share) {
        await navigator.share({ text: value });
        return;
      }
    } catch {
      // fallback to clipboard below
    }
    try {
      await navigator.clipboard.writeText(value);
      setFeedbackToast({ open: true, text: "Response copied for sharing." });
    } catch {
      // ignore clipboard errors
    }
  }

  function handleFileInputChange(event) {
    const files = event.target.files;
    addFiles(files, attachmentSourceRef.current || "file");
    event.target.value = "";
  }

  function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      updateActiveChatMessages(
        (m) => [
          ...m,
          { role: "assistant", text: "Microphone is not supported in this browser.", ownerUid: currentUid, createdAt: Date.now() },
        ],
        "Microphone support"
      );
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = preferredSpeechLanguage;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || "";
        if (transcript.trim()) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.lang = preferredSpeechLanguage;
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }

  async function isBackendHealthy() {
    try {
      const response = await fetch(apiUrl("/api/health"));
      return response.ok;
    } catch {
      return false;
    }
  }

  function appendAssistantPlaceholder(streamId) {
    const now = Date.now();
    updateActiveChatMessages(
      (m) => [...m, { role: "assistant", text: "", streaming: true, streamId, ownerUid: currentUid, createdAt: now }],
      "Reply"
    );
  }

  function updateStreamingAssistant(streamId, updater) {
    updateActiveChatMessages((m) => {
      const idx = m.findIndex((item) => item?.streamId === streamId);
      if (idx < 0) return m;
      const next = [...m];
      const current = next[idx];
      const nextText = updater(String(current?.text || ""));
      next[idx] = { ...current, text: nextText, streaming: true, ownerUid: currentUid };
      return next;
    }, "Reply");
  }

  function finalizeStreamingAssistant(streamId, text) {
    updateActiveChatMessages((m) => {
      const idx = m.findIndex((item) => item?.streamId === streamId);
      if (idx < 0) return [...m, { role: "assistant", text, ownerUid: currentUid, createdAt: Date.now() }];
      const next = [...m];
      const current = next[idx] || {};
      next[idx] = { role: "assistant", text, ownerUid: currentUid, createdAt: current.createdAt || Date.now() };
      return next;
    }, "Reply");
  }

  function withAcademicContext(messageText, context) {
    const contextBlock = buildAcademicContextBlock(context);
    if (!contextBlock) return messageText;
    return `${messageText}\n\n${contextBlock}`;
  }

  async function fetchAssistantReplyFull({ token, messageText, academicContext }) {
    const requestUrl = apiUrl(AI_PATH);
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: withAcademicContext(messageText, academicContext),
        mode: resolvedChatMode,
        workspaceContext,
        context: {
          mode: resolvedChatMode,
          workspace: workspaceContext || null,
        },
        preferredLanguage: String(settingsPrefs?.language || "en-KE"),
        metadata: {
          academicContext: academicContext || EMPTY_ACADEMIC_CONTEXT,
          mode: resolvedChatMode,
          workspaceContext: workspaceContext || null,
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (import.meta.env.DEV) {
      console.debug("[NewChatLanding][AI_RESPONSE]", { status: response.status, ok: response.ok, mode: "fallback" });
    }
    if (!response.ok) {
      const message = result?.message || result?.error || "AI service unavailable.";
      const backendHealthy = response.status === 404 ? await isBackendHealthy() : true;
      return {
        ok: false,
        text: backendHealthy
          ? `I couldn't reach the AI service (status ${response.status}). ${message}`
          : "Backend is unavailable (health check failed). Please try again later.",
      };
    }

    return {
      ok: true,
      text: result?.text || result?.reply || result?.data?.reply || "Response received.",
    };
  }

  async function streamAssistantReply({ token, messageText, streamId, academicContext }) {
    const requestUrl = `${apiUrl(AI_PATH)}?stream=1`;
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: withAcademicContext(messageText, academicContext),
        mode: resolvedChatMode,
        workspaceContext,
        context: {
          mode: resolvedChatMode,
          workspace: workspaceContext || null,
        },
        preferredLanguage: String(settingsPrefs?.language || "en-KE"),
        metadata: {
          academicContext: academicContext || EMPTY_ACADEMIC_CONTEXT,
          mode: resolvedChatMode,
          workspaceContext: workspaceContext || null,
        },
      }),
    });

    const contentType = String(response.headers.get("content-type") || "");
    if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
      return { ok: false, reason: "no_stream" };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let streamedText = "";
    let gotChunk = false;

    const processEvent = (eventBlock) => {
      const lines = eventBlock.split("\n");
      let eventType = "message";
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const payloadRaw = dataLines.join("\n");
      if (!payloadRaw) return false;
      let payload = {};
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        payload = {};
      }

      if (eventType === "chunk") {
        const delta = String(payload?.delta || "");
        if (delta) {
          gotChunk = true;
          streamedText += delta;
          updateStreamingAssistant(streamId, (prev) => `${prev}${delta}`);
          requestAnimationFrame(() => scrollToBottom("auto"));
        }
      }
      if (eventType === "done") {
        const finalText = String(payload?.text || streamedText).trim();
        finalizeStreamingAssistant(streamId, finalText || streamedText || "Response received.");
        return true;
      }
      return false;
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIndex = buffer.search(/\r?\n\r?\n/);
        while (sepIndex >= 0) {
          const delimiter = buffer.slice(sepIndex).startsWith("\r\n\r\n") ? 4 : 2;
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + delimiter);
          const completed = processEvent(rawEvent);
          if (completed) return { ok: true };
          sepIndex = buffer.search(/\r?\n\r?\n/);
        }
      }
    } catch {
      return { ok: false, reason: "stream_read_error", gotChunk, streamedText };
    }

    if (gotChunk) {
      finalizeStreamingAssistant(streamId, streamedText || "Response received.");
      return { ok: true };
    }
    return { ok: false, reason: "empty_stream" };
  }

  async function sendMessage(text) {
    const pendingAttachments = attachments;
    const clean = text.trim();
    if (!clean && pendingAttachments.length === 0) return;

    const attachSummary =
      pendingAttachments.length > 0
        ? `\n\nAttachments:\n${pendingAttachments.map((a) => `- ${a.name}`).join("\n")}`
        : "";
    const messageText = `${clean || "Sent attachments"}${attachSummary}`;
    const currentContext = contextByChat[activeChat?.id || ""] || EMPTY_ACADEMIC_CONTEXT;
    const detectedContext = detectAcademicContext(messageText, currentContext);
    const mergedContext = mergeAcademicContext(currentContext, detectedContext, messageText);
    if (activeChat?.id) {
      setContextByChat((prev) => ({ ...prev, [activeChat.id]: mergedContext }));
    }

    updateActiveChatMessages(
      (m) => [...m, { role: "user", text: messageText, ownerUid: currentUid, createdAt: Date.now() }],
      clean || "New Chat"
    );
    if (clean) setLastPrompt(clean);
    setInput("");
    setAttachments([]);
    setSelectedStarter(null);
    setStarterSuggestions([]);
    requestAnimationFrame(() => scrollToBottom("smooth"));

    let streamId = null;
    try {
      const token = await auth?.currentUser?.getIdToken(true).catch(() => null);
      if (!token) {
        updateActiveChatMessages(
          (m) => [...m, { role: "assistant", text: "Please sign in to use AI chat.", ownerUid: currentUid, createdAt: Date.now() }],
          clean || "Sign in"
        );
        return;
      }

      streamId = `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      appendAssistantPlaceholder(streamId);
      requestAnimationFrame(() => scrollToBottom("auto"));

      if (import.meta.env.DEV) {
        console.debug("[NewChatLanding][AI_REQUEST]", {
          url: apiUrl(AI_PATH),
          hasText: Boolean(clean),
          attachments: pendingAttachments.length,
          mode: "stream-first",
        });
      }

      const streamResult = await streamAssistantReply({
        token,
        messageText,
        streamId,
        academicContext: mergedContext,
      });
      if (streamResult.ok) return;

      const fallback = await fetchAssistantReplyFull({
        token,
        messageText,
        academicContext: mergedContext,
      });
      finalizeStreamingAssistant(streamId, fallback.text);
    } catch {
      const backendHealthy = await isBackendHealthy();
      const errorText = backendHealthy
        ? "Failed to reach AI service."
        : "Backend is unavailable (health check failed). Please try again later.";
      if (streamId) {
        finalizeStreamingAssistant(streamId, errorText);
      } else {
        updateActiveChatMessages(
          (m) => [...m, { role: "assistant", text: errorText, ownerUid: currentUid, createdAt: Date.now() }],
          clean || "Request failed"
        );
      }
    }
  }

  function stripMarkdown(raw) {
    const value = String(raw || "");
    return value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_~>#-]{1,3}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolveTtsLang() {
    const storedPrefs = getStoredPreferences({}, currentUid);
    const storedLang = readScopedJson(currentUid, "language", null);
    const rawLang =
      settingsPrefs?.language ||
      storedPrefs?.language ||
      storedLang ||
      "en-US";
    return resolveSpeechLanguage(rawLang);
  }

  function pickVoice(allVoices, lang) {
    if (!Array.isArray(allVoices) || allVoices.length === 0) return null;
    const normalized = String(lang || "").toLowerCase();
    const base = normalized.split("-")[0];
    const byLang = allVoices.filter((v) => String(v.lang || "").toLowerCase().startsWith(normalized));
    const byBase = allVoices.filter((v) => String(v.lang || "").toLowerCase().startsWith(base));
    const byEn = allVoices.filter((v) => String(v.lang || "").toLowerCase().startsWith("en"));
    const preferGoogle = (list) => list.find((v) => String(v.name || "").toLowerCase().includes("google")) || list[0];
    return preferGoogle(byLang) || preferGoogle(byBase) || preferGoogle(byEn) || null;
  }

  function speakText(rawText) {
    if (!rawText || !("speechSynthesis" in window)) return;
    const cleaned = stripMarkdown(rawText);
    if (!cleaned) return;
    const clipped = cleaned.length > 1800 ? `${cleaned.slice(0, 1800)}…` : cleaned;
    const now = Date.now();
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    setSpeakingText(rawText);
    const utterance = new SpeechSynthesisUtterance(clipped);
    const resolvedLang = resolveTtsLang() || "en-US";
    const chosenVoice = pickVoice(voices, resolvedLang);
    utterance.lang = resolvedLang;
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };
    window.speechSynthesis.speak(utterance);
    lastSpokenRef.current = { text: clipped, at: now };
  }

  function speakAssistantText(text) {
    speakText(text);
  }

  async function copyPromptText(index, text) {
    const value = String(text || "");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const temp = document.createElement("textarea");
        temp.value = value;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 1200);
    } catch {
      setCopiedMessageIndex(null);
    }
  }

  function editPromptText(text) {
    const value = String(text || "");
    setInput(value);
    setTimeout(() => focusPromptInput(), 0);
  }

  function handleNavClick(itemKey) {
    setIsMorePopupOpen(false);
    setIsMobileMoreOpen(false);
    setIsNewChatMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsNotificationsMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setIsAttachOpen(false);
    setIsToolsPanelOpen(false);

    if (itemKey === "admin") {
      if (!canShowAdmin) return;
      syncActiveView("admin", "push");
      return;
    }
    syncActiveView(itemKey, "push");
  }

  useEffect(() => {
    const onWindowKeyDown = (event) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        globalSearchInputRef.current?.focus();
        globalSearchInputRef.current?.select();
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTypingTarget) return;
        event.preventDefault();
        globalSearchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;
    if (active !== "newchat") {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      return;
    }
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [active]);

  if (active === "settings") {
    return (
      <SettingsPage
        user={user}
        onBack={() => syncActiveView("newchat", "push")}
        canShowAdmin={isAdminRole}
        onOpenAdmin={openAdminPanel}
      />
    );
  }

  if (active === "profile") {
    const name = firebaseUser?.displayName || "Student";
    const email = firebaseUser?.email || "—";
    const photo = firebaseUser?.photoURL || null;
    const uid = firebaseUser?.uid || "—";
    const role = userRole || "unknown";
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Profile</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-14 w-14 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              {photo ? <img src={photo} alt="Profile avatar" className="h-full w-full object-cover" /> : initialsOf(name)}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900 truncate">{name}</div>
              <div className="text-sm text-slate-600 truncate">{email}</div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-slate-500">UID</span>
              <span className="ml-3 truncate max-w-[60%]">{uid}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-slate-500">Role</span>
              <span className="ml-3 truncate max-w-[60%]">{role}</span>
            </div>
          </div>
          <button
            onClick={() => syncActiveView("newchat", "push")}
            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  if (active === "notebook") {
    return <NotebookPage onBack={() => syncActiveView("newchat", "push")} />;
  }

  if (active === "subgroups") {
    return <SubgroupRoom onBack={() => syncActiveView("newchat", "push")} />;
  }

  if (active === "courses") {
    return <CoursesDashboard onBack={() => syncActiveView("newchat", "push")} />;
  }

  if (active === "assignments") {
    return <AssignmentsPage />;
  }

  if (active === "results") {
    return <ResultsPage />;
  }

  if (active === "admin") {
    return <AdminAnalyticsLanding />;
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-slate-100 flex flex-col overflow-hidden md:h-[100dvh] md:overflow-hidden">
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="bg-gradient-to-b from-white/80 via-white/40 to-transparent px-3 py-3 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow-sm grid place-items-center text-slate-700"
              onClick={() => setIsMobileDrawerOpen(true)}
              title="Menu"
            >
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-1 min-w-0">
              <span className="px-3 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm text-sm font-semibold text-slate-900">
                ElimuLink
              </span>
              <span className="px-3 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm text-sm font-semibold text-slate-900">
                University
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                ref={notifBtnRef}
                onClick={openMobileNotifications}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow-sm grid place-items-center text-slate-700 relative"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadNotifications > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-sky-500 text-white text-[10px] font-semibold leading-[18px] px-1">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                ) : null}
              </button>
            </div>

            <div ref={profileMenuRef} className="relative">
              <button
                onClick={() => setIsProfileSheetOpen(true)}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden grid place-items-center text-slate-700"
                title="Profile"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold">{profileInitials}</span>
                )}
              </button>

            </div>
          </div>
        </div>
        {import.meta.env.DEV ? (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 md:hidden px-3">
            <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5">role: {String(userRole || "unknown")}</span>
            <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5">view: {String(active || "unknown")}</span>
          </div>
        ) : null}
      </div>

      {isNotifOpen && notifAnchor ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent md:hidden"
            aria-label="Close notifications"
            onClick={() => setIsNotifOpen(false)}
          />
          <div
            className="fixed z-50 rounded-2xl bg-white shadow-xl border border-slate-200 p-2 space-y-2 md:hidden"
            style={{ top: notifAnchor.top, left: notifAnchor.left, width: notifAnchor.width }}
          >
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-slate-500">NOTIFICATIONS</div>
                <div className="text-xs text-slate-600">
                  {settingsPrefs.muteNotifications ? "Muted from Settings" : "Recent updates"}
                </div>
              </div>
              {!settingsPrefs.muteNotifications ? (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-64 overflow-auto smart-scrollbar space-y-2">
              {settingsPrefs.muteNotifications ? (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  Notifications are muted.
                  <button onClick={openSettingsPanel} className="ml-2 text-slate-900 font-semibold underline">
                    Open Settings
                  </button>
                </div>
              ) : (
                normalizedNotifications.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600 mt-1">{item.body}</div>
                    {item.createdAt ? (
                      <div className="text-[11px] text-slate-400 mt-1">{formatTimeAgo(item.createdAt)}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {isProfileSheetOpen ? (
        <>
          <button
            type="button"
            aria-label="Close profile sheet"
            className="fixed inset-0 z-[60] bg-black/30 md:hidden"
            onClick={() => setIsProfileSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl bg-white shadow-2xl md:hidden"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
                <button
                  type="button"
                  onClick={() => setIsProfileSheetOpen(false)}
                  className="absolute right-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Done
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                    {auth.currentUser?.photoURL ? (
                      <img src={auth.currentUser.photoURL} alt="Profile avatar" className="h-full w-full object-cover" />
                    ) : (
                      profileInitials || "S"
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {auth.currentUser?.displayName || "Student"}
                    </div>
                    <div className="text-xs text-slate-600 truncate">{auth.currentUser?.email || ""}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <button
                  onClick={() => {
                    setIsProfileSheetOpen(false);
                    syncActiveView("profile", "push");
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <IdCard size={16} />
                  Profile & Account
                </button>
                <button
                  onClick={() => {
                    setIsProfileSheetOpen(false);
                    syncActiveView("settings", "push");
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Settings size={16} />
                  Settings
                </button>
                {canShowAdmin ? (
                  <button
                    onClick={() => {
                      setIsProfileSheetOpen(false);
                      openAdminPanel();
                    }}
                    className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Shield size={16} />
                    Admin
                  </button>
                ) : null}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="hidden md:block w-full px-4 md:px-5 pt-1.5 pb-0.5 shrink-0 relative z-20">
        <div className="surface-elevated h-12 rounded-xl border border-slate-200/85 bg-slate-50/95 shadow-[0_6px_16px_rgba(15,23,42,0.05)] px-2.5 md:px-3 flex items-center gap-2">
          <button
            className="md:hidden h-9 w-9 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
            onClick={() => setIsMobileDrawerOpen(true)}
            title="Open menu"
          >
            <Menu size={16} className="mx-auto text-slate-700" />
          </button>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800"
              title="Home"
            >
              <span className="h-6 w-6 rounded-md bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center">
                E
              </span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
            <button
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
              title="Calendar"
              onClick={() => handleNavClick("calendar")}
            >
              <CalendarDays size={14} />
            </button>
          </div>

          <div className="hidden md:flex flex-1 min-w-0 items-center justify-center">
            <div className="relative w-full max-w-[640px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={globalSearchInputRef}
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runGlobalSearch();
                  }
                }}
                placeholder="Search Ctrl K"
                className="w-full h-9 rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-1 mr-1">
            <button
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
              title="New Chat"
              onClick={startNewChat}
            >
              <Check size={16} />
            </button>
            <button
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
              title="Notebook"
              onClick={() => handleNavClick("notebook")}
            >
              <NotebookPen size={16} />
            </button>
            <button
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
              title="Courses"
              onClick={() => handleNavClick("courses")}
            >
              <BookOpen size={16} />
            </button>
            <button
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
              title="Results"
              onClick={() => handleNavClick("results")}
            >
              <BarChart3 size={16} />
            </button>
          </div>

          <div ref={notificationsMenuRef} className="relative">
            <button
              onClick={toggleNotificationsMenu}
              className="h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 relative"
              title="Notifications"
            >
              <Bell size={16} className="mx-auto" />
              {unreadNotifications > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-sky-500 text-white text-[10px] font-semibold leading-[18px] px-1">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </button>

            {isNotificationsMenuOpen ? (
              <div className="absolute right-0 top-12 w-80 rounded-xl border border-slate-200 bg-white p-2 space-y-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
                  <div>
                    <div className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-300">NOTIFICATIONS</div>
                    <div className="text-xs text-slate-600 dark:text-slate-200">
                      {settingsPrefs.muteNotifications ? "Muted from Settings" : "Recent updates"}
                    </div>
                  </div>
                  {!settingsPrefs.muteNotifications ? (
                    <button
                      onClick={() => setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>

                <div className="max-h-64 overflow-auto smart-scrollbar space-y-1">
                  {settingsPrefs.muteNotifications ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                      Notifications are muted.
                      <button
                        onClick={openSettingsPanel}
                        className="ml-2 text-slate-900 font-semibold underline dark:text-white"
                      >
                        Open Settings
                      </button>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className={[
                          "rounded-lg px-3 py-2 border",
                          item.read
                            ? "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                            : "bg-indigo-600 text-white border-indigo-500",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div
                          className={
                            item.read ? "text-xs text-slate-600 dark:text-slate-300" : "text-xs text-indigo-100"
                          }
                        >
                          {item.detail}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div ref={profileMenuRef} className="relative">
            <button
              onClick={toggleProfileMenu}
              className="h-9 w-9 rounded-full overflow-hidden bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"
              title={`${user.name} profile`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : profileInitials ? (
                <span className="text-xs font-semibold">{profileInitials}</span>
              ) : (
                <UserCircle2 size={20} />
              )}
            </button>

            {isProfileMenuOpen ? (
              <>
                <div className="fixed inset-0 z-[70] md:hidden">
                  <button
                    type="button"
                    aria-label="Close profile menu"
                    className="absolute inset-0 bg-black/45"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <button
                        type="button"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="absolute right-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Done
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                          ) : (
                            profileInitials
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate dark:text-white">{user.name}</div>
                          <div className="text-xs text-slate-600 truncate dark:text-slate-300">{user.email}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <button
                        onClick={openSettingsPanel}
                        className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <IdCard size={16} />
                        Profile & Account
                      </button>
                      <button
                        onClick={openSettingsPanel}
                        className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                      {canShowAdmin ? (
                        <button
                          onClick={openAdminPanel}
                          className="w-full text-left px-3 py-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                        >
                          <Shield size={16} />
                          Admin
                        </button>
                      ) : null}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-3 rounded-xl text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 flex items-center gap-2"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </div>
                </div>

                <div className="absolute right-0 top-12 hidden w-80 rounded-xl border border-slate-200 bg-white p-2 space-y-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:block">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                        ) : (
                          profileInitials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate dark:text-white">{user.name}</div>
                        <div className="text-xs text-slate-600 truncate dark:text-slate-300">{user.email}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={openSettingsPanel}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <IdCard size={15} />
                    Profile & Account
                  </button>
                  <button
                    onClick={openSettingsPanel}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Settings size={15} />
                    Settings
                  </button>
                  {canShowAdmin ? (
                    <button
                      onClick={openAdminPanel}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Shield size={15} />
                      Admin
                    </button>
                  ) : null}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 flex items-center gap-2"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {isMobileDrawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r border-slate-200">
            <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_20px_rgba(99,102,241,0.35)]" />
                <div className="font-semibold text-slate-800">Home</div>
              </div>
              <button
                className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50"
                onClick={() => setIsMobileDrawerOpen(false)}
              >
                <X size={16} className="mx-auto" />
              </button>
            </div>

            <nav className="p-2 space-y-3">
              <div className="space-y-1">
                <div className="px-3 pt-1 text-[11px] font-semibold tracking-wider text-slate-500">MAIN</div>
                <div className="space-y-1 relative" ref={newChatMenuRef}>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                        <SidebarButton
                          label="NewChat"
                          icon={LayoutGrid}
                          active={active === "newchat"}
                          collapsed={false}
                          onClick={() => {
                            setIsMobileDrawerOpen(false);
                            startNewChat();
                          }}
                        />
                    </div>
                    <button
                      onClick={() => setIsNewChatMenuOpen((v) => !v)}
                      className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center justify-center"
                      title="Chat actions"
                    >
                      <Ellipsis size={16} />
                    </button>
                  </div>

                  {isNewChatMenuOpen ? (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-xl border border-blue-200/60 bg-blue-500/20 backdrop-blur-sm p-1 space-y-1 z-30">
                      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-500">CHAT HISTORY</div>
                      <div className="max-h-44 overflow-auto smart-scrollbar space-y-1">
                        {chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={[
                              "flex items-center gap-2 px-2 py-1 rounded-lg",
                              activeChatId === chat.id
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "hover:bg-blue-500/20",
                            ].join(" ")}
                          >
                            <button
                              onClick={() => {
                                syncActiveView("newchat", "push");
                                setActiveChatId(chat.id);
                                setIsMobileDrawerOpen(false);
                                setIsNewChatMenuOpen(false);
                              }}
                              className="flex-1 text-left min-w-0"
                              title={chat.title}
                            >
                              <div
                                className={[
                                  "text-sm truncate",
                                  activeChatId === chat.id ? "text-white font-semibold" : "text-slate-700 font-medium",
                                ].join(" ")}
                              >
                                {chat.title || UNTITLED_CHAT_BASE}
                              </div>
                              <div
                                className={[
                                  "text-[11px]",
                                  activeChatId === chat.id ? "text-indigo-100" : "text-slate-500",
                                ].join(" ")}
                              >
                                {formatChatStamp(chat.updatedAt)}
                              </div>
                            </button>
                            <button
                              onClick={() => renameChatById(chat.id)}
                              className={[
                                "h-7 w-7 inline-flex items-center justify-center rounded-md border",
                                activeChatId === chat.id
                                  ? "border-white/35 text-white hover:bg-white/15"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-100",
                              ].join(" ")}
                              title="Rename chat"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteChatById(chat.id)}
                              className={[
                                "h-7 w-7 inline-flex items-center justify-center rounded-md border",
                                activeChatId === chat.id
                                  ? "border-white/35 text-white hover:bg-white/15"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-100",
                              ].join(" ")}
                              title="Delete chat"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {MAIN_ITEMS.filter((item) => item.key !== "newchat").map((item) => (
                  <SidebarButton
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    active={active === item.key}
                    collapsed={false}
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleNavClick(item.key);
                    }}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pt-1 text-[11px] font-semibold tracking-wider text-slate-500">COLLABORATION</div>
                {COLLABORATION_ITEMS.map((item) => (
                  <SidebarButton
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    active={active === item.key}
                    collapsed={false}
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleNavClick(item.key);
                    }}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pt-1 text-[11px] font-semibold tracking-wider text-slate-500">SYSTEM</div>

                <SidebarButton
                  label={SETTINGS_ITEM.label}
                  icon={SETTINGS_ITEM.icon}
                  active={active === SETTINGS_ITEM.key}
                  collapsed={false}
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    handleNavClick(SETTINGS_ITEM.key);
                  }}
                />

                <button
                  onClick={() => setIsMobileMoreOpen((v) => !v)}
                  className={[
                    "w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition",
                    moreKeys.includes(active) ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Ellipsis size={16} />
                  <span className="flex-1">More</span>
                  {isMobileMoreOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="px-3 -mt-1 text-xs text-slate-400">Role: {String(userRole || "unknown")}</div>

                {isMobileMoreOpen ? (
                  <div className="pl-2 space-y-1">
                    {moreItems.map((item) => (
                      <SidebarButton
                        key={item.key}
                        label={item.label}
                        icon={item.icon}
                        active={active === item.key}
                        collapsed={false}
                        onClick={() => {
                          setIsMobileDrawerOpen(false);
                          handleNavClick(item.key);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <div className="w-full px-4 md:px-5 pt-1.5 pb-4 flex-1 min-h-0 overflow-hidden">
        <div className="h-full min-h-0 md:flex md:gap-4">
        <aside
          className={[
            "hidden md:block h-full min-h-0 shrink-0 transition-[width] duration-300 ease-out",
            isSidebarOpen ? "w-[272px]" : "w-[82px]",
          ].join(" ")}
        >
          <div
            className={[
              "surface-elevated rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-[0_10px_22px_rgba(15,23,42,0.05)] overflow-visible h-full flex flex-col",
              "transition-all duration-300 ease-out",
            ].join(" ")}
          >
            <div className="relative px-3 py-3 bg-slate-50/95 border-b border-slate-200/70 flex items-center">
              {isSidebarOpen ? (
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_20px_rgba(99,102,241,0.22)]" />
                  <div className="text-[15px] font-semibold text-slate-800">Workspace</div>
                </div>
              ) : (
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500" />
              )}
              <button
                onClick={() => {
                  setIsSidebarOpen((v) => !v);
                  setIsMorePopupOpen(false);
                }}
                className={[
                  "absolute -right-2.5 top-1/2 -translate-y-1/2",
                  "h-8 w-8 rounded-xl",
                  "border border-slate-200/90 bg-white/95 shadow-sm",
                  "hover:bg-slate-100 text-slate-600",
                  "flex items-center justify-center",
                ].join(" ")}
                title={isSidebarOpen ? "Collapse" : "Expand"}
              >
                <ChevronRight
                  size={15}
                  className={["transition-transform duration-300", isSidebarOpen ? "rotate-180" : ""].join(" ")}
                />
              </button>
            </div>

            <nav className="p-2.5 pb-4 space-y-3 relative flex-1 min-h-0 overflow-y-auto overflow-x-visible smart-scrollbar">
              {isSidebarOpen ? (
                <div className="px-2 pb-1">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={sidebarSearch}
                      onChange={(event) => setSidebarSearch(event.target.value)}
                      placeholder="Search"
                      className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/90 pl-9 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <SectionLabel collapsed={!isSidebarOpen}>MAIN</SectionLabel>
                <div className="space-y-1 relative" ref={newChatMenuRef}>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      <SidebarButton
                        label="NewChat"
                        icon={LayoutGrid}
                        active={active === "newchat"}
                        collapsed={!isSidebarOpen}
                        onClick={startNewChat}
                      />
                    </div>
                    {isSidebarOpen ? (
                      <button
                        onClick={() => setIsNewChatMenuOpen((v) => !v)}
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0"
                        title="Chat actions"
                      >
                        <Ellipsis size={16} />
                      </button>
                    ) : null}
                  </div>

                  {isSidebarOpen && isNewChatMenuOpen ? (
                    <div className="absolute left-2 right-2 top-full mt-1 rounded-xl border border-blue-200/60 bg-blue-500/20 backdrop-blur-sm p-1 space-y-1 z-30">
                      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-500">CHAT HISTORY</div>
                      <div className="max-h-44 overflow-auto smart-scrollbar space-y-1">
                        {chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={[
                              "flex items-center gap-2 px-2 py-1 rounded-lg",
                              activeChatId === chat.id
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "hover:bg-blue-500/20",
                            ].join(" ")}
                          >
                            <button
                              onClick={() => {
                                syncActiveView("newchat", "push");
                                setActiveChatId(chat.id);
                                setIsNewChatMenuOpen(false);
                              }}
                              className="flex-1 text-left min-w-0"
                              title={chat.title}
                            >
                              <div
                                className={[
                                  "text-sm truncate",
                                  activeChatId === chat.id ? "text-white font-semibold" : "text-slate-700 font-medium",
                                ].join(" ")}
                              >
                                {chat.title || UNTITLED_CHAT_BASE}
                              </div>
                              <div
                                className={[
                                  "text-[11px]",
                                  activeChatId === chat.id ? "text-indigo-100" : "text-slate-500",
                                ].join(" ")}
                              >
                                {formatChatStamp(chat.updatedAt)}
                              </div>
                            </button>
                            <button
                              onClick={() => renameChatById(chat.id)}
                              className={[
                                "h-7 w-7 inline-flex items-center justify-center rounded-md border",
                                activeChatId === chat.id
                                  ? "border-white/35 text-white hover:bg-white/15"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-100",
                              ].join(" ")}
                              title="Rename chat"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteChatById(chat.id)}
                              className={[
                                "h-7 w-7 inline-flex items-center justify-center rounded-md border",
                                activeChatId === chat.id
                                  ? "border-white/35 text-white hover:bg-white/15"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-100",
                              ].join(" ")}
                              title="Delete chat"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {MAIN_ITEMS.filter((item) => item.key !== "newchat").map((item) => (
                  <SidebarButton
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    active={active === item.key}
                    collapsed={!isSidebarOpen}
                    onClick={() => handleNavClick(item.key)}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <SectionLabel collapsed={!isSidebarOpen}>COLLABORATION</SectionLabel>
                {COLLABORATION_ITEMS.map((item) => (
                  <SidebarButton
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    active={active === item.key}
                    collapsed={!isSidebarOpen}
                    onClick={() => handleNavClick(item.key)}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <SectionLabel collapsed={!isSidebarOpen}>SYSTEM</SectionLabel>

                <SidebarButton
                  label={SETTINGS_ITEM.label}
                  icon={SETTINGS_ITEM.icon}
                  active={active === SETTINGS_ITEM.key}
                  collapsed={!isSidebarOpen}
                  onClick={() => handleNavClick(SETTINGS_ITEM.key)}
                />

                <button
                  onClick={() => {
                    if (isSidebarOpen) {
                      setIsMoreOpen((v) => !v);
                    } else {
                      setIsMorePopupOpen((v) => !v);
                    }
                  }}
                  className={[
                    "w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition",
                    !isSidebarOpen ? "justify-center" : "",
                    moreKeys.includes(active) ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                  title={!isSidebarOpen ? "More" : undefined}
                >
                  <Ellipsis size={16} />
                  {isSidebarOpen ? (
                    <>
                      <span className="flex-1">More</span>
                      {isMoreOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  ) : null}
                </button>

                {isSidebarOpen && isMoreOpen ? (
                  <div className="pl-2 space-y-1">
                    {moreItems.map((item) => (
                      <SidebarButton
                        key={item.key}
                        label={item.label}
                        icon={item.icon}
                        active={active === item.key}
                        collapsed={false}
                        onClick={() => handleNavClick(item.key)}
                      />
                    ))}
                  </div>
                ) : null}

                {!isSidebarOpen && isMorePopupOpen ? (
                  <div className="absolute left-[74px] bottom-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-lg p-2 z-20">
                    <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-500">MORE</div>
                    <div className="mt-1 space-y-1">
                      {moreItems.map((item) => (
                        <SidebarButton
                          key={item.key}
                          label={item.label}
                          icon={item.icon}
                          active={active === item.key}
                          collapsed={false}
                          onClick={() => {
                            setIsMorePopupOpen(false);
                            handleNavClick(item.key);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </nav>
          </div>
        </aside>

        <main
          className={[
            "min-w-0 flex flex-col overflow-hidden min-h-0 flex-1",
          ].join(" ")}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={fileAcceptMode || undefined}
            capture={fileCaptureMode || undefined}
            onChange={handleFileInputChange}
          />

          {active === "newchat" ? (
            <div className="md:hidden h-[100dvh] overflow-hidden flex flex-col">
              <div
                ref={mobileMessagesRef}
                onScroll={handleChatScroll}
                className="chat-scroll-surface flex-1 overflow-y-auto overscroll-none touch-pan-y px-4 pt-20 pb-[calc(96px+env(safe-area-inset-bottom))] space-y-4"
                style={{ paddingBottom: `calc(${composerHeight}px + env(safe-area-inset-bottom) + ${kbHeight}px + 28px)` }}
              >
                {messages.length === 0 ? (
                  <div className="rounded-3xl bg-white/95 border border-slate-200/80 px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
                    <div className="text-[12px] font-medium tracking-[0.01em] text-slate-500">{timeGreeting()}</div>
                    <div className="text-[28px] leading-[1.2] font-semibold text-slate-900 mt-1.5">
                      {modeConfig.title}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-600 mt-2">
                      {modeConfig.subtitle}
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="flex flex-wrap items-start gap-1.5 pt-1 pb-2">
                    {starterSet.map((starter) => {
                      const isActive = selectedStarter === starter.key;
                      return (
                        <button
                          key={starter.key}
                          onClick={() => applyStarter(starter)}
                          className={[
                            "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-medium leading-tight bg-white/95 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition active:scale-[0.99]",
                            isActive
                              ? "border-sky-300 bg-sky-50 text-slate-900"
                              : "border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <span className="text-[15px] leading-none">{starter.emoji}</span>
                          <span>{starter.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {activeContextLabel ? (
                  <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[11px] text-slate-600">
                    {activeContextLabel}
                  </div>
                ) : null}

                {messages.length > 0 ? <div style={{ height: mobileVirtualWindow.paddingTop }} /> : null}
                {mobileVirtualWindow.items.map(({ message: m, index: idx }) => (
                  <div key={idx} ref={(node) => measureVirtualRow("mobile", idx, node)}>
                    {shouldShowSectionAnchor(idx) ? (
                      <div className="my-2.5 flex items-center gap-2.5">
                        <span className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                          {sectionLabelForIndex(idx)}
                        </span>
                        <span className="h-px flex-1 bg-slate-200/70" />
                      </div>
                    ) : null}
                    <Bubble
                      role={m.role}
                      text={m.text}
                      streaming={Boolean(m.streaming)}
                      onAssistantSpeak={speakAssistantText}
                      isSpeaking={isSpeaking}
                      speakingText={speakingText}
                      onRetry={() => {
                        if (lastPrompt) sendMessage(lastPrompt);
                      }}
                      onLearnMore={() => sendMessage("Learn more about the error and how I can fix it.")}
                      onCopy={() => copyPromptText(idx, m.text)}
                      onEdit={m.role === "user" ? () => editPromptText(m.text) : undefined}
                      isCopied={copiedMessageIndex === idx}
                      reaction={feedbackByMessage[`${activeChat?.id || "chat"}:${idx}`] || null}
                      onLike={() => setMessageFeedback(`${activeChat?.id || "chat"}:${idx}`, "like")}
                      onDislike={() => setMessageFeedback(`${activeChat?.id || "chat"}:${idx}`, "dislike")}
                      onShare={() => shareAssistantMessage(m.text)}
                      onRetryMessage={() => lastPrompt && sendMessage(lastPrompt)}
                      onSimplify={() => sendMessage("Please simplify your last answer in clear student-friendly language.")}
                      onDetailed={() => sendMessage("Please make your last answer more detailed with steps and practical examples.")}
                      onSummarizeTool={() => sendMessage(`Summarize this answer for me:\n\n${m.text}`)}
                      onNotesTool={() => sendMessage(`Turn this answer into clean study notes:\n\n${m.text}`)}
                      onFlashcardsTool={() => sendMessage(`Generate revision flashcards (Q/A) from this answer:\n\n${m.text}`)}
                      onSimplerTool={() => sendMessage(`Explain this answer in simpler student-friendly language:\n\n${m.text}`)}
                    />
                  </div>
                ))}
                {messages.length > 0 ? <div style={{ height: mobileVirtualWindow.paddingBottom }} /> : null}
                <div ref={messagesEndRef} />
              </div>

              <div
                ref={mobileComposerRef}
                className="fixed left-0 right-0 bottom-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:static md:z-auto"
                style={{ bottom: `${kbHeight}px` }}
              >
                <div className="max-w-xl mx-auto space-y-2">
                  {hasStarterSuggestions ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.05)] p-2.5">
                      <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                        Suggested prompts
                      </div>
                      <div className="space-y-1.5">
                        {starterSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => applySuggestion(suggestion)}
                            className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-200/80"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="surface-elevated rounded-[26px] border border-slate-200/90 bg-white/90 backdrop-blur-md px-2.5 py-2 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
                    {attachments.length > 0 ? (
                      <div className="mb-2.5 flex flex-wrap gap-1.5 px-1">
                        {attachments.map((a) => (
                          <div
                            key={a.id}
                            className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-2.5 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                          >
                            <span className="text-[12px] font-medium text-slate-700 truncate max-w-[130px]">{a.name}</span>
                            <span className="text-[10px] text-slate-500">{formatFileSize(a.size)}</span>
                            <button
                              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              onClick={() => removeAttachment(a.id)}
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-end gap-2">
                      <div ref={mobileAttachmentMenuRef} className="relative shrink-0">
                        <button
                          onClick={toggleAttachmentPanel}
                          className="h-10 w-10 rounded-2xl border border-slate-200/90 bg-white/80 text-slate-700 grid place-items-center shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition hover:bg-slate-50 active:scale-[0.98]"
                          title="Add attachment"
                        >
                          <Plus size={17} />
                        </button>

                        <div
                          className={[
                            "surface-elevated absolute left-0 bottom-12 z-30 w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/40 bg-white/75 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)] p-2 origin-bottom-left transition duration-150",
                            isAttachOpen ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-1.5 scale-95 pointer-events-none",
                          ].join(" ")}
                        >
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              onClick={() => openAttachmentPicker({ accept: "image/*", source: "photo" })}
                              className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                            >
                              <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <Image size={16} />
                              </span>
                              <span>Photo</span>
                            </button>
                            <button
                              onClick={() => openAttachmentPicker({ source: "file" })}
                              className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                            >
                              <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <Paperclip size={16} />
                              </span>
                              <span>Files</span>
                            </button>
                            <button
                              onClick={() => openAttachmentPicker({ accept: "image/*", capture: "environment", source: "camera" })}
                              className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                            >
                              <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <Camera size={16} />
                              </span>
                              <span>Camera</span>
                            </button>
                            <button
                              onClick={() => openAttachmentPicker({ accept: "image/*", capture: "environment", source: "scan" })}
                              className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                            >
                              <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <ScanLine size={16} />
                              </span>
                              <span>Scan</span>
                            </button>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/65 p-1.5">
                            <div className="relative overflow-hidden">
                              <div className={`transition-transform duration-200 ${isToolsPanelOpen ? "-translate-x-full" : "translate-x-0"}`}>
                                <button
                                  onClick={() => setIsToolsPanelOpen(true)}
                                  className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-700 hover:bg-white/80"
                                >
                                  <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Tools</span>
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                              <div
                                className={[
                                  "absolute inset-0 transition-transform duration-200",
                                  isToolsPanelOpen ? "translate-x-0" : "translate-x-full",
                                ].join(" ")}
                              >
                                <div className="rounded-lg bg-white/90 p-1">
                                  <button
                                    onClick={() => setIsToolsPanelOpen(false)}
                                    className="mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                                  >
                                    <ChevronDown size={12} />
                                    Back
                                  </button>
                                  <div className="grid grid-cols-2 gap-1">
                                    {COMPOSER_TOOL_PRESETS.map((tool) => (
                                      <button
                                        key={tool.key}
                                        onClick={() => applyToolPreset(tool.prompt)}
                                        className="rounded-md border border-slate-200/80 bg-white px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50"
                                      >
                                        {tool.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <textarea
                        ref={mobilePromptInputRef}
                        data-maxheight="168"
                        rows={1}
                        value={input}
                        onChange={(e) => handleComposerInputChange(e.target.value, e.target)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(input);
                          }
                        }}
                        className="min-h-[42px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                        placeholder="Type your message..."
                      />

                      <button
                        onClick={() => (hasText ? sendMessage(input) : toggleMic())}
                        className={[
                          "relative h-10 w-10 shrink-0 rounded-2xl transition grid place-items-center overflow-hidden",
                          hasText
                            ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-[0.98]"
                            : "border border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                        title={hasText ? "Send" : "Live AI ready"}
                      >
                        {!hasText ? (
                          <>
                            <span className="absolute inset-0 rounded-2xl border border-sky-400/35" />
                            <Mic size={16} className="relative z-10" />
                          </>
                        ) : (
                          <Send size={16} className="transition-transform duration-200" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {active !== "newchat" ? (
            <div className="md:hidden flex-1 overflow-y-auto px-4 pt-20 pb-24 bg-slate-50">
              <PlaceholderPanel
                title={activePlaceholder?.title || "Coming soon"}
                bullets={activePlaceholder?.bullets || ["Feature wiring", "Permissions setup", "Backend connection"]}
              />
            </div>
          ) : null}

          {active === "newchat" ? (
            <div className="surface-elevated relative hidden md:flex flex-1 min-h-0 flex-col rounded-2xl bg-slate-50/70">
            <div className="px-4 py-2.5 shrink-0">
              <div className="max-w-[1080px] w-full mx-auto">
                <div className="text-sm font-semibold text-slate-800">{activeChat?.title || UNTITLED_CHAT_BASE}</div>
                <div className="text-xs text-slate-500">
                  AI Academic Assistant • {formatChatStamp(activeChat?.updatedAt)}
                </div>
                {activeContextLabel ? (
                  <div className="mt-1 inline-flex items-center rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[11px] text-slate-600">
                    {activeContextLabel}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={[hasConversation ? "px-4 pt-1 pb-2" : "px-4 pt-1 pb-2", "flex-1 min-h-0 flex flex-col"].join(" ")}>
              <div className="max-w-[1080px] w-full mx-auto flex-1 min-h-0 flex flex-col">
              {messages.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 shrink-0 mb-3">
                  <StatCard title="Next Class" value={user.nextClass} subtitle="From your timetable" />
                  <StatCard title="Balance" value={user.balance} subtitle="Fees portal" />
                  <StatCard title="Attendance" value={user.attendance} subtitle="This month" />
                  <StatCard title="GPA Progress" value={user.gpa} subtitle="Current GPA" />
                </div>
              ) : null}

              <div ref={desktopMessagesRef} onScroll={handleChatScroll} className="chat-scroll-surface flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3.5">
                <div className="max-w-[760px] w-full mx-auto space-y-5 pb-8">
                {messages.length === 0 ? (
                  <div className="rounded-3xl bg-white/95 border border-slate-200/80 px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[12px] font-medium tracking-[0.01em] text-slate-500">{timeGreeting()}</div>
                    <div className="text-[30px] leading-[1.2] font-semibold text-slate-900 mt-1.5">
                      {modeConfig.title}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-600 mt-2">
                      {modeConfig.subtitle}
                    </div>
                  </div>
                ) : null}

                {messages.length > 0 ? <div style={{ height: desktopVirtualWindow.paddingTop }} /> : null}
                {desktopVirtualWindow.items.map(({ message: m, index: idx }) => (
                  <div key={idx} ref={(node) => measureVirtualRow("desktop", idx, node)}>
                    {shouldShowSectionAnchor(idx) ? (
                      <div className="my-3 flex items-center gap-3">
                        <span className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                          {sectionLabelForIndex(idx)}
                        </span>
                        <span className="h-px flex-1 bg-slate-200/70" />
                      </div>
                    ) : null}
                    <Bubble
                      role={m.role}
                      text={m.text}
                      streaming={Boolean(m.streaming)}
                      onAssistantSpeak={speakAssistantText}
                      isSpeaking={isSpeaking}
                      speakingText={speakingText}
                      onRetry={() => {
                        if (lastPrompt) sendMessage(lastPrompt);
                      }}
                      onLearnMore={() => sendMessage("Learn more about the error and how I can fix it.")}
                      onCopy={() => copyPromptText(idx, m.text)}
                      onEdit={m.role === "user" ? () => editPromptText(m.text) : undefined}
                      isCopied={copiedMessageIndex === idx}
                      reaction={feedbackByMessage[`${activeChat?.id || "chat"}:${idx}`] || null}
                      onLike={() => setMessageFeedback(`${activeChat?.id || "chat"}:${idx}`, "like")}
                      onDislike={() => setMessageFeedback(`${activeChat?.id || "chat"}:${idx}`, "dislike")}
                      onShare={() => shareAssistantMessage(m.text)}
                      onRetryMessage={() => lastPrompt && sendMessage(lastPrompt)}
                      onSimplify={() => sendMessage("Please simplify your last answer in clear student-friendly language.")}
                      onDetailed={() => sendMessage("Please make your last answer more detailed with steps and practical examples.")}
                      onSummarizeTool={() => sendMessage(`Summarize this answer for me:\n\n${m.text}`)}
                      onNotesTool={() => sendMessage(`Turn this answer into clean study notes:\n\n${m.text}`)}
                      onFlashcardsTool={() => sendMessage(`Generate revision flashcards (Q/A) from this answer:\n\n${m.text}`)}
                      onSimplerTool={() => sendMessage(`Explain this answer in simpler student-friendly language:\n\n${m.text}`)}
                    />
                  </div>
                ))}
                {messages.length > 0 ? <div style={{ height: desktopVirtualWindow.paddingBottom }} /> : null}
                <div ref={messagesEndRef} />
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="mt-3 flex flex-wrap items-start gap-1.5 shrink-0 max-w-[760px] w-full mx-auto">
                  {starterSet.map((starter) => {
                    const isActive = selectedStarter === starter.key;
                    return (
                      <button
                        key={starter.key}
                        onClick={() => applyStarter(starter)}
                        className={[
                          "inline-flex items-center gap-2 rounded-2xl border bg-white/95 px-3 py-2 text-left text-[13px] font-medium text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition active:scale-[0.99]",
                          isActive
                            ? "border-sky-300 bg-sky-50 text-slate-900"
                            : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <span className="text-[15px] leading-none">{starter.emoji}</span>
                        <span>{starter.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {hasStarterSuggestions ? (
                <div className="surface-elevated mt-3 rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] shrink-0 max-w-[760px] w-full mx-auto">
                  <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                    Suggested prompts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {starterSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => applySuggestion(suggestion)}
                        className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-200/80"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div ref={desktopAttachmentMenuRef} className="mt-3 shrink-0 relative max-w-[760px] w-full mx-auto border-t border-slate-200/70 pt-4 pb-1">
                <div className="surface-elevated rounded-[28px] border border-slate-200/85 bg-white/95 backdrop-blur-md px-3 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition focus-within:border-sky-300/70 focus-within:ring-2 focus-within:ring-sky-100/80">
                  {attachments.length > 0 ? (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {attachments.map((a) => (
                        <div
                          key={a.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-2.5 py-1.5"
                        >
                          <span className="text-[12px] font-medium text-slate-700 truncate max-w-[220px]">{a.name}</span>
                          <span className="text-[10px] text-slate-500">{formatFileSize(a.size)}</span>
                          <button
                            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => removeAttachment(a.id)}
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2">
                    <button
                      onClick={toggleAttachmentPanel}
                      className="h-10 w-10 shrink-0 rounded-2xl border border-slate-200/90 bg-white/80 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition active:scale-[0.98]"
                      title="Add attachment"
                    >
                      <Plus size={17} />
                    </button>

                    <textarea
                      ref={desktopPromptInputRef}
                      data-maxheight="192"
                      rows={1}
                      value={input}
                      onChange={(e) => handleComposerInputChange(e.target.value, e.target)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      className="min-h-[44px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="Type your message..."
                    />

                    <button
                      onClick={() => setIsAiModeOn((v) => !v)}
                      className={[
                        "h-9 px-3.5 rounded-xl border text-xs font-semibold transition",
                        isAiModeOn
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                      title="AI conversation mode"
                    >
                      <span className="inline-flex items-center gap-1"><Sparkles size={14} /> AI</span>
                    </button>

                    <button
                      onClick={toggleMic}
                      className={[
                        "h-9 w-9 rounded-xl border inline-flex items-center justify-center transition",
                        isListening
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                      title={isListening ? "Stop voice input" : "Start voice input"}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    <button
                      onClick={() => canSend && sendMessage(input)}
                      disabled={!canSend}
                      className={[
                        "h-10 w-10 rounded-xl text-white shadow-sm transition",
                        canSend ? "bg-sky-500 hover:bg-sky-600 active:scale-[0.98]" : "bg-slate-300 cursor-not-allowed",
                      ].join(" ")}
                      title="Send"
                    >
                      <Send size={16} className="mx-auto" />
                    </button>
                  </div>
                </div>

                <div
                  className={[
                    "surface-elevated absolute left-2 bottom-[calc(100%+10px)] z-20 w-72 rounded-2xl border border-white/45 bg-white/72 backdrop-blur-xl shadow-[0_20px_42px_rgba(15,23,42,0.18)] p-2 origin-bottom-left transition duration-150",
                    isAttachOpen ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-1.5 scale-95 pointer-events-none",
                  ].join(" ")}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => openAttachmentPicker({ accept: "image/*", source: "photo" })}
                      className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                    >
                      <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <Image size={16} />
                      </span>
                      <span>Photo</span>
                    </button>
                    <button
                      onClick={() => openAttachmentPicker({ source: "file" })}
                      className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                    >
                      <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <Paperclip size={16} />
                      </span>
                      <span>Files</span>
                    </button>
                    <button
                      onClick={() => openAttachmentPicker({ accept: "image/*", capture: "environment", source: "camera" })}
                      className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                    >
                      <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <Camera size={16} />
                      </span>
                      <span>Camera</span>
                    </button>
                    <button
                      onClick={() => openAttachmentPicker({ accept: "image/*", capture: "environment", source: "scan" })}
                      className="group rounded-xl border border-slate-200/70 bg-white/75 px-1.5 py-2 text-center text-[10px] font-medium text-slate-600 hover:border-slate-300 hover:bg-white"
                    >
                      <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <ScanLine size={16} />
                      </span>
                      <span>Scan</span>
                    </button>
                  </div>

                  <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/65 p-1.5">
                    <div className="relative overflow-hidden">
                      <div className={`transition-transform duration-200 ${isToolsPanelOpen ? "-translate-x-full" : "translate-x-0"}`}>
                        <button
                          onClick={() => setIsToolsPanelOpen(true)}
                          className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-700 hover:bg-white/80"
                        >
                          <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Tools</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                      <div
                        className={[
                          "absolute inset-0 transition-transform duration-200",
                          isToolsPanelOpen ? "translate-x-0" : "translate-x-full",
                        ].join(" ")}
                      >
                        <div className="rounded-lg bg-white/90 p-1">
                          <button
                            onClick={() => setIsToolsPanelOpen(false)}
                            className="mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                          >
                            <ChevronDown size={12} />
                            Back
                          </button>
                          <div className="grid grid-cols-2 gap-1">
                            {COMPOSER_TOOL_PRESETS.map((tool) => (
                              <button
                                key={tool.key}
                                onClick={() => applyToolPreset(tool.prompt)}
                                className="rounded-md border border-slate-200/80 bg-white px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50"
                              >
                                {tool.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500 hidden">
              Backend will be Python. Later we will send messages and attachments to your API (for example /api/chat).
            </div>
            </div>
          ) : null}

          {active !== "newchat" ? (
            <div className="hidden md:flex flex-1 min-h-0 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-[0_10px_24px_rgba(15,23,42,0.05)] p-6">
              <div className="w-full max-w-2xl">
                <PlaceholderPanel
                  title={activePlaceholder?.title || "Coming soon"}
                  bullets={activePlaceholder?.bullets || ["Feature wiring", "Permissions setup", "Backend connection"]}
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>
      </div>
      {feedbackToast.open ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-[90] bottom-[calc(82px+env(safe-area-inset-bottom))] md:bottom-5">
          <div className="rounded-xl border border-slate-200 bg-slate-900 text-white/95 px-4 py-2 text-sm shadow-lg">
            {feedbackToast.text || "Thank you for your feedback!"}
          </div>
        </div>
      ) : null}
      <div
        className={[
          "pointer-events-none fixed right-3 md:right-3 top-[40%] z-[70] transition-all duration-300",
          isChatScrolling ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1.5",
        ].join(" ")}
      >
        <div className="mb-2 -ml-16 w-20 rounded-full border border-slate-200/70 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 text-center shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-sm md:text-xs">
          {chatScrollLabel}
        </div>
        <div className="relative h-20 md:h-24 w-[3px] md:w-1 rounded-full bg-slate-400/25 overflow-hidden backdrop-blur-sm">
          <div
            className="absolute left-0 right-0 h-7 md:h-8 rounded-full bg-slate-500/55"
            style={{ top: `${chatScrollProgress * 100}%`, transform: "translateY(-50%)" }}
          />
        </div>
      </div>
    </div>
  );
}
