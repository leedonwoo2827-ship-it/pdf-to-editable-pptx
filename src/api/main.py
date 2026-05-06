from __future__ import annotations

# IMPORTANT: import torch BEFORE anything that might pull in paddlepaddle.
# paddlepaddle (paddleocr's backend) tweaks Windows DLL search paths during
# its own import, which then breaks torch's shm.dll loader (WinError 127).
# Loading torch first locks its DLLs in place so the subsequent paddleocr
# import can't dislodge them. This single line fixes the import-order
# crash that otherwise blocks `start.bat` from launching the server.
import torch  # noqa: F401  (intentionally unused — preload only)

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
