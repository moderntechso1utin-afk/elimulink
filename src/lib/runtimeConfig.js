function detectModeFromHost() {
  if (typeof window === "undefined") return "public";
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith("student.") || host.includes("elimulink-student")) return "student";
  if (host.startsWith("institution.") || host.includes("elimulink-institution")) return "institution";
  return "public";
}

export function getApiBase() {
  if (import.meta.env.DEV) {
    // In local dev, use same-origin `/api` and let Vite proxy forward to backend.
    // This avoids CORS issues for app.localhost/student.localhost/institution.localhost.
    return "";
  }
  const envBase = (import.meta.env.VITE_API_BASE || "").trim();
  const normalized = envBase.replace(/\/$/, "");
  if (!normalized || normalized.includes(":4000")) {
    throw new Error(
      "Invalid VITE_API_BASE. Must be http://127.0.0.1:8000 in dev or your Render URL in prod."
    );
  }
  return normalized;
}

if (typeof window !== "undefined" && !window.__ELIMULINK_RUNTIME_LOGGED__) {
  const apiBase = getApiBase();
  const mode = detectModeFromHost();
  const site = window.location.host;
  window.__ELIMULINK_DEBUG__ = { apiBase, mode, site };
  console.log(`[RUNTIME] mode=${mode} site=${site} apiBase=${apiBase}`);
  console.log("[ENV_RUNTIME]", {
    MODE: import.meta.env.MODE,
    VITE_API_BASE: import.meta.env.VITE_API_BASE,
  });
  window.__ELIMULINK_RUNTIME_LOGGED__ = true;
}
