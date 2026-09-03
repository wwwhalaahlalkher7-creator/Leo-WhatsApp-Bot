#!/bin/sh
set -eu
# Velrix keeps the service process alive; PM2/systemd is not required.
# Use --pairing-code only for the first WhatsApp login.
exec node index.js "$@"
