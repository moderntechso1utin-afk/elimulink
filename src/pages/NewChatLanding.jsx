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
  FileUp,
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
  Trash2,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { apiUrl } from "../lib/apiUrl";
import { getStoredPreferences, getStoredProfile } from "../lib/userSettings";
import SettingsPage from "./SettingsPage";
import NotebookPage from "./NotebookPage";
import SubgroupRoom from "./SubgroupRoom";
import CoursesDashboard from "./CoursesDashboard";
import AssignmentsPage from "./AssignmentsPage";
import ResultsPage from "./ResultsPage";

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

const ADMIN_ROLES = new Set(["institution_admin", "department_head", "super_admin"]);
const CHAT_HISTORY_KEY = "institution_chat_threads_v1";
const CHAT_ACTIVE_KEY = "institution_chat_active_v1";
const UNTITLED_CHAT_BASE = "New Chat";

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

function createDefaultChat(title = UNTITLED_CHAT_BASE, assistantText = "") {
  return {
    id: makeChatId(),
    title,
    updatedAt: Date.now(),
    messages: assistantText ? [{ role: "assistant", text: assistantText }] : [],
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

function isErrorText(text) {
  const value = String(text || "").toLowerCase();
  return value.includes("failed to reach ai service") || value.includes("error (");
}

function Bubble({ role, text, onAssistantSpeak, onRetry, onLearnMore, onCopy, onEdit, isCopied }) {
  const isUser = role === "user";
  const isError = !isUser && isErrorText(text);
  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm",
          isUser
            ? "bg-sky-500 text-white rounded-br-md"
            : "bg-white text-slate-900 border border-slate-200 rounded-bl-md",
        ].join(" ")}
      >
        <div>{text}</div>

        {!isUser ? (
          <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onAssistantSpeak?.(text)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              title="Play audio"
            >
              <Volume2 size={13} />
              Speak
            </button>
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
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
        collapsed ? "justify-center px-2" : "",
        active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
      title={collapsed ? label : undefined}
    >
      <span className="text-base">{Icon ? <Icon size={16} /> : null}</span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function SectionLabel({ collapsed, children }) {
  if (collapsed) return null;
  return <div className="px-3 pt-2 text-[11px] font-semibold tracking-wider text-slate-500">{children}</div>;
}

export default function NewChatLanding({ onOpenAdmin, userRole }) {
  const firebaseUser = auth?.currentUser || null;
  const profileName = resolveProfileName(firebaseUser);
  const welcomeText = buildWelcomeMessage(profileName);

  const [active, setActive] = useState("newchat");
  const [input, setInput] = useState("");
  const [chats, setChats] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
      return Array.isArray(saved) && saved.length > 0
        ? normalizeChatTitles(saved)
        : [createDefaultChat(UNTITLED_CHAT_BASE, "")];
    } catch {
      return [createDefaultChat(UNTITLED_CHAT_BASE, "")];
    }
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      return localStorage.getItem(CHAT_ACTIVE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [isNewChatMenuOpen, setIsNewChatMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsMenuOpen, setIsNotificationsMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notifications, setNotifications] = useState(() => [
    {
      id: "n1",
      title: "New activity",
      detail: "Your recent chats are now saved in history.",
      read: false,
    },
    {
      id: "n2",
      title: "Assignments update",
      detail: "Assignment tools were updated with AI helper shortcuts.",
      read: false,
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
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isAiModeOn, setIsAiModeOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const recognitionRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const newChatMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const globalSearchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const promptInputRef = useRef(null);
  const lastSpokenRef = useRef({ text: "", at: 0 });

  const [attachments, setAttachments] = useState([]);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar_more_open", isMoreOpen ? "1" : "0");
    } catch {
      // no-op
    }
  }, [isMoreOpen]);

  useEffect(() => {
    if (!isAttachmentMenuOpen) return;
    const onDocumentMouseDown = (event) => {
      if (!attachmentMenuRef.current) return;
      if (!attachmentMenuRef.current.contains(event.target)) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [isAttachmentMenuOpen]);

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
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chats));
    } catch {
      // no-op
    }
  }, [chats]);

  useEffect(() => {
    if (activeChatId && chats.some((chat) => chat.id === activeChatId)) return;
    setActiveChatId(chats[0]?.id || "");
  }, [activeChatId, chats]);

  useEffect(() => {
    try {
      if (activeChatId) localStorage.setItem(CHAT_ACTIVE_KEY, activeChatId);
    } catch {
      // no-op
    }
  }, [activeChatId]);

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

  const normalizedRole = String(userRole || "").toLowerCase();
  const canShowAdmin = ADMIN_ROLES.has(normalizedRole);
  const moreItems = MORE_ITEMS_BASE;

  const moreKeys = moreItems.map((item) => item.key);

  const settingsProfile = useMemo(
    () =>
      getStoredProfile({
        name: profileName,
        email: firebaseUser?.email || "student@elimulink.co.ke",
        phone: "+2547xx xxx xxx",
        avatarUrl: "",
      }),
    [active, profileName, firebaseUser]
  );
  const settingsPrefs = useMemo(
    () =>
      getStoredPreferences({
        muteNotifications: false,
        keyboardShortcuts: false,
        language: "en",
      }),
    [active]
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

  const quickPrompts = [
    { label: "Summarize Biology lecture", icon: "✨" },
    { label: "Explain Photosynthesis", icon: "🌿" },
    { label: "Prep for History 202 exam", icon: "📘" },
    { label: "Write assignment draft", icon: "📝" },
    { label: "Help me learn", icon: "🎓" },
  ];

  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const hasConversation = messages.length > 0;
  const canSend = input.trim().length > 0 || attachments.length > 0;
  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const profileInitials = initialsOf(user.name);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeChatId]);

  function updateActiveChatMessages(updater, titleHint) {
    const currentId = activeChat?.id;
    if (!currentId) return;
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentId) return chat;
        const nextMessages = updater(chat.messages || []);
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
    setActive("settings");
  }

  function openAdminPanel() {
    setIsProfileMenuOpen(false);
    setIsNotificationsMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setIsMobileMoreOpen(false);
    setIsMorePopupOpen(false);
    onOpenAdmin?.();
  }

  function toggleNotificationsMenu() {
    setIsNotificationsMenuOpen((prev) => !prev);
    setIsProfileMenuOpen(false);
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

    setActive("newchat");
    if (matchingChat?.id) {
      setActiveChatId(matchingChat.id);
      setGlobalSearch("");
      return;
    }

    setInput(query);
    setGlobalSearch("");
    setTimeout(() => promptInputRef.current?.focus(), 0);
  }

  async function handleLogout() {
    setIsProfileMenuOpen(false);
    try {
      await signOut(auth);
    } catch {
      // no-op, keep frontend flow
    }
    window.location.href = "/login?returnTo=%2Finstitution";
  }

  function startNewChat() {
    const next = createDefaultChat(nextUntitledChatTitle(chats), "");
    setChats((prev) => [next, ...prev]);
    setActiveChatId(next.id);
    setActive("newchat");
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
        const fallback = createDefaultChat(UNTITLED_CHAT_BASE, "");
        setActiveChatId(fallback.id);
        return [fallback];
      }
      if (activeChatId === chatId) setActiveChatId(filtered[0].id);
      return filtered;
    });
  }

  function addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const next = [];
    for (const f of Array.from(fileList)) {
      const url = URL.createObjectURL(f);
      next.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(16).slice(2)}`,
        name: f.name,
        type: f.type || "application/octet-stream",
        url,
        file: f,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      updateActiveChatMessages(
        (m) => [...m, { role: "assistant", text: "Microphone is not supported in this browser." }],
        "Microphone support"
      );
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = resolveSpeechLanguage(settingsPrefs?.language);
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
      recognitionRef.current.lang = resolveSpeechLanguage(settingsPrefs?.language);
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }

  async function sendMessage(text) {
    const pendingAttachments = attachments;
    const clean = text.trim();
    if (!clean && pendingAttachments.length === 0) return;

    const attachSummary =
      pendingAttachments.length > 0
        ? `\n\nAttachments:\n${pendingAttachments.map((a) => `- ${a.name}`).join("\n")}`
        : "";

    updateActiveChatMessages(
      (m) => [...m, { role: "user", text: (clean || "Sent attachments") + attachSummary }],
      clean || "New Chat"
    );
    if (clean) setLastPrompt(clean);
    setInput("");
    setAttachments([]);

    try {
      const token = await auth?.currentUser?.getIdToken(true).catch(() => null);
      if (!token) {
        updateActiveChatMessages(
          (m) => [...m, { role: "assistant", text: "Please sign in to use AI chat." }],
          clean || "Sign in"
        );
        return;
      }

      let response;
      if (pendingAttachments.length > 0) {
        const formData = new FormData();
        formData.append("message", clean || "Sent attachments");
        formData.append("preferredLanguage", String(settingsPrefs?.language || "en"));
        pendingAttachments.forEach((a) => {
          if (a?.file instanceof File) formData.append("files", a.file, a.name);
        });
        response = await fetch(apiUrl("/api/chat/upload"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: clean,
            preferredLanguage: String(settingsPrefs?.language || "en"),
          }),
        });
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = result?.code || result?.error || `HTTP_${response.status}`;
        const message = result?.message || code;
        updateActiveChatMessages(
          (m) => [...m, { role: "assistant", text: `Error (${response.status}): ${message}` }],
          clean || "Error"
        );
        return;
      }

      const reply = result?.text || result?.reply || result?.data?.reply || "Response received.";
      updateActiveChatMessages((m) => [...m, { role: "assistant", text: reply }], clean || "Reply");
    } catch {
      updateActiveChatMessages(
        (m) => [...m, { role: "assistant", text: "Failed to reach AI service." }],
        clean || "Request failed"
      );
    }
  }

  function speakAssistantText(text) {
    if (!text || !("speechSynthesis" in window)) return;
    const now = Date.now();
    const normalized = String(text).trim();
    if (!normalized) return;
    if (lastSpokenRef.current.text === normalized && now - lastSpokenRef.current.at < 2500) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(normalized);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = resolveSpeechLanguage(settingsPrefs?.language);
    window.speechSynthesis.speak(utterance);
    lastSpokenRef.current = { text: normalized, at: now };
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
    setTimeout(() => promptInputRef.current?.focus(), 0);
  }

  function handleNavClick(itemKey) {
    setIsMorePopupOpen(false);
    setIsMobileMoreOpen(false);
    setIsNewChatMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsNotificationsMenuOpen(false);

    if (itemKey === "admin") {
      onOpenAdmin?.();
      return;
    }
    setActive(itemKey);
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
    if (!isMobile) return;
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
        onBack={() => setActive("newchat")}
        canShowAdmin={canShowAdmin}
        onOpenAdmin={openAdminPanel}
      />
    );
  }

  if (active === "notebook") {
    return <NotebookPage onBack={() => setActive("newchat")} />;
  }

  if (active === "subgroups") {
    return <SubgroupRoom onBack={() => setActive("newchat")} />;
  }

  if (active === "courses") {
    return <CoursesDashboard onBack={() => setActive("newchat")} />;
  }

  if (active === "assignments") {
    return <AssignmentsPage />;
  }

  if (active === "results") {
    return <ResultsPage />;
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-slate-100 flex flex-col overflow-hidden">
      <div className="w-full px-3 md:px-4 pt-2 pb-1 shrink-0">
        <div className="h-12 rounded-xl border border-slate-200 bg-white/95 shadow-sm px-2.5 md:px-3 flex items-center gap-2">
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

          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div className="relative">
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
                className="w-[58vw] min-w-[180px] max-w-[520px] h-9 rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
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
                                setActive("newchat");
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

      <div className="w-full px-4 md:px-6 pt-3 pb-6 grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
        <aside
          className={[
            "hidden md:block col-span-12 min-h-0",
            isSidebarOpen ? "md:col-span-3 lg:col-span-3" : "md:col-span-1 lg:col-span-1",
          ].join(" ")}
        >
          <div
            className={[
              "rounded-2xl bg-white border border-slate-200 shadow-sm overflow-visible transition-[width] duration-200 h-full flex flex-col",
              isSidebarOpen ? "w-full" : "w-[72px]",
            ].join(" ")}
          >
            <div className="relative px-3 py-3 bg-slate-50 border-b border-slate-200 flex items-center">
              {isSidebarOpen ? (
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_20px_rgba(99,102,241,0.35)]" />
                  <div className="text-base font-semibold text-slate-800">Home</div>
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
                  "absolute -right-3 top-1/2 -translate-y-1/2",
                  "h-9 w-9 rounded-full",
                  "border border-slate-200 bg-white shadow-sm",
                  "hover:bg-slate-100 text-slate-700",
                  "flex items-center justify-center",
                ].join(" ")}
                title={isSidebarOpen ? "Collapse" : "Expand"}
              >
                {isSidebarOpen ? "‹" : "›"}
              </button>
            </div>

            <nav className="p-2 space-y-3 relative flex-1 overflow-y-auto overflow-x-visible smart-scrollbar">
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
                                setActive("newchat");
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
            "col-span-12 min-w-0 flex flex-col overflow-hidden min-h-0",
            isSidebarOpen ? "md:col-span-9 lg:col-span-9" : "md:col-span-11 lg:col-span-11",
          ].join(" ")}
        >
          <div className="rounded-xl bg-slate-50 border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 bg-white/80 shrink-0">
              <div className="text-sm font-semibold text-slate-800">{activeChat?.title || UNTITLED_CHAT_BASE}</div>
              <div className="text-xs text-slate-500">
                AI Academic Assistant • {formatChatStamp(activeChat?.updatedAt)}
              </div>
            </div>

            <div className={[hasConversation ? "px-4 pt-2 pb-4" : "p-4", "flex-1 min-h-0 flex flex-col bg-slate-100/60"].join(" ")}>
              {messages.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 shrink-0 mb-3">
                  <StatCard title="Next Class" value={user.nextClass} subtitle="From your timetable" />
                  <StatCard title="Balance" value={user.balance} subtitle="Fees portal" />
                  <StatCard title="Attendance" value={user.attendance} subtitle="This month" />
                  <StatCard title="GPA Progress" value={user.gpa} subtitle="Current GPA" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-y-auto smart-scrollbar rounded-2xl bg-slate-100/80 border border-slate-300/70 px-5 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
                    <div className="text-sm text-slate-500">{timeGreeting()}</div>
                    <div className="text-2xl font-semibold text-slate-900 mt-1">
                      Hi {firstNameOf(user.name)}, where should we start?
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      Ask anything about coursework, assignments, revision, or research.
                    </div>
                  </div>
                ) : null}

                {messages.map((m, idx) => (
                  <Bubble
                    key={idx}
                    role={m.role}
                    text={m.text}
                    onAssistantSpeak={speakAssistantText}
                    onRetry={() => {
                      if (lastPrompt) sendMessage(lastPrompt);
                    }}
                    onLearnMore={() => sendMessage("Learn more about the error and how I can fix it.")}
                    onCopy={() => copyPromptText(idx, m.text)}
                    onEdit={m.role === "user" ? () => editPromptText(m.text) : undefined}
                    isCopied={copiedMessageIndex === idx}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 shrink-0">
                  {quickPrompts.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => sendMessage(p.label)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 hover:bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shrink-0">
                  <div className="text-xs font-semibold text-slate-500">Attachments</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="text-xs text-slate-700">{a.name}</span>
                        <button
                          className="text-xs text-slate-500 hover:text-slate-900"
                          onClick={() => removeAttachment(a.id)}
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div ref={attachmentMenuRef} className="mt-3 flex items-end gap-2 shrink-0 relative">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />

                <button
                  onClick={() => setIsAttachmentMenuOpen((v) => !v)}
                  className="h-11 w-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center shadow-sm transition"
                  title="Add attachment"
                >
                  <Plus size={17} />
                </button>

                {isAttachmentMenuOpen ? (
                  <div className="absolute left-0 bottom-12 z-20 rounded-xl border border-slate-200 bg-white shadow-lg p-2 w-44">
                    <button
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        galleryInputRef.current?.click();
                      }}
                      className="group w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span>Photo</span>
                      <Image size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        cameraInputRef.current?.click();
                      }}
                      className="group w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span>Camera</span>
                      <Camera size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        scanInputRef.current?.click();
                      }}
                      className="group w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span>Scan</span>
                      <ScanLine size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="group w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span>File</span>
                      <FileUp size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                    </button>
                  </div>
                ) : null}

                <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
                  <input
                    ref={promptInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendMessage(input);
                    }}
                    className="w-full outline-none text-[15px] text-slate-800 bg-transparent placeholder:text-slate-400"
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

              <div className="mt-3 text-xs text-slate-500">
                Backend will be Python. Later we will send messages and attachments to your API (for example /api/chat).
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
