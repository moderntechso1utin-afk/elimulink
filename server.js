const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Allow your frontend origins (Vercel + localhost)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function(origin, cb) {
    // allow non-browser tools (curl, Postman)
    if (!origin) return cb(null, true);
    // if no allowlist set, allow all (MVP). You can tighten later.
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    return cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
}));

const PORT = process.env.PORT || 4000;
const APP_ID = process.env.VITE_APP_ID || 'elimulink-pro-v2';

// Initialize Firebase Admin SDK from service account JSON in env
if (!process.env.FIREBASE_ADMIN_SA) {
  console.warn('FIREBASE_ADMIN_SA not set — server Firestore write will fail');
} else {
  try {
    const sa = JSON.parse(process.env.FIREBASE_ADMIN_SA);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } catch (e) {
    console.error('Failed to parse FIREBASE_ADMIN_SA:', e.message);
  }
}

// Only initialize Firestore if the Firebase app was successfully initialized.
const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;

// Firebase ID token middleware for students
async function requireUser(req, res, next) {
  try {
    const authz = req.headers.authorization || '';
    if (!authz.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }
    const token = authz.slice(7);

    if (!admin.apps?.length) {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    // decoded.uid exists
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid user token' });
  }
}

// Role enforcement helper
function requireRole(role) {
  return (req, res, next) => {
    const r = req.user?.role || req.user?.claims?.role;
    if (r !== role) return res.status(403).json({ error: `Requires role: ${role}` });
    return next();
  };
}

const ADMIN_HASH = process.env.ADMIN_PASSCODE_HASH || '';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET; // required
if (!ADMIN_JWT_SECRET) {
  console.warn("ADMIN_JWT_SECRET not set — admin auth will not work reliably");
}
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload?.admin) return next();
    return res.status(403).json({ error: 'Not admin' });
  } catch (e) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

const bcrypt = require("bcryptjs");

app.post("/api/admin/auth", (req, res) => {
  const { passcode } = req.body || {};

  if (!passcode) {
    return res.status(400).json({ error: "passcode required" });
  }

  if (!process.env.ADMIN_PASSCODE_HASH) {
    return res
      .status(500)
      .json({ error: "Server not configured for admin auth" });
  }

  const isValid = bcrypt.compareSync(
    passcode,
    process.env.ADMIN_PASSCODE_HASH
  );

  if (!isValid) {
    return res.status(401).json({ error: "Invalid passcode" });
  }

  const token = jwt.sign({ admin: true }, ADMIN_JWT_SECRET, { expiresIn: "12h" });

  return res.json({ token });
});


app.post('/api/libraries/sync', requireAdmin, async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  if (!db) return res.status(200).json({ success: false, message: 'Firestore not initialized. Ensure FIREBASE_ADMIN_SA is set in your environment.', data: [] });
  try {
    const r = await fetch(url);
    const data = await r.json();
    // Expect data to be { libraries: [{ name, books: [{ title, author, link }] }] } or array
    const libs = Array.isArray(data) ? data : (data.libraries || []);
    const col = db.collection('artifacts').doc(APP_ID).collection('libraries');
    for (const lib of libs) {
      const libRef = await col.add({ name: lib.name || 'Unnamed', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      if (Array.isArray(lib.books)) {
        const booksCol = col.doc(libRef.id).collection('books');
        for (const b of lib.books) {
          await booksCol.add({ title: b.title || '', author: b.author || '', link: b.link || '', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      }
    }
    return res.json({ ok: true, imported: libs.length });
  } catch (e) {
    console.error('Sync error', e);
    return res.status(500).json({ error: e.message });
  }
});

// Friendly, public GET fallback for libraries syncing status/data
app.get('/api/libraries/sync', async (req, res) => {
  if (!db) {
    return res.status(200).json({
      success: false,
      message: 'Firestore not initialized. Ensure FIREBASE_ADMIN_SA is set in your .env.',
      data: []
    });
  }

  try {
    const libsSnap = await db.collection('artifacts').doc(APP_ID).collection('libraries').get();
    const libs = [];
    for (const doc of libsSnap.docs) {
      const lib = { id: doc.id, ...(doc.data() || {}) };
      const booksSnap = await db.collection('artifacts').doc(APP_ID).collection('libraries').doc(doc.id).collection('books').get();
      lib.books = booksSnap.docs.map(b => ({ id: b.id, ...(b.data() || {}) }));
      libs.push(lib);
    }
    return res.json({ success: true, data: libs });
  } catch (e) {
    console.error('GET /api/libraries/sync error', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/image', requireAdmin, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!OPENAI_KEY) return res.status(200).json({ success: false, error: 'Image generation key missing. Update your environment with OPENAI_API_KEY.' });
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 })
    });
    const data = await r.json();
    const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.b64_image;
    if (!b64) return res.status(502).json({ error: 'No image returned', details: data });
    return res.json({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error('Image error', e);
    return res.status(500).json({ error: e.message });
  }
});

// Student AI endpoint
app.post('/api/ai/student', requireUser, async (req, res) => {
  const { text, region, userName, aiTone, useGoogleSearch } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  }

  // Minimal institutional grounding placeholder:
  // Later we'll fetch institution context, library, departments, policies from Firestore.
  const systemInstruction = `
You are ElimuLink, an institutional learning copilot.
Tone: ${aiTone || 'professional'}.
Be accurate. If unsure, say you are unsure and suggest what to check.
Support both global knowledge and institution-specific help.
Never reveal secrets or tokens.
`;

  const promptText = `Current Time: ${new Date().toISOString()}
Region: ${region || 'unknown'}
User: ${userName || 'student'}
Student UID: ${req.user.uid}
Question: ${text}
`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          tools: useGoogleSearch ? [{ google_search: {} }] : [],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );

    const data = await r.json();

    const aiText =
      data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response.';

    return res.json({ ok: true, text: aiText, raw: undefined });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

// Root status route for quick health check
app.get('/', (req, res) => {
  const status = {
    service: 'ElimuLink API',
    port: PORT,
    firestore: !!db,
    openai: !!OPENAI_KEY,
    note: 'Use /api/admin/auth (POST), /api/libraries/sync (GET/POST), /api/image (POST)'
  };
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify(status, null, 2));
});
