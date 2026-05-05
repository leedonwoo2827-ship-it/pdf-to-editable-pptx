from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.routes import router as api_router

ROOT = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = ROOT / "static"


def create_app() -> FastAPI:
    app = FastAPI(title="PDF to Editable PowerPoint")

    app.include_router(api_router)

    if STATIC_DIR.exists():
        # Mount static assets at /static (for app.js, styles.css)
        app.mount(
            "/static",
            StaticFiles(directory=str(STATIC_DIR)),
            name="static",
        )

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
