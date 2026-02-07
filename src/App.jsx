import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, query, serverTimestamp, orderBy, addDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import imageAPI from './services/imageAPI.js';
import { 
  Plus, 
  FolderHeart, 
  Gem, 
  Settings, 
  HelpCircle, 
  Menu, 
  Send, 
  Volume2, 
  Image as ImageIcon, 
  Paperclip, 
  Edit2, 
  Check, 
  X,
  Clock,
  User,
  Sun,
  Moon,
  Search
} from 'lucide-react';

// --- CONFIG & INIT ---
// Read Firebase config from environment variables (preferred)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'elimulink-pro-v2';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''; 
// API base for backend (set this in Vercel to your Render service URL)
const API_BASE = import.meta.env.VITE_API_BASE || '';

function apiUrl(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return API_BASE ? API_BASE.replace(/\/$/, '') + path : path;
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

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
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
  const [uploads, setUploads] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [userRole, setUserRole] = useState('student');

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

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Sync History
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');
    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatHistory(history.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
  }, [user]);

  // Load persisted user region preference
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const uDoc = doc(db, 'artifacts', appId, 'users', user.uid);
        const snap = await getDoc(uDoc);
        if (snap.exists()) {
          const data = snap.data();
          if (data.region) setRegion(data.region);
          // Determine role: prefer explicit `role`, else `isStaff` boolean
          if (data.role) setUserRole(data.role);
          else if (data.isStaff) setUserRole('staff');
          else setUserRole('student');
        }
      } catch (e) { console.error('Error reading user prefs', e); }
    })();
  }, [user]);

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

      const res = await fetch(apiUrl('/api/ai/student'), {
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
          useGoogleSearch: settings.useGoogleSearch
        })
      });

      const data = await res.json();
      const aiText = data?.text || 'Connection error.';

      // Insert AI reply right after the edited message
      const rebuilt = [...updated];
      rebuilt.splice(idx + 1, 0, { id: Date.now() + 1, role: 'ai', content: aiText });
      setMessages(rebuilt);
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

    try {
      const filesSummary = uploads.length
        ? `User uploaded files: ${uploads.map(u => u.name).join(', ')}. Use them if relevant.`
        : '';

      const rulePrefix = `RULE: Always answer on the home chat. Do not tell user to navigate to modules. Use institution info when relevant; otherwise use global info. QUESTION:`;

      const isImageReq = /(generate|create|show|draw|make).*(image|picture|photo|illustration|flag|draw)/i.test(text);
      if (isImageReq) {
        try {
          const examStyle = "Make it clean, high-contrast, exam-ready, well-labeled if diagram, minimal clutter.";
          const imgPrompt = `${text}\n\n${examStyle}`;

          let imgDataUrl = null;
          if (adminToken) {
            try { imgDataUrl = await serverGenerateImage(imgPrompt); } catch(e) { imgDataUrl = null; }
          }
          if (!imgDataUrl) imgDataUrl = await imageAPI.generateImage(imgPrompt);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', type: 'image', content: imgDataUrl, text: 'Here is the generated image.' }]);
        } catch (imgErr) {
          // fallback to textual description via backend student AI
          try {
            const idToken = user ? await user.getIdToken() : null;
            const bodyText = `${filesSummary}\n\n${rulePrefix} ${text}`;
            const res = await fetch(apiUrl('/api/ai/student'), {
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
                useGoogleSearch: settings.useGoogleSearch
              })
            });
            const data = await res.json();
            const aiText = data?.text || 'Could not generate image.';
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: aiText }]);
          } catch (fallbackErr) {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'Error: Could not reach AI service.' }]);
          }
        }
      } else {
        const idToken = user ? await user.getIdToken() : null;
        const bodyText = `${filesSummary}\n\n${rulePrefix} ${text}`;
        const res = await fetch(apiUrl('/api/ai/student'), {
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
            useGoogleSearch: settings.useGoogleSearch
          })
        });
        const data = await res.json();
        const aiText = data?.text || 'Connection error.';
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: aiText }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'Error: ' + err.message }]);
    } finally {
      setIsThinking(false);
    }
  };

  const SidebarItem = ({ icon: Icon, label, onClick, active }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-colors ${active ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar: Collapsible Menu */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-slate-900 border-r border-white/5 flex flex-col shrink-0`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <div className="w-6 h-6 bg-sky-500 rounded flex items-center justify-center text-white text-[10px]">EL</div>
            ElimuLink Pro
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <SidebarItem icon={Plus} label="New Chat" onClick={() => { setMessages([]); setActiveChatId(null); }} />
          <SidebarItem icon={FolderHeart} label="My Stuff" onClick={() => { setShowMyStuff(!showMyStuff); }} />
          {userRole === 'staff' && (
            <SidebarItem icon={FolderHeart} label="Admin" onClick={() => { setShowAdmin(s=>!s); }} />
          )}
          
          <div className="mt-6 mb-2 px-3 text-[10px] uppercase text-slate-500 font-bold tracking-widest">Recent Chats</div>
          {chatHistory.slice(0, 5).map(chat => (
            <button key={chat.id} onClick={() => { setActiveChatId(chat.id); setMessages(chat.messages || []); }} className="w-full text-left p-2 rounded text-xs truncate text-slate-400 hover:bg-white/5">
              {chat.title || "Previous Chat"}
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-white/5">
          <SidebarItem icon={Settings} label="Settings" onClick={() => setIsSettingsOpen(true)} />
          <SidebarItem icon={HelpCircle} label="Help" onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
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
            ) : showAdmin ? (
              <div className="p-4 bg-slate-900 rounded-lg max-h-[600px] overflow-y-auto">
                <h2 className="text-lg font-bold">Admin: Libraries</h2>
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
        <div className="p-4 bg-slate-950">
          <div className="max-w-3xl mx-auto">
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
