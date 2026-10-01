#!/bin/bash
# desk.local one-time setup
# Generates a self-signed cert, registers the nginx site, and adds /etc/hosts entry.
# Re-run any time the cert expires (~365 days) or to redo the wiring.

set -e

DOMAIN="desk.local"
PROJECT_DIR="$HOME/code/desk"
NGINX_CONF="$HOME/code/nginx-${DOMAIN}.conf"
NGINX_DEST="/etc/nginx/conf.d/${DOMAIN}.conf"
CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"

step() { printf "\n→ %s\n" "$1"; }

step "Adding ${DOMAIN} to /etc/hosts"
if grep -qE "[[:space:]]${DOMAIN}([[:space:]]|$)" /etc/hosts 2>/dev/null; then
    echo "   already present, skipping"
else
    echo "127.0.0.1 ${DOMAIN}" | sudo tee -a /etc/hosts > /dev/null
    echo "   added 127.0.0.1 ${DOMAIN}"
fi

step "Generating self-signed cert for ${DOMAIN}"
if [[ -f "${CERT_DIR}/${DOMAIN}.crt" && -f "${KEY_DIR}/${DOMAIN}.key" ]]; then
    echo "   cert already exists, skipping (delete files to regenerate)"
else
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "${KEY_DIR}/${DOMAIN}.key" \
      -out    "${CERT_DIR}/${DOMAIN}.crt" \
      -subj   "/C=RU/ST=RU/L=RU/O=Desk/CN=${DOMAIN}" \
      -addext "subjectAltName=DNS:${DOMAIN}"
    sudo chmod 644 "${CERT_DIR}/${DOMAIN}.crt"
    sudo chmod 600 "${KEY_DIR}/${DOMAIN}.key"
    echo "   cert: ${CERT_DIR}/${DOMAIN}.crt"
    echo "   key: ${KEY_DIR}/${DOMAIN}.key"
fi

step "Linking nginx config"
if [[ -L "${NGINX_DEST}" || -f "${NGINX_DEST}" ]]; then
    echo "   ${NGINX_DEST} already exists, leaving as is"
else
    sudo ln -s "${NGINX_CONF}" "${NGINX_DEST}"
    echo "   linked ${NGINX_CONF} → ${NGINX_DEST}"
fi

step "Testing nginx config"
sudo nginx -t

step "Reloading nginx"
if sudo systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx
    echo "   reloaded via systemctl"
else
    sudo nginx -s reload || sudo nginx
    echo "   reloaded (or started) nginx"
fi

echo ""
echo "✅ Open https://${DOMAIN}/ in your browser."
echo "   First visit will warn about self-signed cert — click 'Advanced' → 'Proceed'."