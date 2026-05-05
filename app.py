"""Entrypoint: starts the FastAPI server and opens the browser.

Run with:
    python app.py
"""
from __future__ import annotations

import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    import uvicorn

    from src.settings import settings

    settings.ensure_dirs()

    url = f"http://{settings.host}:{settings.port}/"

    def _open_browser_when_ready() -> None:
        # Small delay so the server is up before the browser hits it.
        time.sleep(1.0)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open_browser_when_ready, daemon=True).start()

    print(f"\n  PDF to Editable PowerPoint -- serving at {url}")
    print("  Press Ctrl+C to stop.\n")

    uvicorn.run(
        "src.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
