"""Quick page-to-PNG rendering for browser thumbnails.

Uses PyMuPDF (fitz) instead of pdfplumber/pypdfium2 because pypdfium2 is
not thread-safe — when the browser requests several thumbnails in parallel,
pypdfium2 crashes the worker process with native access violations. PyMuPDF
allows independent Document instances per call which is safe.
"""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF


def page_count(pdf_path: Path) -> int:
    with fitz.open(str(pdf_path)) as doc:
        return doc.page_count


def render_thumbnail(pdf_path: Path, page_idx: int, dpi: int = 96) -> bytes:
    """Render a single page to PNG bytes. One fresh fitz handle per call,
    so concurrent requests do not share state."""
    with fitz.open(str(pdf_path)) as doc:
        page = doc.load_page(page_idx)
        scale = dpi / 72.0
        pm = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return pm.tobytes("png")
