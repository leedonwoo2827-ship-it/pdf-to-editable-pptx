from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class UploadResponse(BaseModel):
    job_id: str
    page_count: int
    filename: str


class PageStatus(BaseModel):
    index: int
    state: Literal["queued", "rendering", "ocr", "inpainting", "done", "warning", "error"] = "queued"
    text_block_count: int = 0
    elapsed_s: float = 0.0
    message: str = ""


class JobStatus(BaseModel):
    job_id: str
    page_count: int
    pages: list[PageStatus]
    overall_state: Literal["idle", "running", "complete", "failed", "cancelled"] = "idle"
    output_ready: bool = False
    error: str = ""


class ProcessRequest(BaseModel):
    dpi: int = 200
    dilation: int = 15
    # NotebookLM·Canva 등 우하단 고정 위치에 워터마크 로고가 박힌 PDF용.
    # 켜면 페이지마다 우하단 일정 영역을 OCR 마스크에 강제 추가 → LaMa가 함께 지움.
    remove_watermark: bool = False


class ReviewBlock(BaseModel):
    text: str
    x_pt: float
    y_pt: float
    w_pt: float
    h_pt: float
    score: float = 0.9


class ReviewPageState(BaseModel):
    page_idx: int
    page_w_pt: float
    page_h_pt: float
    blocks: list[ReviewBlock]


class OcrRegionRequest(BaseModel):
    bbox_norm: list[float]  # [x, y, w, h] in 0..1 of the page background image


class OcrRegionResponse(BaseModel):
    ok: bool
    message: str = ""
    block: ReviewBlock | None = None


class SaveBlocksRequest(BaseModel):
    blocks: list[ReviewBlock]


class CommitRegionRequest(BaseModel):
    bbox_norm: list[float]  # [x, y, w, h] in 0..1 of the page background image
    text: str


class CommitRegionResponse(BaseModel):
    ok: bool
    message: str = ""
    block: ReviewBlock | None = None
