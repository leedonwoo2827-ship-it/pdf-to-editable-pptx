"""Render PDF pages to PIL images for the conversion pipeline.

Why pdfplumber here and PyMuPDF in page_render.py:
- pdfplumber sits on top of pypdfium2, which is NOT thread-safe. Multiple
  pypdfium2 calls in flight at the same process crash inside native code.
- The conversion pipeline runs page-by-page anyway, so a single global
  lock around pdfplumber.open is cheap and avoids a class of native
  crashes if someone later parallelises the loop or starts a second
  conversion while one is in flight.
- Browser thumbnails go through PyMuPDF (page_render.py) which IS
  thread-safe. Don't conflate the two paths.
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
