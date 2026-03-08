import { auth } from "./firebase";
import { readScopedJson, writeScopedJson } from "./userScopedStorage";

export const PROFILE_SETTINGS_KEY = "elimulink_profile_settings_v1";
export const PREFS_SETTINGS_KEY = "elimulink_preferences_v1";
export const DEFAULT_APP_LANGUAGE = "en";

const RTL_LANGUAGE_BASES = new Set(["ar", "fa", "he", "ur"]);

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function resolveUid(uid) {
  if (uid) return uid;
  return auth?.currentUser?.uid || null;
}

export function getStoredProfile(defaults = {}, uid = null) {
  const effectiveUid = resolveUid(uid);
  const scoped = readScopedJson(effectiveUid, PROFILE_SETTINGS_KEY, null);
  const stored = scoped && typeof scoped === "object" ? scoped : readJSON(PROFILE_SETTINGS_KEY, {});
  return { ...defaults, ...stored };
}

export function saveStoredProfile(profile, uid = null) {
  const effectiveUid = resolveUid(uid);
  const next = profile || {};
  if (effectiveUid) {
    writeScopedJson(effectiveUid, PROFILE_SETTINGS_KEY, next);
    return;
  }
  writeJSON(PROFILE_SETTINGS_KEY, next);
}

export function getStoredPreferences(defaults = {}, uid = null) {
  const effectiveUid = resolveUid(uid);
  const scoped = readScopedJson(effectiveUid, PREFS_SETTINGS_KEY, null);
  const stored = scoped && typeof scoped === "object" ? scoped : readJSON(PREFS_SETTINGS_KEY, {});
  return { ...defaults, ...stored };
}

export function saveStoredPreferences(preferences, uid = null) {
  const effectiveUid = resolveUid(uid);
  const next = { ...(preferences || {}) };
  if (effectiveUid) {
    writeScopedJson(effectiveUid, PREFS_SETTINGS_KEY, next);
  } else {
    writeJSON(PREFS_SETTINGS_KEY, next);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("elimulink-preferences-change", { detail: next }));
  }
}

export function getStoredLanguage(fallback = DEFAULT_APP_LANGUAGE, uid = null) {
  const prefs = getStoredPreferences({ language: fallback }, uid);
  const language = String(prefs?.language || fallback).trim().toLowerCase();
  return language || fallback;
}

export function isRtlLanguage(languageCode) {
  const value = String(languageCode || "").trim().toLowerCase();
  const base = value.split("-")[0];
  return RTL_LANGUAGE_BASES.has(base);
}
