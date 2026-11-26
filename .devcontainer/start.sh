#!/usr/bin/env bash
# Starts DayMate AI in the background and makes the preview link public.
cd "$(dirname "$0")/.."
[ -d client/dist ] || (npm run setup && npm run build)
pkill -f "node server/index.js" 2>/dev/null
nohup env PORT=5000 node server/index.js > /tmp/daymate.log 2>&1 &
sleep 4
if [ -n "$CODESPACE_NAME" ]; then
  gh codespace ports visibility 5000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
  echo "DayMate AI: https://${CODESPACE_NAME}-5000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi
