import React, { useState } from "react";
import {
  completeAdminActivation,
  redeemAdminKey,
} from "../lib/adminActivationApi";

export default function InstitutionActivatePage() {
  const [accessKey, setAccessKey] = useState("");
  const [activationToken, setActivationToken] = useState("");
  const [activationData, setActivationData] = useState(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canRedeem = !pending && accessKey.trim().length > 0 && !activationToken;
  const canComplete =
    !pending &&
    Boolean(activationToken) &&
    String(password).length >= 8 &&
    password === confirmPassword;

  async function handleRedeem(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const data = await redeemAdminKey(accessKey.trim());
      setActivationToken(String(data?.activationToken || ""));
      setActivationData(data?.activation || null);
      setFullName(String(data?.activation?.fullName || ""));
    } catch (err) {
      setError(String(err?.message || "Failed to redeem activation key"));
    } finally {
      setPending(false);
    }
  }

  async function handleComplete(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await completeAdminActivation({
        activationToken,
        password,
        fullName: fullName.trim(),
      });
      setSuccess(
        "Activation complete. Continue to normal login with your email and password."
      );
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        window.location.replace("/login?returnTo=%2Finstitution");
      }, 600);
    } catch (err) {
      setError(String(err?.message || "Failed to complete activation"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-xl border border-white/10 bg-slate-900 p-6">
        <h1 className="text-lg font-bold">Institution Admin Activation</h1>
        <p className="mt-2 text-sm text-slate-300">
          This page is for first-time staff/admin activation using an
          executive-issued one-time access key.
        </p>

        {error ? (
          <div className="mt-3 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-3 rounded bg-emerald-900/40 border border-emerald-500/40 px-3 py-2 text-xs">
            {success}
          </div>
        ) : null}

        {!activationToken ? (
          <form className="mt-4 space-y-3" onSubmit={handleRedeem}>
            <label className="block">
              <span className="text-xs text-slate-400">One-time access key</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Enter executive-issued key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                required
              />
            </label>

            <button
              className="w-full rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={!canRedeem}
            >
              {pending ? "Validating key..." : "Activate"}
            </button>
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={handleComplete}>
            <div className="rounded border border-white/10 bg-slate-800/80 px-3 py-2 text-xs">
              <div>
                <b>Institution:</b> {activationData?.institutionName || activationData?.institutionId || "N/A"}
              </div>
              <div>
                <b>Department:</b> {activationData?.departmentName || activationData?.departmentId || "N/A"}
              </div>
              <div>
                <b>Role:</b> {activationData?.role || "staff"}
              </div>
              <div>
                <b>Email:</b> {activationData?.email || "N/A"}
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-slate-400">Full name</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400">Set password</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                placeholder="At least 8 characters"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-400">Confirm password</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Re-enter password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <button
              className="w-full rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={!canComplete}
            >
              {pending ? "Completing..." : "Complete activation"}
            </button>

            <button
              className="w-full text-xs text-slate-300 underline"
              type="button"
              onClick={() => {
                window.location.replace("/login?returnTo=%2Finstitution");
              }}
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
