#!/usr/bin/env bash
# Production start for Render (and similar hosts). Binds 0.0.0.0:$PORT.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
PORT="${PORT:-8000}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"
else
  PYTHON="${PYTHON:-python}"
fi
exec "$PYTHON" -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
