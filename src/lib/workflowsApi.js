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

export function createWorkflow(payload) {
  return request("/api/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listWorkflows(params = {}) {
  const q = new URLSearchParams();
  if (params.department) q.set("department", params.department);
  if (params.status) q.set("status", params.status);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request(`/api/workflows${suffix}`);
}

export function getWorkflow(id) {
  return request(`/api/workflows/${id}`);
}

export function moveWorkflowToReview(id, payload) {
  return request(`/api/workflows/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestWorkflowApproval(id, payload) {
  return request(`/api/workflows/${id}/request-approval`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveWorkflow(id, payload) {
  return request(`/api/workflows/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectWorkflow(id, payload) {
  return request(`/api/workflows/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveWorkflow(id, payload) {
  return request(`/api/workflows/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setWorkflowCommunication(id, payload) {
  return request(`/api/workflows/${id}/communication`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function attachWorkflowRubric(id, payload) {
  return request(`/api/workflows/${id}/rubric/attach`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function evaluateWorkflowDraft(id, payload) {
  return request(`/api/workflows/${id}/evaluate-draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveWorkflowReviewerDecision(id, payload) {
  return request(`/api/workflows/${id}/reviewer-decision`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
