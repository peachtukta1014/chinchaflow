#!/usr/bin/env bash
# Materialize apps/*/.env.local from Cursor Cloud Agent Dashboard secrets.
# Safe to run locally: no-op when VITE_FIREBASE_API_KEY is unset.
set -euo pipefail

if [ -z "${VITE_FIREBASE_API_KEY:-}" ]; then
  echo "[materialize-cloud-env] VITE_FIREBASE_API_KEY not set — skip"
  exit 0
fi

write_env() {
  local target="$1"
  local app_id="$2"
  cat > "$target" <<EOF
VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
VITE_FIREBASE_DATABASE_URL=${VITE_FIREBASE_DATABASE_URL:-}
VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
VITE_FIREBASE_APP_ID=${app_id}
EOF
  echo "[materialize-cloud-env] wrote $target"
}

if [ -z "${VITE_FIREBASE_APP_ID_SHRIMP:-}" ]; then
  echo "[materialize-cloud-env] VITE_FIREBASE_APP_ID_SHRIMP missing — skip shrimp"
else
  write_env "apps/seafood-pos/.env.local" "${VITE_FIREBASE_APP_ID_SHRIMP}"
fi

if [ -z "${VITE_FIREBASE_APP_ID_TEA:-}" ]; then
  echo "[materialize-cloud-env] VITE_FIREBASE_APP_ID_TEA missing — skip tea"
else
  write_env "apps/chincha-tea/.env.local" "${VITE_FIREBASE_APP_ID_TEA}"
fi
