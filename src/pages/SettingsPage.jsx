import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredThemeMode, setThemeMode } from "../lib/theme";
import {
  getStoredPreferences,
  getStoredProfile,
  saveStoredPreferences,
  saveStoredProfile,
} from "../lib/userSettings";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili (Swahili)" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "pl", label: "Polish" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "ro", label: "Romanian" },
  { code: "el", label: "Greek" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "ar", label: "Arabic" },
  { code: "he", label: "Hebrew" },
  { code: "fa", label: "Persian (Farsi)" },
  { code: "ur", label: "Urdu" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "pa", label: "Punjabi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-tw", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "tl", label: "Filipino (Tagalog)" },
  { code: "am", label: "Amharic" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "zu", label: "Zulu" },
];

function languageLabelOf(code) {
  const normalized = String(code || "").trim().toLowerCase();
  return LANGUAGE_OPTIONS.find((lang) => lang.code === normalized)?.label || "English";
}

function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-600 dark:focus:border-slate-600",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Button({ variant = "primary", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition active:scale-[0.99]";
  const styles = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
    softDanger:
      "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45",
  };
  return <button {...props} className={`${base} ${styles[variant]} ${className}`} />;
}

function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
      <div>
        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</div>
        {sublabel ? <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sublabel}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-700",
        ].join(" ")}
        aria-pressed={checked}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "left-5 dark:bg-slate-900" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = source;
  });
}

async function normalizeAvatarImage(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!String(file?.type || "").startsWith("image/")) return rawDataUrl;

  try {
    const image = await loadImage(rawDataUrl);
    const maxSize = 512;
    const sourceWidth = Math.max(1, Number(image.width) || 1);
    const sourceHeight = Math.max(1, Number(image.height) || 1);
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return rawDataUrl;
  }
}

export default function SettingsPage({ user, onBack, canShowAdmin = false, onOpenAdmin }) {
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [form, setForm] = useState(() =>
    getStoredProfile({
      name: user?.name || "Scholar",
      email: user?.email || "scholar@elimulink.demo",
      phone: user?.phone || "+2547xx xxx xxx",
      avatarUrl: "",
    })
  );
  const [prefs, setPrefs] = useState(() => {
    const stored = getStoredPreferences({
      muteNotifications: false,
      keyboardShortcuts: false,
      language: "en",
    });
    return { ...stored, theme: getStoredThemeMode() };
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [avatarError, setAvatarError] = useState("");

  const resolvedTheme = useMemo(() => prefs.theme, [prefs.theme]);

  useEffect(() => {
    setThemeMode(resolvedTheme);
  }, [resolvedTheme]);

  async function onSave() {
    setSaving(true);
    try {
      saveStoredProfile(form);
      saveStoredPreferences({
        muteNotifications: !!prefs.muteNotifications,
        keyboardShortcuts: !!prefs.keyboardShortcuts,
        language: String(prefs.language || "en"),
      });
      await new Promise((r) => setTimeout(r, 450));
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarSelect(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;

    setAvatarError("");
    try {
      const avatarUrl = await normalizeAvatarImage(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
    } catch {
      setAvatarError("Could not process this image. Try another photo.");
    }
  }

  function removeAvatar() {
    setAvatarError("");
    setForm((prev) => ({ ...prev, avatarUrl: "" }));
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onBack?.()}
            className="w-fit rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Manage account, preferences, and support.</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              Frontend now
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              Backend later
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section title="Profile & Account" description="Name, email, phone, password.">
            <div className="space-y-4">
              <Field label="Profile photo" hint="Upload or camera">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                    {form.avatarUrl ? (
                      <img src={form.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-lg font-semibold text-slate-600 dark:text-slate-300">
                        {String(form.name || "U").trim().charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => uploadInputRef.current?.click()}>
                      Upload
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => cameraInputRef.current?.click()}>
                      Camera
                    </Button>
                    {form.avatarUrl ? (
                      <Button type="button" variant="softDanger" onClick={removeAvatar}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
                {avatarError ? (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-300">{avatarError}</div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Choose a photo, then tap Save changes.
                  </div>
                )}
              </Field>
              <Field label="Full name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email" hint="Read-only now, update from account backend later">
                <Input value={form.email} disabled />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+254..."
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => alert("Change password (backend later)")}>
                  Change password
                </Button>
                <Button type="button" onClick={onSave} disabled={saving} className="ml-auto">
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
              {savedAt ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">Saved {savedAt.toLocaleString()}</div>
              ) : null}
            </div>
          </Section>

          <Section title="Preferences" description="Theme, notifications, shortcuts.">
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Theme</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["system", "light", "dark"].map((t) => {
                    const active = prefs.theme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPrefs((p) => ({ ...p, theme: t }))}
                        className={[
                          "rounded-xl px-3 py-2 text-sm transition",
                          active
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                        ].join(" ")}
                      >
                        {t[0].toUpperCase() + t.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Language</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Current: {languageLabelOf(prefs.language || "en")}
                </div>
                <div className="mt-2">
                  <select
                    value={prefs.language || "en"}
                    onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                    aria-label="Select app language"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-600 dark:focus:border-slate-600"
                  >
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Applies app language preference after Save changes.
                </div>
              </div>
              <Toggle
                checked={prefs.muteNotifications}
                onChange={(v) => setPrefs((p) => ({ ...p, muteNotifications: v }))}
                label="Mute notifications"
                sublabel="Pause non-critical alerts."
              />
              <Toggle
                checked={prefs.keyboardShortcuts}
                onChange={(v) => setPrefs((p) => ({ ...p, keyboardShortcuts: v }))}
                label="Keyboard shortcuts"
                sublabel="Power-user navigation keys."
              />
            </div>
          </Section>

          <Section title="Tools" description="Personal tools and downloads.">
            <div className="space-y-3">
              <Button variant="ghost" type="button" className="w-full justify-between" onClick={() => alert("Personal tools (frontend preview, backend later)")}>
                Personal tools
                <span className="text-xs text-slate-500 dark:text-slate-400">Backend later</span>
              </Button>
              <Button variant="ghost" type="button" className="w-full justify-between" onClick={() => alert("Download app (frontend preview, backend later)")}>
                Download app
                <span className="text-xs text-slate-500 dark:text-slate-400">Backend later</span>
              </Button>
              <Button variant="ghost" type="button" className="w-full justify-between" onClick={() => alert("Advanced settings (frontend preview, backend later)")}>
                Advanced settings
                <span className="text-xs text-slate-500 dark:text-slate-400">Backend later</span>
              </Button>
            </div>
          </Section>

          {canShowAdmin ? (
            <Section title="Administration" description="Admin access for institution roles.">
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  type="button"
                  className="w-full justify-between"
                  onClick={() => onOpenAdmin?.()}
                >
                  Open Admin Dashboard
                  <span className="text-xs text-slate-500 dark:text-slate-400">Shortcut</span>
                </Button>
              </div>
            </Section>
          ) : null}

          <Section title="Support" description="Help and account actions.">
            <div className="space-y-3">
              <Button variant="ghost" type="button" className="w-full justify-between" onClick={() => alert("Help center") }>
                Help
                <span className="text-xs text-slate-500 dark:text-slate-400">Available</span>
              </Button>
              <Button variant="softDanger" type="button" className="w-full justify-between" onClick={() => alert("Move to trash (backend later)")}>
                Trash
                <span className="text-xs text-red-600/80 dark:text-red-200/80">Backend later</span>
              </Button>
              <Button variant="softDanger" type="button" className="w-full justify-between" onClick={() => alert("Logout (backend later)")}>
                Logout
                <span className="text-xs text-red-600/80 dark:text-red-200/80">Backend later</span>
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
