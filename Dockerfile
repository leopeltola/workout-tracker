# syntax=docker/dockerfile:1

# --- Frontend build ---------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Runtime (FastAPI + built frontend) -------------------------------------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runtime
WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/src ./src
RUN uv sync --frozen --no-dev

COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/entrypoint.sh ./

COPY --from=frontend /build/dist ./frontend_dist

RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
