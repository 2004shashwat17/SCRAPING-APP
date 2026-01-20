#!/usr/bin/env bash
set -euo pipefail

echo "Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x720x24 -ac &
XVFB_PID=$!
export DISPLAY=:99

VNC_AUTH_FILE=/tmp/vnc_passwd
if [ ! -f "$VNC_AUTH_FILE" ]; then
  echo "No VNC password file found; creating a temporary random password"
  PASS=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)
  echo "$PASS" | x11vnc -storepasswd - $VNC_AUTH_FILE || true
  echo "Temporary VNC password: $PASS"
fi

echo "Starting x11vnc..."
x11vnc -display :99 -rfbauth $VNC_AUTH_FILE -forever -shared -rfbport 5900 &
VNC_PID=$!

echo "Starting websockify (noVNC web front-end) on port 6080..."
# websockify serves the noVNC files and proxies to localhost:5900
websockify --web /opt/noVNC 6080 localhost:5900 &
WEBSOCKIFY_PID=$!

echo "Starting Node app..."
npm start

# on exit do cleanup
trap 'echo "Shutting down..."; kill $WEBSOCKIFY_PID $VNC_PID $XVFB_PID || true' EXIT
