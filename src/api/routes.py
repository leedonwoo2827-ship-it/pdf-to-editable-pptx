from __future__ import annotations

import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from src.api.schemas import (
    JobStatus,
    PageStatus,
    ProcessRequest,
    UploadResponse,
)
from src.core import jobs, local_export, page_render
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
        converter = local_export.get_shared_converter()
        converter.initialize_models()
    except Exception as exc:
        job.overall_state = "failed"
        job.error = f"Model initialization failed: {exc}"
        return

    output_path = settings.exports_dir / f"{job.id}_{Path(job.filename).stem}_Editable.pptx"

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
        local_export.convert_pdf_to_pptx(
            pdf_path=job.pdf_path,
            output_path=output_path,
            dpi=dpi,
            dilation=dilation,
            converter=converter,
            on_page_progress=on_page_progress,
            cancel_flag=cancel_flag,
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
