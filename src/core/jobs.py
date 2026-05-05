from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from src.api.schemas import JobStatus, PageStatus


@dataclass
class Job:
    id: str
    pdf_path: Path
    page_count: int
    filename: str
    pages: list[PageStatus] = field(default_factory=list)
    overall_state: Literal["idle", "running", "complete", "failed", "cancelled"] = "idle"
    output_path: Path | None = None
    workspace_dir: Path | None = None  # Per-page bg.png + blocks.json for review
    error: str = ""
    cancel_flag: bool = False

    def status(self) -> JobStatus:
        return JobStatus(
            job_id=self.id,
            page_count=self.page_count,
            pages=list(self.pages),
            overall_state=self.overall_state,
            output_ready=self.output_path is not None and self.output_path.exists(),
            error=self.error,
        )


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, pdf_path: Path, page_count: int, filename: str) -> Job:
        job_id = uuid.uuid4().hex
        pages = [PageStatus(index=i) for i in range(page_count)]
        job = Job(
            id=job_id,
            pdf_path=pdf_path,
            page_count=page_count,
            filename=filename,
            pages=pages,
        )
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def remove(self, job_id: str) -> None:
        with self._lock:
            self._jobs.pop(job_id, None)


store = JobStore()
