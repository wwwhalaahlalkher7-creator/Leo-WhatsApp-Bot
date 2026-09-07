#!/bin/sh
set -eu

PERSIST_ROOT="/app/persist"
PERSIST_DATA="$PERSIST_ROOT/data"
PERSIST_SESSION="$PERSIST_ROOT/session"

mkdir -p "$PERSIST_ROOT"

# Seed persistent data only on the first deployment.
if [ ! -d "$PERSIST_DATA" ]; then
  mkdir -p "$PERSIST_DATA"
  if [ -d /app/data ]; then
    cp -a /app/data/. "$PERSIST_DATA/"
  fi
fi

mkdir -p "$PERSIST_SESSION"

# Keep the application paths unchanged while storing runtime state on the
# Railway Volume mounted at /app/persist.
rm -rf /app/data /app/session
ln -s "$PERSIST_DATA" /app/data
ln -s "$PERSIST_SESSION" /app/session

# Start the YouTube PO-token provider locally for yt-dlp when available.
if [ -f /opt/bgutil-ytdlp-pot-provider/server/build/main.js ]; then
  node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --host 127.0.0.1 >/tmp/bgutil-pot-provider.log 2>&1 &
  POT_PID=$!
  trap 'kill "$POT_PID" 2>/dev/null || true' EXIT INT TERM
  sleep 1
fi

exec "$@"
