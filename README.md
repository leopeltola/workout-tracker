# Workout Tracker

A fast, mobile-first workout logger. Log exercises per day with sets, reps and
weight. Syncs to the server so your data follows you across devices. Installable
as a PWA on iOS / Android.

- **Backend:** FastAPI (Python 3.12), SQLAlchemy, Postgres, uv
- **Frontend:** React + Vite + TypeScript + Tailwind, PWA via `vite-plugin-pwa`
- **Auth:** GitHub OAuth, provider-agnostic data model (more providers later)

## Layout

```
backend/     FastAPI app (src/app), Alembic migrations, tests
frontend/    Vite + React PWA
Dockerfile   Multi-stage: builds frontend, serves it from FastAPI
.github/     GitHub Actions CI + image publish
```

## Local development

Prerequisites: `uv`, Node 22+, Python 3.12.

```sh
# Backend
cd backend
cp .env.example .env            # optional for dev; defaults work
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

Backend tests + lint:

```sh
cd backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

## GitHub OAuth setup

1. Create an OAuth App at https://github.com/settings/developers
   - Homepage URL: `https://<your-domain>`
   - Authorization callback URL: `https://<your-domain>/api/auth/callback`
2. Copy the Client ID / Client Secret into the app's env vars
   (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
3. Set `BASE_URL=https://<your-domain>` and `ENV=production`.
4. Keep `ALLOWED_IDENTITIES=github:leopeltola` to lock signups to your account.
   To add more users, append `,github:<username>`. To open signups, leave empty.

## Deploying with Coolify + GitHub Actions

The CI pipeline (`.github/workflows/build.yml`) runs on pushes to `main` and
publishes the image to GHCR:

```
ghcr.io/<owner>/<repo>:main
```

1. **GitHub:** this repo already has Actions enabled; the workflow needs no
   secrets (it uses the automatic `GITHUB_TOKEN`, which gets `packages: write`).
2. **Coolify:** create a resource of type **Docker Image**, set the image to
   `ghcr.io/<owner>/<repo>:main`, and add a GHCR registry credential with a
   personal access token scoped to `read:packages` if the repo is private.
3. **Database:** add a Postgres database in Coolify (one-click) and point
   `DATABASE_URL` at it, e.g.
   `postgresql+psycopg://user:password@db:5432/workouts`.
   Alembic migrations run automatically on container start.
4. **Domain:** set your domain on the resource. Coolify handles TLS.

### Environment variables

Set these in Coolify:

| Variable               | Example                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `ENV`                  | `production`                                                |
| `BASE_URL`             | `https://workouts.example.com`                              |
| `DATABASE_URL`         | `postgresql+psycopg://...`                                  |
| `SESSION_SECRET`       | `openssl rand -base64 48`                                   |
| `GITHUB_CLIENT_ID`     | from the OAuth App                                          |
| `GITHUB_CLIENT_SECRET` | from the OAuth App                                          |
| `ALLOWED_IDENTITIES`   | `github:leopeltola`                                         |
| `STATIC_DIR`           | `frontend_dist` (default, leave as-is)                      |

## Installing on iPhone

1. Open the deployed site in Safari.
2. Share → **Add to Home Screen**.
3. It opens standalone, full-screen, with the app icon.

The PWA shows a "new version available" prompt when the app updates.

## Notes

- Editing past days is allowed; everything syncs to the server.
- Weights are logged in kg (empty weight = bodyweight).
- New exercises are created on the fly as you type them — no setup.
