"""Build inpainting masks from OCR bounding boxes.

LaMa expects a binary mask the same size as the page image, where the
white pixels (255) are what to inpaint. This module turns OCR
quadrilateral bboxes into such a mask, with two key details:

1. Each bbox is expanded slightly from its centroid (10% by default) so
   the mask covers the glyph edges and not just the OCR-tight box.

2. After all polygons are drawn, the mask is morphologically dilated by
   an *adaptive* amount based on average text height — taller text
   wants more dilation. Clamped to [15, 40] pixels so we never under- or
   over-mask drastically.

These choices were tuned empirically: too tight a mask leaves halos of
the original ink; too loose a mask makes LaMa start hallucinating
backgrounds where there shouldn't be any.
"""
from __future__ import annotations

import cv2
import numpy as np

from src.core.ocr import OcrResult


# Adaptive dilation: average_text_height * this ratio, clamped to the
# (min, max) below.
DILATION_HEIGHT_RATIO = 0.20
DILATION_MIN_PX = 15
DILATION_MAX_PX = 40

# Per-bbox poly expansion before fillPoly.
BBOX_EXPAND_RATIO = 1.10


def build_mask(
    page_h_px: int,
    page_w_px: int,
    ocr_results: list[OcrResult],
    base_dilation_px: int = 15,
) -> tuple[np.ndarray, list[float]]:
    """Build a (H, W) uint8 mask covering all OCR text regions, plus
    return the list of bbox heights so the caller can compute things
    like an adaptive font size if it wants.

    The mask combines a fillPoly per bbox with a morphological close
    (5x5) and an adaptive dilate (max(base_dilation_px, adaptive) where
    adaptive is height-based).
    """
    mask = np.zeros((page_h_px, page_w_px), dtype=np.uint8)
    bbox_heights: list[float] = []

    for r in ocr_results:
        poly = np.array(r.box, dtype=np.float32)
        ctr = np.mean(poly, axis=0)
        expanded = ctr + (poly - ctr) * BBOX_EXPAND_RATIO
        pts = expanded.astype(np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(mask, [pts], 255)
        ys = [p[1] for p in r.box]
        bbox_heights.append(max(ys) - min(ys))

    if bbox_heights:
        avg_h = sum(bbox_heights) / len(bbox_heights)
        adaptive = int(avg_h * DILATION_HEIGHT_RATIO)
        adaptive = max(DILATION_MIN_PX, min(adaptive, DILATION_MAX_PX))
        final = max(base_dilation_px, adaptive)
        kernel_close = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
        kernel_dil = np.ones((final, final), np.uint8)
        mask = cv2.dilate(mask, kernel_dil, iterations=1)

    return mask, bbox_heights


def build_rect_mask(
    page_h_px: int,
    page_w_px: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    pad_px: int | None = None,
) -> np.ndarray:
    """Build a mask for a single user-drawn rectangle (used by the
    'commit new region' review flow). pad_px defaults to ~0.5% of the
    larger image dimension so any ink hugging the edge gets removed too.
    """
    mask = np.zeros((page_h_px, page_w_px), dtype=np.uint8)
    if pad_px is None:
        pad_px = max(4, int(0.005 * max(page_w_px, page_h_px)))
    l = max(0, left - pad_px)
    t = max(0, top - pad_px)
    r = min(page_w_px, right + pad_px)
    b = min(page_h_px, bottom + pad_px)
    mask[t:b, l:r] = 255
    return mask
