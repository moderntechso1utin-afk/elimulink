import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, getDoc, updateDoc, serverTimestamp, addDoc, query, orderBy } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

function envValue(key) {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === null) return raw;
  const trimmed = String(raw).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const firebaseConfig = {
  apiKey: envValue('VITE_FIREBASE_API_KEY'),
  authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: envValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: envValue('VITE_FIREBASE_APP_ID'),
  measurementId: envValue('VITE_FIREBASE_MEASUREMENT_ID'),
};

const firebaseEnvVarMap = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
  VITE_FIREBASE_MEASUREMENT_ID: firebaseConfig.measurementId,
};

const missingFirebaseVars = Object.entries(firebaseEnvVarMap)
  .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
  .map(([key]) => key);

if (missingFirebaseVars.length > 0) {
  console.error(`[FIREBASE] Missing Firebase env vars: ${missingFirebaseVars.join(', ')}`);
}

let app = null;
let db = null;
let auth = null;
let firebaseInitError = null;

if (missingFirebaseVars.length === 0) {
  try {
    console.log("FIREBASE projectId:", firebaseConfig.projectId);
    console.log("FIREBASE authDomain:", firebaseConfig.authDomain);
    console.log("FIREBASE apiKey first10:", (firebaseConfig.apiKey || "").slice(0, 10));
    console.log("FIREBASE apiKey last6:", (firebaseConfig.apiKey || "").slice(-6));
    console.log("USING FIREBASE API KEY:", envValue('VITE_FIREBASE_API_KEY'));
    console.log("USING AUTH DOMAIN:", envValue('VITE_FIREBASE_AUTH_DOMAIN'));
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    firebaseInitError = String(error?.message || error);
    console.error('[FIREBASE] Initialization failed:', firebaseInitError);
  }
}

export { app, db, auth };
export const appId = import.meta.env.VITE_APP_ID || 'elimulink-pro-v2';
export const firebaseMissingEnvVars = missingFirebaseVars;
export const firebaseInitErrorMessage = firebaseInitError;
