"""Render PDF pages to PIL images for the conversion pipeline.

Both this module and page_render.py sit on top of pypdfium2 (PDFium),
which is NOT thread-safe at the C level. Each module owns its own
threading.Lock so:
- The conversion pipeline (this file) serialises page rendering during
  a conversion job. Pages run sequentially anyway.
- Browser thumbnails (page_render.py) serialise their own concurrent
  calls behind a separate lock.

The two locks are independent: each path opens its own PdfDocument,
holds it only inside its own lock, and closes it before the lock
releases. They never share state.

Earlier versions used PyMuPDF (AGPL-3.0) for the thumbnail path because
pypdfium2's thread-safety was thinner; we removed PyMuPDF to keep the
licence matrix copyleft-free for LAN-served use.
"""
from __future__ import annotations

import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import pdfplumber
from PIL import Image


# Module-global lock guarding any pdfplumber/pypdfium2 use below.
_pdf_lock = threading.Lock()


@contextmanager
def open_pdf_pages(pdf_path: Path) -> Iterator[list]:
    """Open a PDF and yield its pages list, holding the pdfplumber lock
    for the entire iteration. Caller iterates pages inside the with-block.

    Usage:
        with open_pdf_pages(path) as pages:
            for i, page in enumerate(pages):
                pil, w_pt, h_pt = render_page(page, dpi=200)
                ...
    """
    with _pdf_lock:
        with pdfplumber.open(str(pdf_path)) as pdf_file:
            yield pdf_file.pages


def render_page(page, dpi: int) -> tuple[Image.Image, float, float]:
    """Render one pdfplumber page to (RGB PIL image, page_w_pt, page_h_pt)."""
    page_w_pt = float(page.width)
    page_h_pt = float(page.height)
    page_image = page.to_image(resolution=dpi)
    pil = page_image.original.convert("RGB")
    return pil, page_w_pt, page_h_pt
