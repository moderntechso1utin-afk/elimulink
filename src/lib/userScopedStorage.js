export function scopedKey(uid, key) {
  if (!uid) return null;
  return `elimulink:${uid}:${key}`;
}

export function readScopedJson(uid, key, fallback) {
  const fullKey = scopedKey(uid, key);
  if (!fullKey) return fallback;

  try {
    const raw = localStorage.getItem(fullKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeScopedJson(uid, key, value) {
  const fullKey = scopedKey(uid, key);
  if (!fullKey) return;

  try {
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function removeScopedKey(uid, key) {
  const fullKey = scopedKey(uid, key);
  if (!fullKey) return;

  try {
    localStorage.removeItem(fullKey);
  } catch {
    // ignore storage errors
  }
}
