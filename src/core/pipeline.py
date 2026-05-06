"""End-to-end conversion: PDF in, editable PPTX out.

Composes ocr.OcrEngine + inpaint.InpaintEngine + pdf_pages + mask +
slide_writer + workspace into a single function. The HTTP layer
(src/api/routes.py) calls convert_pdf_to_pptx() per upload and
assemble_pptx_from_workspace() when the user re-exports after edits.

Engines are heavy to load (PyTorch model weights etc.), so we keep
one shared Engines instance per process via get_engines().
"""
from __future__ import annotations

import gc
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from src.core import pdf_pages, slide_writer, workspace
from src.core.inpaint import InpaintEngine
from src.core.mask import build_mask
from src.core.ocr import OcrEngine, OcrResult


# on_page_progress callback signature.
ProgressCallback = Callable[[int, str, dict], None]
CancelFlag = Callable[[], bool]


@dataclass
class Engines:
    """The two heavy resources used by the pipeline. Loaded lazily on
    first use; safe to construct without an internet connection."""
    ocr: OcrEngine
    inpaint: InpaintEngine

    def ensure_loaded(self) -> None:
        self.ocr.ensure_loaded()
        self.inpaint.ensure_loaded()

    @property
    def is_gpu(self) -> bool:
        return self.inpaint.is_gpu


def _ocr_to_blocks_and_heights(
    ocr_results: list[OcrResult], scale_factor: float
) -> tuple[list[dict], list[float]]:
    """Convert filtered OCR hits to the block dict shape used by
    workspace and slide_writer, plus the raw bbox heights for adaptive
    sizing decisions upstream."""
    blocks: list[dict] = []
    heights: list[float] = []
    for r in ocr_results:
        xs = [p[0] for p in r.box]
        ys = [p[1] for p in r.box]
        blocks.append({
            "text": r.text,
            "x_pt": min(xs) * scale_factor,
            "y_pt": min(ys) * scale_factor,
            "w_pt": (max(xs) - min(xs)) * scale_factor,
            "h_pt": (max(ys) - min(ys)) * scale_factor,
            "score": r.score,
        })
        heights.append(max(ys) - min(ys))
    return blocks, heights


def process_page(
    engines: Engines,
    pil_image,
    dpi: int,
    base_dilation_px: int,
):
    """Run OCR + inpainting on a single page image. Returns
    (cleaned_bg_image, text_blocks_list)."""
    import numpy as np  # local import to keep this module's top light

    engines.ensure_loaded()

    img_np = np.array(pil_image)
    page_h_px, page_w_px = img_np.shape[:2]

    ocr_results = engines.ocr.detect_two_pass(img_np, page_w_px, page_h_px)

    scale_factor = 72.0 / dpi  # px -> pt
    blocks, _heights = _ocr_to_blocks_and_heights(ocr_results, scale_factor)

    mask_np, _bbox_heights = build_mask(
        page_h_px, page_w_px, ocr_results, base_dilation_px
    )

    from PIL import Image as _PILImage  # local import for the same reason
    mask_pil = _PILImage.fromarray(mask_np)
    cleaned = engines.inpaint.inpaint(pil_image, mask_pil)

    del img_np, mask_np, mask_pil
    engines.inpaint.empty_cache()
    gc.collect()

    return cleaned, blocks


def convert_pdf_to_pptx(
    pdf_path: Path,
    output_path: Path,
    dpi: int = 200,
    dilation: int = 15,
    engines: Optional[Engines] = None,
    on_page_progress: Optional[ProgressCallback] = None,
    cancel_flag: Optional[CancelFlag] = None,
    workspace_dir: Optional[Path] = None,
) -> Path:
    """Convert one PDF into an editable PPTX.

    on_page_progress(page_idx, state, info) is called as the pipeline
    moves; state is one of: rendering, ocr, inpainting, done, error.
    info carries extra detail (text_block_count, elapsed_s, message)."""
    if engines is None:
        engines = get_engines()
    engines.ensure_loaded()

    prs = slide_writer.new_presentation()

    with pdf_pages.open_pdf_pages(pdf_path) as pages:
        for i, page in enumerate(pages):
            if cancel_flag and cancel_flag():
                raise RuntimeError("Cancelled by user")

            t0 = time.monotonic()

            if on_page_progress:
                on_page_progress(i, "rendering", {})

            try:
                pil_image, page_w_pt, page_h_pt = pdf_pages.render_page(page, dpi)
            except Exception as exc:
                if on_page_progress:
                    on_page_progress(i, "error", {"message": f"render failed: {exc}"})
                continue

            if on_page_progress:
                on_page_progress(i, "ocr", {})
            try:
                cleaned, blocks = process_page(engines, pil_image, dpi, dilation)
            except Exception as exc:
                if on_page_progress:
                    on_page_progress(i, "error", {"message": f"OCR/inpaint failed: {exc}"})
                continue

            if on_page_progress:
                on_page_progress(i, "inpainting", {"text_block_count": len(blocks)})

            # Persist before slide assembly so a later assembly bug
            # doesn't lose the OCR+inpaint work.
            if workspace_dir is not None:
                try:
                    workspace.save_page_state(
                        workspace_dir, i, cleaned, blocks, page_w_pt, page_h_pt
                    )
                except Exception:
                    pass

            slide_writer.add_page_slide(prs, cleaned, blocks, page_w_pt, page_h_pt)

            elapsed = time.monotonic() - t0
            if on_page_progress:
                on_page_progress(
                    i,
                    "done",
                    {"text_block_count": len(blocks), "elapsed_s": round(elapsed, 1)},
                )

            del pil_image, cleaned
            gc.collect()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))
    return output_path


def assemble_pptx_from_workspace(workspace_dir: Path, output_path: Path) -> Path:
    """Rebuild a PPTX from saved per-page state (background PNG + blocks
    JSON). Used after the user has edited blocks in the browser review
    UI and wants a fresh .pptx."""
    prs = slide_writer.new_presentation()

    for _idx, data, bg_path in workspace.iter_pages(workspace_dir):
        page_w_pt = float(data["page_w_pt"])
        page_h_pt = float(data["page_h_pt"])
        blocks = data.get("blocks", []) or []
        slide_writer.add_page_slide(prs, bg_path, blocks, page_w_pt, page_h_pt)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))
    return output_path


# ----- Shared engines (one set per process, lazy-loaded) -----------------

_engines: Optional[Engines] = None
_engines_lock = threading.Lock()


def get_engines() -> Engines:
    """Return the process-wide Engines instance, creating it if needed.
    Models are not loaded until ensure_loaded() is called on the
    returned instance — get_engines() itself is cheap."""
    global _engines
    with _engines_lock:
        if _engines is None:
            _engines = Engines(ocr=OcrEngine(), inpaint=InpaintEngine())
        return _engines
