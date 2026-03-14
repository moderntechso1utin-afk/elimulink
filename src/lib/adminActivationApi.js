import { apiUrl } from "./apiUrl";

async function postJson(path, body) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export function redeemAdminKey(accessKey) {
  return postJson("/api/auth/redeem-admin-key", { accessKey });
}

export function completeAdminActivation({ activationToken, password, fullName }) {
  return postJson("/api/auth/complete-admin-activation", {
    activationToken,
    password,
    fullName,
  });
}
