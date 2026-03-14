import React, { useState, useEffect, useRef } from 'react';
import InstitutionAdminDashboard from "./pages/institution/InstitutionAdminDashboard";
import InstitutionNotebook from "./pages/institution/InstitutionNotebook";
import InstitutionAssignments from "./pages/institution/InstitutionAssignments";
import InstitutionHome from "./pages/institution/InstitutionHome";
import { app, db, auth, firebaseMissingEnvVars, firebaseInitErrorMessage } from './lib/firebase';
import imageAPI from './services/imageAPI.js';
import { isSpeechRecognitionSupported, startRecognition, stopRecognition, speak, cancelSpeak } from './lib/voice';
import { 
  Plus, 
  FolderHeart, 
  Gem, 
  Settings, 
  HelpCircle, 
  MessageSquare,
  FileText,
  Activity,
  Presentation,
  Video,
  Calendar,
  Bell,
  Home,
  LogOut,
  Menu, 
  Send, 
  Volume2, 
  VolumeX,
  Mic,
  MicOff,
  Image as ImageIcon, 
  Paperclip, 
  Edit2, 
  Check, 
  X,
  Clock,
  User,
  Sun,
  Moon,
  Search,
  Lock,
  Building2,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getDepartments } from './lib/institution';
import { onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const appId = import.meta.env.VITE_APP_ID || 'elimulink-pro-v2';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''; 
const INSTITUTION_EMAIL_DOMAIN = String(import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'elimulink.co.ke').toLowerCase();
const INSTITUTION_FALLBACK_ID = String(import.meta.env.VITE_INSTITUTION_ID || 'YOUR_INSTITUTION_ID');
// API base for backend (set this in Vercel to your Render service URL)
// Never default to localhost in production
const API_BASE = 
  import.meta.env.VITE_API_BASE || 
  (import.meta.env.MODE === 'development' ? 'http://localhost:4000' : '');

function apiUrl(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return API_BASE ? API_BASE.replace(/\/$/, '') + path : path;
}

function isInstitutionLinkedRole(role) {
  const value = String(role || '');
  return value.startsWith('institution_') || value === 'staff';
}

// Helper to log API errors with context
async function fetchWithErrorLog(url, options = {}) {
  try {
    console.log(`[API] Fetching: ${url}`);
    const res = await fetch(url, options);
    
    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      let errorBody = '';
      if (contentType?.includes('application/json')) {
        try { errorBody = await res.json(); } catch (e) { errorBody = await res.text(); }
      } else {
        errorBody = await res.text();
      }
      console.error(`[API] Error ${res.status}:`, url, errorBody);
      throw new Error(`${res.status}: ${typeof errorBody === 'string' ? errorBody : errorBody?.error || 'Unknown error'}`);
    }
    
    return res;
  } catch (err) {
    console.error(`[API] Failed to fetch ${url}:`, err.message);
    throw err;
  }
}

// PCM to WAV converter for TTS
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) view.setInt16(offset, samples[i], true);
  return buffer;
}

// Greeting helper used on Home
// (moved into component to use user settings)

// Suggest chips for AI replies
function suggestChips(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("kampala")) return ["President", "Currency", "Best hotels", "Safety tips", "Distance from Nairobi"];
  if (t.includes("hostel")) return ["Rules", "Fees", "Check-in times", "Contacts", "Report an issue"];
  if (t.includes("library")) return ["Search books", "Borrowing rules", "Opening hours", "Recommend books"];
  return ["Explain deeper", "Give examples", "Summarize", "Quiz me", "Show sources"];
}

export default function App({ hostMode = 'public', modeUrls = null }) {
  // [DEBUG] Log environment variables on mount
  useEffect(() => {
    const mode = import.meta.env.MODE;
    const apiBase = import.meta.env.VITE_API_BASE || '';
    const fbKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
    const fbProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
    
    console.log('[ENV] MODE:', mode);
    console.log('[ENV] VITE_API_BASE:', apiBase || '(empty - using direct Firestore)');
    console.log('[ENV] VITE_FIREBASE_API_KEY:', fbKey ? fbKey.substring(0, 6) + '...' : '(empty)');
    console.log('[ENV] VITE_FIREBASE_PROJECT_ID:', fbProjectId ? fbProjectId.substring(0, 6) + '...' : '(empty)');
    
    // If API_BASE is set, log the endpoints we'll be calling
    if (apiBase) {
      console.log('[API] Will call:', {
        chat: `${apiBase}/api/ai/student`,
        admin: `${apiBase}/api/admin/auth`,
        libraries: `${apiBase}/api/libraries/sync`,
        image: `${apiBase}/api/image`
      });
    }
    
    // Check for critical missing env vars
    const missing = [...firebaseMissingEnvVars];
    
    if (missing.length > 0) {
      console.error('[ERROR] Missing critical env vars:', missing);
      setEnvError(missing);
    }

    if (firebaseInitErrorMessage) {
      setEnvError((prev) => prev && prev.length ? prev : ['Firebase initialization failed (check VITE_FIREBASE_API_KEY)']);
    }
  }, []);

  useEffect(() => {
    const handleAuthError = (event) => {
      const message =
        String(event?.reason?.message || event?.error?.message || event?.message || event || '');
      if (message.toLowerCase().includes('auth/invalid-api-key')) {
        setEnvError((prev) => (prev && prev.length ? prev : ['VITE_FIREBASE_API_KEY (invalid)']));
      }
    };

    window.addEventListener('unhandledrejection', handleAuthError);
    window.addEventListener('error', handleAuthError);
    return () => {
      window.removeEventListener('unhandledrejection', handleAuthError);
      window.removeEventListener('error', handleAuthError);
    };
  }, []);

  // --- Institution Admin Dashboard Route ---
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const [envError, setEnvError] = useState(null);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  // Responsive sidebar state
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [region, setRegion] = useState('Global');
  const [showAdmin, setShowAdmin] = useState(false);
  const [libraries, setLibraries] = useState([]);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookLink, setNewBookLink] = useState('');
  const [adminToken, setAdminToken] = useState(localStorage.getItem('elimulink_admin_token') || '');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [externalApiUrl, setExternalApiUrl] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('elimulink_settings');
    return saved ? JSON.parse(saved) : { theme: 'dark', aiTone: 'Academic', useGoogleSearch: true, userName: 'Guest Scholar' };
  });
  const [savedImages, setSavedImages] = useState([]);
  const [showMyStuff, setShowMyStuff] = useState(false);
  const [showServicesHub, setShowServicesHub] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [userRole, setUserRole] = useState('public');
  const [userProfile, setUserProfile] = useState(null);
  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
  const [staffCodeInput, setStaffCodeInput] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [institutionDepartments, setInstitutionDepartments] = useState([]);
  const [institutionExpanded, setInstitutionExpanded] = useState(false);
  const [activeDepartmentId, setActiveDepartmentId] = useState(() => localStorage.getItem('activeDepartmentId') || 'general');
  const [activeDepartmentName, setActiveDepartmentName] = useState(() => localStorage.getItem('activeDepartmentName') || 'General');
  const [showDeptBanner, setShowDeptBanner] = useState(false);
  const [suggestedDept, setSuggestedDept] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voiceEnabled');
    return saved == null ? true : saved === 'true';
  });
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardRegNo, setOnboardRegNo] = useState('');
  const [onboardInstitutions, setOnboardInstitutions] = useState([]);
  const [onboardSelectedInst, setOnboardSelectedInst] = useState('');
  const [onboardError, setOnboardError] = useState('');
  const isInstitutionHost =
    hostMode === 'institution' ||
    (typeof window !== 'undefined' && window.location.hostname.toLowerCase().startsWith('institution.'));
  const speechSupported = isSpeechRecognitionSupported();

  // Time-aware greeting helper (keeps inside component scope)
  const getGreeting = () => {
    const hour = new Date().getHours();
    // 5–11: morning, 12–16: afternoon, 17–4: evening
    if (hour >= 5 && hour <= 11) return "Good morning";
    if (hour >= 12 && hour <= 16) return "Good afternoon";
    if (hour >= 17 || hour <= 4) return "Good evening";
    return "Hello";
  };

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const isStaffRole = ["staff", "departmentAdmin", "superAdmin"].includes(userRole);
  const isInstitutionLinkedUser = Boolean(userProfile?.institutionId) && isInstitutionLinkedRole(userRole);
  const departments = institutionDepartments;
  const activeDepartment =
    departments.find((d) => d.id === activeDepartmentId) ||
    { id: activeDepartmentId || 'general', name: activeDepartmentName || 'General', prompt: 'General student support.' };
  const defaultInstitutionDepartments = [
    { id: 'general', name: 'General', prompt: 'General student support and institution guidance.' },
    { id: 'guidance', name: 'Guidance', prompt: 'Student counseling support and wellbeing.' },
    { id: 'sports', name: 'Sports', prompt: 'Sports programs, fixtures, and participation.' },
    { id: 'research', name: 'Research', prompt: 'Research projects and innovation support.' },
    { id: 'dean', name: 'Dean', prompt: 'Student administration and discipline support.' },
  ];

  const handleDepartmentSelect = (dep) => {
    setActiveDepartmentId(dep.id);
    setActiveDepartmentName(dep.name || dep.id);
    localStorage.setItem('activeDepartmentId', dep.id);
    localStorage.setItem('activeDepartmentName', dep.name || dep.id);
    if (isMobile) setSidebarOpen(false);
  };

  async function verifyStaffCode(code) {
    try {
      if (!user) return alert('Not signed in');
      if (!userProfile?.institutionId) return alert('No institutionId on your profile yet');
      const settingsRef = doc(db, 'institutions', userProfile.institutionId, 'settings', 'security');
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return alert('No staff code set yet in institutions/{institutionId}/settings/security');
      const staffCode = snap.data().staffCode;
      if (!staffCode) return alert('security.staffCode missing');
      if (code === staffCode) {
        const uDoc = doc(db, 'artifacts', appId, 'users', user.uid);
        await setDoc(uDoc, { role: 'staff', staffCodeVerified: true }, { merge: true });
        setUserRole('staff');
        setShowInstitutionModal(false);
        setStaffCodeInput('');
        alert('Staff code verified!');
      } else {
        alert('Invalid staff code');
      }
    } catch (e) {
      console.error(e);
      alert('Verification error: ' + (e.message || 'unknown'));
    }
  }

  const handleSelectInstitution = () => {
    if (!onboardSelectedInst) return;
    setOnboardError('');
    setShowInstitutionModal(false);
  };

  const handleInstitutionOnboard = async () => {
    if (!onboardEmail.trim() || !onboardRegNo.trim()) {
      setOnboardError('Email and registration number are required.');
      return;
    }
    setOnboardError('');
    setShowInstitutionModal(false);
  };

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      if (!auth) {
        setEnvError((prev) => prev && prev.length ? prev : ['Firebase Auth is not initialized']);
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (e) {
        const msg = String(e?.message || '');
        console.error('Firebase auth init failed:', msg);
        if (msg.toLowerCase().includes('auth/invalid-api-key')) {
          setEnvError((prev) => (prev && prev.length ? prev : ['VITE_FIREBASE_API_KEY (invalid)']));
        }
      }
    };
    initAuth();
    if (!auth) return;
    try {
      return onAuthStateChanged(
        auth,
        (nextUser) => setUser(nextUser),
        (err) => {
          const msg = String(err?.message || err || '');
          console.error('onAuthStateChanged error:', msg);
          if (msg.toLowerCase().includes('auth/invalid-api-key')) {
            setEnvError((prev) => (prev && prev.length ? prev : ['VITE_FIREBASE_API_KEY (invalid)']));
          }
        }
      );
    } catch (e) {
      const msg = String(e?.message || '');
      console.error('onAuthStateChanged failed:', msg);
      if (msg.toLowerCase().includes('auth/invalid-api-key')) {
        setEnvError((prev) => (prev && prev.length ? prev : ['VITE_FIREBASE_API_KEY (invalid)']));
      }
      return;
    }
  }, []);

  // Sync History
  useEffect(() => {
    if (!user) {
      setUserRole('public');
      setUserProfile(null);
      return;
    }
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');
    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatHistory(history.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
  }, [user]);

  // Load persisted user region preference and extended role profile
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const uDoc = doc(db, 'artifacts', appId, 'users', user.uid);
        const snap = await getDoc(uDoc);

        if (snap.exists()) {
          let data = snap.data();
          console.log('[APP_AUTH] profile_loaded', { uid: user.uid, email: user.email || null, loadedProfile: data });

          const email = String(user?.email || '').trim().toLowerCase();
          const matchesInstitutionDomain = email.endsWith(`@${INSTITUTION_EMAIL_DOMAIN}`);
          const shouldBackfill = matchesInstitutionDomain && (!data?.institutionId || !data?.role || data?.role === 'public' || data?.role === 'student_general');

          if (shouldBackfill) {
            const patch = {
              institutionId: INSTITUTION_FALLBACK_ID,
              role: 'institution_student',
              subscriptionActive: true,
            };
            await setDoc(uDoc, patch, { merge: true });
            data = { ...(data || {}), ...patch };
            console.log('[APP_AUTH] institution_backfill_applied', { uid: user.uid, email, patch });
          }

          if (data.region) setRegion(data.region);

          // ✅ Primary role source
          const inferredRole = data.role || 'student_general';
          setUserRole(inferredRole);

          // ✅ Keep extra profile info (for student/institution later)
          setUserProfile({
            role: inferredRole,

            // ✅ Student scope model
            studentScope: data.studentScope ?? 'general', // general | institution
            educationLevel: data.educationLevel ?? null,  // primary | highschool | self | etc

            // Institution-specific (only meaningful if studentScope === 'institution')
            studentType: data.studentType ?? null,
            stage: data.stage ?? null,
            verificationStatus: data.verificationStatus ?? null,
            institutionId: data.institutionId ?? null,
            departmentId: data.departmentId ?? null,
            admissionNumber: data.admissionNumber ?? null,
            subscriptionActive: data.subscriptionActive === true,
          });
        } else {
          // ✅ If no user doc exists (common on anon auth), create a default PUBLIC profile
          const fallbackRole = 'student_general';
          setUserRole(fallbackRole);

          setUserProfile({
            role: fallbackRole,
            studentScope: 'general',
            educationLevel: null,
            institutionId: null,
            departmentId: null,
            subscriptionActive: false,
          });
        }
      } catch (e) {
        console.error('Error reading user prefs', e);
        setUserRole('student_general');
      }
    })();
  }, [user, appId, hostMode]);

  const runPostLoginSync = async (firebaseUser) => {
    if (!firebaseUser) return null;
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(apiUrl('/api/auth/post-login-sync'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Post-login sync failed');
    const role = data?.role || 'student_general';
    setUserRole(role);
    setUserProfile((prev) => ({
      ...(prev || {}),
      role,
      institutionId: data?.institutionId || null,
      departmentId: data?.departmentId || prev?.departmentId || null,
      subscriptionActive: data?.subscriptionActive === true,
    }));
    return data;
  };

  useEffect(() => {
    localStorage.setItem('voiceEnabled', voiceEnabled ? 'true' : 'false');
  }, [voiceEnabled]);

  useEffect(() => {
    if (!isInstitutionHost) {
      stopRecognition();
      cancelSpeak();
      setIsListening(false);
    }
    return () => {
      stopRecognition();
      cancelSpeak();
    };
  }, [isInstitutionHost]);

  const handleMicToggle = () => {
    if (!isInstitutionHost || !speechSupported) return;
    if (isListening) {
      stopRecognition();
      setIsListening(false);
      return;
    }
    const started = startRecognition({
      onResult: (finalTranscript) => {
        setInput((prev) => (prev && prev.trim() ? `${prev} ${finalTranscript}` : finalTranscript));
      },
      onError: (event) => {
        console.error('Speech recognition error:', event?.error || event);
      },
      onEnd: () => setIsListening(false),
    });
    if (started) setIsListening(true);
  };

  const speakIfInstitutionVoiceEnabled = (text) => {
    if (!isInstitutionHost || !voiceEnabled) return;
    speak(text);
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setUser(null);
      setUserRole('public');
      setUserProfile(null);
      setMessages([]);
      setActiveChatId(null);
      setIsSettingsOpen(false);
      localStorage.removeItem('activeDepartmentId');
      localStorage.removeItem('activeDepartmentName');
      window.location.replace('/login');
    }
  };

  // Restore department on startup if authorized
  useEffect(() => {
    if (isStaffRole) {
      const depId = localStorage.getItem('activeDepartmentId');
      const depName = localStorage.getItem('activeDepartmentName');
      if (depId) setActiveDepartmentId(depId);
      if (depName) setActiveDepartmentName(depName);
    }
  }, [isStaffRole]);

  // Load departments for institution mode users.
  useEffect(() => {
    async function loadDeps() {
      try {
        if (isInstitutionHost && userProfile?.institutionId) {
          const deps = await getDepartments(userProfile.institutionId);
          const normalized = Array.isArray(deps) ? deps : [];
          const hasGeneral = normalized.some((d) => d.id === 'general');
          const merged = hasGeneral
            ? normalized
            : [{ id: 'general', name: 'General', prompt: 'General student support and institution guidance.' }, ...normalized];
          setInstitutionDepartments(merged.length ? merged : defaultInstitutionDepartments);
        }
      } catch (e) {
        console.error("Failed to load departments:", e);
        if (isInstitutionHost) setInstitutionDepartments(defaultInstitutionDepartments);
      }
    }
    loadDeps();
  }, [isInstitutionHost, userProfile]);

  useEffect(() => {
    if (!isInstitutionHost) return;
    if (!institutionDepartments.length) setInstitutionDepartments(defaultInstitutionDepartments);
    if (!localStorage.getItem('activeDepartmentId')) localStorage.setItem('activeDepartmentId', 'general');
    if (!localStorage.getItem('activeDepartmentName')) localStorage.setItem('activeDepartmentName', 'General');
    if (!activeDepartmentId || !institutionDepartments.some((d) => d.id === activeDepartmentId)) {
      setActiveDepartmentId('general');
      setActiveDepartmentName('General');
      localStorage.setItem('activeDepartmentId', 'general');
      localStorage.setItem('activeDepartmentName', 'General');
    }
  }, [isInstitutionHost, activeDepartmentId, institutionDepartments.length]);

  // Persist region preference when changed
  useEffect(() => {
    if (!user) return;
    const uDoc = doc(db, 'artifacts', appId, 'users', user.uid);
    setDoc(uDoc, { region }, { merge: true }).catch(err => console.error('Error saving region', err));
  }, [region, user]);

  // Admin: load libraries
  const loadLibraries = async () => {
    try {
      const libsCol = collection(db, 'artifacts', appId, 'libraries');
      const snaps = await getDocs(libsCol);
      setLibraries(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error('Error loading libraries', e); }
  };

  useEffect(() => { if (showAdmin) loadLibraries(); }, [showAdmin]);

  // persist admin token
  useEffect(() => { if (adminToken) localStorage.setItem('elimulink_admin_token', adminToken); else localStorage.removeItem('elimulink_admin_token'); }, [adminToken]);

  // Persist settings
  useEffect(() => { localStorage.setItem('elimulink_settings', JSON.stringify(settings)); }, [settings]);

  // Auto-save chat to Firestore and load saved images on mount
  useEffect(() => {
    if (!user || !activeChatId) return;
    // Auto-save current chat messages
    const chatRef = doc(db, 'artifacts', appId, 'users', user.uid, 'chats', activeChatId);
    setDoc(chatRef, { messages, title: messages[0]?.text?.substring(0, 50) || 'Chat', timestamp: serverTimestamp() }, { merge: true }).catch(e => console.error('Auto-save error', e));
  }, [messages, user, activeChatId]);

  // Load saved images from Firestore
  useEffect(() => {
    if (!user) return;
    const col = collection(db, 'artifacts', appId, 'users', user.uid, 'savedImages');
    return onSnapshot(col, snap => {
      setSavedImages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // Handle online/offline status and install prompt
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const beforeInstallHandler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', beforeInstallHandler);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
    };
  }, []);

  // Persist recent messages to localStorage for offline access
  useEffect(() => {
    if (!activeChatId) return;
    try {
      const key = 'elimulink_last_messages_' + activeChatId;
      localStorage.setItem(key, JSON.stringify(messages.slice(-30)));
    } catch (e) { /* ignore */ }
  }, [messages, activeChatId]);

  // Load messages from localStorage when switching chats (useful when offline)
  useEffect(() => {
    if (!activeChatId) return;
    try {
      const key = 'elimulink_last_messages_' + activeChatId;
      const raw = localStorage.getItem(key);
      if (raw && (!messages || messages.length === 0)) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch (e) { /* ignore */ }
  }, [activeChatId]);

  const createLibrary = async () => {
    if (!newLibraryName.trim()) return;
    try {
      const libsCol = collection(db, 'artifacts', appId, 'libraries');
      await addDoc(libsCol, { name: newLibraryName, createdAt: serverTimestamp() });
      setNewLibraryName('');
      loadLibraries();
    } catch (e) { console.error(e); }
  };

  const adminLogin = async () => {
    if (!adminPasscode.trim()) return alert('Enter passcode');
    try {
      const res = await fetch(apiUrl('/api/admin/auth'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: adminPasscode }) });
      const j = await res.json();
      if (res.ok && j.token) { setAdminToken(j.token); setShowAdmin(true); setAdminPasscode(''); loadLibraries(); }
      else alert(j.error || 'Auth failed');
    } catch (e) { alert('Auth error'); }
  };

  const syncFromExternal = async () => {
    if (!externalApiUrl.trim()) return alert('Enter API URL');
    try {
      const res = await fetch(apiUrl('/api/libraries/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ url: externalApiUrl }) });
      const j = await res.json();
      if (res.ok) { alert('Imported: ' + j.imported); loadLibraries(); } else alert(j.error || 'Sync failed');
    } catch (e) { alert('Sync error'); }
  };

  const serverGenerateImage = async (prompt) => {
    try {
      const res = await fetch(apiUrl('/api/image'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ prompt }) });
      const j = await res.json();
      if (res.ok && j.image) return j.image;
      throw new Error(j.error || 'No image');
    } catch (e) { throw e; }
  };

  const studentGenerateImage = async (prompt) => {
    const idToken = user ? await user.getIdToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(apiUrl('/api/image/student'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.image) return j.image;
    throw new Error(j.error || 'Image generation failed');
  };

  const saveImageToMyStuff = async (imgDataUrl) => {
    if (!user) return;
    try {
      const imgRef = collection(db, 'artifacts', appId, 'users', user.uid, 'savedImages');
      await addDoc(imgRef, { image: imgDataUrl, savedAt: serverTimestamp(), region });
    } catch (e) { console.error('Save image error', e); }
  };

  const selectLibraryAndLoad = async (lib) => {
    setSelectedLibrary({ ...lib, books: [] });
    try {
      const booksCol = collection(db, 'artifacts', appId, 'libraries', lib.id, 'books');
      const snaps = await getDocs(booksCol);
      const books = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      setSelectedLibrary(prev => ({ ...prev, books }));
    } catch (e) { console.error(e); }
  };

  const addBookToLibrary = async () => {
    if (!selectedLibrary || !newBookTitle.trim()) return;
    try {
      const booksCol = collection(db, 'artifacts', appId, 'libraries', selectedLibrary.id, 'books');
      await addDoc(booksCol, { title: newBookTitle, author: newBookAuthor, link: newBookLink, createdAt: serverTimestamp() });
      setNewBookTitle(''); setNewBookAuthor(''); setNewBookLink('');
      selectLibraryAndLoad(selectedLibrary);
    } catch (e) { console.error(e); }
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  const handleTTS = async (text) => {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.substring(0, 300) }] }],
          generationConfig: { 
            responseModalities: ["AUDIO"], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } 
          }
        })
      });
      const data = await res.json();
      const base64Data = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) return;
      const binaryString = window.atob(base64Data);
      const bytes = new Int16Array(binaryString.length / 2);
      for (let i = 0; i < binaryString.length; i += 2) {
        bytes[i / 2] = binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8);
      }
      const wavBuffer = encodeWAV(bytes, 24000);
      const audio = new Audio(URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' })));
      audio.play();
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploads(prev => [...prev, { name: file.name, size: file.size, type: file.type }]);

    // show a lightweight chat message about the upload
    const msg = { id: Date.now(), role: 'user', text: `📎 Uploaded: ${file.name}`, isFile: true };
    setMessages(prev => [...prev, msg]);

    // clear input so same file can be re-uploaded if needed
    e.target.value = '';
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditValue(msg.text || msg.content);
  };

  const saveEdit = async (id) => {
    const editedText = editValue.trim();
    if (!editedText) return;

    // 1) Update the edited user message in-place
    const idx = messages.findIndex(m => m.id === id);
    if (idx === -1) return;

    // 2) Build a new messages array:
    // - replace user text
    // - remove the immediate next AI response (if any), so we regenerate it
    const nextMsg = messages[idx + 1];
    const shouldRemoveNextAI = nextMsg && nextMsg.role === 'ai';

    const updated = messages
      .map(m => (m.id === id ? { ...m, text: editedText } : m))
      .filter((m, i) => !(shouldRemoveNextAI && i === idx + 1));

    setMessages(updated);
    setEditingId(null);

    // 3) Regenerate AI response once
    setIsThinking(true);
    try {
      const idToken = user ? await user.getIdToken() : null;

      const res = await fetchWithErrorLog(apiUrl('/api/ai/student'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          text: editedText,
          region,
          userName: settings.userName,
          aiTone: settings.aiTone,
          useGoogleSearch: settings.useGoogleSearch,
          departmentId: isInstitutionHost ? activeDepartmentId : null,
          departmentName: isInstitutionHost ? activeDepartmentName : null,
          hostMode: isInstitutionHost ? 'institution' : 'public',
          institutionId: isInstitutionHost ? (userProfile?.institutionId || null) : null,
          mode: isInstitutionHost ? activeDepartmentName : null,
        })
      });

      const data = await res.json();
      const aiText = data?.text || 'Connection error.';
      if (isInstitutionHost && userProfile?.institutionId && user?.uid) {
        logInstitutionCaseMessage({
          institutionId: userProfile.institutionId,
          studentUid: user.uid,
          departmentId: activeDepartmentId || 'general',
          from: 'ai',
          text: aiText,
          visibility: 'student',
        });
      }

      // Insert AI reply right after the edited message
      const rebuilt = [...updated];
      rebuilt.splice(idx + 1, 0, { id: Date.now() + 1, role: 'ai', content: aiText });
      setMessages(rebuilt);
      speakIfInstitutionVoiceEnabled(aiText);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'Error: ' + err.message }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = async (e, customText = null) => {
    if (e) e.preventDefault();
    const text = customText || input;
    if (!text.trim()) return;

    if (!activeChatId) setActiveChatId(crypto.randomUUID());

    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    if (isInstitutionHost && userProfile?.institutionId && user?.uid) {
      logInstitutionCaseMessage({
        institutionId: userProfile.institutionId,
        studentUid: user.uid,
        departmentId: activeDepartmentId || 'general',
        from: 'student',
        text,
        visibility: 'student',
      });
    }

    try {
      const filesSummary = uploads.length
        ? `User uploaded files: ${uploads.map(u => u.name).join(', ')}. Use them if relevant.`
        : '';

      // Compose department-aware system prompt
      const basePrompt = `You are ElimuLink, an institutional learning copilot. Tone: ${settings.aiTone || 'professional'}. Be accurate. If unsure, say you are unsure and suggest what to check. Support both global knowledge and institution-specific help. Never reveal secrets or tokens.`;
      const deptPrompt = `\nDepartment Mode: ${activeDepartment.name}\nInstructions: ${activeDepartment.prompt}`;
      const systemPrompt = basePrompt + deptPrompt;

      const rulePrefix = `RULE: Always answer on the home chat. Do not tell user to navigate to modules. Use institution info when relevant; otherwise use global info. QUESTION:`;
      const isLibraryQuery = /\b(book|library|isbn|borrow|available|catalog)\b/i.test(text);

      const isImageReq = /(generate|create|show|draw|make|image|picture|photo|illustration|flag|logo|poster|banner|in image form|as an image)/i.test(text);
      if (isImageReq) {
        try {
          const examStyle = "Make it clean, high-contrast, exam-ready, well-labeled if diagram, minimal clutter.";
          const imgPrompt = `${text}\n\n${examStyle}`;

          let imgDataUrl = null;
          try { imgDataUrl = await studentGenerateImage(imgPrompt); } catch (e) { imgDataUrl = null; }
          if (!imgDataUrl && adminToken) {
            try { imgDataUrl = await serverGenerateImage(imgPrompt); } catch(e) { imgDataUrl = null; }
          }
          if (!imgDataUrl) imgDataUrl = await imageAPI.generateImage(imgPrompt);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', type: 'image', content: imgDataUrl, text: 'Here is the generated image.' }]);
        } catch (imgErr) {
          // fallback to textual description via backend student AI
          try {
            const idToken = user ? await user.getIdToken() : null;
            const bodyText = `${filesSummary}\n\n${rulePrefix} ${text}`;
            const res = await fetchWithErrorLog(apiUrl('/api/ai/student'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': idToken ? `Bearer ${idToken}` : ''
              },
              body: JSON.stringify({
                text: bodyText,
                region,
                userName: settings.userName,
                aiTone: settings.aiTone,
                useGoogleSearch: settings.useGoogleSearch,
                departmentId: activeDepartmentId,
                departmentName: isInstitutionHost ? activeDepartmentName : null,
                hostMode: isInstitutionHost ? 'institution' : 'public',
                institutionId: isInstitutionHost ? (userProfile?.institutionId || null) : null,
                mode: isInstitutionHost ? activeDepartmentName : null,
                systemPrompt
              })
            });
            const data = await res.json();
            // AI department switch suggestion
            if (data?.suggestDepartmentId && data.suggestDepartmentId !== activeDepartmentId) {
              setSuggestedDept(data);
              setShowDeptBanner(true);
            }
            const aiText = data?.text || 'Could not generate image.';
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: aiText }]);
            speakIfInstitutionVoiceEnabled(aiText);
            if (isInstitutionHost && userProfile?.institutionId && user?.uid) {
              logInstitutionCaseMessage({
                institutionId: userProfile.institutionId,
                studentUid: user.uid,
                departmentId: activeDepartmentId || 'general',
                from: 'ai',
                text: aiText,
                visibility: 'student',
              });
            }
            // Log activity
            logInstitutionActivity({ departmentId: activeDepartmentId, studentUid: user?.uid, chatId: activeChatId, role: userRole, content: text });
          } catch (fallbackErr) {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'Error: Could not reach AI service.' }]);
          }
        }
      } else {
        const idToken = user ? await user.getIdToken() : null;
        const bodyText = `${filesSummary}\n\n${rulePrefix} ${text}`;
        let res;
        if (isInstitutionHost) {
          let libraryResults = [];
          if (isLibraryQuery) {
            try {
              const params = new URLSearchParams({
                q: text,
                departmentId: activeDepartmentId || 'general',
              });
              const libraryRes = await fetchWithErrorLog(apiUrl(`/api/library/search?${params.toString()}`), {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': idToken ? `Bearer ${idToken}` : '',
                },
              });
              const libraryData = await libraryRes.json();
              libraryResults = Array.isArray(libraryData?.items) ? libraryData.items : [];
            } catch (libraryErr) {
              console.warn('[LIBRARY] Search failed, continuing without library grounding:', libraryErr?.message || libraryErr);
            }
          }

          res = await fetchWithErrorLog(apiUrl('/api/chat'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': idToken ? `Bearer ${idToken}` : '',
            },
            body: JSON.stringify({
              message: bodyText,
              text: bodyText,
              region,
              userName: settings.userName,
              aiTone: settings.aiTone,
              useGoogleSearch: settings.useGoogleSearch,
              departmentId: activeDepartmentId || 'general',
              departmentName: activeDepartmentName || 'General',
              hostMode: 'institution',
              institutionId: userProfile?.institutionId || null,
              mode: activeDepartmentName || null,
              systemPrompt,
              institutionContext: {
                libraryResults,
              },
            }),
          });
        } else {
          res = await fetchWithErrorLog(apiUrl('/api/ai/student'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': idToken ? `Bearer ${idToken}` : ''
            },
            body: JSON.stringify({
              text: bodyText,
              region,
              userName: settings.userName,
              aiTone: settings.aiTone,
              useGoogleSearch: settings.useGoogleSearch,
              departmentId: activeDepartmentId,
              departmentName: isInstitutionHost ? activeDepartmentName : null,
              hostMode: isInstitutionHost ? 'institution' : 'public',
              institutionId: isInstitutionHost ? (userProfile?.institutionId || null) : null,
              mode: isInstitutionHost ? activeDepartmentName : null,
              systemPrompt
            })
          });
        }
        const data = await res.json();
        // AI department switch suggestion
        if (data?.suggestDepartmentId && data.suggestDepartmentId !== activeDepartmentId) {
          setSuggestedDept(data);
          setShowDeptBanner(true);
        }
        const aiText = data?.text || 'Connection error.';
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: aiText }]);
        speakIfInstitutionVoiceEnabled(aiText);
        if (isInstitutionHost && userProfile?.institutionId && user?.uid) {
          logInstitutionCaseMessage({
            institutionId: userProfile.institutionId,
            studentUid: user.uid,
            departmentId: activeDepartmentId || 'general',
            from: 'ai',
            text: aiText,
            visibility: 'student',
          });
        }
        // Log activity
        logInstitutionActivity({ departmentId: activeDepartmentId, studentUid: user?.uid, chatId: activeChatId, role: userRole, content: text });
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'Error: ' + err.message }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Log activity to institution-scoped Firestore collection
  const logInstitutionActivity = async ({ departmentId, studentUid, chatId, role, content }) => {
    try {
      const institutionId = userProfile?.institutionId;
      if (!departmentId || !studentUid || !chatId || !institutionId) return;
      const col = collection(db, 'institutions', institutionId, 'activity');
      await addDoc(col, {
        departmentId,
        studentUid,
        chatId,
        role,
        content,
        createdAt: serverTimestamp()
      });
      // Log to console for verification
      const instDoc = await getDoc(doc(db, 'institutions', institutionId));
      const institutionData = instDoc.exists() ? instDoc.data() : null;
      console.log("🏫 Institution lookup result:", institutionId, institutionData);
    } catch (e) { /* ignore */ }
  };

  const buildCaseId = (studentUid, departmentId) => `${studentUid || 'unknown'}_${departmentId || 'general'}`;

  const logInstitutionCaseMessage = async ({ institutionId, studentUid, departmentId, from, text, visibility = 'student', sentiment, tags }) => {
    try {
      if (!institutionId || !studentUid || !text) return;
      const caseId = buildCaseId(studentUid, departmentId);
      const caseRef = doc(db, 'institutions', institutionId, 'cases', caseId);
      await setDoc(caseRef, {
        institutionId,
        departmentId: departmentId || 'general',
        studentId: studentUid,
        status: 'open',
        rating: null,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
      const messagesCol = collection(db, 'institutions', institutionId, 'cases', caseId, 'messages');
      const payload = {
        from,
        text,
        createdAt: serverTimestamp(),
        departmentId: departmentId || 'general',
        visibility,
      };
      if (sentiment) payload.sentiment = sentiment;
      if (tags) payload.tags = tags;
      await addDoc(messagesCol, payload);
      await setDoc(caseRef, { lastUpdated: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('Case message log failed', e);
    }
  };

  const SidebarItem = ({ icon: Icon, label, onClick, active }) => (
    <button
      onClick={() => {
        onClick && onClick();
        if (isMobile) setSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors ${active ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  const ExecutiveSidebarItem = ({ icon: Icon, label, onClick, active = false }) => (
    <button
      onClick={() => {
        onClick && onClick();
        if (isMobile) setSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
        active ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-slate-800'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  // Student capability booleans
  const isStudent = ['student', 'student_general', 'institution_student'].includes(userRole);
  const studentScope = userProfile?.studentScope ?? 'general';
  const isGeneralLearner = isStudent && studentScope === 'general';
  const isInstitutionStudent = isStudent && studentScope === 'institution';
  const isInstitutionVerified =
    isInstitutionStudent &&
    userProfile?.verificationStatus === 'verified';

  // Role-aware sidebar title
  const roleTitle =
    userRole === 'student' ? 'Student Portal' :
    userRole === 'student_general' ? 'Student Portal' :
    userRole === 'institution_student' ? 'Institution Student Portal' :
    userRole === 'institution_admin' ? 'Institution Admin Portal' :
    userRole === 'institution' ? 'Institution Console' :
    userRole === 'staff' ? 'Staff Console' :
    'Public Explore';

  const resolvedModeUrls = {
    public: modeUrls?.public || 'https://app.elimulink.co.ke/public',
    student: modeUrls?.student || 'https://student.elimulink.co.ke/student',
    institution: modeUrls?.institution || 'https://institution.elimulink.co.ke/institution',
  };
  const institutionAdminAllowedRoles = ['staff', 'departmentAdmin', 'institution_admin', 'superAdmin'];
  const institutionHomeUrl = resolvedModeUrls.institution.endsWith('/institution')
    ? resolvedModeUrls.institution
    : `${resolvedModeUrls.institution}/institution`;

  const handleAdminNavClick = async () => {
    const tokenInstitutionId = user
      ? await user.getIdTokenResult().then((r) => r?.claims?.institutionId || null).catch(() => null)
      : null;
    const hasInstitutionAccess =
      Boolean(userProfile?.institutionId) ||
      Boolean(tokenInstitutionId) ||
      institutionAdminAllowedRoles.includes(userRole);

    if (!hasInstitutionAccess) {
      alert('Institution access required.');
      return;
    }

    if (hostMode === 'public' || hostMode === 'student') {
      window.location.assign(institutionHomeUrl);
      return;
    }

    window.history.pushState({}, '', '/institution/admin');
    setPath('/institution/admin');
  };

  const handlePortalClick = () => {
    if (isInstitutionLinkedUser) {
      window.location.assign(resolvedModeUrls.institution);
      return;
    }
    if (hostMode === 'public') {
      window.location.assign(resolvedModeUrls.student);
      return;
    }
    if (hostMode === 'student') {
      window.location.assign(resolvedModeUrls.student);
      return;
    }
    window.location.assign(resolvedModeUrls.public);
  };

  if (path === '/institution/newchat' || path.startsWith('/institution/newchat')) {
    window.history.replaceState({}, '', '/institution');
    setPath('/institution');
    return null;
  }

  // Permission gate for /institution/admin
  if (path.startsWith('/institution/admin')) {
    if (!institutionAdminAllowedRoles.includes(userRole)) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
      return null;
    }
    return (
      <InstitutionAdminDashboard
        userRole={userRole}
        userProfile={userProfile}
        user={user}
      />
    );
  }

  if (path.startsWith('/institution/notebook')) {
    const allowedRoles = ['institution_student', 'student_general', 'student', 'staff', 'departmentAdmin', 'institution_admin', 'superAdmin'];
    if (!allowedRoles.includes(userRole) || !userProfile?.institutionId) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
      return null;
    }
    return (
      <InstitutionNotebook
        user={user}
        userProfile={userProfile}
        userRole={userRole}
        activeDepartmentId={activeDepartmentId}
        activeDepartmentName={activeDepartmentName}
      />
    );
  }

  if (path.startsWith('/institution/assignments')) {
    const allowedRoles = ['institution_student', 'student_general', 'student', 'staff', 'departmentAdmin', 'institution_admin', 'superAdmin'];
    if (!allowedRoles.includes(userRole) || !userProfile?.institutionId) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
      return null;
    }
    return (
      <InstitutionAssignments
        user={user}
        userProfile={userProfile}
        userRole={userRole}
        activeDepartmentId={activeDepartmentId}
        activeDepartmentName={activeDepartmentName}
      />
    );
  }

  if (path === '/institution' || path === '/institution/') {
    if (!userProfile?.institutionId) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
      return null;
    }
    return (
      <InstitutionHome
        user={user}
        userProfile={userProfile}
        userRole={userRole}
        activeDepartmentId={activeDepartmentId}
        activeDepartmentName={activeDepartmentName}
      />
    );
  }

  // If critical env vars missing, show error panel instead of app
  if (envError && envError.length > 0) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center p-4">
        <div className="max-w-md bg-red-900/20 border border-red-500 rounded-lg p-6">
          <div className="text-lg font-bold text-red-400 mb-3">⚠️ Configuration Error</div>
          <div className="text-sm text-slate-300 mb-4">
            Missing required environment variables on Vercel. Contact admin and add these to Vercel:
          </div>
          <div className="bg-slate-900 rounded p-3 text-xs space-y-1 text-slate-200 font-mono">
            {envError.map(v => (
              <div key={v}>• {v}</div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-4">
            See Vercel project settings → Environment Variables
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Hamburger for mobile */}
      {isMobile && (
        <button
          className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-slate-900 border border-white/10 text-sky-400 md:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={28} />
        </button>
      )}
      {/* Institution Onboarding Modal */}
      {showInstitutionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-sky-400">Join your Institution</h2>
            <div className="mb-2">
              <input type="email" className="w-full p-2 rounded bg-slate-800 border border-white/10 mb-2 text-white" placeholder="Student Email" value={onboardEmail} onChange={e=>setOnboardEmail(e.target.value)} />
              <input className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white" placeholder="Registration Number" value={onboardRegNo} onChange={e=>setOnboardRegNo(e.target.value)} />
            </div>
            {onboardInstitutions.length > 1 && (
              <div className="mb-2">
                <label className="text-xs text-slate-300">Select Institution</label>
                <select className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white mt-1" value={onboardSelectedInst||''} onChange={e=>setOnboardSelectedInst(e.target.value)}>
                  <option value="">-- Select --</option>
                  {onboardInstitutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name || inst.id}</option>
                  ))}
                </select>
                <button className="mt-2 w-full bg-sky-500 text-white font-bold py-2 rounded" onClick={handleSelectInstitution}>Confirm</button>
              </div>
            )}
            {onboardError && <div className="text-red-400 text-xs mb-2">{onboardError}</div>}
            <button className="w-full bg-sky-500 text-white font-bold py-2 rounded mt-2" onClick={handleInstitutionOnboard}>Continue</button>
          </div>
        </div>
      )}
      {/* Sidebar: Drawer on mobile, static on desktop */}
      {/* Backdrop for mobile drawer */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={
          isMobile
            ? `fixed top-0 left-0 z-40 h-full w-full max-w-xs bg-slate-900 border-r border-white/5 flex flex-col min-w-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `w-[260px] bg-slate-900 border-r border-white/5 flex flex-col shrink-0 min-w-0`
        }
        style={isMobile ? { boxShadow: isSidebarOpen ? '0 0 0 9999px rgba(0,0,0,0.5)' : undefined } : {}}
      >
        <div className="p-4 border-b border-white/5 flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 font-bold text-sky-400 ${isInstitutionHost ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (!isInstitutionHost) return;
              window.history.pushState({}, '', '/institution');
              setPath('/institution');
              if (isMobile) setSidebarOpen(false);
            }}
          >
            <div className="w-6 h-6 bg-sky-500 rounded flex items-center justify-center text-white text-[10px]">EL</div>
            {isInstitutionHost ? `ElimuLink — ${roleTitle}` : 'ElimuLink Executive'}
          </div>
          <div className="text-[11px] text-slate-400">
            {userRole === 'student' && 'Your academic tools are ready.'}
            {userRole === 'student_general' && 'Your academic tools are ready.'}
            {userRole === 'institution' && 'Manage learning, students, and insights.'}
            {userRole === 'institution_admin' && 'Manage learning, students, and insights.'}
            {userRole === 'institution_student' && 'Institution-linked learning tools are ready.'}
            {userRole === 'staff' && 'Admin and operational controls.'}
            {userRole === 'public' && 'Explore institutions, courses, and opportunities.'}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isInstitutionHost ? (
            <>
              <SidebarItem
                icon={Plus}
                label="New Chat"
                onClick={() => {
                  window.history.pushState({}, '', '/institution');
                  setPath('/institution');
                  if (isMobile) setSidebarOpen(false);
                }}
              />
              {!["staff","departmentAdmin","institution_admin","superAdmin"].includes(userRole) && (
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors text-slate-300 hover:bg-white/5"
                  onClick={() => setShowStaffLogin(true)}
                >
                  <Shield size={18} />
                  <span>Staff Login</span>
                  <Lock size={16} className="ml-auto opacity-70" />
                </button>
              )}
              <SidebarItem icon={FolderHeart} label="Notebook" onClick={() => { window.history.pushState({}, '', '/institution/notebook'); setPath('/institution/notebook'); }} />
              <SidebarItem icon={FolderHeart} label="Assignments" onClick={() => { window.history.pushState({}, '', '/institution/assignments'); setPath('/institution/assignments'); }} />
              {institutionAdminAllowedRoles.includes(userRole) && (
                <SidebarItem
                  icon={Shield}
                  label="Admin"
                  onClick={handleAdminNavClick}
                />
              )}
            </>
          ) : (
            <>
              <div className="space-y-6 px-1 py-2">
                <div>
                  <p className="px-2 pb-2 text-xs text-gray-400 uppercase">AI Workspace</p>
                  <div className="space-y-1">
                    <ExecutiveSidebarItem icon={MessageSquare} label="New Chat" active onClick={() => { setMessages([]); setActiveChatId(null); }} />
                    <ExecutiveSidebarItem icon={FileText} label="My Notes" onClick={() => { setShowMyStuff(!showMyStuff); }} />
                    <ExecutiveSidebarItem icon={Activity} label="My Activity" onClick={() => { setShowServicesHub(true); setShowMyStuff(false); setShowAdmin(false); }} />
                    <ExecutiveSidebarItem icon={Presentation} label="Presentation Requests" onClick={() => { setShowServicesHub(true); setShowMyStuff(false); setShowAdmin(false); }} />
                  </div>
                </div>

                <div>
                  <p className="px-2 pb-2 text-xs text-gray-400 uppercase">Communication</p>
                  <div className="space-y-1">
                    <ExecutiveSidebarItem icon={Video} label="Meet" onClick={() => {}} />
                    <ExecutiveSidebarItem icon={Calendar} label="Calendar" onClick={() => {}} />
                  </div>
                </div>

                <div>
                  <p className="px-2 pb-2 text-xs text-gray-400 uppercase">Account</p>
                  <div className="space-y-1">
                    <ExecutiveSidebarItem icon={Settings} label="Settings & Profile" onClick={() => setIsSettingsOpen(true)} />
                    <ExecutiveSidebarItem icon={Bell} label="Notifications" onClick={() => {}} />
                    <ExecutiveSidebarItem icon={Home} label="Institution Snapshot" onClick={handlePortalClick} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-1">
          {isInstitutionHost ? (
            <>
              <SidebarItem icon={Settings} label="Settings" onClick={() => setIsSettingsOpen(true)} />
              <SidebarItem icon={HelpCircle} label="Help" onClick={() => {}} />
            </>
          ) : (
            <>
              <ExecutiveSidebarItem icon={HelpCircle} label="Help" onClick={() => {}} />
              <ExecutiveSidebarItem icon={LogOut} label="Logout" onClick={handleLogout} />
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-w-0 relative ${isMobile ? '' : 'ml-0'}`}>
        {/* Department label and switch banner */}
        {isInstitutionHost && (
          <div className="flex items-center gap-2 px-4 pt-2 pb-1">
            <span className="text-xs bg-sky-900/40 text-sky-200 px-2 py-1 rounded font-bold">
              Mode: {activeDepartmentId ? (activeDepartmentName || activeDepartmentId) : 'General'}
            </span>
          </div>
        )}
        {suggestedDept && showDeptBanner && (
          <div className="mx-4 mb-2 p-2 bg-emerald-900/80 border border-emerald-400 rounded flex items-center gap-3 text-xs text-white">
            <span>Switch to {departments.find(d=>d.id===suggestedDept.suggestDepartmentId)?.name || suggestedDept.suggestDepartmentId}? <span className="text-slate-300">({suggestedDept.reason})</span></span>
            <button className="ml-2 px-2 py-1 bg-emerald-500 rounded text-white font-bold" onClick={() => {
              const next = departments.find(d => d.id === suggestedDept.suggestDepartmentId) || { id: suggestedDept.suggestDepartmentId, name: suggestedDept.suggestDepartmentId };
              setActiveDepartmentId(next.id);
              setActiveDepartmentName(next.name || next.id);
              localStorage.setItem('activeDepartmentId', next.id);
              localStorage.setItem('activeDepartmentName', next.name || next.id);
              setShowDeptBanner(false);
              setSuggestedDept(null);
            }}>Switch</button>
            <button className="ml-1 px-2 py-1 bg-slate-700 rounded text-white" onClick={() => setShowDeptBanner(false)}>Dismiss</button>
          </div>
        )}
        <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock size={14} />
              {currentTime}
            </div>
            <div className="ml-3">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-slate-900 border border-white/5 text-[11px] rounded px-2 py-1 text-slate-300">
                <option value="Global">Global</option>
                <option value="Kampala">Kampala</option>
                <option value="Local">Local</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="text-xs text-amber-300 bg-amber-900/10 px-3 py-1 rounded">You're offline — saved explanations still available</div>
            )}
            {showInstall && deferredPrompt && (
              <button onClick={async () => {
                try {
                  setShowInstall(false);
                  deferredPrompt.prompt();
                  const choice = await deferredPrompt.userChoice;
                  setDeferredPrompt(null);
                } catch (e) { console.error('Install prompt failed', e); }
              }} className="bg-emerald-500 px-3 py-1 rounded text-xs font-bold text-white">Install ElimuLink</button>
            )}
            {isInstitutionHost && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                Mode: {activeDepartmentName || 'General'}
              </span>
            )}
            <div className="bg-white/5 px-3 py-1 rounded-full text-[10px] text-slate-400 border border-white/10 uppercase tracking-tighter">Home Station</div>
          </div>
        </header>

        {/* Chat Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-sky-500/20 rounded-3xl mx-auto flex items-center justify-center">
                  <Gem size={40} className="text-sky-400" />
                </div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">
                  {getGreeting()}, {settings.userName}
                </h1>
                <div className="text-slate-400 text-sm mt-2">{currentTime}</div>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Ask me about geography, technical research, books, or generate high-quality images. Choose a region above to tailor responses.
                </p>
              </div>
            )}

            {showMyStuff ? (
              <div className="p-4 bg-slate-900 rounded-lg">
                <h2 className="text-lg font-bold mb-4">My Stuff - Saved Images</h2>
                {savedImages.length === 0 ? (
                  <div className="text-slate-400 text-center py-8">No saved images yet. Generate an image and click "Save" to add it here!</div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {savedImages.map(img => (
                      <div key={img.id} className="relative group">
                        <img src={img.image} alt="Saved" className="w-full h-48 object-cover rounded-lg border border-white/10" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center gap-2">
                          <a href={img.image} download className="bg-sky-500 px-3 py-2 rounded text-xs font-bold">Download</a>
                          <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'savedImages', img.id)); }} className="bg-red-600 px-3 py-2 rounded text-xs font-bold">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : showServicesHub ? (
              <div className="p-4 bg-slate-900 rounded-lg max-h-[600px] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">Services Hub</h2>
                {isStudent && (
                  <>
                    <section className="mb-6">
                      <h3 className="font-semibold text-sky-400 mb-2">Student Services</h3>
                      <ul className="list-disc pl-6 text-slate-300 text-sm">
                        <li>Request Transcripts</li>
                        <li>Ask for Support</li>
                        <li>Book Counseling</li>
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-semibold text-sky-400 mb-2">Requests</h3>
                      <ul className="list-disc pl-6 text-slate-300 text-sm">
                        <li>Submit a Request</li>
                        <li>View Request Status</li>
                      </ul>
                    </section>
                  </>
                )}
                {isInstitutionLinkedUser && (
                  <>
                    <section className="mb-6">
                      <h3 className="font-semibold text-emerald-400 mb-2">Institution Services</h3>
                      <ul className="list-disc pl-6 text-slate-300 text-sm">
                        <li>Manage Student Requests</li>
                        <li>Approve Transcripts</li>
                        <li>Schedule Counseling</li>
                      </ul>
                    </section>
                    <section className="mb-6">
                      <h3 className="font-semibold text-emerald-400 mb-2">Approvals</h3>
                      <ul className="list-disc pl-6 text-slate-300 text-sm">
                        <li>Approve Requests</li>
                        <li>View Pending Approvals</li>
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-semibold text-emerald-400 mb-2">Reports</h3>
                      <ul className="list-disc pl-6 text-slate-300 text-sm">
                        <li>View Service Reports</li>
                        <li>Download Reports</li>
                      </ul>
                    </section>
                  </>
                )}
                <button className="mt-6 bg-sky-500 px-4 py-2 rounded text-white font-bold" onClick={() => setShowServicesHub(false)}>Close</button>
              </div>
            ) : showAdmin ? (
              <div className="p-4 bg-slate-900 rounded-lg max-h-[600px] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">Institution Services</h2>
                <div className="mb-6 flex flex-wrap gap-2">
                  {departments.filter(d=>d.id!=='general').map(dept => (
                    <button key={dept.id} className={`px-3 py-2 rounded font-bold text-xs ${activeDepartmentId===dept.id?'bg-sky-500 text-white':'bg-slate-800 text-sky-200 hover:bg-sky-700 hover:text-white'}`} onClick={()=>{setActiveDepartmentId(dept.id); setShowAdmin(false);}}>{dept.name}</button>
                  ))}
                </div>
                <h2 className="text-lg font-bold">Admin: Libraries</h2>
                      {/* Department Admin Dashboard (stub, UI only) */}
                      {/* Example: /institution/department/:deptId (no routing refactor) */}
                      {userRole === 'staff' && showAdmin && selectedLibrary && (
                        <div className="p-4 bg-slate-900 rounded-lg mt-4">
                          <h2 className="text-lg font-bold mb-2">Department Admin Dashboard (Stub)</h2>
                          <div className="text-xs text-slate-400 mb-2">Department: {activeDepartment.name}</div>
                          <div className="text-slate-300">(Logs and cases for this department would be shown here.)</div>
                        </div>
                      )}
                {!adminToken ? (
                  <div className="mt-3 flex gap-2">
                    <input value={adminPasscode} onChange={(e)=>setAdminPasscode(e.target.value)} placeholder="Admin passcode" type="password" className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm" />
                    <button onClick={adminLogin} className="bg-sky-500 px-3 rounded text-sm">Sign In</button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 mb-4">
                    <div className="text-sm text-slate-300">Signed in as admin</div>
                    <button onClick={()=>{ setAdminToken(''); setShowAdmin(false); }} className="ml-auto bg-red-600 px-3 rounded text-sm">Sign Out</button>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={externalApiUrl} onChange={(e)=>setExternalApiUrl(e.target.value)} placeholder="External library API URL" className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm" />
                    <button onClick={syncFromExternal} className="bg-emerald-500 px-3 rounded text-sm">Sync From API</button>
                  </div>

                  <div className="flex gap-2">
                    <input value={newLibraryName} onChange={(e)=>setNewLibraryName(e.target.value)} placeholder="New library name" className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm" />
                    <button onClick={createLibrary} className="bg-sky-500 px-3 rounded text-sm">Create</button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Libraries</h3>
                      <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                        {libraries.map(lib => (
                          <li key={lib.id} className="flex items-center justify-between bg-slate-800 p-2 rounded text-xs">
                            <button onClick={()=>selectLibraryAndLoad(lib)} className="text-left truncate">{lib.name}</button>
                            <button onClick={async ()=>{ if(confirm('Delete?')){ await deleteDoc(doc(db,'artifacts',appId,'libraries',lib.id)); loadLibraries(); } }} className="text-red-500 ml-2">✕</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Books</h3>
                      {selectedLibrary ? (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {selectedLibrary.books?.map(b => (
                            <div key={b.id} className="bg-slate-800 p-2 rounded text-xs">
                              <div className="font-semibold truncate">{b.title}</div>
                              <div className="text-slate-400 text-[10px]">{b.author}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs">Select a library</div>
                      )}
                      {selectedLibrary && (
                        <div className="mt-2 space-y-1">
                          <input value={newBookTitle} onChange={(e)=>setNewBookTitle(e.target.value)} placeholder="Title" className="w-full bg-slate-800 p-1 rounded text-xs" />
                          <input value={newBookAuthor} onChange={(e)=>setNewBookAuthor(e.target.value)} placeholder="Author" className="w-full bg-slate-800 p-1 rounded text-xs" />
                          <button onClick={addBookToLibrary} className="w-full bg-sky-500 px-2 py-1 rounded text-xs">Add Book</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                <div key={m.id} className={`flex group ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`relative max-w-[85%] rounded-2xl p-4 ${
                  m.role === 'user' 
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
                  : 'bg-slate-900 border border-white/10 text-slate-200'
                }`}>
                  {editingId === m.id ? (
                    <div className="space-y-2 min-w-[200px]">
                      <textarea 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-slate-800 border border-white/20 rounded p-2 text-sm focus:outline-none"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-400"><X size={16}/></button>
                        <button onClick={() => saveEdit(m.id)} className="p-1 hover:text-green-400"><Check size={16}/></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.type === 'image' && m.content && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-white/10">
                          <img src={m.content} alt="AI Generated" className="w-full h-auto object-cover" />
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text || m.content}</p>
                      {m.role === 'ai' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestChips(m.text || m.content).slice(0,5).map((c) => (
                            <button
                              key={c}
                              onClick={() => handleSubmit(null, c)}
                              className="text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className={`mt-3 pt-3 border-t border-white/5 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        {m.role === 'user' ? (
                          <button onClick={() => { setEditingId(m.id); setEditValue(m.text || m.content); }} className="text-[10px] flex items-center gap-1 hover:text-sky-200 uppercase font-bold">
                            <Edit2 size={10} /> Edit
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleTTS(m.text || m.content)} className="text-[10px] flex items-center gap-1 hover:text-sky-400 uppercase font-bold">
                              <Volume2 size={10} /> Hear Voice
                            </button>
                            {m.type === 'image' && m.content && (
                              <>
                                <a href={m.content} download className="text-[10px] flex items-center gap-1 hover:text-sky-200 uppercase font-bold">Download</a>
                                <button onClick={() => { saveImageToMyStuff(m.content); alert('Saved to My Stuff!'); }} className="text-[10px] flex items-center gap-1 hover:text-emerald-400 uppercase font-bold">Save</button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
                
                {isThinking && (
                  <div className="flex items-center gap-2 text-sky-500 text-xs font-bold animate-pulse">
                    <div className="w-1 h-1 bg-sky-500 rounded-full" />
                    AI is processing global data...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Input Dock */}
        <div className={`p-4 bg-slate-950 ${isMobile ? 'fixed bottom-0 left-0 w-full z-20' : ''}`} style={isMobile ? {boxShadow:'0 -2px 16px 0 rgba(0,0,0,0.2)'} : {}}>
          <div className={`${isMobile ? 'max-w-full' : 'max-w-3xl mx-auto'}`}>
            {uploads.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-2">
                {uploads.map((f, i) => (
                  <div key={i} className="text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 flex items-center gap-2">
                    {f.name}
                    <button onClick={() => setUploads(prev => prev.filter((_, idx) => idx !== i))} className="opacity-70 hover:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl focus-within:border-sky-500/50 transition-all p-2">
              <form onSubmit={handleSubmit} className="flex flex-col">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about geography, research, books, or generate an image..."
                  className="w-full bg-transparent border-none py-3 px-4 focus:outline-none text-sm placeholder:text-slate-600"
                />
                <div className="flex items-center justify-between px-2 pb-1">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={handleFileUpload} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors" title="Upload for research">
                      <Paperclip size={18} />
                    </button>
                    <button type="button" onClick={() => setInput(p => p + " Generate an image of ")} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors" title="Generate Image">
                      <ImageIcon size={18} />
                    </button>
                    {isInstitutionHost && (
                      <>
                        <button
                          type="button"
                          onClick={handleMicToggle}
                          disabled={!speechSupported}
                          title={speechSupported ? (isListening ? 'Stop voice input' : 'Start voice input') : 'Voice not supported in this browser'}
                          className={`p-2 rounded-lg transition-colors ${
                            speechSupported
                              ? isListening
                                ? 'bg-red-600/30 text-red-300 hover:bg-red-600/40'
                                : 'hover:bg-white/5 text-slate-400'
                              : 'text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {speechSupported ? (isListening ? <MicOff size={18} /> : <Mic size={18} />) : <MicOff size={18} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceEnabled((prev) => {
                              const next = !prev;
                              if (!next) cancelSpeak();
                              return next;
                            });
                          }}
                          title={voiceEnabled ? 'Voice playback on' : 'Voice playback off'}
                          className={`p-2 rounded-lg transition-colors ${voiceEnabled ? 'text-sky-300 hover:bg-white/5' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                          {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        </button>
                      </>
                    )}
                  </div>
                  <button 
                    disabled={!input.trim()}
                    className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <span>Analyze</span>
                    <Send size={14} />
                  </button>
                </div>
              </form>
              <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />
            </div>
            <p className="text-[10px] text-center text-slate-600 mt-2 uppercase tracking-widest">
              Unified Platform • Global Access
            </p>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {/* Institution Staff Code Modal */}
      {showInstitutionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-sky-400">Staff only — enter Staff Code</h2>

            <input
              className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white mb-2"
              placeholder="Staff Code"
              value={staffCodeInput}
              onChange={e => setStaffCodeInput(e.target.value)}
              type="password"
            />

            <button
              className="w-full bg-sky-500 text-white font-bold py-2 rounded mt-2"
              onClick={() => verifyStaffCode(staffCodeInput)}
            >
              Verify
            </button>

            <button
              className="w-full mt-2 text-xs text-slate-400 underline"
              onClick={() => setShowInstitutionModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showStaffLogin && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-sky-400 mb-2">Staff Login</h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter institution Staff Code plus your Email and Password.
            </p>

            <input
              className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white mb-2"
              placeholder="Staff Code"
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value)}
            />
            <input
              className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white mb-2"
              placeholder="Staff Email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />
            <input
              className="w-full p-2 rounded bg-slate-800 border border-white/10 text-white mb-2"
              placeholder="Password"
              type="password"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
            />

            <button
              className="w-full bg-sky-500 text-white font-bold py-2 rounded mt-2"
              onClick={async () => {
                try {
                  await signInWithEmailAndPassword(auth, staffEmail, staffPassword);
                  await runPostLoginSync(auth.currentUser);
                  const idToken = await auth.currentUser.getIdToken();
                  const res = await fetch(apiUrl('/api/auth/verify-staff-code'), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ staffCode }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Verify failed');

                  setUserRole('staff');
                  setUserProfile((prev) => ({ ...(prev || {}), role: 'staff', staffCodeVerified: true }));
                  alert('Staff access enabled!');
                  setShowStaffLogin(false);
                  setStaffCode('');
                  setStaffEmail('');
                  setStaffPassword('');
                } catch (e) {
                  alert(e.message || 'Login failed');
                }
              }}
            >
              Sign in
            </button>

            <button
              className="w-full mt-2 text-xs text-slate-400 underline"
              onClick={() => setShowStaffLogin(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Settings className="text-sky-500" size={20} /> Control Hub</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-slate-400 hover:bg-white/5 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 p-8">
              <div className="space-y-6">
                <section>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Identity</label>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                    <User size={16} className="text-sky-400" />
                    <input 
                      className="bg-transparent border-none focus:outline-none text-sm w-full text-white" 
                      value={settings.userName} 
                      onChange={e => setSettings({...settings, userName: e.target.value})}
                      placeholder="Your name"
                    />
                  </div>
                </section>

                <section>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Appearance</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSettings({...settings, theme: 'light'})} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm ${settings.theme === 'light' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/5 border-white/5 text-slate-400'}`}><Sun size={14}/> Light</button>
                                       <button onClick={() => setSettings({...settings, theme: 'dark'})} className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm ${settings.theme === 'dark' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/5 border-white/5 text-slate-400'}`}><Moon size={14}/> Dark</button>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">AI Personality</label>
                  <select 
                    value={settings.aiTone} 
                    onChange={e => setSettings({...settings, aiTone: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 p-3 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="Academic">Academic Expert</option>
                    <option value="Concise">Ultra Concise</option>
                    <option value="Creative">Creative Assistant</option>
                  </select>
                </section>

                <section>
                  <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Search size={16} className="text-emerald-400" />
                      <div className="text-xs text-white">
                        <div className="font-bold">Live Research</div>
                        <div className="text-slate-500 text-[10px]">Google Search integration</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, useGoogleSearch: !settings.useGoogleSearch})}
                      className={`w-10 h-6 rounded-full transition-all relative ${settings.useGoogleSearch ? 'bg-sky-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.useGoogleSearch ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                </section>
                <section>
                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm py-3 rounded-xl"
                  >
                    Log out
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Stuff Modal - shows saved images */}
      {/* This can be triggered from sidebar "My Stuff" item */}
    </div>
  );
}


