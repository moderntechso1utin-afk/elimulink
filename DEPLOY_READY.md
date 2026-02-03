Deploy-ready branch — quick checklist

This file contains commands and guidance to create a `deploy-ready` branch, run local checks, and push to your remote so Render and Vercel can deploy.

1) Run local build & smoke test

```bash
npm install
npm run build
# confirm build output exists (dist/) and server can start
NODE_ENV=production node server.js
# visit http://localhost:4000/ to see health JSON
```

2) Generate admin passcode hash (if you haven't already)

```bash
node -e "console.log(require('crypto').createHash('sha256').update('yourPasscode').digest('hex'))"
```

3) Commit and create `deploy-ready` branch

```bash
# ensure working tree is clean
git status --porcelain
# create branch from current main (or desired branch)
git checkout -b deploy-ready
# add files
git add .
git commit -m "chore: deploy-ready — PWA updates, render manifest, deploy scripts"
# push branch
git push -u origin deploy-ready
```

4) Connect backend to Render
- In Render dashboard choose "New" → "Infrastructure as Code" → import repo.
- Render will read `render.yaml` and create `ElimuLink-API` service.
- Add environment variables (mark secure): `ADMIN_PASSCODE_HASH`, `ADMIN_JWT_SECRET`, `OPENAI_API_KEY`, `FIREBASE_ADMIN_SA`, `VITE_APP_ID`.
- Confirm Build Command: `npm install && npm run build` and Start Command: `npm run server`.
- Enable Auto-Deploy from `deploy-ready` or `main` branch.

5) Connect frontend to Vercel
- In Vercel, import repo and set Project settings:
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Environment variable: `VITE_API_BASE` = `https://<your-render-service>.onrender.com`
- Trigger deploy.

6) Test live PWA install & offline
- Open Vercel URL (HTTPS).
- Confirm Service Worker and Manifest in DevTools > Application.
- Test offline: DevTools > Network > Offline → reload (should show `/offline.html`).
- Click the header "Install ElimuLink" button to prompt installation (or use browser install flow).

Notes
- Do NOT commit secrets (keys, Firebase admin JSON) to the repo. Use Render/Vercel secure env variables.
- If Render build fails due to missing `FIREBASE_ADMIN_SA`, the server will still start but Firestore features won't work.

If you want, I can create a PR with these changes (if you provide repo remote access) or walk you through the GitHub PR creation steps.