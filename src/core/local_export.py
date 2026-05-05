"""Local PDF -> editable PPTX converter.

Ported from ysrock/pdf2pptx-ai-tool with four targeted fixes:
  1. Slide canvas — fixed 16:9, each page image fit inside (letterbox)
  2. Default DPI 200 (was 100) for better OCR
  3. OCR noise filtering (low score, single chars, tiny bboxes)
  4. Font size = bbox_h * 0.65 (was 0.8 — too large)
"""
from __future__ import annotations

import gc
import threading
import time
from io import BytesIO
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np
import pdfplumber
import torch
from PIL import Image
from pptx import Presentation
from pptx.util import Emu, Pt
from rapidocr_onnxruntime import RapidOCR
from simple_lama_inpainting import SimpleLama


# Fix #1: every slide is 16:9 widescreen, EMU = 914400 per inch.
SLIDE_W_EMU = Emu(int(13.333 * 914400))
SLIDE_H_EMU = Emu(int(7.5 * 914400))
SLIDE_W_PT = 13.333 * 72
SLIDE_H_PT = 7.5 * 72

# Fix #3 thresholds
MIN_OCR_SCORE = 0.5
MIN_TEXT_LEN = 2  # at least 2 chars unless korean (single hangul ok)
MIN_BBOX_AREA_RATIO = 1e-4  # bbox_w * bbox_h / page_w * page_h


def _is_korean(s: str) -> bool:
    return any("가" <= ch <= "힣" for ch in s)


def _filter_ocr_results(ocr_result, page_w_px: int, page_h_px: int) -> list:
    """Drop noisy OCR results (Fix #3)."""
    if not ocr_result:
        return []
    page_area = max(page_w_px * page_h_px, 1)
    kept = []
    for item in ocr_result:
        try:
            box, text, score = item
        except (ValueError, TypeError):
            continue
        if not text or not text.strip():
            continue
        if score < MIN_OCR_SCORE:
            continue
        text_clean = text.strip()
        # Allow short text only if Korean or numeric/important
        if len(text_clean) < MIN_TEXT_LEN and not _is_korean(text_clean):
            continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        bw = max(xs) - min(xs)
        bh = max(ys) - min(ys)
        if bw <= 0 or bh <= 0:
            continue
        if (bw * bh) / page_area < MIN_BBOX_AREA_RATIO:
            continue
        kept.append((box, text_clean, score))
    return kept


class LocalConverter:
    """OCR + inpainting pipeline. Initialize models once, reuse across pages."""

    def __init__(self) -> None:
        self.ocr_engine: Optional[RapidOCR] = None
        self.lama: Optional[SimpleLama] = None
        self.is_gpu = False
        self._initialized = False
        self._init_lock = threading.Lock()

    def initialize_models(self) -> None:
        with self._init_lock:
            if self._initialized:
                return
            self.ocr_engine = RapidOCR()
            self.is_gpu = torch.cuda.is_available()
            if not self.is_gpu:
                # Force CPU map_location for SimpleLama's torch.jit.load
                original_jit_load = torch.jit.load
                def safe_jit_load(*args, **kwargs):
                    if "map_location" not in kwargs:
                        kwargs["map_location"] = torch.device("cpu")
                    return original_jit_load(*args, **kwargs)
                torch.jit.load = safe_jit_load
                try:
                    self.lama = SimpleLama()
                finally:
                    torch.jit.load = original_jit_load
            else:
                self.lama = SimpleLama()
            self._initialized = True

    # ------- Per-page processing -------

    def process_page(
        self,
        pil_image: Image.Image,
        dpi: int,
        dilation_size: int,
    ) -> tuple[Image.Image, list[dict]]:
        """Run OCR + inpainting on a PIL image. Returns (clean_bg, text_blocks)."""
        if not self._initialized:
            self.initialize_models()
        assert self.ocr_engine is not None and self.lama is not None

        img_np = np.array(pil_image)
        page_h_px, page_w_px = img_np.shape[:2]

        # OCR
        ocr_result, _ = self.ocr_engine(img_np)
        ocr_filtered = _filter_ocr_results(ocr_result, page_w_px, page_h_px)

        mask = np.zeros(img_np.shape[:2], dtype=np.uint8)
        text_blocks: list[dict] = []
        box_heights: list[float] = []
        scale_factor = 72.0 / dpi  # px -> pt

        for box, text, score in ocr_filtered:
            poly = np.array(box, dtype=np.float32)
            center = np.mean(poly, axis=0)
            expanded_poly = center + (poly - center) * 1.10
            pts = expanded_poly.astype(np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(mask, [pts], 255)

            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            text_blocks.append({
                "text": text,
                "x_pt": min(xs) * scale_factor,
                "y_pt": min(ys) * scale_factor,
                "w_pt": (max(xs) - min(xs)) * scale_factor,
                "h_pt": (max(ys) - min(ys)) * scale_factor,
                "score": score,
            })
            box_heights.append(max(ys) - min(ys))

        # Adaptive dilation
        if box_heights:
            avg_h = sum(box_heights) / len(box_heights)
            adaptive_dil = int(avg_h * 0.20)
            adaptive_dil = max(15, min(adaptive_dil, 40))
            final_dil = max(dilation_size, adaptive_dil)
            kernel_close = np.ones((5, 5), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
            kernel = np.ones((final_dil, final_dil), np.uint8)
            mask = cv2.dilate(mask, kernel, iterations=1)

        # Inpaint
        mask_pil = Image.fromarray(mask)
        with torch.no_grad():
            cleaned = self.lama(pil_image, mask_pil)

        # Cleanup
        del img_np, mask, mask_pil
        if self.is_gpu:
            torch.cuda.empty_cache()
        gc.collect()

        return cleaned, text_blocks


def _fit_image_to_slide(
    img: Image.Image, page_w_pt: float, page_h_pt: float
) -> tuple[float, float, float, float]:
    """Fix #1: fit page image into 16:9 slide (letterbox). Returns (left_pt, top_pt, w_pt, h_pt)."""
    page_aspect = page_w_pt / page_h_pt
    slide_aspect = SLIDE_W_PT / SLIDE_H_PT
    if abs(page_aspect - slide_aspect) < 0.01:
        return 0.0, 0.0, SLIDE_W_PT, SLIDE_H_PT
    if page_aspect > slide_aspect:
        # Page is wider -> letterbox top/bottom
        new_w = SLIDE_W_PT
        new_h = SLIDE_W_PT / page_aspect
        return 0.0, (SLIDE_H_PT - new_h) / 2, new_w, new_h
    # Page is taller -> letterbox left/right
    new_h = SLIDE_H_PT
    new_w = SLIDE_H_PT * page_aspect
    return (SLIDE_W_PT - new_w) / 2, 0.0, new_w, new_h


def convert_pdf_to_pptx(
    pdf_path: Path,
    output_path: Path,
    dpi: int = 200,
    dilation: int = 15,
    converter: Optional[LocalConverter] = None,
    on_page_progress: Optional[Callable[[int, str, dict], None]] = None,
    cancel_flag: Optional[Callable[[], bool]] = None,
) -> Path:
    """Convert one PDF into an editable PPTX.

    on_page_progress(page_idx, state, info) is called as the pipeline moves;
    state is one of: "rendering", "ocr", "inpainting", "done", "error".
    info carries extra detail (text_block_count, elapsed_s, message).
    """
    if converter is None:
        converter = LocalConverter()
        converter.initialize_models()

    prs = Presentation()
    prs.slide_width = SLIDE_W_EMU
    prs.slide_height = SLIDE_H_EMU
    blank_layout = prs.slide_layouts[6]

    with pdfplumber.open(str(pdf_path)) as pdf_file:
        total = len(pdf_file.pages)
        for i, page in enumerate(pdf_file.pages):
            if cancel_flag and cancel_flag():
                raise RuntimeError("Cancelled by user")

            t0 = time.monotonic()
            page_w_pt = float(page.width)
            page_h_pt = float(page.height)

            if on_page_progress:
                on_page_progress(i, "rendering", {})

            try:
                page_image_obj = page.to_image(resolution=dpi)
                pil_image = page_image_obj.original.convert("RGB")
            except Exception as exc:
                if on_page_progress:
                    on_page_progress(i, "error", {"message": f"render failed: {exc}"})
                continue

            if on_page_progress:
                on_page_progress(i, "ocr", {})
            try:
                cleaned, text_blocks = converter.process_page(pil_image, dpi, dilation)
            except Exception as exc:
                if on_page_progress:
                    on_page_progress(i, "error", {"message": f"OCR/inpaint failed: {exc}"})
                continue

            if on_page_progress:
                on_page_progress(i, "inpainting", {"text_block_count": len(text_blocks)})

            slide = prs.slides.add_slide(blank_layout)

            # Fix #1: letterbox the page image into the 16:9 slide
            left_pt, top_pt, fit_w_pt, fit_h_pt = _fit_image_to_slide(
                cleaned, page_w_pt, page_h_pt
            )
            scale_x = fit_w_pt / page_w_pt
            scale_y = fit_h_pt / page_h_pt

            bg_buf = BytesIO()
            cleaned.save(bg_buf, format="PNG", optimize=True)
            bg_buf.seek(0)
            slide.shapes.add_picture(
                bg_buf,
                Pt(left_pt),
                Pt(top_pt),
                width=Pt(fit_w_pt),
                height=Pt(fit_h_pt),
            )

            # Fix #4: smaller font size factor
            for block in text_blocks:
                try:
                    box_left = Pt(left_pt + block["x_pt"] * scale_x)
                    box_top = Pt(top_pt + block["y_pt"] * scale_y)
                    box_w = Pt(max(block["w_pt"] * scale_x, 8.0))
                    box_h = Pt(max(block["h_pt"] * scale_y, 8.0))
                    txBox = slide.shapes.add_textbox(box_left, box_top, box_w, box_h)
                    tf = txBox.text_frame
                    tf.word_wrap = True
                    tf.text = block["text"]
                    if block["h_pt"] > 0:
                        font_pt = max(6.0, block["h_pt"] * scale_y * 0.65)
                        tf.paragraphs[0].font.size = Pt(font_pt)
                except Exception:
                    continue

            elapsed = time.monotonic() - t0
            if on_page_progress:
                on_page_progress(
                    i,
                    "done",
                    {"text_block_count": len(text_blocks), "elapsed_s": round(elapsed, 1)},
                )

            del pil_image, cleaned, page_image_obj
            gc.collect()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))
    return output_path


# Module-level shared converter (models loaded lazily on first request)
_shared_converter: Optional[LocalConverter] = None
_shared_lock = threading.Lock()


def get_shared_converter() -> LocalConverter:
    global _shared_converter
    with _shared_lock:
        if _shared_converter is None:
            _shared_converter = LocalConverter()
        return _shared_converter
