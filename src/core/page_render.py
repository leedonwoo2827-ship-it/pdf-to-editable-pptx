"""Quick page-to-PNG rendering for browser thumbnails.

Uses pypdfium2 (PDFium, Apache 2.0 / BSD-3) directly. Earlier versions of
this module used PyMuPDF for its native thread-safety, but PyMuPDF's
AGPL-3.0 licence triggers source-disclosure obligations the moment the app
is served over the network — and this project is intended to also run as
a small LAN server for colleagues without GPUs. Switching to pypdfium2
keeps the licence matrix copyleft-free.

PDFium itself is not fully thread-safe at the C level, so we serialise
all pypdfium2 calls in this module behind a single lock. The conversion
pipeline has its own independent lock in pdf_pages.py — they hold
separate `PdfDocument` instances and never share state, so the two locks
do not need to coordinate.
"""
from __future__ import annotations

import io
import threading
from pathlib import Path

import pypdfium2 as pdfium


# Module-global lock guarding every pypdfium2 call below.
# Concurrent thumbnail requests (which Alpine.js fires off in parallel
# when the user lands on the page list) get serialised here — fine for
# a single-user local app, and avoids native crashes inside PDFium.
_pdfium_lock = threading.Lock()


def page_count(pdf_path: Path) -> int:
    """Return the page count for a PDF file."""
    with _pdfium_lock:
        pdf = pdfium.PdfDocument(str(pdf_path))
        try:
            return len(pdf)
        finally:
            pdf.close()


def render_thumbnail(pdf_path: Path, page_idx: int, dpi: int = 96) -> bytes:
    """Render a single page to PNG bytes.

    Each call opens its own PdfDocument so we never hold a reference
    across calls — combined with the module lock, this keeps PDFium's
    state strictly per-call.
    """
    scale = dpi / 72.0
    with _pdfium_lock:
        pdf = pdfium.PdfDocument(str(pdf_path))
        try:
            page = pdf[page_idx]
            try:
                # render() returns a PdfBitmap; .to_pil() copies the
                # buffer into a standalone PIL.Image we can use after
                # closing the bitmap/page/pdf below.
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                bitmap.close()
            finally:
                page.close()
        finally:
            pdf.close()

    buf = io.BytesIO()
    pil_image.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()
