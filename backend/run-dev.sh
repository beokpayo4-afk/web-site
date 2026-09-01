#!/usr/bin/env bash
# Nexora API on 8001 — local development only (not for Render).
set -euo pipefail
cd "$(dirname "$0")"

if [[ -n "${RENDER:-}" || -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]]; then
  echo "error: run-dev.sh is for local development only." >&2
  echo "On Render, set Start Command to: bash start.sh" >&2
  exit 1
fi

ROOT="$(cd .. && pwd)"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"
else
  PYTHON="${PYTHON:-python}"
fi
exec "$PYTHON" -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
