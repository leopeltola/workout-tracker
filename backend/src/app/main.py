from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import auth, exercises, logs, me

app = FastAPI(title=settings.app_name, version="0.1.0")


@app.middleware("http")
async def cache_control(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path in ("/", "/index.html", "/sw.js", "/manifest.webmanifest"):
        # Never let browsers keep a stale app shell or service worker.
        response.headers["Cache-Control"] = "no-cache"
    elif path.startswith("/assets/"):
        # Hashed filenames are immutable; cache aggressively.
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "env": settings.env}


app.include_router(auth.router)
app.include_router(me.router)
app.include_router(exercises.router)
app.include_router(logs.router)

_static_dir = Path(settings.static_dir)
if (_static_dir / "index.html").is_file():
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file = _static_dir / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(_static_dir / "index.html")


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # noqa: S104 - bind all interfaces inside the container
        port=8000,
        reload=settings.env == "development",
    )


if __name__ == "__main__":
    main()
