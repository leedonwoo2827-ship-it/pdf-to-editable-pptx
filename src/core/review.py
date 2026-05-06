"""Review-mode operations: OCR a user-drawn region, or commit a new
text region (inpaint + add textbox) onto an already-converted page.

Both operations work on the saved per-page state in workspace.py so
the user's edits persist across sessions and across re-exports.

bbox_norm convention: [x, y, w, h] in 0..1 of the *background image*
(the inpainted PNG saved in the workspace). The page_w_pt stored in
the JSON is the bridge back to PowerPoint coordinates.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from src.core import workspace
from src.core.inpaint import InpaintEngine
from src.core.mask import build_rect_mask
from src.core.ocr import OcrEngine


def _bbox_norm_to_px(
    bbox_norm: list[float], width_px: int, height_px: int
) -> tuple[int, int, int, int] | None:
    """Convert [x, y, w, h] in 0..1 to (left, top, right, bottom) pixel
    coords clamped to the image. Returns None if the area is degenerate."""
    if len(bbox_norm) < 4:
        return None
    x_norm, y_norm, w_norm, h_norm = bbox_norm[:4]
    left = max(0, int(x_norm * width_px))
    top = max(0, int(y_norm * height_px))
    right = min(width_px, int((x_norm + w_norm) * width_px))
    bottom = min(height_px, int((y_norm + h_norm) * height_px))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def ocr_region_from_bg(
    workspace_dir: Path,
    page_idx: int,
    bbox_norm: list[float],
    ocr: OcrEngine,
) -> dict | None:
    """OCR a user-marked region of an already-inpainted page background.

    Why this works: the inpainted bg still contains the text in regions
    OCR originally missed (because we never masked them), so OCR'ing the
    user-drawn crop directly hits the surviving ink.

    Returns a block dict (text, x_pt, y_pt, w_pt, h_pt, score) or None
    if nothing was recognised."""
    data = workspace.load_page_state(workspace_dir, page_idx)
    if data is None:
        return None
    bg_path, _ = workspace.page_paths(workspace_dir, page_idx)
    if not bg_path.exists():
        return None
    page_w_pt = float(data["page_w_pt"])

    img = Image.open(bg_path).convert("RGB")
    W, H = img.size
    rect = _bbox_norm_to_px(bbox_norm, W, H)
    if rect is None:
        return None
    left, top, right, bottom = rect

    crop = img.crop((left, top, right, bottom))
    crop_np = np.array(crop)
    try:
        results = ocr.detect_crop(crop_np)
    except Exception:
        results = []

    texts = [r.text.strip() for r in results if r.text and r.text.strip()]
    combined = " ".join(texts).strip()
    if not combined:
        return None

    px_per_pt = max(W / page_w_pt, 1e-6)
    return {
        "text": combined,
        "x_pt": left / px_per_pt,
        "y_pt": top / px_per_pt,
        "w_pt": (right - left) / px_per_pt,
        "h_pt": (bottom - top) / px_per_pt,
        "score": 0.9,
    }


def commit_new_region(
    workspace_dir: Path,
    page_idx: int,
    bbox_norm: list[float],
    text: str,
    inpaint: InpaintEngine,
) -> dict | None:
    """Add a brand-new editable text block at a user-drawn region AND
    inpaint that area on the page bg so the original ink no longer shows
    through the new textbox.

    One round-trip: 'mark a region, type the text — clean up what's
    there.' Returns the new block dict (also persisted to JSON), or None
    on degenerate input."""
    data = workspace.load_page_state(workspace_dir, page_idx)
    if data is None:
        return None
    bg_path, _ = workspace.page_paths(workspace_dir, page_idx)
    if not bg_path.exists():
        return None
    page_w_pt = float(data["page_w_pt"])

    img = Image.open(bg_path).convert("RGB")
    W, H = img.size
    rect = _bbox_norm_to_px(bbox_norm, W, H)
    if rect is None:
        return None
    left, top, right, bottom = rect

    mask_np = build_rect_mask(H, W, left, top, right, bottom)
    mask_pil = Image.fromarray(mask_np)
    try:
        cleaned = inpaint.inpaint(img, mask_pil)
    except Exception:
        # If LaMa fails, fall back to the original bg — better than
        # losing the textbox commit.
        cleaned = img
    cleaned.save(str(bg_path), format="PNG", optimize=True)

    px_per_pt = max(W / page_w_pt, 1e-6)
    block = {
        "text": text,
        "x_pt": left / px_per_pt,
        "y_pt": top / px_per_pt,
        "w_pt": (right - left) / px_per_pt,
        "h_pt": (bottom - top) / px_per_pt,
        "score": 0.99,
    }
    workspace.append_block(workspace_dir, page_idx, block)
    return block
