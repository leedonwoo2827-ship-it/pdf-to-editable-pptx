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
