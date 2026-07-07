# RDHS Insights — Rwanda DHS Dashboard

A full-stack health analytics dashboard for Rwanda's Demographic and Health Survey (DHS) 2019–20 data.

## Architecture

| Layer | Technology | Port |
|---|---|---|
| Frontend | Next.js 15 + Tailwind CSS | 5000 |
| Backend API | Django 6 + FastAPI (via Daphne ASGI) | 8000 |
| Database | SQLite (WAL mode) | — |

The backend combines **Django** (admin panel, data management, ORM) and **FastAPI** (REST API under `/api/*`) in a single ASGI process using Daphne. The frontend proxies `/api/*` requests to the backend via Next.js rewrites.

## Running Locally

Two workflows run in parallel:

- **Start application** — `cd frontend && npm run dev` (port 5000, webview)
- **Backend API** — `cd backend && python -m daphne -b 0.0.0.0 -p 8000 rdhs_viz.asgi:application` (port 8000)

## Key URLs

- `/` — Next.js dashboard (frontend)
- `/api/docs` — FastAPI interactive docs (backend)
- `/admin/` — Django admin
- `/admin-panel/` — Custom admin panel for data upload

## Environment Variables & Secrets

| Name | Purpose |
|---|---|
| `SESSION_SECRET` | Django `SECRET_KEY` (falls back to insecure default in dev) |
| `DJANGO_DEBUG` | Set to `false` in production (defaults to `true`) |

## Data Loading

DHS datasets (.DTA Stata files) are uploaded via the admin panel at `/admin-panel/`. The backend processes them asynchronously using `pyreadstat` + `pandas`.

## User Preferences

- Keep the existing Django + Next.js monorepo structure; do not migrate to a pnpm workspace.
- Use `python -m daphne` (not the bare `daphne` binary) to ensure the `.pythonlibs` install is picked up on Replit.
