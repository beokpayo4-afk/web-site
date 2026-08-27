# Nexora

Original full-stack e-commerce platform (React + Django). Inspired by typical storefront information architecture only — no copied source, logos, images, or product copy.

```
frontend/   React, TypeScript, Vite, Tailwind CSS
backend/    Django, Django REST Framework, PostgreSQL, JWT
docs/       Architecture, API, database, setup, plan
```

## Phase 1 — local setup

### 1. Environment

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_ENGINE=postgres` and `DATABASE_URL` in `.env`. Never commit `.env`. If a database password contains `@`, encode it as `%40`.

### 2. PostgreSQL

```bash
psql -U postgres -h localhost -c "CREATE ROLE nexora LOGIN PASSWORD 'choose-a-password';"
psql -U postgres -h localhost -c "CREATE DATABASE nexora OWNER nexora;"
```

### 3. Backend

```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py runserver
```

Health check: [http://localhost:8000/api/v1/health/](http://localhost:8000/api/v1/health/)

Expected:

```json
{"status": "ok"}
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

### 5. Checks

```bash
cd backend && python manage.py test && python manage.py check
cd frontend && npm run lint && npm run typecheck
```

Full instructions: [docs/setup.md](docs/setup.md)

Payment credentials and webhook setup: [docs/payments.md](docs/payments.md)
