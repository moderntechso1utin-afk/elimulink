const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');
const admin = require('firebase-admin');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

function resolveFirebaseProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    null
  );
}

function loadEnvFile(filename, options = {}) {
  const { override = false } = options;
  const fullPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (override || !(key in process.env)) process.env[key] = value;
  }
}

// Load local env files when running outside managed platforms.
loadEnvFile('.env');
loadEnvFile('.env.local', { override: true });

const app = express();
app.use(express.json({ limit: '5mb' }));

// Allow your frontend origins (Vercel + localhost)

// CORS: allow https://*.vercel.app and local dev origins on localhost/127.0.0.1 any port
const allowedOrigins = [
  /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/, // https://*.vercel.app
  'https://app.elimulink.co.ke',
  'https://student.elimulink.co.ke',
  'https://institution.elimulink.co.ke',
  /^https:\/\/[a-zA-Z0-9-]+\.web\.app$/,
  /^https:\/\/[a-zA-Z0-9-]+\.firebaseapp\.com$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/app\.localhost:\d+$/,
  /^http:\/\/student\.localhost:\d+$/,
  /^http:\/\/institution\.localhost:\d+$/,
];

const corsOptions = {
  origin: function(origin, cb) {
    if (!origin) return cb(null, true); // allow non-browser tools
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return origin === allowed;
    });
    if (isAllowed) {
      console.log(`[CORS] Allowed: ${origin}`);
      return cb(null, true);
    }
    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs.toFixed(1)}ms)`);
  });
  next();
});

const PORT = process.env.PORT || 4000;
const APP_ID = process.env.VITE_APP_ID || 'elimulink-pro-v2';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error('AI_TIMEOUT');
      timeoutError.code = 'AI_TIMEOUT';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isAiTimeoutError(err) {
  return err?.code === 'AI_TIMEOUT' || err?.message === 'AI_TIMEOUT';
}

// Initialize Firebase Admin SDK once.
function initFirebaseAdminOnce() {
  if (admin.apps.length) return;

  const saJson = process.env.FIREBASE_ADMIN_SA;
  if (saJson) {
    try {
      const serviceAccount = JSON.parse(saJson);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return;
    } catch (e) {
      console.error('Failed to parse FIREBASE_ADMIN_SA:', e.message);
      return;
    }
  }

  // Fallback for GOOGLE_APPLICATION_CREDENTIALS
  try {
    const projectId = resolveFirebaseProjectId();
    admin.initializeApp(projectId ? { projectId } : undefined);
    console.log(`[AUTH] Firebase Admin initialized (projectId: ${projectId || 'auto-detect'})`);
  } catch (e) {
    console.warn('Firebase Admin not configured via FIREBASE_ADMIN_SA or GOOGLE_APPLICATION_CREDENTIALS');
  }
}
initFirebaseAdminOnce();

// Only initialize Firestore if the Firebase app was successfully initialized.
const db = (admin.apps && admin.apps.length) ? admin.firestore() : null;

// Shared Firebase ID token middleware for all authenticated API routes.
async function requireFirebaseAuth(req, res, next) {
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
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      claims: decoded,
    };
    return next();
  } catch (e) {
    console.error('requireFirebaseAuth error:', e?.message || e);
    return res.status(401).json({ error: 'Invalid/expired token' });
  }
}

function requireInstitutionAccess(req, res, next) {
  if (!req.user?.institutionId) {
    return res.status(403).json({ error: 'Institution access required' });
  }
  return next();
}

async function requireDepartmentAdminScope(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Missing auth user' });
    if (!db) return res.status(500).json({ error: 'Firestore not initialized on backend' });

    const profile = await getUserProfile(uid);
    const role = profile?.role || '';
    const institutionId = profile?.institutionId || null;
    const departmentId = profile?.departmentId || null;
    const allowedRoles = ['departmentAdmin', 'staff'];

    if (!allowedRoles.includes(role) || !institutionId || !departmentId) {
      return res.status(403).json({ error: 'Department admin scope required' });
    }

    req.scope = { institutionId, departmentId, role };
    return next();
  } catch (e) {
    console.error('requireDepartmentAdminScope error:', e);
    return res.status(500).json({ error: 'Failed to resolve department scope' });
  }
}

async function getUserProfile(uid) {
  const ref = db.doc(`artifacts/${APP_ID}/users/${uid}`);
  const snap = await ref.get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function isInstitutionLinked(profile) {
  const role = String(profile?.role || '');
  const institutionId = profile?.institutionId;
  if (!institutionId) return false;
  return role.startsWith('institution_') || role === 'institution_student' || role === 'institution_admin';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailDomain(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at < 0 || at === normalized.length - 1) return '';
  return normalized.slice(at + 1);
}

async function resolveInstitutionIdByDomain(domain) {
  if (!domain) return null;

  const mappedRef = db.doc(`domains/${domain}`);
  const mappedSnap = await mappedRef.get();
  if (mappedSnap.exists) {
    const mapped = mappedSnap.data() || {};
    if (mapped.institutionId) return String(mapped.institutionId);
  }

  const bySettings = await db
    .collection('institutions')
    .where('settings.domains', 'array-contains', domain)
    .limit(1)
    .get();
  if (!bySettings.empty) return bySettings.docs[0].id;

  return null;
}

async function hasInstitutionRegistryMembership({ institutionId, uid, normalizedEmailValue }) {
  if (!institutionId || !uid || !normalizedEmailValue) return false;

  const userRef = db.doc(`institutions/${institutionId}/registries/users/${uid}`);
  const userSnap = await userRef.get();
  if (userSnap.exists) return true;

  const emailRef = db.doc(`institutions/${institutionId}/registries/emails/${normalizedEmailValue}`);
  const emailSnap = await emailRef.get();
  return emailSnap.exists;
}

async function getStudentSnapshot(institutionId, uid) {
  const ref = db.doc(`institutions/${institutionId}/students/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    name: data.name || null,
    regNo: data.regNo || null,
    departmentId: data.departmentId || null,
    year: data.year || null,
  };
}

async function getFinanceSummary(institutionId, uid) {
  const ref = db.doc(`institutions/${institutionId}/finance/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    balance: data.balance ?? null,
    currency: data.currency || 'KES',
    lastPaymentAt: data.lastPaymentAt || null,
  };
}

async function getNextClasses(institutionId, uid) {
  const col = db.collection(`institutions/${institutionId}/timetable/${uid}/items`);
  const q = col.orderBy('startAt', 'asc').limit(5);
  const snaps = await q.get();
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getNotices(institutionId, departmentId) {
  const q = db.collection(`institutions/${institutionId}/announcements`).orderBy('createdAt', 'desc').limit(5);
  const snaps = await q.get();
  const all = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!departmentId) return all;
  return all.filter((n) => !n.departmentId || n.departmentId === departmentId).slice(0, 5);
}

async function getDepartmentsList(institutionId) {
  const snap = await db.collection(`institutions/${institutionId}/departments`).get();
  if (snap.empty) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

async function getLatestAnnouncements(institutionId) {
  const snap = await db
    .collection(`institutions/${institutionId}/announcements`)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();
  if (snap.empty) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanDepartmentId(raw, fallback = 'general') {
  const value = String(raw || '').trim();
  return value || fallback;
}

function buildDepartmentScopeList(departmentId) {
  const primary = cleanDepartmentId(departmentId);
  if (primary === 'general') return ['general'];
  return [primary, 'general'];
}

function isDepartmentAdminRole(role) {
  return role === 'departmentAdmin' || role === 'staff';
}

async function resolveInstitutionScope(uid, requestedDepartmentId, profileOverride = null) {
  if (!db) throw httpError(500, 'Firestore not initialized on backend');
  const profile = profileOverride || (await getUserProfile(uid));
  if (!profile?.institutionId) throw httpError(403, 'Institution access required');

  const role = String(profile.role || 'student_general');
  const profileDepartmentId = cleanDepartmentId(profile.departmentId, 'general');
  const departmentId = cleanDepartmentId(requestedDepartmentId, profileDepartmentId);

  if (isDepartmentAdminRole(role) && departmentId !== profileDepartmentId) {
    throw httpError(403, 'Department scope mismatch');
  }

  if (!isDepartmentAdminRole(role) && role !== 'institution_admin') {
    if (departmentId !== 'general' && departmentId !== profileDepartmentId) {
      throw httpError(403, 'Department scope mismatch');
    }
  }

  return {
    profile,
    uid,
    role,
    institutionId: profile.institutionId,
    departmentId,
    profileDepartmentId,
  };
}

function safeLibraryItem(item) {
  return {
    id: item.id,
    title: item.title || '',
    author: item.author || '',
    isbn: item.isbn || '',
    category: item.category || '',
    departmentId: item.departmentId || 'general',
    status: item.status || 'available',
    location: item.location || '',
    updatedAt: item.updatedAt || null,
  };
}

function matchesLibraryQuery(item, q) {
  const term = String(q || '').trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    item.title,
    item.author,
    item.isbn,
    item.category,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return haystack.includes(term);
}

function sortByUpdatedAtDesc(a, b) {
  const aSec = a?.updatedAt?._seconds ?? a?.updatedAt?.seconds ?? 0;
  const bSec = b?.updatedAt?._seconds ?? b?.updatedAt?.seconds ?? 0;
  return bSec - aSec;
}

async function fetchScopedLibraryItems(institutionId, departmentId, limitCount = 200) {
  const departments = buildDepartmentScopeList(departmentId);
  let queryRef = db.collection(`institutions/${institutionId}/libraryItems`);
  if (departments.length === 1) {
    queryRef = queryRef.where('departmentId', '==', departments[0]);
  } else {
    queryRef = queryRef.where('departmentId', 'in', departments);
  }
  const snap = await queryRef.limit(limitCount).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

async function fetchScopedAnnouncements(institutionId, departmentId, limitCount = 20) {
  const all = await getLatestAnnouncements(institutionId);
  const allowedDepartments = buildDepartmentScopeList(departmentId);
  return all
    .filter((a) => allowedDepartments.includes(cleanDepartmentId(a.departmentId, 'general')))
    .slice(0, limitCount);
}

function summarizeLibrary(items) {
  const countsByStatus = { available: 0, borrowed: 0, reserved: 0 };
  const categories = {};

  for (const item of items) {
    const status = String(item.status || 'available');
    if (countsByStatus[status] == null) countsByStatus[status] = 0;
    countsByStatus[status] += 1;

    const category = String(item.category || '').trim();
    if (category) categories[category] = (categories[category] || 0) + 1;
  }

  const latestItems = [...items].sort(sortByUpdatedAtDesc).slice(0, 5).map(safeLibraryItem);
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return { countsByStatus, latestItems, topCategories };
}

function normalizeCaseStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'resolved' || value === 'closed') return 'resolved';
  if (value === 'in progress' || value === 'in_progress' || value === 'reviewing') return 'in_progress';
  return 'open';
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentWeekKey() {
  const date = new Date();
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function parseWeekRange(weekKey) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekKey || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return { startMs: weekStart.getTime(), endMs: weekEnd.getTime() };
}

async function fetchScopedCases(institutionId, departmentId, limitCount = 400) {
  if (departmentId === 'all') {
    const snap = await db
      .collection(`institutions/${institutionId}/cases`)
      .orderBy('lastUpdated', 'desc')
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  const departments = buildDepartmentScopeList(departmentId);
  let queryRef = db.collection(`institutions/${institutionId}/cases`);
  if (departments.length === 1) {
    queryRef = queryRef.where('departmentId', '==', departments[0]);
  } else {
    queryRef = queryRef.where('departmentId', 'in', departments);
  }
  const snap = await queryRef.orderBy('lastUpdated', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

async function fetchMessagesForCases(institutionId, cases, perCaseLimit = 25) {
  const selected = Array.isArray(cases) ? cases.slice(0, 120) : [];
  const results = await Promise.all(
    selected.map(async (item) => {
      const snap = await db
        .collection(`institutions/${institutionId}/cases/${item.id}/messages`)
        .orderBy('createdAt', 'desc')
        .limit(perCaseLimit)
        .get();
      const messages = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      return { caseId: item.id, messages };
    }),
  );
  return results;
}

function summarizeCaseMetrics(cases, weekRange) {
  const totals = {
    totalCases: 0,
    openCases: 0,
    resolvedCases: 0,
    avgRating: 0,
    newCasesThisWeek: 0,
  };
  if (!Array.isArray(cases) || !cases.length) return totals;

  let ratingSum = 0;
  let ratingCount = 0;
  for (const c of cases) {
    totals.totalCases += 1;
    const normalizedStatus = normalizeCaseStatus(c.status);
    if (normalizedStatus === 'resolved') totals.resolvedCases += 1;
    if (normalizedStatus === 'open') totals.openCases += 1;

    const rating = Number(c.rating);
    if (Number.isFinite(rating) && rating > 0) {
      ratingSum += rating;
      ratingCount += 1;
    }

    const baselineTs = toMillis(c.createdAt) || toMillis(c.lastUpdated);
    if (baselineTs >= weekRange.startMs && baselineTs < weekRange.endMs) {
      totals.newCasesThisWeek += 1;
    }
  }
  totals.avgRating = ratingCount ? Number((ratingSum / ratingCount).toFixed(2)) : 0;
  return totals;
}

function safeCaseDigest(cases, messagesByCase, maxCases = 80) {
  const messageMap = new Map(messagesByCase.map((m) => [m.caseId, m.messages || []]));
  return cases.slice(0, maxCases).map((c) => {
    const msg = messageMap.get(c.id) || [];
    const sample = msg
      .slice(0, 3)
      .map((entry) => String(entry.text || '').replace(/\s+/g, ' ').trim().slice(0, 140))
      .filter(Boolean);
    return {
      caseId: c.id,
      studentId: c.studentId || null,
      status: normalizeCaseStatus(c.status),
      rating: c.rating || null,
      departmentId: c.departmentId || 'general',
      snippets: sample,
    };
  });
}

function tryParseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (e) {}
  }
  return null;
}

async function buildWeeklyReportInsights({ institutionId, departmentId, weekKey, metrics, caseDigest }) {
  if (!caseDigest.length) {
    return {
      topIssues: [],
      riskFlags: [],
      trends: [],
      recommendations: ["I don't have enough institutional data for that."],
    };
  }

  const system = `
You generate department-scoped weekly reports for institutions.
Rules:
1) Use only provided GROUNDING DATA.
2) Never invent institutional facts.
3) Output strict JSON only with keys: topIssues, riskFlags, trends, recommendations.
4) If data is insufficient, set recommendations to ["I don't have enough institutional data for that."].
`;
  const prompt = `
Create a weekly report insights JSON.
departmentId=${departmentId}
weekKey=${weekKey}
metrics=${JSON.stringify(metrics)}
GROUNDING DATA=${JSON.stringify({ institutionId, departmentId, cases: caseDigest })}
`;
  const raw = await callGeminiText({
    system,
    userMessage: prompt,
    institutionContext: { institutionId, departmentId, weekKey, metrics, caseDigest },
  });
  const parsed = tryParseJsonObject(raw);
  if (!parsed) {
    return {
      topIssues: [],
      riskFlags: [],
      trends: [],
      recommendations: ["I don't have enough institutional data for that."],
    };
  }
  return {
    topIssues: Array.isArray(parsed.topIssues) ? parsed.topIssues : [],
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
    trends: Array.isArray(parsed.trends) ? parsed.trends : [],
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length
      ? parsed.recommendations
      : ["I don't have enough institutional data for that."],
  };
}

async function getOrGenerateWeeklyReport({ scope, requestedDepartmentId, requestedWeekKey, force = false }) {
  const role = String(scope.role || '');
  const weekKey = requestedWeekKey || currentWeekKey();
  const weekRange = parseWeekRange(weekKey);
  if (!weekRange) throw httpError(400, 'Invalid weekKey format. Use YYYY-Www');

  let effectiveDepartmentId = scope.departmentId;
  if (role === 'institution_admin') {
    const candidate = String(requestedDepartmentId || 'general').trim().toLowerCase();
    effectiveDepartmentId = candidate === 'all' ? 'all' : cleanDepartmentId(candidate, 'general');
  }

  const reportRef = db.doc(`institutions/${scope.institutionId}/reports/${effectiveDepartmentId}/weekly/${weekKey}`);
  if (!force) {
    const existing = await reportRef.get();
    if (existing.exists) {
      return { generated: false, report: { id: existing.id, ...(existing.data() || {}) } };
    }
  }

  const scopedCases = await fetchScopedCases(scope.institutionId, effectiveDepartmentId, 400);
  const messagesByCase = await fetchMessagesForCases(scope.institutionId, scopedCases, 25);
  const metrics = summarizeCaseMetrics(scopedCases, weekRange);
  const caseDigest = safeCaseDigest(scopedCases, messagesByCase, 100);
  const insights = await buildWeeklyReportInsights({
    institutionId: scope.institutionId,
    departmentId: effectiveDepartmentId,
    weekKey,
    metrics,
    caseDigest,
  });

  const report = {
    institutionId: scope.institutionId,
    departmentId: effectiveDepartmentId,
    weekKey,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: scope.uid,
    scope: { role, departmentId: scope.departmentId },
    metrics,
    insights,
    compliance: { note: 'Department-scoped, read-only analysis' },
  };
  await reportRef.set(report, { merge: true });
  const saved = await reportRef.get();
  return { generated: true, report: { id: saved.id, ...(saved.data() || {}) } };
}

async function writeLibraryAudit({ institutionId, uid, role, departmentId, type, query }) {
  await db.collection(`institutions/${institutionId}/audits`).add({
    type,
    uid,
    role,
    departmentId: cleanDepartmentId(departmentId),
    query: String(query || ''),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function callGeminiText({ system, userMessage, institutionContext }) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `USER_MESSAGE:\n${userMessage}\n` },
          { text: `GROUNDING DATA:\n${JSON.stringify(institutionContext, null, 2)}\n` },
        ],
      },
    ],
    generationConfig: { temperature: 0.4 },
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, AI_TIMEOUT_MS);

  const data = await response.json();
  if (!response.ok) {
    console.error('Gemini error:', data);
    throw new Error(data?.error?.message || 'Gemini request failed');
  }

  return (
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
    "I couldn't generate a response."
  );
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
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

async function generateImageFromOpenAI(prompt) {
  const r = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 })
  }, AI_TIMEOUT_MS);
  const data = await r.json().catch(() => ({}));
  const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.b64_image;
  if (!r.ok) {
    const msg = data?.error?.message || `Image provider error: ${r.status}`;
    throw new Error(msg);
  }
  if (!b64) {
    throw new Error('No image returned');
  }
  return `data:image/png;base64,${b64}`;
}

async function generateSpeechFromGemini(text, voiceName = 'Kore') {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY not set on backend');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`;
  const r = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: String(text || '').slice(0, 300) }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: String(voiceName || 'Kore') }
          }
        }
      }
    }),
  }, AI_TIMEOUT_MS);

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini TTS error: ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

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
    const image = await generateImageFromOpenAI(prompt);
    return res.json({ image });
  } catch (e) {
    console.error('Image error', e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/image', requireFirebaseAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'Image generation key missing on backend. Set OPENAI_API_KEY.' });
  }
  try {
    const image = await generateImageFromOpenAI(prompt);
    return res.json({ ok: true, image });
  } catch (e) {
    console.error('[ERROR] /api/ai/image', e.message);
    if (isAiTimeoutError(e)) {
      return res.status(504).json({ ok: false, error: 'AI_TIMEOUT' });
    }
    return res.status(502).json({ error: e.message });
  }
});

app.post('/api/ai/tts', requireFirebaseAuth, async (req, res) => {
  const { text, voiceName } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  try {
    const tts = await generateSpeechFromGemini(text, voiceName);
    const audioBase64 = tts?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    return res.json({ ok: true, audioBase64, tts });
  } catch (e) {
    console.error('[ERROR] /api/ai/tts', e.message);
    if (isAiTimeoutError(e)) {
      return res.status(504).json({ ok: false, error: 'AI_TIMEOUT' });
    }
    return res.status(502).json({ error: e.message });
  }
});

// Student image endpoint (requires Firebase user token)
app.post('/api/image/student', requireFirebaseAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'Image generation key missing on backend. Set OPENAI_API_KEY.' });
  }
  try {
    const image = await generateImageFromOpenAI(prompt);
    return res.json({ ok: true, image });
  } catch (e) {
    console.error('[ERROR] /api/image/student', e.message);
    if (isAiTimeoutError(e)) {
      return res.status(504).json({ ok: false, error: 'AI_TIMEOUT' });
    }
    return res.status(502).json({ error: e.message });
  }
});

app.get('/api/library/search', requireFirebaseAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const requestedDepartmentId = req.query.departmentId;
    const scope = await resolveInstitutionScope(req.user.uid, requestedDepartmentId);
    const items = await fetchScopedLibraryItems(scope.institutionId, scope.departmentId, 250);
    const filtered = items
      .filter((item) => matchesLibraryQuery(item, q))
      .sort(sortByUpdatedAtDesc)
      .slice(0, 80)
      .map(safeLibraryItem);

    await writeLibraryAudit({
      institutionId: scope.institutionId,
      uid: scope.uid,
      role: scope.role,
      departmentId: scope.departmentId,
      type: 'library_search',
      query: q,
    });

    return res.json({
      ok: true,
      departmentId: scope.departmentId,
      count: filtered.length,
      items: filtered,
    });
  } catch (e) {
    console.error('GET /api/library/search error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
});

app.get('/api/library/summary', requireFirebaseAuth, async (req, res) => {
  try {
    const requestedDepartmentId = req.query.departmentId;
    const scope = await resolveInstitutionScope(req.user.uid, requestedDepartmentId);
    const items = await fetchScopedLibraryItems(scope.institutionId, scope.departmentId, 250);
    const summary = summarizeLibrary(items);

    await writeLibraryAudit({
      institutionId: scope.institutionId,
      uid: scope.uid,
      role: scope.role,
      departmentId: scope.departmentId,
      type: 'library_summary',
      query: scope.departmentId,
    });

    return res.json({
      ok: true,
      departmentId: scope.departmentId,
      ...summary,
    });
  } catch (e) {
    console.error('GET /api/library/summary error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
});

app.get('/api/announcements/latest', requireFirebaseAuth, async (req, res) => {
  try {
    const requestedDepartmentId = req.query.departmentId;
    const scope = await resolveInstitutionScope(req.user.uid, requestedDepartmentId);
    const announcements = await fetchScopedAnnouncements(scope.institutionId, scope.departmentId, 10);
    return res.json({ ok: true, departmentId: scope.departmentId, announcements });
  } catch (e) {
    console.error('GET /api/announcements/latest error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
});

app.get('/api/reports/weekly', requireFirebaseAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    const requestedDepartmentId = req.query.departmentId;
    const requestedWeekKey = String(req.query.weekKey || '').trim() || currentWeekKey();
    const scope = await resolveInstitutionScope(req.user.uid, requestedDepartmentId, profile);
    const result = await getOrGenerateWeeklyReport({
      scope,
      requestedDepartmentId,
      requestedWeekKey,
      force: false,
    });
    return res.json({ ok: true, generated: result.generated, report: result.report });
  } catch (e) {
    console.error('GET /api/reports/weekly error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
});

app.post('/api/reports/weekly/generate', requireFirebaseAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    const requestedDepartmentId = req.body?.departmentId;
    const requestedWeekKey = String(req.body?.weekKey || '').trim() || currentWeekKey();
    const scope = await resolveInstitutionScope(req.user.uid, requestedDepartmentId, profile);
    const result = await getOrGenerateWeeklyReport({
      scope,
      requestedDepartmentId,
      requestedWeekKey,
      force: true,
    });
    return res.json({ ok: true, generated: true, report: result.report });
  } catch (e) {
    console.error('POST /api/reports/weekly/generate error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
});

// Student AI endpoint
app.post('/api/ai/student', requireFirebaseAuth, async (req, res) => {
  const { text, region, userName, aiTone, useGoogleSearch } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  console.log(`[API] /api/ai/student - User: ${req.user.uid}, Region: ${region}`);

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error('[ERROR] GEMINI_API_KEY not set on backend');
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    console.log(`[API] Calling Gemini: ${url.substring(0, 50)}...`);
    
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        tools: useGoogleSearch ? [{ google_search: {} }] : [],
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }),
    }, AI_TIMEOUT_MS);

    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      console.error(`[ERROR] Gemini API returned ${r.status}:`, errorData);
      return res.status(r.status).json({ error: `Gemini API error: ${r.status}`, details: errorData });
    }

    const data = await r.json();

    if (!data.candidates || data.candidates.length === 0) {
      console.error('[ERROR] Gemini returned no candidates:', data);
      return res.status(500).json({ error: 'Gemini returned empty response' });
    }

    const aiText =
      data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response.';

    console.log(`[API] Gemini responded successfully (${aiText.length} chars)`);
    return res.json({ ok: true, text: aiText, raw: undefined });
  } catch (e) {
    console.error('[ERROR] /api/ai/student exception:', e.message);
    if (isAiTimeoutError(e)) {
      return res.status(504).json({ ok: false, error: 'AI_TIMEOUT' });
    }
    return res.status(500).json({ error: e.message });
  }
});

// Unified chat endpoint (global + institution context)
app.post('/api/chat', requireFirebaseAuth, async (req, res) => {
  try {
    const { message, mode, departmentId, institutionContext: incomingContext } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!db) {
      return res.status(500).json({ error: 'Firestore not initialized on backend' });
    }

    const profile = await getUserProfile(req.user.uid);
    const role = profile?.role || 'student_general';
    const institutionId = profile?.institutionId || null;
    const useInstitution = Boolean(institutionId);
    const sourcesUsed = { global: true, institution: useInstitution };

    let institutionContext = {};
    if (useInstitution) {
      const scope = await resolveInstitutionScope(req.user.uid, departmentId, profile);
      const departments = await getDepartmentsList(institutionId).catch(() => []);
      const announcements = await fetchScopedAnnouncements(institutionId, scope.departmentId, 10).catch(() => []);
      const scopedLibraryItems = await fetchScopedLibraryItems(institutionId, scope.departmentId, 250).catch(() => []);
      const librarySummary = summarizeLibrary(scopedLibraryItems);
      institutionContext = {
        institutionId,
        role: scope.role,
        departmentId: scope.departmentId,
        departments,
        announcements,
        library: librarySummary,
        libraryResults: Array.isArray(incomingContext?.libraryResults) ? incomingContext.libraryResults.slice(0, 50) : [],
        departmentMode: mode || null,
      };
    } else {
      institutionContext = {
        institutionId: null,
        role,
        note: 'No institution-linked access. Do not invent institution facts.',
      };
    }

    const system = `
You are ElimuLink AI. Be brief, smooth, and clear.
Rules:
1) Global knowledge is allowed.
2) Institutional facts MUST come only from GROUNDING DATA.
3) If a needed record is missing/null, reply exactly: "I don't have enough institutional data for that."
4) If user asks for fees/timetable/results and context is missing, do NOT guess.
5) Provide 2-4 helpful follow-up options at the end (bullets).
`;

    const text = await callGeminiText({
      system,
      userMessage: message,
      institutionContext,
    });

    return res.json({
      text,
      sourcesUsed,
      role,
      institutionId,
    });
  } catch (err) {
    console.error('POST /api/chat error:', err);
    if (isAiTimeoutError(err)) {
      return res.status(504).json({ ok: false, error: 'AI_TIMEOUT' });
    }
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/auth/post-login-sync', requireFirebaseAuth, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firestore not initialized on backend' });

    const uid = req.user?.uid;
    const email = normalizeEmail(req.user?.email);
    if (!uid) return res.status(400).json({ error: 'Missing uid in token' });
    if (!email) return res.status(400).json({ error: 'Email is required on Firebase user token' });

    const domain = emailDomain(email);
    const institutionId = await resolveInstitutionIdByDomain(domain);

    let role = 'student_general';
    let resolvedInstitutionId = null;
    let subscriptionActive = false;

    if (institutionId) {
      const institutionRef = db.doc(`institutions/${institutionId}`);
      const institutionSnap = await institutionRef.get();
      const institutionData = institutionSnap.exists ? institutionSnap.data() : {};
      subscriptionActive = institutionData?.subscriptionActive === true;

      if (subscriptionActive) {
        const member = await hasInstitutionRegistryMembership({
          institutionId,
          uid,
          normalizedEmailValue: email,
        });
        if (member) {
          role = 'institution_student';
          resolvedInstitutionId = institutionId;
          subscriptionActive = true;
        }
      }
    }

    await db.doc(`artifacts/${APP_ID}/users/${uid}`).set(
      {
        role,
        institutionId: resolvedInstitutionId,
        subscriptionActive,
        email,
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return res.json({
      role,
      institutionId: resolvedInstitutionId,
      subscriptionActive,
    });
  } catch (err) {
    console.error('POST /api/auth/post-login-sync error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

function normalizeActivationRole(rawRole) {
  const value = String(rawRole || '').trim();
  if (!value) return 'staff';
  return value;
}

function normalizeActivationKey(value) {
  return String(value || '').trim().toUpperCase();
}

function hashActivationKey(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function isActivationKeyInactive(payload = {}) {
  if (payload.isActive === false) return true;
  const status = String(payload.status || '').toLowerCase();
  return status === 'revoked' || status === 'disabled' || status === 'inactive';
}

function isActivationKeyUsed(payload = {}) {
  if (payload.usedAt || payload.usedByUid || payload.consumed === true) return true;
  const status = String(payload.status || '').toLowerCase();
  return status === 'used' || status === 'redeemed' || status === 'completed';
}

function isActivationKeyExpired(payload = {}) {
  const raw = payload.expiresAt;
  if (!raw) return false;
  const expiresMs =
    typeof raw?.toMillis === 'function'
      ? raw.toMillis()
      : typeof raw?.seconds === 'number'
        ? raw.seconds * 1000
        : typeof raw?._seconds === 'number'
          ? raw._seconds * 1000
          : Date.parse(String(raw));
  if (!Number.isFinite(expiresMs)) return false;
  return Date.now() > expiresMs;
}

async function findActivationKeyByInput(accessKey) {
  const key = normalizeActivationKey(accessKey);
  if (!key) return null;

  const keyHash = hashActivationKey(key);
  const byHash = await db
    .collection('artifacts')
    .doc(APP_ID)
    .collection('adminActivationKeys')
    .where('keyHash', '==', keyHash)
    .limit(1)
    .get();
  if (!byHash.empty) return byHash.docs[0];

  // Legacy/plaintext fallback for previously-seeded docs.
  const byPlain = await db
    .collection('artifacts')
    .doc(APP_ID)
    .collection('adminActivationKeys')
    .where('key', '==', key)
    .limit(1)
    .get();
  if (!byPlain.empty) return byPlain.docs[0];

  return null;
}

app.post('/api/auth/redeem-admin-key', async (req, res) => {
  try {
    const { accessKey } = req.body || {};
    if (!accessKey) return res.status(400).json({ error: 'accessKey is required' });
    if (!db) return res.status(500).json({ error: 'Firestore not initialized on backend' });
    if (!admin.apps?.length) return res.status(500).json({ error: 'Firebase Admin not configured' });
    if (!ADMIN_JWT_SECRET) return res.status(500).json({ error: 'ADMIN_JWT_SECRET not configured' });

    const keyDoc = await findActivationKeyByInput(accessKey);
    if (!keyDoc?.exists) return res.status(404).json({ error: 'Invalid activation key' });

    const redeemed = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(keyDoc.ref);
      if (!freshSnap.exists) throw httpError(404, 'Invalid activation key');
      const data = freshSnap.data() || {};

      if (isActivationKeyInactive(data)) throw httpError(403, 'Activation key is inactive');
      if (isActivationKeyUsed(data)) throw httpError(409, 'Activation key already used');
      if (isActivationKeyExpired(data)) throw httpError(410, 'Activation key expired');

      const activationNonce = crypto.randomBytes(16).toString('hex');
      tx.set(
        keyDoc.ref,
        {
          status: 'redeemed',
          redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          consumed: true,
          activationNonce,
          activationExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
        },
        { merge: true },
      );

      return {
        keyId: freshSnap.id,
        activationNonce,
        institutionId: data.institutionId || null,
        institutionName: data.institutionName || null,
        departmentId: data.departmentId || null,
        departmentName: data.departmentName || null,
        role: normalizeActivationRole(data.role),
        email: normalizeEmail(data.email),
        fullName: String(data.fullName || data.displayName || '').trim() || null,
      };
    });

    if (!redeemed.email) {
      return res.status(500).json({ error: 'Activation key is missing email identity' });
    }

    const activationToken = jwt.sign(
      {
        type: 'admin_activation',
        keyId: redeemed.keyId,
        activationNonce: redeemed.activationNonce,
        email: redeemed.email,
        institutionId: redeemed.institutionId,
        departmentId: redeemed.departmentId,
        role: redeemed.role,
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '30m' },
    );

    return res.json({
      ok: true,
      activationToken,
      activation: {
        institutionId: redeemed.institutionId,
        institutionName: redeemed.institutionName,
        departmentId: redeemed.departmentId,
        departmentName: redeemed.departmentName,
        role: redeemed.role,
        email: redeemed.email,
        fullName: redeemed.fullName,
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    console.error('POST /api/auth/redeem-admin-key error:', err);
    return res.status(status).json({ error: err?.message || 'Server error' });
  }
});

app.post('/api/auth/complete-admin-activation', async (req, res) => {
  try {
    const { activationToken, password, fullName } = req.body || {};
    if (!activationToken) return res.status(400).json({ error: 'activationToken is required' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!db) return res.status(500).json({ error: 'Firestore not initialized on backend' });
    if (!admin.apps?.length) return res.status(500).json({ error: 'Firebase Admin not configured' });
    if (!ADMIN_JWT_SECRET) return res.status(500).json({ error: 'ADMIN_JWT_SECRET not configured' });

    let payload;
    try {
      payload = jwt.verify(activationToken, ADMIN_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired activation token' });
    }

    if (payload?.type !== 'admin_activation' || !payload?.keyId || !payload?.activationNonce) {
      return res.status(400).json({ error: 'Invalid activation token payload' });
    }

    const keyRef = db
      .collection('artifacts')
      .doc(APP_ID)
      .collection('adminActivationKeys')
      .doc(String(payload.keyId));
    const keySnap = await keyRef.get();
    if (!keySnap.exists) return res.status(404).json({ error: 'Activation key record not found' });
    const keyData = keySnap.data() || {};

    if (keyData.activationNonce !== payload.activationNonce) {
      return res.status(403).json({ error: 'Activation token no longer valid' });
    }
    if (String(keyData.status || '').toLowerCase() === 'completed' || keyData.activationCompletedAt) {
      return res.status(409).json({ error: 'Activation already completed' });
    }
    if (isActivationKeyExpired({ expiresAt: keyData.activationExpiresAt })) {
      return res.status(410).json({ error: 'Activation token expired' });
    }

    const email = normalizeEmail(payload.email || keyData.email);
    if (!email) return res.status(500).json({ error: 'Activation identity email missing' });

    let existingUser = null;
    try {
      existingUser = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') {
        throw err;
      }
    }
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists. Continue with normal login.' });
    }

    const displayName = String(fullName || keyData.fullName || payload.fullName || '').trim() || null;
    const created = await admin.auth().createUser({
      email,
      password: String(password),
      ...(displayName ? { displayName } : {}),
    });

    const institutionId = keyData.institutionId || payload.institutionId || null;
    const role = normalizeActivationRole(keyData.role || payload.role);
    const departmentId = keyData.departmentId || payload.departmentId || null;
    await db.doc(`artifacts/${APP_ID}/users/${created.uid}`).set(
      {
        email,
        role,
        institutionId,
        departmentId,
        displayName: displayName || null,
        name: displayName || null,
        staffCodeVerified: true,
        activatedFromKeyId: keySnap.id,
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await keyRef.set(
      {
        status: 'completed',
        activationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedByUid: created.uid,
        usedByEmail: email,
      },
      { merge: true },
    );

    return res.json({
      ok: true,
      message: 'Activation completed. Use your email and password to sign in.',
      email,
      role,
      institutionId,
      departmentId,
    });
  } catch (err) {
    console.error('POST /api/auth/complete-admin-activation error:', err);
    return res.status(err?.status || 500).json({ error: err?.message || 'Server error' });
  }
});

app.post('/api/auth/verify-staff-code', requireFirebaseAuth, async (req, res) => {
  try {
    const { staffCode } = req.body || {};
    if (!staffCode) return res.status(400).json({ error: 'staffCode is required' });
    if (!db) return res.status(500).json({ error: 'Firestore not initialized on backend' });

    const profile = await getUserProfile(req.user.uid);
    const institutionId = req.user?.institutionId || profile?.institutionId;
    if (!institutionId) return res.status(403).json({ error: 'Institution access required' });

    const secRef = db.doc(`institutions/${institutionId}/settings/security`);
    const secSnap = await secRef.get();
    if (!secSnap.exists) return res.status(404).json({ error: 'Security settings not found' });

    const stored = secSnap.data().staffCode;
    if (!stored) return res.status(500).json({ error: 'No staffCode configured in Firestore' });
    if (String(staffCode).trim() !== String(stored).trim()) {
      return res.status(401).json({ error: 'Invalid staff code' });
    }

    const uRef = db.doc(`artifacts/${APP_ID}/users/${req.user.uid}`);
    await uRef.set({ role: 'staff', staffCodeVerified: true }, { merge: true });

    return res.json({ status: 'ok', newRole: 'staff', institutionId });
  } catch (e) {
    console.error('verify-staff-code error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.get('/api/admin/cases', requireFirebaseAuth, requireDepartmentAdminScope, async (req, res) => {
  try {
    const { institutionId, departmentId } = req.scope;
    const snap = await db
      .collection(`institutions/${institutionId}/cases`)
      .where('departmentId', '==', departmentId)
      .orderBy('lastUpdated', 'desc')
      .limit(100)
      .get();
    const cases = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, cases });
  } catch (e) {
    console.error('GET /api/admin/cases error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.get('/api/admin/cases/:caseId', requireFirebaseAuth, requireDepartmentAdminScope, async (req, res) => {
  try {
    const { institutionId, departmentId } = req.scope;
    const caseRef = db.doc(`institutions/${institutionId}/cases/${req.params.caseId}`);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) return res.status(404).json({ error: 'Case not found' });
    const caseData = caseSnap.data() || {};
    if (caseData.departmentId !== departmentId) return res.status(403).json({ error: 'Out-of-scope case' });

    const msgSnap = await db
      .collection(`institutions/${institutionId}/cases/${req.params.caseId}/messages`)
      .where('departmentId', '==', departmentId)
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, case: { id: caseSnap.id, ...caseData }, messages });
  } catch (e) {
    console.error('GET /api/admin/cases/:caseId error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.post('/api/admin/cases/:caseId/remarks', requireFirebaseAuth, requireDepartmentAdminScope, async (req, res) => {
  try {
    const { institutionId, departmentId } = req.scope;
    const { text, visibility = 'internal', sentiment, tags } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });

    const caseRef = db.doc(`institutions/${institutionId}/cases/${req.params.caseId}`);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) return res.status(404).json({ error: 'Case not found' });
    const caseData = caseSnap.data() || {};
    if (caseData.departmentId !== departmentId) return res.status(403).json({ error: 'Out-of-scope case' });

    await db.collection(`institutions/${institutionId}/cases/${req.params.caseId}/messages`).add({
      from: 'admin',
      text: String(text),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      departmentId,
      visibility,
      ...(sentiment ? { sentiment } : {}),
      ...(tags ? { tags } : {}),
    });
    await caseRef.set({ lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/cases/:caseId/remarks error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});


// Health check endpoint for Render
app.get('/health', (req, res) => res.status(200).send('ok'));

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

app.use((err, req, res, next) => {
  console.error('[EXPRESS_ERROR]', err?.stack || err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ ok: false, error: 'INTERNAL_SERVER_ERROR' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err);
});

const server = app.listen(PORT, () => {
  console.log(`[SERVER] ElimuLink API listening on port ${PORT}`);
  console.log(`[CONFIG] Firebase Admin: ${db ? 'initialized' : 'NOT configured'}`);
  console.log(`[CONFIG] Gemini API: ${process.env.GEMINI_API_KEY ? 'set' : 'NOT configured'}`);
  console.log(`[CONFIG] OpenAI API: ${OPENAI_KEY ? 'set' : 'not configured'}`);
});
server.timeout = Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 120000);
server.keepAliveTimeout = Number(process.env.SERVER_KEEPALIVE_TIMEOUT_MS || 65000);
server.headersTimeout = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 70000);
