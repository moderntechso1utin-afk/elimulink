import { useEffect, useState } from "react";
import NewChatLanding from "../pages/NewChatLanding";
import AdminAnalyticsLanding from "../pages/AdminAnalyticsLanding";
import { auth, db, appId } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

const INSTITUTION_HISTORY_KEY = "institutionMode";

function resolveModeFromHistory() {
  if (typeof window === "undefined") return "institution";
  return window.history.state?.[INSTITUTION_HISTORY_KEY] === "admin" ? "admin" : "institution";
}

export default function InstitutionApp({ userRole }) {
  const [mode, setMode] = useState(() => resolveModeFromHistory()); // institution | admin
  const [adminCheckPending, setAdminCheckPending] = useState(false);

  async function resolveCurrentInstitutionId() {
    const uid = auth?.currentUser?.uid;
    if (!uid || !db) return null;
    try {
      const userSnap = await getDoc(doc(db, "artifacts", appId, "users", uid));
      if (!userSnap.exists()) return null;
      const profile = userSnap.data() || {};
      return profile.institutionId || null;
    } catch {
      return null;
    }
  }

  async function institutionHasActivatedAdmin(institutionId) {
    if (!institutionId || !db) return false;
    try {
      const snap = await getDocs(
        query(
          collection(db, "artifacts", appId, "users"),
          where("institutionId", "==", institutionId),
          limit(200),
        ),
      );
      if (snap.empty) return false;
      return snap.docs.some((docSnap) => {
        const data = docSnap.data() || {};
        const role = String(data.role || "").toLowerCase();
        return Boolean(
          data.activatedFromKeyId ||
            data.staffCodeVerified === true ||
            role === "institution_admin" ||
            role === "department_head" ||
            role === "departmentadmin" ||
            role === "staff" ||
            role === "admin" ||
            role === "superadmin",
        );
      });
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentState = window.history.state || {};
    const currentMode = currentState[INSTITUTION_HISTORY_KEY];
    if (currentMode !== "institution" && currentMode !== "admin") {
      window.history.replaceState(
        { ...currentState, [INSTITUTION_HISTORY_KEY]: "institution" },
        "",
        window.location.href
      );
    }

    const onPopState = () => {
      setMode(resolveModeFromHistory());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function openAdmin() {
    if (adminCheckPending) return;
    setAdminCheckPending(true);
    try {
      const institutionId = await resolveCurrentInstitutionId();
      const hasActivatedAdmin = await institutionHasActivatedAdmin(institutionId);

      if (!hasActivatedAdmin) {
        window.history.pushState({}, "", "/institution/activate");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      window.location.assign("/institution");
    } finally {
      setAdminCheckPending(false);
    }
  }

  return mode === "admin" ? (
    <AdminAnalyticsLanding userRole={userRole} />
  ) : (
    <NewChatLanding onOpenAdmin={openAdmin} userRole={userRole} />
  );
}
