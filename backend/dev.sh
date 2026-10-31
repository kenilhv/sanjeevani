#!/bin/bash
# Runs the local Terse actor runtime. On Windows run via WSL:  wsl -d Ubuntu-24.04 -- bash backend/dev.sh
# (Terse has no native Windows runtime.)
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"
# Secrets live in the project-root .env (may have Windows line endings).
if [ -f ../.env ]; then set -a; source <(sed 's/\r$//' ../.env); set +a; fi
export GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8787}"
# SQLite on /mnt/c (drvfs) is unreliable, so keep actor state on the Linux filesystem.
export DURABLE_ACTORS_DATA_DIR="${DURABLE_ACTORS_DATA_DIR:-$HOME/.sanjeevni/durable-actors}"
mkdir -p "$DURABLE_ACTORS_DATA_DIR"
bun install --silent
exec terse actor dev "$@"
