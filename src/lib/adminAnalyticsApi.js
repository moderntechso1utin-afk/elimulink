import { apiUrl } from "./apiUrl";
import { auth } from "./firebase";

async function authedGet(path) {
  const token = await auth?.currentUser?.getIdToken?.().catch(() => null);
  const res = await fetch(apiUrl(path), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw ? { message: raw } : {};
  }
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data?.data || {};
}

export function getAdminAnalyticsSummary() {
  return authedGet("/api/admin/analytics/summary");
}

