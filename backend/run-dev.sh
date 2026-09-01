#!/usr/bin/env bash
# Nexora API on 8001 — local development only (not for Render).
set -euo pipefail
cd "$(dirname "$0")"

if [[ -n "${RENDER:-}" || -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]]; then
  echo "Render detected — using production start (start.sh)." >&2
  exec bash "$(dirname "$0")/start.sh"
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
