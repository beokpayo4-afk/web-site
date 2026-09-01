# Setup

## Prerequisites

- Node.js 20+
- Python 3.10+
- PostgreSQL 14+ (18 is fine)

## Phase 1 — project foundation

This phase covers the monorepo, Django + DRF, PostgreSQL via env vars, CORS, the health API, and the React application shell.

### 1. Environment

From the repo root:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Edit `.env`. Never commit it.

```
DATABASE_ENGINE=postgres
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/nexora
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

If the password contains `@`, encode it as `%40` in the URL.

Frontend:

```
VITE_API_URL=http://127.0.0.1:8001
```

Production (Vercel): set `VITE_API_URL=https://web-site-1-wecz.onrender.com`.

### 2. PostgreSQL (once)

```bash
psql -U postgres -h localhost -c "CREATE ROLE nexora LOGIN PASSWORD 'choose-a-password';"
psql -U postgres -h localhost -c "CREATE DATABASE nexora OWNER nexora;"
```

### 3. Backend

From the repo root (Git Bash on Windows):

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py runserver
```

Health: http://localhost:8000/api/v1/health/

```json
{"status": "ok"}
```

`python manage.py seed_catalog` is optional and belongs to later catalogue work, not Phase 1.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (Vite may use 5174 if 5173 is busy). CORS allowlist includes both.

ESLint: `npm run lint`  
Prettier: `npm run format`  
Typecheck: `npm run typecheck`

### 5. Quality commands

```bash
cd backend
python manage.py test
python manage.py check

cd ../frontend
npm run lint
npm run typecheck
npm run build
```

## Conventions

- Do not copy assets or copy from the reference website.
- Do not put secrets or payment credentials in frontend code. Production payment keys belong in server environment variables only. See [payments.md](payments.md).
- Django tests use SQLite even when runtime uses PostgreSQL.
- Later phases (auth, catalog, cart, checkout) already have code in this repo; do not delete them while working on foundation.
