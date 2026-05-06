from __future__ import annotations

import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from src.api.schemas import (
    CommitRegionRequest,
    CommitRegionResponse,
    JobStatus,
    OcrRegionRequest,
    OcrRegionResponse,
    PageStatus,
    ProcessRequest,
    ReviewBlock,
    ReviewPageState,
    SaveBlocksRequest,
    UploadResponse,
)
from src.core import jobs, page_render, pipeline, review, workspace
from src.settings import settings


router = APIRouter(prefix="/api")


# --- Upload ---

@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a .pdf file")

    settings.ensure_dirs()
    safe_name = Path(file.filename).name
    target = settings.uploads_dir / safe_name
    if target.exists():
        stem, suf = target.stem, target.suffix
        i = 1
        while (settings.uploads_dir / f"{stem}_{i}{suf}").exists():
            i += 1
        target = settings.uploads_dir / f"{stem}_{i}{suf}"
    with target.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        pc = page_render.page_count(target)
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(400, f"Cannot read PDF: {exc}") from exc

    job = jobs.store.create(target, pc, safe_name)
    return UploadResponse(job_id=job.id, page_count=pc, filename=safe_name)


# --- Page thumbnails ---

@router.get("/page/{job_id}/{page_idx}.png")
def page_png(job_id: str, page_idx: int) -> Response:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if not (0 <= page_idx < job.page_count):
        raise HTTPException(404, "Page out of range")
    png = page_render.render_thumbnail(job.pdf_path, page_idx, dpi=96)
    return Response(content=png, media_type="image/png")


# --- Process / status / result ---

def _run_conversion(job_id: str, dpi: int, dilation: int) -> None:
    job = jobs.store.get(job_id)
    if not job:
        return

    try:
        engines = pipeline.get_engines()
        engines.ensure_loaded()
    except Exception as exc:
        job.overall_state = "failed"
        job.error = f"Model initialization failed: {exc}"
        return

    output_path = settings.exports_dir / f"{job.id}_{Path(job.filename).stem}_Editable.pptx"
    job.workspace_dir = settings.exports_dir / f"{job.id}_workspace"

    def on_page_progress(idx: int, state: str, info: dict) -> None:
        if idx < 0 or idx >= len(job.pages):
            return
        ps = job.pages[idx]
        new_state = state if state in (
            "rendering", "ocr", "inpainting", "done", "warning", "error", "queued"
        ) else "queued"
        job.pages[idx] = PageStatus(
            index=idx,
            state=new_state,  # type: ignore[arg-type]
            text_block_count=info.get("text_block_count", ps.text_block_count),
            elapsed_s=info.get("elapsed_s", ps.elapsed_s),
            message=info.get("message", ps.message),
        )

    def cancel_flag() -> bool:
        return job.cancel_flag

    try:
        job.overall_state = "running"
        pipeline.convert_pdf_to_pptx(
            pdf_path=job.pdf_path,
            output_path=output_path,
            dpi=dpi,
            dilation=dilation,
            engines=engines,
            on_page_progress=on_page_progress,
            cancel_flag=cancel_flag,
            workspace_dir=job.workspace_dir,
        )
        job.output_path = output_path
        job.overall_state = "complete"
    except RuntimeError as exc:
        if "Cancelled" in str(exc):
            job.overall_state = "cancelled"
        else:
            job.overall_state = "failed"
            job.error = str(exc)
    except Exception as exc:
        job.overall_state = "failed"
        job.error = f"{type(exc).__name__}: {exc}"


@router.post("/process/{job_id}", response_model=JobStatus)
def process(job_id: str, req: ProcessRequest) -> JobStatus:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if job.overall_state == "running":
        return job.status()

    job.overall_state = "running"
    job.error = ""
    job.cancel_flag = False
    job.output_path = None
    job.pages = [PageStatus(index=i) for i in range(job.page_count)]

    t = threading.Thread(
        target=_run_conversion, args=(job_id, req.dpi, req.dilation), daemon=True
    )
    t.start()
    return job.status()


@router.get("/status/{job_id}", response_model=JobStatus)
def status(job_id: str) -> JobStatus:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return job.status()


@router.post("/cancel/{job_id}", response_model=JobStatus)
def cancel(job_id: str) -> JobStatus:
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    job.cancel_flag = True
    return job.status()


@router.get("/result/{job_id}")
def result(job_id: str):
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if not job.output_path or not job.output_path.exists():
        raise HTTPException(404, "Result not ready")
    download_name = f"{Path(job.filename).stem}_Editable.pptx"
    return FileResponse(
        path=str(job.output_path),
        media_type=(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ),
        filename=download_name,
    )


# --- Review / refine after conversion -------------------------------------

def _require_workspace(job_id: str):
    job = jobs.store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if not job.workspace_dir or not job.workspace_dir.exists():
        raise HTTPException(404, "No reviewable workspace for this job (run conversion first).")
    return job


@router.get("/review/{job_id}/{page_idx}/bg.png")
def review_bg(job_id: str, page_idx: int):
    job = _require_workspace(job_id)
    bg = job.workspace_dir / f"page_{page_idx}_bg.png"
    if not bg.exists():
        raise HTTPException(404, "Page not converted yet")
    return FileResponse(str(bg), media_type="image/png")


@router.get("/review/{job_id}/{page_idx}/state", response_model=ReviewPageState)
def review_state(job_id: str, page_idx: int) -> ReviewPageState:
    job = _require_workspace(job_id)
    data = workspace.load_page_state(job.workspace_dir, page_idx)
    if data is None:
        raise HTTPException(404, "Page not converted yet")
    return ReviewPageState.model_validate(data)


@router.post("/review/{job_id}/{page_idx}/blocks")
def review_save_blocks(job_id: str, page_idx: int, req: SaveBlocksRequest):
    job = _require_workspace(job_id)
    blocks = [b.model_dump() for b in req.blocks]
    if not workspace.update_page_blocks(job.workspace_dir, page_idx, blocks):
        raise HTTPException(500, "Failed to save blocks")
    return {"ok": True, "count": len(blocks)}


@router.post("/review/{job_id}/{page_idx}/ocr-region", response_model=OcrRegionResponse)
def review_ocr_region(
    job_id: str, page_idx: int, req: OcrRegionRequest
) -> OcrRegionResponse:
    job = _require_workspace(job_id)
    engines = pipeline.get_engines()
    engines.ensure_loaded()
    block = review.ocr_region_from_bg(
        job.workspace_dir, page_idx, list(req.bbox_norm), engines.ocr
    )
    if block is None:
        return OcrRegionResponse(ok=False, message="No text detected in that region.")
    return OcrRegionResponse(ok=True, block=ReviewBlock.model_validate(block))


@router.post("/review/{job_id}/{page_idx}/commit-region", response_model=CommitRegionResponse)
def review_commit_region(
    job_id: str, page_idx: int, req: CommitRegionRequest
) -> CommitRegionResponse:
    """Commit a user-marked region: inpaint that area on the bg AND
    persist a new editable text block at that position. The user-typed
    text is what shows in the textbox; the original ink at that spot is
    cleaned up so the two don't collide."""
    job = _require_workspace(job_id)
    text = (req.text or "").strip()
    if not text:
        return CommitRegionResponse(ok=False, message="Text is empty")
    engines = pipeline.get_engines()
    engines.ensure_loaded()
    block = review.commit_new_region(
        job.workspace_dir,
        page_idx,
        list(req.bbox_norm),
        text,
        engines.inpaint,
    )
    if block is None:
        return CommitRegionResponse(ok=False, message="Could not commit region")
    return CommitRegionResponse(ok=True, block=ReviewBlock.model_validate(block))


@router.post("/review/{job_id}/regenerate")
def review_regenerate(job_id: str):
    job = _require_workspace(job_id)
    new_output = (
        settings.exports_dir
        / f"{job.id}_{Path(job.filename).stem}_Editable_v2.pptx"
    )
    try:
        pipeline.assemble_pptx_from_workspace(job.workspace_dir, new_output)
    except Exception as exc:
        raise HTTPException(500, f"Regenerate failed: {exc}") from exc
    job.output_path = new_output
    return {"ok": True}
