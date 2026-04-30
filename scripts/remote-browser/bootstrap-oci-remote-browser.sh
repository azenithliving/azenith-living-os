#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="${SCRIPT_DIR}/templates"

: "${REMOTE_BROWSER_HOSTNAME:?REMOTE_BROWSER_HOSTNAME is required}"
: "${APP_PROD_ORIGIN:?APP_PROD_ORIGIN is required}"
: "${REMOTE_BROWSER_VNC_PASSWORD:?REMOTE_BROWSER_VNC_PASSWORD is required}"

REMOTE_BROWSER_USER="${REMOTE_BROWSER_USER:-remotebrowser}"
REMOTE_BROWSER_RESOLUTION="${REMOTE_BROWSER_RESOLUTION:-1920x1080}"
REMOTE_BROWSER_DEPTH="${REMOTE_BROWSER_DEPTH:-24}"
CHROMIUM_START_URL="${CHROMIUM_START_URL:-about:blank}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root on the OCI VM."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  xfce4 \
  xfce4-goodies \
  tigervnc-standalone-server \
  novnc \
  websockify \
  dbus-x11 \
  caddy \
  snapd

systemctl enable --now snapd.socket
systemctl enable --now caddy

if [[ ! -e /snap ]]; then
  ln -s /var/lib/snapd/snap /snap
fi

snap install core || true
snap install chromium

if ! id -u "$REMOTE_BROWSER_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$REMOTE_BROWSER_USER"
fi

install -d -m 700 -o "$REMOTE_BROWSER_USER" -g "$REMOTE_BROWSER_USER" "/home/${REMOTE_BROWSER_USER}/.vnc"
install -d -m 755 -o "$REMOTE_BROWSER_USER" -g "$REMOTE_BROWSER_USER" "/home/${REMOTE_BROWSER_USER}/.config/autostart"

printf "%s" "$REMOTE_BROWSER_VNC_PASSWORD" | vncpasswd -f >"/home/${REMOTE_BROWSER_USER}/.vnc/passwd"
chown "$REMOTE_BROWSER_USER:$REMOTE_BROWSER_USER" "/home/${REMOTE_BROWSER_USER}/.vnc/passwd"
chmod 600 "/home/${REMOTE_BROWSER_USER}/.vnc/passwd"

sed \
  -e "s|__REMOTE_BROWSER_USER__|${REMOTE_BROWSER_USER}|g" \
  "${TEMPLATES_DIR}/xstartup" >"/home/${REMOTE_BROWSER_USER}/.vnc/xstartup"
chown "$REMOTE_BROWSER_USER:$REMOTE_BROWSER_USER" "/home/${REMOTE_BROWSER_USER}/.vnc/xstartup"
chmod 700 "/home/${REMOTE_BROWSER_USER}/.vnc/xstartup"

sed \
  -e "s|__CHROMIUM_START_URL__|${CHROMIUM_START_URL}|g" \
  "${TEMPLATES_DIR}/chromium.desktop" >"/home/${REMOTE_BROWSER_USER}/.config/autostart/chromium.desktop"
chown "$REMOTE_BROWSER_USER:$REMOTE_BROWSER_USER" "/home/${REMOTE_BROWSER_USER}/.config/autostart/chromium.desktop"
chmod 644 "/home/${REMOTE_BROWSER_USER}/.config/autostart/chromium.desktop"

sed \
  -e "s|__REMOTE_BROWSER_USER__|${REMOTE_BROWSER_USER}|g" \
  -e "s|__REMOTE_BROWSER_RESOLUTION__|${REMOTE_BROWSER_RESOLUTION}|g" \
  -e "s|__REMOTE_BROWSER_DEPTH__|${REMOTE_BROWSER_DEPTH}|g" \
  "${TEMPLATES_DIR}/browser-vnc.service" >/etc/systemd/system/browser-vnc.service

sed \
  -e "s|__REMOTE_BROWSER_USER__|${REMOTE_BROWSER_USER}|g" \
  "${TEMPLATES_DIR}/browser-websockify.service" >/etc/systemd/system/browser-websockify.service

sed \
  -e "s|__REMOTE_BROWSER_HOSTNAME__|${REMOTE_BROWSER_HOSTNAME}|g" \
  -e "s|__APP_PROD_ORIGIN__|${APP_PROD_ORIGIN}|g" \
  "${TEMPLATES_DIR}/Caddyfile" >/etc/caddy/Caddyfile

sudo -u "$REMOTE_BROWSER_USER" vncserver -kill :1 >/dev/null 2>&1 || true

systemctl daemon-reload
systemctl enable --now browser-vnc.service
systemctl enable --now browser-websockify.service
systemctl restart caddy

echo "Remote browser bootstrap completed."
echo "Viewer URL: https://${REMOTE_BROWSER_HOSTNAME}/vnc.html"
