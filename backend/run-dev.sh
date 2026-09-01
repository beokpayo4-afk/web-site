#!/usr/bin/env bash
# Nexora API on 8001 — avoids conflict when another app uses port 8000.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"
else
  PYTHON="${PYTHON:-python}"
fi
exec "$PYTHON" -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
