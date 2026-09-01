#!/usr/bin/env bash
# Production start for Render (and similar hosts). Binds 0.0.0.0:$PORT.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
