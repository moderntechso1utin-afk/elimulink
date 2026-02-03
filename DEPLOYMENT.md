Deployment Guide — Frontend (Vercel) and Backend (Render)

Overview
- Frontend: Static React app built with Vite. Deploy to Vercel.
- Backend: Express API (`server.js`) for admin endpoints and image proxy. Deploy to Render (or any Node host supporting env vars).

Frontend — Vercel
1. Sign in to Vercel and create a new Project.
2. Import your Git repository (GitHub/GitLab/Bitbucket).
3. Framework Preset: "Other" or let Vercel detect Vite.
4. Build & Output Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Environment Variables (set in Vercel Dashboard > Settings > Environment Variables):
   - `VITE_API_BASE` → your backend URL (e.g. `https://elimulink-api.onrender.com`)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, etc. (your Firebase client config)
   - `VITE_GEMINI_API_KEY` or other client keys (avoid placing sensitive server-only keys in frontend)
6. Routing: `vercel.json` already contains a SPA rewrite to `index.html`. No changes required.
7. Deploy. After deployment, ensure the site is served over HTTPS (Vercel provides it by default).

Notes & best practices
- Keep secrets (OpenAI/ADMIN_JWT_SECRET/FIREBASE_ADMIN_SA) on the server (Render), not in Vercel.
- Use `VITE_API_BASE` to point the frontend to the Render backend.

Backend — Render
Option A — Use the provided `render.yaml`
1. Push `render.yaml` to your repo's root on the `main` branch.
2. In Render, create a new service by connecting your repository and selecting the `render.yaml` option; Render will read the manifest.
3. Set the following Environment Variables in Render (Dashboard > Service > Environment):
   - `ADMIN_PASSCODE_HASH` — sha256(passcode) used by `/api/admin/auth` (generate locally)
   - `ADMIN_JWT_SECRET` — random secret for signing admin tokens
   - `OPENAI_API_KEY` — (or `OPENAI` equivalent) for image generation
   - `FIREBASE_ADMIN_SA` — JSON-encoded Firebase Admin service account (set as secure env)
   - `VITE_APP_ID` — optional, defaults to `elimulink-pro-v2`
4. Deploy. Render will run `npm install && npm run build` and then `npm run server`.

Option B — Manual service creation
1. Create new Web Service → Environment: `Node`.
2. Branch: `main` (or your chosen branch).
3. Build Command: `npm install && npm run build`
4. Start Command: `npm run server`
5. Set the same environment variables as above.
6. Deploy.

Health checks & HTTPS
- Render exposes your service over HTTPS automatically for public services.
- A simple health check endpoint is at `/` (JSON status) — Render will consider the service healthy if it responds with 200.

Generating `ADMIN_PASSCODE_HASH`
Run locally (PowerShell / macOS / Linux):

```bash
# Replace 'yourPasscode' with a secure passcode
node -e "console.log(require('crypto').createHash('sha256').update('yourPasscode').digest('hex'))"
```

Then copy the resulting hash into Render as `ADMIN_PASSCODE_HASH`.

Firebase Admin Service Account
- In the Firebase console, create a service account key (JSON) and paste the entire JSON into the `FIREBASE_ADMIN_SA` env var in Render. Mark it secure/private.

CORS and `VITE_API_BASE`
- `server.js` uses `apiUrl()` in the frontend. Set `VITE_API_BASE` on Vercel to the Render service URL (e.g. `https://elimulink-api.onrender.com`).

Testing locally with environment variables
- Create a `.env.local` for Vite (example variables):

```
VITE_API_BASE=http://localhost:4000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_GEMINI_API_KEY=...
```

- For the server, set env vars in your shell or use a `.env` loader if you add one.

Rollback & logs
- Use Render's dashboard to view build and runtime logs. If startup fails, check `npm run server` output.

Want me to:
- Add local icon assets and update `public/manifest.json`.
- Commit a minimal `Procfile` or Dockerfile for alternate hosts.
- Create a Vercel project configuration snippet with recommended environment variable names.

Obtaining Vercel & Render IDs and tokens
----------------------------------------

Vercel
- Personal Token: Visit https://vercel.com/account/tokens and create a new token. Save it to your GitHub Actions secrets as `VERCEL_TOKEN`.
- Project ID: In the Vercel dashboard open your Project → Settings → General. The "Project ID" field contains the `VERCEL_PROJECT_ID` (copy into GitHub secret).
- Org/Scope: Your organization or personal scope appears in the URL (e.g. `https://vercel.com/<org>/...`) — you can use that slug as `VERCEL_ORG_ID` or obtain the numeric org id via Vercel API if needed.
- CLI alternative to list projects (requires `vercel` CLI and token):
```bash
VERCEL_TOKEN=your_token
vercel projects ls --token "$VERCEL_TOKEN"
```

Render
- API Key: In Render, go to Account → API Keys → New API Key. Add the key to GitHub Actions secrets as `RENDER_API_KEY`.
- Service ID: In the Render dashboard open your Service → Settings → Service Details. The "Service ID" is shown there (use as `RENDER_SERVICE_ID`).
- Trigger a deploy via the REST API (used in the workflow):
```bash
curl -X POST "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
   -H "Authorization: Bearer $RENDER_API_KEY" \
   -H "Content-Type: application/json" -d '{}'
```

Notes
- Do not commit tokens or service IDs to the repo. Store them as GitHub Actions secrets.
- If you need help finding a specific value, tell me which dashboard you're in and I can give exact click-by-click guidance.

