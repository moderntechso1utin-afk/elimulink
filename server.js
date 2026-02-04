const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');
const admin = require('firebase-admin');

const app = express();
app.use(express.json({ limit: '5mb' }));

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

const ADMIN_HASH = process.env.ADMIN_PASSCODE_HASH || '';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || crypto.randomBytes(32).toString('hex');
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

function hashPasscode(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload && payload.admin) return next();
  } catch (e) { }
  return res.status(403).json({ error: 'Invalid token' });
}

const bcrypt = require("bcryptjs");

app.post("/api/admin/auth", (req, res) => {
  const { passcode } = req.body || {};
  if (!passcode) {
    return res.status(400).json({ error: "passcode required" });
  }

  if (!process.env.ADMIN_PASSCODE_HASH) {
    return res.status(500).json({ error: "Server not configured for admin auth" });
  }

  const isValid = bcrypt.compareSync(
    passcode,
    process.env.ADMIN_PASSCODE_HASH
  );

  if (!isValid) {
    return res.status(401).json({ error: "Invalid passcode" });
  }

  const token = jwt.sign(
    { admin: true },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: "12h" }
  );

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
