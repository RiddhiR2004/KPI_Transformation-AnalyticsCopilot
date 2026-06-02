from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
EXPORT_DIR = DATA_DIR / "exports"

FILES = {
    "business_context": DATA_DIR / "business_context.json",
    "prompts": DATA_DIR / "prompts.json",
    "kpi_library": DATA_DIR / "kpi_library.json",
    "activity_log": DATA_DIR / "activity_log.json",
    "functional_spec": DATA_DIR / "functional_specification.json",
    "approved_kpis": DATA_DIR / "approved_kpi_library.json",
}


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    EXPORT_DIR.mkdir(exist_ok=True)
    for path in FILES.values():
        if not path.exists():
            default: Any = [] if path.name == "activity_log.json" else {}
            write_json(path, default)


def read_json(path: Path, default: Any) -> Any:
    ensure_data_dir()
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def now_iso() -> str:
    return datetime.utcnow().isoformat()
