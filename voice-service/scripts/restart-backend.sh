#!/usr/bin/env bash
# The restart moment: kill the local actor runtime, start it again, and let the
# Durable Actors reload every patient's story from SQLite (<actor project>/.durable-actors).
# Point RESTART_CMD at this script in .env. Only works when the actor runtime runs on THIS machine;
# if it runs on Aditya's laptop, make RESTART_CMD an ssh command that runs this script there.
# Checked with durable-actors 0.14.6: killing the runtime does not respawn it, and state survives even kill -9.
set -euo pipefail
ACTORS_DIR="${ACTORS_DIR:?set ACTORS_DIR to the actor project folder}"
# Not named PORT: that's inherited from this service's .env (8787) and would leak into the runtime.
ACTOR_PORT="${DURABLE_ACTORS_PORT:-7100}"
LOG="$(cd "$(dirname "$0")/.." && pwd)/.restart.log"
BUN_BIN="$(command -v bunx || true)"
if [ -z "$BUN_BIN" ]; then echo "bunx not found on PATH (install Bun 1.4.2+)" >&2; exit 1; fi

pkill -f "durable-actors dev" || true
pids="$(lsof -ti tcp:"$ACTOR_PORT" -sTCP:LISTEN || true)"
if [ -n "$pids" ]; then kill $pids || true; fi
for _ in $(seq 1 20); do lsof -ti tcp:"$ACTOR_PORT" -sTCP:LISTEN >/dev/null || break; sleep 0.25; done

cd "$ACTORS_DIR"
# Clean environment, so the runtime reads only the actor project's own .env (e.g. its OPENAI_API_KEY),
# exactly as when Aditya starts it by hand. Otherwise an empty key in this service's .env would win.
env -i HOME="$HOME" USER="${USER:-}" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" DURABLE_ACTORS_PORT="$ACTOR_PORT" \
  nohup "$BUN_BIN" durable-actors dev >"$LOG" 2>&1 &
pid=$!

# Return once it's listening, so a failed start shows up as an error instead of a 30s timeout.
for _ in $(seq 1 60); do
  if lsof -ti tcp:"$ACTOR_PORT" -sTCP:LISTEN >/dev/null; then
    echo "actor runtime back on :$ACTOR_PORT (pid $pid), log: $LOG"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "actor runtime exited during startup. Last log lines:" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  sleep 0.5
done
echo "actor runtime not listening on :$ACTOR_PORT after 30s, log: $LOG" >&2
exit 1
