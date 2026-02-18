import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { auth, db, firebaseInitErrorMessage } from '../lib/firebase';
import { getResolvedHostMode } from './hostMode';

const APP_ID = import.meta.env.VITE_APP_ID || 'elimulink-pro-v2';
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.MODE === 'development' ? 'http://localhost:4000' : '');

function apiUrl(path) {
  if (!path.startsWith('/')) path = `/${path}`;
  return API_BASE ? `${API_BASE.replace(/\/$/, '')}${path}` : path;
}

function isInstitutionLinkedRole(role) {
  const value = String(role || '');
  return value.startsWith('institution_') || value === 'staff';
}

function canAccessInstitution(profile) {
  if (!profile) return false;
  const role = profile?.role || '';
  const roleAllowed = isInstitutionLinkedRole(role);
  const hasInstitution = Boolean(profile?.institutionId);
  const subscriptionActive = profile?.subscriptionActive === true;
  return roleAllowed && hasInstitution && subscriptionActive;
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

function getModeUrl(mode) {
  const host = window.location.hostname.toLowerCase();
  const isLocal = host.endsWith('.localhost') || host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    const localMap = {
      public: 'http://app.localhost:3000',
      student: 'http://student.localhost:3000',
      institution: 'http://institution.localhost:3000',
    };
    return `${localMap[mode]}/${mode}`;
  }

  const baseMap = {
    public: 'https://app.elimulink.co.ke',
    student: 'https://student.elimulink.co.ke',
    institution: 'https://institution.elimulink.co.ke',
  };

  return `${baseMap[mode]}/${mode}`;
}

function getModeFromProfile(profile) {
  if (canAccessInstitution(profile)) return 'institution';
  if (profile?.role && profile.role !== 'public') return 'student';
  return 'public';
}

function getBaseOrigin(modeUrl, mode) {
  return String(modeUrl || '').replace(new RegExp(`/${mode}$`), '');
}

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading...
    </div>
  );
}

function LoginPage({
  mode,
  hostMode,
  profile,
  user,
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get('message');
    const incomingReturnTo = params.get('returnTo') || '';
    if (message) setNotice(message);
    setReturnTo(incomingReturnTo);
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
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-slate-900 p-6">
          <h1 className="text-lg font-bold">Complete your profile</h1>
          <p className="text-sm text-slate-300 mt-2">Your full name is required before continuing.</p>
          {error && <div className="mt-3 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-xs">{error}</div>}
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
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
              disabled={pending}
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

  const hostMode = useMemo(
    () => getResolvedHostMode(window.location.hostname, import.meta.env.VITE_HOST_MODE),
    [],
  );

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
    const baseOrigin = getBaseOrigin(modeUrls[mode], mode);
    window.location.replace(`${baseOrigin}${targetPath}`);
  };

  const resolvePostAuthTarget = (nextProfile, returnToRaw = '') => {
    const mode = getModeFromProfile(nextProfile);
    const returnTo = decodeURIComponent(String(returnToRaw || ''));
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
        setProfile(snap.exists() ? snap.data() : null);
      } catch (err) {
        console.error('Failed to load user profile for host routing', err);
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

    if (pathname === '/' || pathname === '/choose') {
      replacePath(expectedPrefix, setPathname);
      handledInitialRedirect.current = true;
      return;
    }

    if (!loggedIn) {
      if (pathname !== '/login') {
        const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
        window.history.replaceState({}, '', `/login?returnTo=${returnTo}`);
        setPathname('/login');
      }
      handledInitialRedirect.current = true;
      return;
    }

    if (hostMode === 'institution' && !canAccessInstitution(profile)) {
      const message = encodeURIComponent('Institution access requires an institution-linked account');
      window.location.replace(`${modeUrls.student}?message=${message}`);
      handledInitialRedirect.current = true;
      return;
    }

    const profileDone = isProfileComplete(profile, user);
    if (!profileDone && pathname !== '/onboarding') {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
      window.history.replaceState({}, '', `/onboarding?returnTo=${returnTo}`);
      setPathname('/onboarding');
      handledInitialRedirect.current = true;
      return;
    }

    if (profileDone && (pathname === '/login' || pathname === '/onboarding')) {
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo') || '';
      const target = resolvePostAuthTarget(profile, returnTo);
      navigateToModePath(target.mode, target.path);
      handledInitialRedirect.current = true;
      return;
    }

    if (!pathname.startsWith(expectedPrefix) && pathname !== '/login' && pathname !== '/onboarding') {
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
      <App hostMode={hostMode} modeUrls={modeUrls} />
    </>
  );

  if (firebaseInitErrorMessage) {
    return <div style={{ padding: 16 }}>Firebase init failed: {firebaseInitErrorMessage}</div>;
  }

  if (!authReady || !profileReady) return <LoadingScreen />;

  if (pathname === '/login' || pathname === '/onboarding') {
    return (
      <LoginPage
        mode={pathname === '/onboarding' ? 'onboarding' : 'login'}
        hostMode={hostMode}
        profile={profile}
        user={user}
        onAuthSuccess={async (syncedProfile, returnTo) => {
          const merged = {
            ...(profile || {}),
            ...(syncedProfile || {}),
            displayName: profileDisplayName(profile, auth?.currentUser),
          };
          setProfile(merged);
          const complete = isProfileComplete(merged, auth?.currentUser);
          if (!complete) {
            window.history.replaceState({}, '', `/onboarding?returnTo=${encodeURIComponent(returnTo || '')}`);
            setPathname('/onboarding');
            return;
          }
          const target = resolvePostAuthTarget(merged, returnTo);
          navigateToModePath(target.mode, target.path);
          handledInitialRedirect.current = false;
        }}
        onCompleteOnboarding={async (fullName, returnTo) => {
          if (!user) throw new Error('Not authenticated');
          if (!fullName) throw new Error('Full name is required');
          if (auth?.currentUser && !auth.currentUser.displayName) {
            await updateProfile(auth.currentUser, { displayName: fullName });
          }
          const profilePatch = {
            displayName: fullName,
            name: fullName,
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid), profilePatch, { merge: true });
          const merged = { ...(profile || {}), ...profilePatch };
          setProfile(merged);
          const target = resolvePostAuthTarget(merged, returnTo);
          navigateToModePath(target.mode, target.path);
          handledInitialRedirect.current = false;
        }}
      />
    );
  }

  return appElement;
}
