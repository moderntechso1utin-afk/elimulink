import { apiUrl } from "./apiUrl";

async function request(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function createRubric(payload) {
  return request("/api/rubrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listRubrics(params = {}) {
  const q = new URLSearchParams();
  if (params.courseId) q.set("courseId", params.courseId);
  if (params.departmentId) q.set("departmentId", params.departmentId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request(`/api/rubrics${suffix}`);
}

export function getRubric(rubricId) {
  return request(`/api/rubrics/${rubricId}`);
}

