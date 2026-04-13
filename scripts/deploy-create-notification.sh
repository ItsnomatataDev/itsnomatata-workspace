#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTION_NAME="create-notification"
PROJECT_REF="${SUPABASE_PROJECT_REF:-${1:-}}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed or not on PATH."
  exit 1
fi

if [[ -z "$PROJECT_REF" ]]; then
  echo "Usage: SUPABASE_PROJECT_REF=<project-ref> npm run deploy:function:create-notification"
  echo "   or: npm run deploy:function:create-notification -- <project-ref>"
  exit 1
fi

cd "$ROOT_DIR"

echo "Deploying edge function '$FUNCTION_NAME' to project '$PROJECT_REF'..."
supabase functions deploy "$FUNCTION_NAME" --project-ref "$PROJECT_REF"

echo "Deployment complete."