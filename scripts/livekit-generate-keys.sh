#!/usr/bin/env bash
set -euo pipefail

echo "Generating LiveKit API key pair..."
echo ""

if command -v docker >/dev/null 2>&1; then
  docker run --rm livekit/livekit-server:v1.8 generate-keys
  exit 0
fi

if command -v livekit-server >/dev/null 2>&1; then
  livekit-server generate-keys
  exit 0
fi

echo "Install Docker or livekit-server, then re-run this script."
exit 1
