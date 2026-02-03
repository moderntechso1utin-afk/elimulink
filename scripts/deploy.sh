#!/usr/bin/env bash
# Helper: create a deploy-ready branch and push to origin
# Usage: ./scripts/deploy.sh
set -e
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Commit or stash changes before running."
  git status --porcelain
  exit 1
fi
BRANCH=deploy-ready
git checkout -b "$BRANCH"
git add .
git commit -m "chore: deploy-ready — PWA and deployment configs" || echo "No changes to commit"
git push -u origin "$BRANCH"
echo "Pushed branch '$BRANCH' to origin. Create a PR to merge to main or connect Render/Vercel to this branch."