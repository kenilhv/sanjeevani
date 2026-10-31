#!/bin/bash
# Mirrors backend/ to WSL's Linux filesystem (~/sanjeevni/backend), where Terse builds in seconds
# instead of minutes, and where its file watcher actually sees changes.
# Usage (WSL):  bash backend/sync.sh          one-off sync
#               bash backend/sync.sh --watch  keep syncing every second
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/sanjeevni/backend"
mkdir -p "$DEST"
cp -f "$SRC/../.env" "$HOME/sanjeevni/.env" 2>/dev/null || true
sync_once() {
    rsync -a --delete --exclude node_modules --exclude generated --exclude .durable-actors --exclude gateway/.relay-tokens.json "$SRC/" "$DEST/"
}
sync_once
if [ ! -d "$DEST/node_modules" ]; then (cd "$DEST" && "$HOME/.bun/bin/bun" install --silent); fi
if [ "$1" = "--watch" ]; then
    while true; do sleep 1; sync_once; done
fi
