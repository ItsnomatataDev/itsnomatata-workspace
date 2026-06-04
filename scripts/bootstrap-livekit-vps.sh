#!/usr/bin/env bash
# Bootstrap LiveKit on the meet VPS (Ubuntu/Debian).
# Run ON THE SERVER as root: bash bootstrap-livekit-vps.sh
#
# Prerequisites:
#   - DNS A record: meet.itsnomatata.com -> this server's public IP
#   - Ports open in cloud firewall: 80, 443/tcp, 3478/udp, 7881/tcp, 50000-50100/udp

set -euo pipefail

MEET_DOMAIN="${MEET_DOMAIN:-meet.itsnomatata.com}"
INSTALL_DIR="${INSTALL_DIR:-/opt/livekit}"
REPO_INFRA="$(cd "$(dirname "$0")/../infra/livekit" && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the meet VPS."
  exit 1
fi

echo "==> Installing packages (docker, nginx, certbot, ufw)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 nginx certbot python3-certbot-nginx ufw curl

systemctl enable --now docker
systemctl enable nginx

echo "==> Opening firewall ports..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/udp
ufw allow 7881/tcp
ufw allow 50000:50100/udp
ufw --force enable || true

echo "==> Installing LiveKit files to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
cp "${REPO_INFRA}/docker-compose.yml" "${INSTALL_DIR}/"
cp "${REPO_INFRA}/livekit.yaml" "${INSTALL_DIR}/livekit.yaml"

if grep -q 'REPLACE_ME_API_KEY' "${INSTALL_DIR}/livekit.yaml"; then
  echo ""
  echo "Generate keys (on this machine or your laptop):"
  echo "  ./scripts/livekit-generate-keys.sh"
  echo ""
  echo "Edit ${INSTALL_DIR}/livekit.yaml — set keys: { YOUR_KEY: YOUR_SECRET }"
  echo "Then set the same values in Supabase → Edge Functions → Secrets:"
  echo "  LIVEKIT_URL=wss://${MEET_DOMAIN}"
  echo "  LIVEKIT_API_KEY=<key>"
  echo "  LIVEKIT_API_SECRET=<secret>"
  echo ""
  read -r -p "Press Enter after you have updated livekit.yaml..."
fi

echo "==> Starting LiveKit (Docker)..."
cd "${INSTALL_DIR}"
docker compose pull
docker compose up -d

echo "==> Configuring Nginx..."
cp "${REPO_INFRA}/nginx/meet.itsnomatata.com.conf" "/etc/nginx/sites-available/${MEET_DOMAIN}.conf"
ln -sf "/etc/nginx/sites-available/${MEET_DOMAIN}.conf" "/etc/nginx/sites-enabled/${MEET_DOMAIN}.conf"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Temporary HTTP-only config for certbot if certs do not exist yet
if [[ ! -f "/etc/letsencrypt/live/${MEET_DOMAIN}/fullchain.pem" ]]; then
  cat > "/etc/nginx/sites-available/${MEET_DOMAIN}.conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${MEET_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF
  nginx -t && systemctl reload nginx
  certbot certonly --nginx -d "${MEET_DOMAIN}" --non-interactive --agree-tos -m "admin@${MEET_DOMAIN}" || {
    echo "Certbot failed. Set CERTBOT_EMAIL and re-run certbot manually."
    exit 1
  }
  cp "${REPO_INFRA}/nginx/meet.itsnomatata.com.conf" "/etc/nginx/sites-available/${MEET_DOMAIN}.conf"
fi

nginx -t
systemctl reload nginx

echo ""
echo "Done. Verify from your laptop:"
echo "  npm run verify:livekit"
echo ""
echo "Redeploy Supabase edge functions after secret changes:"
echo "  npm run deploy:livekit-functions"
