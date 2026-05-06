"""Per-page workspace state on disk.

For every converted page we save:
  - {workspace}/page_{i}_bg.png   — the inpainted background
  - {workspace}/page_{i}.json     — page metadata + OCR text blocks

This lets the user re-export a PPTX after editing blocks in the
browser, without re-running OCR or LaMa. The review API
(review.py) reads/writes through this module so the on-disk format
stays consistent.

Block dict shape:
  {
      "text":   str,
      "x_pt":   float,   # top-left in PDF points (1/72 inch)
      "y_pt":   float,
      "w_pt":   float,
      "h_pt":   float,
      "score":  float,
  }
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


def save_page_state(
    workspace_dir: Path,
    page_idx: int,
    cleaned_bg: Image.Image,
    text_blocks: list[dict],
    page_w_pt: float,
    page_h_pt: float,
) -> None:
    """Persist (inpainted bg PNG, blocks JSON) for one page."""
    workspace_dir.mkdir(parents=True, exist_ok=True)
    bg_path = workspace_dir / f"page_{page_idx}_bg.png"
    cleaned_bg.save(str(bg_path), format="PNG", optimize=True)

    json_path = workspace_dir / f"page_{page_idx}.json"
    json_path.write_text(
        json.dumps(
            {
                "page_idx": page_idx,
                "page_w_pt": page_w_pt,
                "page_h_pt": page_h_pt,
                "blocks": text_blocks,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def load_page_state(workspace_dir: Path, page_idx: int) -> dict | None:
    """Return the page state dict, or None if the page hasn't been
    converted yet."""
    json_path = workspace_dir / f"page_{page_idx}.json"
    if not json_path.exists():
        return None
    return json.loads(json_path.read_text(encoding="utf-8"))


def update_page_blocks(
    workspace_dir: Path, page_idx: int, blocks: list[dict]
) -> bool:
    """Replace the saved blocks list for a page. Returns False if the
    page hasn't been converted yet."""
    json_path = workspace_dir / f"page_{page_idx}.json"
    if not json_path.exists():
        return False
    data = json.loads(json_path.read_text(encoding="utf-8"))
    data["blocks"] = blocks
    json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return True


def append_block(workspace_dir: Path, page_idx: int, block: dict) -> bool:
    """Append a single block to the saved list. Returns False if the
    page hasn't been converted yet."""
    data = load_page_state(workspace_dir, page_idx)
    if data is None:
        return False
    blocks = list(data.get("blocks", []) or [])
    blocks.append(block)
    return update_page_blocks(workspace_dir, page_idx, blocks)


def page_paths(workspace_dir: Path, page_idx: int) -> tuple[Path, Path]:
    """Return (bg_png_path, json_path) for a page. Existence not checked."""
    return (
        workspace_dir / f"page_{page_idx}_bg.png",
        workspace_dir / f"page_{page_idx}.json",
    )


def iter_pages(workspace_dir: Path):
    """Yield (page_idx, data_dict, bg_path) for every saved page in
    ascending page order. Skips entries with malformed JSON or missing
    bg.png."""
    json_files = sorted(
        workspace_dir.glob("page_*.json"),
        key=lambda p: int(p.stem.split("_")[1]),
    )
    for jf in json_files:
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            continue
        page_idx = int(data.get("page_idx", -1))
        if page_idx < 0:
            continue
        bg_path = workspace_dir / f"page_{page_idx}_bg.png"
        if not bg_path.exists():
            continue
        yield page_idx, data, bg_path
