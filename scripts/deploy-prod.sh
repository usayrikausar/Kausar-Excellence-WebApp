#!/usr/bin/env bash
# Deploys Hosting (+ the SSR Cloud Function it needs) to the real production
# project, kausar-excellence-web-app.
#
# WHY THIS RUNS FROM A SEPARATE WSL-NATIVE COPY, NOT THE WINDOWS PROJECT DIR:
#   1. Firebase's Next.js packaging step symlinks firebase-admin into the
#      Cloud Function bundle. Windows refuses non-admin symlink creation
#      (EPERM) unless Developer Mode is on, so a deploy run directly from
#      the Windows path (or from WSL against /mnt/c) fails partway through.
#   2. Native binaries (lightningcss, used by Tailwind v4) are platform-
#      specific. node_modules installed on Windows only has the Windows
#      binary, so even running the *build* from WSL against the Windows
#      node_modules fails ("Cannot find module lightningcss.linux-x64-gnu").
#   The fix for both: a dedicated copy of the repo living on WSL's own
#   filesystem (~/deploy-workspace/kausar-webapp), with its own npm install
#   producing Linux-native binaries and a filesystem that allows symlinks.
#   This script keeps that copy in sync with whatever is pushed to `main`
#   and deploys from there. It never edits code — only run it after your
#   changes are committed AND pushed.
#
# USAGE (from Windows Git Bash / PowerShell):
#   wsl.exe -e bash "/mnt/c/Users/Surface Laptop 4/BNI IKON CS Session/kausar-webapp/scripts/deploy-prod.sh"
# USAGE (from inside WSL directly):
#   ~/deploy-workspace/kausar-webapp/scripts/deploy-prod.sh
#
# Optional: pass --only <targets> to override the default (hosting only),
# e.g. --only hosting,firestore:rules,firestore:indexes,storage

set -euo pipefail

WORKSPACE="$HOME/deploy-workspace/kausar-webapp"
REPO_URL="https://github.com/usayrikausar/Kausar-Excellence-WebApp.git"
KEY_PATH="$HOME/.secrets/kausar-prod-key.json"
PROJECT_ID="kausar-excellence-web-app"
DEPLOY_TARGETS="hosting"

if [ "${1:-}" = "--only" ]; then
  DEPLOY_TARGETS="$2"
fi

if [ ! -f "$KEY_PATH" ]; then
  echo "Missing service account key at $KEY_PATH" >&2
  echo "Copy the kausar-excellence-web-app-firebase-adminsdk-*.json key there first (chmod 600)." >&2
  exit 1
fi

if [ ! -d "$WORKSPACE/.git" ]; then
  echo "No deploy workspace found at $WORKSPACE — cloning fresh..."
  mkdir -p "$(dirname "$WORKSPACE")"
  git clone "$REPO_URL" "$WORKSPACE"
fi

cd "$WORKSPACE"

echo "== Syncing to latest pushed main =="
git fetch origin main
git reset --hard origin/main
# This workspace is a deploy mirror only — never edit files here directly.
# Any local changes here would be discarded by the reset above.

echo "== Installing dependencies (Linux-native) =="
npm install

if echo "$DEPLOY_TARGETS" | grep -q "functions"; then
  echo "== Installing functions/ dependencies =="
  (cd functions && npm install)
fi

echo "== Deploying [$DEPLOY_TARGETS] to $PROJECT_ID =="
export FUNCTIONS_DISCOVERY_TIMEOUT=120000
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_PATH"
npx firebase experiments:enable webframeworks
npx firebase deploy --only "$DEPLOY_TARGETS" --project "$PROJECT_ID"

if echo "$DEPLOY_TARGETS" | grep -q "hosting"; then
  echo "== Re-asserting minInstances (Firebase's own tooling can't set this — see ensure-min-instances.mjs) =="
  node scripts/ensure-min-instances.mjs "$KEY_PATH"
fi

echo "== Deploy complete =="
echo "Live at: https://kausar-excellence-web-app.web.app"
