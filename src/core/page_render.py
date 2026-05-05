"""Quick page-to-PNG rendering for browser thumbnails (independent of conversion)."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pdfplumber


def page_count(pdf_path: Path) -> int:
    with pdfplumber.open(str(pdf_path)) as f:
        return len(f.pages)


def render_thumbnail(pdf_path: Path, page_idx: int, dpi: int = 96) -> bytes:
    """Lightweight thumbnail render for the UI. Lower DPI than conversion."""
    with pdfplumber.open(str(pdf_path)) as f:
        page = f.pages[page_idx]
        page_image = page.to_image(resolution=dpi)
        pil = page_image.original
        buf = BytesIO()
        pil.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
