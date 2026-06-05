#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-${1:-zirftywinscopzuuwdlg}}"
FUNCTIONS=(
  "create-notification"
  "send-push-notification"
  "send-direct-email"
  "dispatch-notification-email"
  "content-studio-analyze-image"
  "check-time-tracking"
  "livekit-guest-token"
)

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed."
  echo "Install: https://supabase.com/docs/guides/cli/getting-started"
  exit 1
fi

cd "$ROOT_DIR"

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying edge function '$fn' to project '$PROJECT_REF'..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo ""
echo "Done. Set Edge secrets if you have not already:"
echo "  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT"
echo "  INTERNAL_API_KEY, N8N_NOTIFICATION_WEBHOOK_URL, N8N_NOTIFICATION_WEBHOOK_SECRET"
echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions"
