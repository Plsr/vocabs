#!/bin/bash
# Prepares Claude Code on the web sandboxes: deps, a local Postgres in
# Docker, and applied migrations, so agents can run the app end to end.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

pnpm install

# The sandbox ships dockerd but doesn't start it.
if ! docker info >/dev/null 2>&1; then
  nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || { echo "dockerd failed to start, see /tmp/dockerd.log" >&2; exit 1; }
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

pnpm db:up
pnpm db:migrate
