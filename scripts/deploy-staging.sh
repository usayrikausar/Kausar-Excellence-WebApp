#!/usr/bin/env bash
# Deploys to the STAGING project (staging-kausar-excell-web-app) — demo data
# only, for trying changes before they go live. Same approach as
# deploy-prod.sh (see there for why it runs from a WSL-native copy), but
# with its own workspace, its own key and its own .env.production, so a
# staging build can never talk to the live project.
#
# USAGE (from Windows Git Bash / PowerShell):
#   wsl.exe -e bash "/mnt/c/Users/Surface Laptop 4/BNI IKON CS Session/kausar-webapp/scripts/deploy-staging.sh"
# Options:
#   --branch <name>   deploy a pushed branch instead of main (try a change before merging)
#   --only <targets>  default "hosting"; first deploy needs
#                     --only hosting,functions,firestore:rules,firestore:indexes,storage
#
# No minInstances step: staging is allowed to sleep (first load after a quiet
# spell takes a few seconds), which keeps it close to free.

set -euo pipefail

WORKSPACE="$HOME/deploy-workspace/kausar-webapp-staging"
REPO_URL="https://github.com/usayrikausar/Kausar-Excellence-WebApp.git"
KEY_PATH="$HOME/.secrets/kausar-staging-key.json"
PROJECT_ID="staging-kausar-excell-web-app"
BRANCH="main"
DEPLOY_TARGETS="hosting"

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --only) DEPLOY_TARGETS="$2"; shift 2 ;;
    *) echo "Unknown option: $1 (use --branch <name> and/or --only <targets>)" >&2; exit 1 ;;
  esac
done

case "$PROJECT_ID" in
  staging-*) ;;
  *) echo "Refusing to run: $PROJECT_ID is not a staging project." >&2; exit 1 ;;
esac

if [ ! -f "$KEY_PATH" ]; then
  echo "Missing staging service account key at $KEY_PATH" >&2
  exit 1
fi
if ! grep -q "\"project_id\": \"$PROJECT_ID\"" "$KEY_PATH"; then
  echo "Refusing to run: $KEY_PATH is not a key for $PROJECT_ID." >&2
  exit 1
fi

if [ ! -d "$WORKSPACE/.git" ]; then
  echo "No staging workspace found at $WORKSPACE — cloning fresh..."
  mkdir -p "$(dirname "$WORKSPACE")"
  git clone "$REPO_URL" "$WORKSPACE"
fi

cd "$WORKSPACE"

echo "== Syncing to pushed branch: $BRANCH =="
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Rewritten on every run (these files are gitignored, so the reset above
# leaves them alone) — the staging project's public web config.
cat > .env.production <<'ENV'
NEXT_PUBLIC_FIREBASE_PROJECT_ID=staging-kausar-excell-web-app
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAdVbJBHJmPbSDgB5RT-rqxykzOeGfd6tU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=staging-kausar-excell-web-app.firebaseapp.com
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_APP_ENV=staging
GCLOUD_PROJECT=staging-kausar-excell-web-app
ENV
# Same Turbopack workaround as .env.kausar-excellence-web-app (Firebase reads .env.<projectId>).
echo "IS_WEBPACK_TEST=1" > ".env.$PROJECT_ID"
rm -f .env.production.local .env.local

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

echo "== Staging deploy complete: https://$PROJECT_ID.web.app =="
