# Vercel Fetch Error - Diagnostic Checklist

## Quick Diagnosis (5 minutes)

### Step 1: Check Frontend Environment Variables ✅
**Location:** Vercel Dashboard → Settings → Environment Variables

**Required for chat to work:**
- [ ] `VITE_API_BASE` is set (not empty)
- [ ] `VITE_API_BASE` matches your Render backend URL (e.g., `https://elimulink-api.onrender.com`)
- [ ] No typos or trailing slashes in the URL

**To verify:** Copy the URL and visit it in browser. You should see:
```json
{
  "service": "ElimuLink API",
  "port": 4000,
  "firestore": true,
  "openai": true,
  "note": "Use /api/admin/auth..."
}
```

### Step 2: Check Frontend Logs 📱
**What to do:**
1. Open your Vercel app
2. Press F12 (open DevTools)
3. Go to Console tab
4. Look for lines starting with `[ENV]` or `[API]`

**What you should see:**
```
[ENV] MODE: production
[ENV] VITE_API_BASE: https://elimulink-api.onrender.com
[API] Will call: {
  chat: "https://elimulink-api.onrender.com/api/ai/student",
  ...
}
```

**If you see:** `[ENV] VITE_API_BASE: (empty - using direct Firestore)`
→ **Problem:** Env var not set. Add to Vercel settings.

### Step 3: Send a Test Message 💬
1. Type a chat message
2. Press Send
3. Watch the Console tab in real-time

**Success looks like:**
```
[API] Fetching: https://elimulink-api.onrender.com/api/ai/student
```
(followed by a response)

**Error looks like:**
```
[API] Fetching: https://elimulink-api.onrender.com/api/ai/student
[API] Error 500: https://... {"error": "..."}
```

### Step 4: Check Render Backend Logs 🖥️
**Location:** Render Dashboard → Your Service → Logs

**What to look for:** Lines starting with `[SERVER]`, `[API]`, `[CONFIG]`, `[CORS]`, or `[ERROR]`

**Success logs look like:**
```
[SERVER] ElimuLink API listening on port 4000
[CONFIG] CORS origins: ... *.vercel.app
[CORS] Allowed: https://myapp.vercel.app
[API] /api/ai/student - User: uid123, Region: Uganda
[API] Calling Gemini: https://generativelanguage.googleapis.com...
[API] Gemini responded successfully (245 chars)
```

**Error logs look like:**
```
[ERROR] Gemini API returned 401: {"error": {"code": 401, "message": "Invalid API key"}}
```

---

## Common Issues & Fixes

### Issue #1: "Error: Failed to fetch"
Console shows `[API] Fetching: ...` followed by error

**Possible causes:**
1. **Render backend is sleeping** (free tier)
   - Fix: Open Render URL directly (https://elimulink-api.onrender.com) to wake it up
   - Then try chat again (may take 30 seconds to respond)

2. **Backend URL is wrong**
   - Check Render logs for `[SERVER] listening on port` 
   - Copy the correct URL to Vercel `VITE_API_BASE`

3. **CORS is being blocked**
   - Check Render logs for `[CORS] Blocked: https://...`
   - If you see this, server.js CORS config needs update

4. **Gemini API key is wrong**
   - Check Render logs for `[ERROR] Gemini API returned 401`
   - Update `GEMINI_API_KEY` in Render settings

### Issue #2: Console shows "Failed to fetch https://localhost:4000"
**Problem:** `VITE_API_BASE` not set, using development default

**Fix:**
- Vercel Settings → Environment Variables
- Add: `VITE_API_BASE = https://your-render-url.onrender.com`
- Redeploy

### Issue #3: "[CORS] Blocked: https://myapp.vercel.app"
**Problem:** Your Vercel domain is not in CORS allowlist

**Fix:**
- Check server.js line 24: Should have `/\.vercel\.app$/` regex
- If missing, add it to DEFAULT_ALLOWED_ORIGINS
- Redeploy backend

### Issue #4: "[ERROR] GEMINI_API_KEY not set"
**Problem:** Backend doesn't have Google Gemini API key

**Fix:**
- Render Settings → Environment
- Add: `GEMINI_API_KEY = (your key from Google Cloud Console)`
- Redeploy

### Issue #5: Render service keeps "sleeping"
**Problem:** Free tier Render service shuts down after 15 min of inactivity

**Solution:**
- Option A: Upgrade to Paid plan on Render
- Option B: Add "wake up" check — Before sending chat, call GET https://your-url.onrender.com/
- Option C: Use Render's scheduled tasks to ping the service every 10 min

---

## Testing Endpoints Directly

### Test if backend is up
```bash
curl https://your-render-url.onrender.com/
```
Should return JSON with status.

### Test chat endpoint (with valid token)
```bash
curl -X POST https://your-render-url.onrender.com/api/ai/student \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -d '{"text": "Hello"}'
```
Should return: `{"ok":true,"text":"..."}`

---

## Quick Render Setup

If backend is missing `GEMINI_API_KEY`:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select your project
3. Go to APIs & Services → Credentials
4. Create API key for Gemini
5. Copy the key
6. Go to Render Dashboard → Your Service → Settings
7. Under Environment, add: `GEMINI_API_KEY = (paste key)`
8. Click Redeploy

---

## Success Criteria

After all fixes, you should see:

✅ Frontend Console:
```
[ENV] VITE_API_BASE: https://elimulink-api.onrender.com
[API] Will call: { chat: "https://...", ... }
```

✅ Chat message sends:
```
[API] Fetching: https://elimulink-api.onrender.com/api/ai/student
```

✅ Get response (no error)
```
{role: "ai", content: "Here's what I found..."}
```

✅ Render Logs show:
```
[API] /api/ai/student - User: uid123, Region: Uganda
[API] Calling Gemini: https://...
[API] Gemini responded successfully (245 chars)
```

---

## Need Help?

1. **Check all 4 log sources:** Frontend console, Render logs, Vercel settings, browser network tab (F12 → Network)
2. **Look for `[API]`, `[ERROR]`, `[CONFIG]`, `[CORS]` prefixes** — These are the new diagnostic logs
3. **Copy exact error messages** from console/logs and share them

All error messages now have clear context showing exactly where the failure occurred.
