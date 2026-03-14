import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import App from '../App.jsx';
import InstitutionApp from '../institution/InstitutionApp.jsx';
import StudentApp from '../student/StudentApp.jsx';
import InstitutionActivatePage from '../pages/InstitutionActivatePage.jsx';
import { auth, db, firebaseInitErrorMessage } from '../lib/firebase';
import { apiUrl } from '../lib/apiUrl';
import { getResolvedHostMode } from './hostMode';

const APP_ID = import.meta.env.VITE_APP_ID || 'elimulink-pro-v2';
const INSTITUTION_EMAIL_DOMAIN = String(import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'elimulink.co.ke').toLowerCase();
const DEBUG_HOST_ROUTER = import.meta.env.DEV && String(import.meta.env.VITE_DEBUG_HOST_ROUTER || '').trim() === '1';
// const INSTITUTION_FALLBACK_ID = String(import.meta.env.VITE_INSTITUTION_ID || 'YOUR_INSTITUTION_ID');
const INSTITUTION_FALLBACK_ID = String(import.meta.env.VITE_INSTITUTION_ID || 'YOUR_INSTITUTION_ID');

function hostLog(...args) {
  if (DEBUG_HOST_ROUTER) console.log(...args);
}

function shouldBackfillInstitutionProfile(nextUser, profile) {
  const email = String(nextUser?.email || '').trim().toLowerCase();
  const matchesDomain = email.endsWith(`@${INSTITUTION_EMAIL_DOMAIN}`);
  if (!matchesDomain) return false;
  const missingRole = !profile?.role || profile?.role === 'public' || profile?.role === 'student_general';
  return missingRole;
}

function profileDisplayName(profile, user) {
  const value = profile?.displayName || profile?.name || user?.displayName || '';
  return String(value).trim();
}

function isProfileComplete(profile, user) {
  return Boolean(profileDisplayName(profile, user));
}

function replacePath(targetPath, setPathname) {
  if (window.location.pathname === targetPath) return;
  window.history.replaceState({}, '', targetPath);
  setPathname(targetPath);
}

function getModeBaseUrl(mode, currentHostname = window.location.hostname) {
  const host = String(currentHostname || '').toLowerCase();
  const isLocal = host.endsWith('.localhost') || host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    const localBaseMap = {
      public: 'http://app.localhost:3000',
      student: 'http://student.localhost:3000',
      institution: 'http://institution.localhost:3000',
    };
    return localBaseMap[mode];
  }

  const isFirebaseDefaultHost = host.includes('.web.app') || host.includes('.firebaseapp.com');
  if (isFirebaseDefaultHost) {
    const firebaseBaseMap = {
      public: 'https://elimulink-app-ai.web.app',
      student: 'https://elimulink-student.web.app',
      institution: 'https://elimulink-institution.web.app',
    };
    return firebaseBaseMap[mode];
  }

  const customBaseMap = {
    public: 'https://app.elimulink.co.ke',
    student: 'https://student.elimulink.co.ke',
    institution: 'https://institution.elimulink.co.ke',
  };
  return customBaseMap[mode];
}

function getModeUrl(mode) {
  return `${getModeBaseUrl(mode)}/${mode}`;
}

function getBaseOrigin(modeUrl, mode) {
  return String(modeUrl || '').replace(new RegExp(`/${mode}$`), '');
}

function getDefaultModePath(mode) {
  return `/${mode || 'public'}`;
}

function sanitizeReturnTo(returnToRaw, { mode, isAuthenticated = false } = {}) {
  const fallback = getDefaultModePath(mode);
  const raw = String(returnToRaw || '').trim();
  if (!raw || raw === '/' || raw === 'null' || raw === 'undefined') return fallback;

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch (_) {
    value = raw;
  }

  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  if (value.startsWith('/login')) return fallback;
  if (value.includes('/onboarding?returnTo=')) return fallback;
  return value;
}

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading...
    </div>
  );
}

function PublicApp({ modeUrls }) {
  return <App hostMode="public" modeUrls={modeUrls} />;
}

function LoginPage({
  mode,
  hostMode,
  profile,
  user,
  authReady,
  onAuthSuccess,
  onCompleteOnboarding,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(profileDisplayName(profile, user));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signup, setSignup] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const navigate = (nextPath) => {
    window.history.replaceState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get('message');
    const incomingReturnTo = params.get('returnTo') || '';
    if (message) setNotice(message);
    setReturnTo(sanitizeReturnTo(incomingReturnTo, { mode: hostMode, isAuthenticated: Boolean(user && !user.isAnonymous) }));
  }, []);

  const normalizeAuthError = (err) => {
    const code = String(err?.code || '');
    const message = String(err?.message || '');
    if (code.includes('auth/operation-not-allowed')) {
      return 'Firebase Auth provider disabled. Enable Email/Password and Google in Firebase Console.';
    }
    if (code.includes('auth/popup-closed-by-user')) {
      return 'Google sign-in was cancelled.';
    }
    return message || 'Authentication failed.';
  };

  const runPostLoginSync = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(apiUrl('/api/auth/post-login-sync'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Post-login sync failed');
    return data;
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      let credential = null;
      if (signup) {
        credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(credential.user, { displayName: fullName.trim() });
        }
        await sendEmailVerification(credential.user);
        setNotice('Check your email to verify your account.');
      } else {
        credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const synced = await runPostLoginSync(credential.user);
      await onAuthSuccess(synced, returnTo);
    } catch (err) {
      setError(normalizeAuthError(err));
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setPending(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const synced = await runPostLoginSync(credential.user);
      await onAuthSuccess(synced, returnTo);
    } catch (err) {
      setError(normalizeAuthError(err));
    } finally {
      setPending(false);
    }
  };

  if (mode === 'onboarding') {
    const canContinue = authReady && !!user && !pending;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-slate-900 p-6">
          <h1 className="text-lg font-bold">Complete your profile</h1>
          <p className="text-sm text-slate-300 mt-2">Your full name is required before continuing.</p>
          {!authReady ? <div className="mt-3 text-xs text-slate-400">Loading...</div> : null}
          {authReady && !user ? (
            <div className="mt-3 rounded bg-amber-900/40 border border-amber-500/40 px-3 py-2 text-xs">
              Please login again.
              <a
                className="ml-2 underline text-amber-200"
                href={`/login?returnTo=${encodeURIComponent(sanitizeReturnTo('/onboarding', { mode: hostMode, isAuthenticated: false }))}`}
              >
                Login
              </a>
            </div>
          ) : null}
          {error && <div className="mt-3 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-xs">{error}</div>}
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!authReady) {
                setError('Loading...');
                return;
              }
              if (!user) {
                // isAuthenticated: false
                const nextReturnTo = sanitizeReturnTo('/', { mode: hostMode, isAuthenticated:  true});
                window.location.replace(`/login?returnTo=${encodeURIComponent(nextReturnTo)}`);
                return;
              }
              setPending(true);
              setError('');
              try {
                await onCompleteOnboarding(fullName.trim(), returnTo);
              } catch (err) {
                setError(String(err?.message || err || 'Failed to save profile'));
              } finally {
                setPending(false);
              }
            }}
          >
            <input
              className="w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <button
              className="w-full rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={!canContinue}
            >
              {pending ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl border border-white/10 bg-slate-900 p-6">
        <h1 className="text-lg font-bold">{signup ? 'Create account' : 'Sign in to continue'}</h1>
        <p className="text-sm text-slate-300 mt-2">
          Access on <span className="font-mono">{hostMode}.elimulink.co.ke</span> requires login.
        </p>
        {notice && <div className="mt-3 rounded bg-amber-900/40 border border-amber-500/40 px-3 py-2 text-xs">{notice}</div>}
        {error && <div className="mt-3 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-xs">{error}</div>}
        <form className="mt-4 space-y-3" onSubmit={handleEmailAuth}>
          {signup ? (
            <input
              className="w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          ) : null}
          <input
            className="w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Password"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Please wait...' : signup ? 'Sign up' : 'Sign in'}
          </button>
        </form>
        <button
          className="mt-3 w-full rounded bg-white/10 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={handleGoogle}
          disabled={pending}
          type="button"
        >
          Continue with Google
        </button>
        <button
          className="mt-3 w-full text-xs text-slate-300 underline"
          type="button"
          onClick={() => setSignup((prev) => !prev)}
        >
          {signup ? 'Already have an account? Sign in' : "New here? Create account"}
        </button>
        {!signup ? (
          <button
            className="mt-2 w-full text-xs text-slate-300 underline"
            type="button"
            onClick={async () => {
              setError('');
              setNotice('');
              try {
                if (!email.trim()) throw new Error('Enter your email first.');
                await sendPasswordResetEmail(auth, email.trim());
                setNotice('Password reset email sent. Check your inbox.');
              } catch (err) {
                setError(normalizeAuthError(err));
              }
            }}
          >
            Forgot password?
          </button>
        ) : null}
        {hostMode === 'institution' ? (
          <button
            className="mt-2 w-full text-xs text-slate-300 underline"
            type="button"
            onClick={() => navigate('/institution/activate')}
          >
            First-time staff/admin activation
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function HostRouter() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [flashMessage, setFlashMessage] = useState('');
  const handledInitialRedirect = useRef(false);
  const authStateLogged = useRef(false);
  const hostRouteLogged = useRef(false);

  const hostMode = useMemo(
    () => getResolvedHostMode(window.location.hostname),
    [],
  );

  useEffect(() => {
    hostLog('[HOST_MODE]', { host: window.location.host, mode: hostMode });
  }, [hostMode]);

  useEffect(() => {
    if (hostRouteLogged.current) return;
    hostLog('[HOST_MODE_ROUTE]', { host: window.location.host, hostMode, pathname });
    hostRouteLogged.current = true;
  }, [hostMode, pathname]);

  const modeUrls = useMemo(
    () => ({
      public: getModeUrl('public'),
      student: getModeUrl('student'),
      institution: getModeUrl('institution'),
    }),
    [],
  );

  const navigateToModePath = (mode, path) => {
    const targetPath = path || `/${mode}`;
    if (mode === hostMode) {
      replacePath(targetPath, setPathname);
      return;
    }
    const baseOrigin = getModeBaseUrl(mode);
    window.location.replace(`${baseOrigin}${targetPath}`);
  };

  const resolvePostAuthTarget = (_nextProfile, returnToRaw = '') => {
    const mode = hostMode;
    const returnTo = sanitizeReturnTo(returnToRaw, { mode, isAuthenticated: true });
    const modePrefix = `/${mode}`;
    if (returnTo && returnTo.startsWith(modePrefix)) return { mode, path: returnTo };
    return { mode, path: modePrefix };
  };

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (authStateLogged.current) return;
    if (!authReady) return;
    hostLog("AUTH_STATE", { authReady, uid: user?.uid || null, host: window.location.host });
    authStateLogged.current = true;
  }, [authReady, user]);

  useEffect(() => {
    if (!auth) return;
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.error('HostRouter auth persistence setup failed:', err?.message || err);
    });
  }, []);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      },
      (err) => {
        console.error('HostRouter auth initialization failed:', err?.message || err);
        setUser(null);
        setAuthReady(true);
      },
    );
  }, []);

  useEffect(() => {
    localStorage.setItem('elimulink_host_mode', hostMode);
  }, [hostMode]);

  useEffect(() => {
    async function loadProfile() {
      if (!authReady) return;
      if (!user || user.isAnonymous) {
        setProfile(null);
        setProfileReady(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid));
        let loadedProfile = snap.exists() ? snap.data() : null;
        hostLog('[HOST_AUTH] profile_loaded', { uid: user.uid, email: user.email || null, loadedProfile });

        if (user && shouldBackfillInstitutionProfile(user, loadedProfile)) {
          const patch = {
            role: 'institution_student',
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid), patch, { merge: true });
          loadedProfile = { ...(loadedProfile || {}), ...patch };
          hostLog('[HOST_AUTH] institution_backfill_applied', { uid: user.uid, email: user.email || null, patch });
        }

        setProfile(loadedProfile);
      } catch (err) {
        console.warn('Failed to load user profile for host routing:', err?.message || err);
        setProfile(null);
      } finally {
        setProfileReady(true);
      }
    }

    setProfileReady(false);
    loadProfile();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !profileReady || handledInitialRedirect.current) return;

    const loggedIn = !!user && !user.isAnonymous;
    const expectedPrefix = `/${hostMode}`;
    hostLog("[AUTH]", {
      host: window.location.host,
      uid: user?.uid || null,
      path: pathname,
      isAnon: user?.isAnonymous,
    });

    const shouldRedirectToModeHome =
      pathname === '/' ||
      pathname === '/choose' ||
      ((hostMode === 'student' || hostMode === 'institution') && pathname === '/public');
    if (shouldRedirectToModeHome) {
      const suffix = window.location.search || '';
      replacePath(`${expectedPrefix}${suffix}`, setPathname);
      handledInitialRedirect.current = true;
      return;
    }

    // Hard rule: never render onboarding when logged out.
    if (!loggedIn && pathname.startsWith('/onboarding')) {
      const returnTo = encodeURIComponent(sanitizeReturnTo('/onboarding', { mode: hostMode, isAuthenticated: false }));
      const target = `/login?returnTo=${returnTo}`;
      hostLog("[REDIRECT]", { from: pathname, to: target });
      window.history.replaceState({}, '', target);
      setPathname('/login');
      handledInitialRedirect.current = true;
      return;
    }

    if ((hostMode === 'student' || hostMode === 'institution') && !loggedIn) {
      if (hostMode === 'institution' && pathname === '/institution/activate') {
        handledInitialRedirect.current = true;
        return;
      }
      if (pathname !== '/login') {
        const rawTarget = pathname === '/onboarding'
          ? '/onboarding'
          : `${window.location.pathname}${window.location.search || ''}`;
        const returnTo = encodeURIComponent(sanitizeReturnTo(rawTarget, { mode: hostMode, isAuthenticated: false }));
        const target = `/login?returnTo=${returnTo}`;
        hostLog("[REDIRECT]", { from: pathname, to: target });
        window.history.replaceState({}, '', target);
        setPathname('/login');
      }
      handledInitialRedirect.current = true;
      return;
    }

    const profileDone = isProfileComplete(profile, user);
    if (loggedIn && !profileDone && pathname !== '/onboarding') {
      const returnTo = encodeURIComponent(
        sanitizeReturnTo(`${window.location.pathname}${window.location.search || ''}`, { mode: hostMode, isAuthenticated: true })
      );
      const target = `/onboarding?returnTo=${returnTo}`;
      hostLog("[REDIRECT]", { from: pathname, to: target });
      window.history.replaceState({}, '', target);
      setPathname('/onboarding');
      handledInitialRedirect.current = true;
      return;
    }

    if (loggedIn && profileDone && (pathname === '/login' || pathname === '/onboarding' || pathname === '/institution/activate')) {
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo') || '';
      const target = resolvePostAuthTarget(profile, returnTo);
      hostLog("[REDIRECT]", { from: pathname, to: target.path });
      navigateToModePath(target.mode, target.path);
      handledInitialRedirect.current = true;
      return;
    }

    if (
      !pathname.startsWith(expectedPrefix) &&
      pathname !== '/login' &&
      pathname !== '/onboarding' &&
      pathname !== '/institution/activate'
    ) {
      replacePath(expectedPrefix, setPathname);
      handledInitialRedirect.current = true;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const incomingMessage = params.get('message');
    if (incomingMessage) {
      setFlashMessage(incomingMessage);
      params.delete('message');
      const cleanSearch = params.toString();
      const suffix = cleanSearch ? `?${cleanSearch}` : '';
      window.history.replaceState({}, '', `${window.location.pathname}${suffix}`);
      setPathname(window.location.pathname);
    }

    handledInitialRedirect.current = true;
  }, [authReady, profileReady, user, profile, hostMode, pathname, modeUrls]);

  useEffect(() => {
    handledInitialRedirect.current = false;
  }, [pathname, hostMode, user, profileReady]);

  const AppEntry =
    hostMode === 'student'
      ? StudentApp
      : hostMode === 'institution'
        ? InstitutionApp
        : PublicApp;

  const appElement = (
    <>
      {user && !user.emailVerified ? (
        <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded border border-amber-500/40 bg-amber-900/60 px-4 py-2 text-xs text-amber-100">
          Your email is not verified yet. Check your inbox.
        </div>
      ) : null}
      {flashMessage ? (
        <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded border border-amber-500/40 bg-amber-900/60 px-4 py-2 text-xs text-amber-100">
          {flashMessage}
        </div>
      ) : null}
      {hostMode === 'institution' ? <AppEntry userRole={profile?.role} /> : <AppEntry modeUrls={modeUrls} />}
    </>
  );

  if (firebaseInitErrorMessage) {
    return <div style={{ padding: 16 }}>Firebase init failed: {firebaseInitErrorMessage}</div>;
  }

  if (!authReady || !profileReady) return <LoadingScreen />;

  if (
    (hostMode === 'student' || hostMode === 'institution') &&
    (!user || user.isAnonymous) &&
    pathname !== '/login' &&
    pathname !== '/institution/activate'
  ) {
    return <LoadingScreen />;
  }

  if (hostMode === 'institution' && pathname === '/institution/activate') {
    return <InstitutionActivatePage />;
  }

  if (pathname === '/login' || pathname === '/onboarding') {
    return (
      <LoginPage
        mode={pathname === '/onboarding' ? 'onboarding' : 'login'}
        hostMode={hostMode}
        profile={profile}
        user={user}
        authReady={authReady}
        onAuthSuccess={async (syncedProfile, returnTo) => {
          const merged = {
            ...(profile || {}),
            ...(syncedProfile || {}),
            displayName: profileDisplayName(profile, auth?.currentUser),
          };
          setProfile(merged);
          const complete = isProfileComplete(merged, auth?.currentUser);
          const safeReturnTo = sanitizeReturnTo(returnTo, { mode: hostMode, isAuthenticated: true });
          if (!complete) {
            window.history.replaceState({}, '', `/onboarding?returnTo=${encodeURIComponent(safeReturnTo)}`);
            setPathname('/onboarding');
            return;
          }
          const target = resolvePostAuthTarget(merged, safeReturnTo);
          navigateToModePath(target.mode, target.path);
          handledInitialRedirect.current = false;
        }}
        onCompleteOnboarding={async (fullName, returnTo) => {
          const activeUser = user || auth?.currentUser || null;
          if (!activeUser) {
            const safeLoginReturn = sanitizeReturnTo('/onboarding', { mode: hostMode, isAuthenticated: false });
            window.history.replaceState({}, '', `/login?returnTo=${encodeURIComponent(safeLoginReturn)}`);
            setPathname('/login');
            return;
          }
          const normalizedName = String(fullName || '').trim();
          if (!normalizedName) throw new Error('Full name is required');
          await activeUser.getIdToken();
          if (auth?.currentUser && !String(auth.currentUser.displayName || '').trim()) {
            await updateProfile(auth.currentUser, { displayName: normalizedName });
          }
          const profileRef = doc(db, 'artifacts', APP_ID, 'users', activeUser.uid);
          const profilePatch = {
            displayName: normalizedName,
            name: normalizedName,
            updatedAt: serverTimestamp(),
          };
          hostLog('[ONBOARDING_SAVE] start', {
            uid: activeUser.uid,
            path: `artifacts/${APP_ID}/users/${activeUser.uid}`,
            payload: profilePatch,
          });
          await setDoc(profileRef, profilePatch, { merge: true });
          hostLog('[ONBOARDING_SAVE] profile saved ok');
          const savedSnap = await getDoc(profileRef);
          const savedProfile = savedSnap.exists() ? savedSnap.data() : null;
          const merged = { ...(profile || {}), ...(savedProfile || {}), ...profilePatch };
          setFlashMessage('');
          setProfile(merged);
          const completeAfterSave = isProfileComplete(merged, auth?.currentUser);
          hostLog('[ONBOARDING_SAVE] profile after save complete?', completeAfterSave);
          const safeReturnTo = sanitizeReturnTo(returnTo, { mode: hostMode, isAuthenticated: true });
          const target = resolvePostAuthTarget(merged, safeReturnTo);
          navigateToModePath(target.mode, target.path);
          handledInitialRedirect.current = false;
        }}
      />
    );
  }

  return appElement;
}
