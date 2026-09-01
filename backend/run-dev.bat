@echo off
cd /d "%~dp0"
set "ROOT=%~dp0.."
if exist "%ROOT%\.venv\bin\python" (
  "%ROOT%\.venv\bin\python" -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
) else if exist "%ROOT%\.venv\Scripts\python.exe" (
  "%ROOT%\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
) else (
  python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
)
