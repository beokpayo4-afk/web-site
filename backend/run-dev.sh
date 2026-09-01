#!/usr/bin/env bash
# Nexora API on 8001 — avoids conflict when another app uses port 8000.
set -euo pipefail
cd "$(dirname "$0")"
uvicorn main:app --reload --host 127.0.0.1 --port 8001
