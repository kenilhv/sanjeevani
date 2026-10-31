#!/bin/bash
# Runs the Sanjeevni gateway (HTTP API + WebSocket events) next to the actor runtime.
# On Windows run via WSL:  wsl -d Ubuntu-24.04 -- bash backend/gateway.sh
# Windows apps reach it at http://localhost:8787 and ws://localhost:8787/events.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"
if [ -f ../.env ]; then set -a; source <(sed 's/\r$//' ../.env); set +a; fi
terse actor generate --non-interactive > /dev/null
exec bun gateway/server.ts
