#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-${1:-zirftywinscopzuuwdlg}}"
FUNCTIONS=("livekit-token" "livekit-guest-token")

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
echo "Done. Confirm Edge secrets:"
echo "  LIVEKIT_URL=wss://meet.itsnomatata.com"
echo "  LIVEKIT_API_KEY, LIVEKIT_API_SECRET (match infra/livekit/livekit.yaml)"
echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions"
