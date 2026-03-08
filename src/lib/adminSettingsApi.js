import { apiUrl } from "./apiUrl";
import { auth } from "./firebase";

async function authedRequest(path, { method = "GET", body } = {}) {
  const token = await auth?.currentUser?.getIdToken?.().catch(() => null);
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
  return data;
}

export async function getAdminSettings() {
  const payload = await authedRequest("/api/admin/settings");
  return payload?.data?.settings || {};
}

export async function putAdminSettings(updatePayload) {
  const payload = await authedRequest("/api/admin/settings", {
    method: "PUT",
    body: { payload: updatePayload || {} },
  });
  return payload?.data?.settings || {};
}

