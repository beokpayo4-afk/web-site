#!/usr/bin/env bash
# Local dev: ./run-dev.sh  (127.0.0.1:8001, reload)
# On Render/PaaS: auto-delegates to start.sh (0.0.0.0:$PORT)
set -euo pipefail
cd "$(dirname "$0")"

_on_production_host() {
  [[ -n "${RENDER:-}" ]] && return 0
  [[ -n "${RENDER_SERVICE_ID:-}" ]] && return 0
  [[ -n "${RENDER_EXTERNAL_HOSTNAME:-}" ]] && return 0
  [[ -n "${RENDER_EXTERNAL_URL:-}" ]] && return 0
  # Render injects PORT for web services; local dev does not set it.
  [[ -n "${PORT:-}" && "${NEXORA_LOCAL_DEV:-}" != "1" ]] && return 0
  return 1
}

if _on_production_host; then
  echo "Production host detected — starting with start.sh." >&2
  exec bash "$(dirname "$0")/start.sh"
fi

export NEXORA_LOCAL_DEV=1
ROOT="$(cd .. && pwd)"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"
else
  PYTHON="${PYTHON:-python}"
fi
exec "$PYTHON" -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
