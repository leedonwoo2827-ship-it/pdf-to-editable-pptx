"""OCR engine wrapper.

Wraps PaddleOCR with Korean (`lang='korean'`) and project-specific
result hygiene:

1. Confidence + size filter — drop low-score, single-character non-Korean,
   and tiny-bbox results that would otherwise produce phantom textboxes.

2. Two-pass detection — after the first pass, whiten the regions it
   covered and OCR again. Small/stylised text (chart labels, decorative
   headings) that the first pass missed often gets picked up on the
   sparser second pass.

This module owns PaddleOCR initialization. Anything outside this file
should not import paddleocr directly.

PaddleOCR with lang='korean' uses Korean-native recognition models
trained jointly with Korean training data — generally stronger than
EasyOCR on small Korean glyphs, and notably stronger than the
multilingual default models on slide-deck-style mixed text.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import cv2
import numpy as np
from paddleocr import PaddleOCR


# Confidence + size filters
MIN_OCR_SCORE = 0.5
MIN_TEXT_LEN = 2  # at least 2 chars unless Korean (single hangul ok)
MIN_BBOX_AREA_RATIO = 1e-4  # bbox_w * bbox_h / page_w * page_h

# PaddleOCR's lang code. 'korean' covers Hangul + Latin reasonably well;
# the recognition model is Korean-native and trained on mixed-script data.
DEFAULT_LANG = "korean"
# We keep the public param name 'langs' for symmetry with the previous
# EasyOCR-based interface, but PaddleOCR only takes a single language
# string per Reader instance — we pick the first.
DEFAULT_LANGS: tuple[str, ...] = ("korean",)

# Hangul ranges (syllables + jamo + compat). Used to keep single-char
# results that are obviously Korean.
_HANGUL_SYLLABLES = ("가", "힯")
_HANGUL_JAMO = ("ᄀ", "ᇿ")
_HANGUL_COMPAT = ("㄰", "㆏")


def is_korean(s: str) -> bool:
    """True if any character in s is in a Hangul range."""
    return any(
        _HANGUL_SYLLABLES[0] <= ch <= _HANGUL_SYLLABLES[1]
        or _HANGUL_JAMO[0] <= ch <= _HANGUL_JAMO[1]
        or _HANGUL_COMPAT[0] <= ch <= _HANGUL_COMPAT[1]
        for ch in s
    )


@dataclass
class OcrResult:
    """One OCR hit. box is a quadrilateral (4 [x, y] points), text is the
    cleaned string, score is the model confidence in [0, 1]."""
    box: list
    text: str
    score: float

    def as_tuple(self) -> tuple:
        return (self.box, self.text, self.score)


def _bbox_xy(box) -> tuple[float, float, float, float]:
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    return min(xs), min(ys), max(xs), max(ys)


def _bbox_iou(box_a, box_b) -> float:
    x1a, y1a, x2a, y2a = _bbox_xy(box_a)
    x1b, y1b, x2b, y2b = _bbox_xy(box_b)
    ix1, iy1 = max(x1a, x1b), max(y1a, y1b)
    ix2, iy2 = min(x2a, x2b), min(y2a, y2b)
    if ix2 < ix1 or iy2 < iy1:
        return 0.0
    inter = (ix2 - ix1) * (iy2 - iy1)
    a = max((x2a - x1a) * (y2a - y1a), 1.0)
    b = max((x2b - x1b) * (y2b - y1b), 1.0)
    return inter / (a + b - inter)


def _dedupe_against(
    new_results: list[OcrResult],
    existing_results: list[OcrResult],
    iou_thresh: float = 0.3,
) -> list[OcrResult]:
    """Drop new_results that overlap (>iou_thresh) with any existing one."""
    out: list[OcrResult] = []
    for r in new_results:
        if any(_bbox_iou(r.box, e.box) > iou_thresh for e in existing_results):
            continue
        out.append(r)
    return out


class OcrEngine:
    """PaddleOCR + project-specific result hygiene.

    Construct once per process and reuse across pages — model load is
    expensive (~hundreds of MB of paddlepaddle + model files on first
    use). After load, calls are fast enough on CPU and very fast on GPU.

    Thread-safety: PaddleOCR's PaddleOCR.ocr() is not designed for
    concurrent calls from multiple threads. The conversion pipeline
    serializes pages anyway, so this is fine for our use.
    """

    def __init__(
        self,
        langs: Sequence[str] = DEFAULT_LANGS,
        use_gpu: bool | None = None,
    ) -> None:
        # PaddleOCR takes a single lang per Reader. Ignore extras for now.
        self.lang = langs[0] if langs else DEFAULT_LANG
        self.use_gpu = use_gpu  # None = auto-detect via paddle defaults
        self._reader: PaddleOCR | None = None

    def ensure_loaded(self) -> None:
        if self._reader is not None:
            return
        kwargs: dict = {
            "lang": self.lang,
            # use_angle_cls=True helps with rotated text (common in slide
            # diagrams — labels along arrows, etc.).
            "use_angle_cls": True,
            # show_log=False to keep our progress UI uncluttered.
            "show_log": False,
        }
        if self.use_gpu is not None:
            kwargs["use_gpu"] = bool(self.use_gpu)
        self._reader = PaddleOCR(**kwargs)

    # --- Single pass ---

    def detect(self, image_np: np.ndarray) -> list[OcrResult]:
        """Run a single OCR pass on a numpy RGB image. Returns
        OcrResult list with raw (no filtering) hits."""
        self.ensure_loaded()
        assert self._reader is not None
        # PaddleOCR.ocr returns: [[(box, (text, score)), ...]] for older
        # API or [[box, text, score], ...] depending on version. Normalize.
        raw = self._reader.ocr(image_np, cls=True)
        if not raw:
            return []
        # PaddleOCR wraps in an extra list (one per image; we pass one image).
        if isinstance(raw, list) and len(raw) == 1 and isinstance(raw[0], list):
            raw = raw[0]
        if raw is None:
            return []

        out: list[OcrResult] = []
        for item in raw:
            if not item:
                continue
            try:
                # New API: [box, (text, score)]
                box = item[0]
                text_score = item[1]
                if isinstance(text_score, (list, tuple)) and len(text_score) >= 2:
                    text, score = text_score[0], text_score[1]
                else:
                    text, score = str(text_score), 1.0
            except (TypeError, IndexError, ValueError):
                continue
            # Normalize box points to plain Python lists so they survive
            # JSON serialization in the workspace state files.
            try:
                box_list = [[float(p[0]), float(p[1])] for p in box]
            except (TypeError, IndexError, ValueError):
                continue
            out.append(OcrResult(box=box_list, text=str(text), score=float(score)))
        return out

    def filter(
        self,
        results: list[OcrResult],
        page_w_px: int,
        page_h_px: int,
    ) -> list[OcrResult]:
        """Drop low-confidence and tiny results. Single-character results
        are kept only if they're Korean (single hangul is valid)."""
        if not results:
            return []
        page_area = max(page_w_px * page_h_px, 1)
        kept: list[OcrResult] = []
        for r in results:
            text_clean = (r.text or "").strip()
            if not text_clean:
                continue
            if r.score < MIN_OCR_SCORE:
                continue
            if len(text_clean) < MIN_TEXT_LEN and not is_korean(text_clean):
                continue
            x1, y1, x2, y2 = _bbox_xy(r.box)
            bw, bh = x2 - x1, y2 - y1
            if bw <= 0 or bh <= 0:
                continue
            if (bw * bh) / page_area < MIN_BBOX_AREA_RATIO:
                continue
            kept.append(OcrResult(box=r.box, text=text_clean, score=r.score))
        return kept

    # --- Two-pass (used by the conversion pipeline) ---

    def detect_two_pass(
        self,
        image_np: np.ndarray,
        page_w_px: int,
        page_h_px: int,
    ) -> list[OcrResult]:
        """Two-pass detect: pass 1 is normal OCR; pass 2 whitens the
        regions covered by pass 1 results and OCRs the residue. The
        residue often contains chart labels and small headings the first
        pass under-detected. Pass-2 hits that overlap pass-1 are dropped."""
        first = self.filter(self.detect(image_np), page_w_px, page_h_px)
        if not first:
            return []

        # Build a coverage mask using a 20% poly expansion to capture the
        # tails of each first-pass detection.
        cover = np.zeros(image_np.shape[:2], dtype=np.uint8)
        for r in first:
            poly = np.array(r.box, dtype=np.float32)
            ctr = np.mean(poly, axis=0)
            expanded = ctr + (poly - ctr) * 1.20
            pts = expanded.astype(np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(cover, [pts], 255)

        masked = image_np.copy()
        masked[cover > 0] = 255

        try:
            second = self.filter(self.detect(masked), page_w_px, page_h_px)
        except Exception:
            return first  # second pass is best-effort

        # Drop any pass-2 hit that overlaps a pass-1 hit (near-duplicates).
        second = _dedupe_against(second, first, iou_thresh=0.2)
        return first + second

    # --- Crop-style OCR (used by review API) ---

    def detect_crop(self, crop_np: np.ndarray) -> list[OcrResult]:
        """OCR a small user-drawn crop. Returns unfiltered hits — caller
        usually just joins the texts together."""
        return self.detect(crop_np)
