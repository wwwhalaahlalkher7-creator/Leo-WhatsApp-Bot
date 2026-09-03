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

exec "$@"
