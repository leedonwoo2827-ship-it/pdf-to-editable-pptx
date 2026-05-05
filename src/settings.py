from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _user_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return Path(base) / "PdfToPptx"


@dataclass
class Settings:
    host: str = "127.0.0.1"
    port: int = 8000
    user_data_dir: Path = field(default_factory=_user_data_dir)

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            host=os.environ.get("HOST", "127.0.0.1"),
            port=int(os.environ.get("PORT", "8000")),
        )

    @property
    def uploads_dir(self) -> Path:
        return self.user_data_dir / "uploads"

    @property
    def exports_dir(self) -> Path:
        return self.user_data_dir / "exports"

    def ensure_dirs(self) -> None:
        for d in (self.user_data_dir, self.uploads_dir, self.exports_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings.from_env()
