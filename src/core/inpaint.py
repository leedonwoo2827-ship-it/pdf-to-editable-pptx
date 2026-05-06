"""Inpainting engine wrapper.

Wraps simple_lama_inpainting.SimpleLama (LaMa via PyTorch) so the rest
of the project never imports torch or simple_lama_inpainting directly.

Behaviour notes:
- GPU is auto-detected via torch.cuda.is_available(). When CPU-only,
  SimpleLama internally calls torch.jit.load without a map_location,
  which raises on a machine that has CUDA-built weights but no CUDA
  available. We monkey-patch torch.jit.load just for the SimpleLama
  constructor to default to map_location='cpu'. Restored immediately.
"""
from __future__ import annotations

import threading

import torch
from PIL import Image
from simple_lama_inpainting import SimpleLama


class InpaintEngine:
    """LaMa inpainting via SimpleLama. Lazy-loaded; safe to construct
    without an internet connection (model download is deferred until
    ensure_loaded())."""

    def __init__(self) -> None:
        self._lama: SimpleLama | None = None
        self._gpu = False
        self._lock = threading.Lock()

    def ensure_loaded(self) -> None:
        with self._lock:
            if self._lama is not None:
                return
            self._gpu = bool(torch.cuda.is_available())
            if self._gpu:
                self._lama = SimpleLama()
            else:
                # Force map_location='cpu' for SimpleLama's internal
                # torch.jit.load so a CUDA-built checkpoint loads on a
                # CPU-only machine.
                original = torch.jit.load

                def _safe_load(*args, **kwargs):
                    if "map_location" not in kwargs:
                        kwargs["map_location"] = torch.device("cpu")
                    return original(*args, **kwargs)

                torch.jit.load = _safe_load
                try:
                    self._lama = SimpleLama()
                finally:
                    torch.jit.load = original

    @property
    def is_gpu(self) -> bool:
        return self._gpu

    def inpaint(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        """Run LaMa on (image, mask). Both are PIL.Image — image RGB,
        mask grayscale where 255 = inpaint, 0 = keep."""
        self.ensure_loaded()
        assert self._lama is not None
        with torch.no_grad():
            return self._lama(image, mask)

    def empty_cache(self) -> None:
        """Drop GPU cache after a heavy frame to keep VRAM tame."""
        if self._gpu:
            torch.cuda.empty_cache()
