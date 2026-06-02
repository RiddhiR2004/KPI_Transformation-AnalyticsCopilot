from __future__ import annotations

from pathlib import Path

from app.storage import EXPORT_DIR, FILES, read_json


def export_json_bundle() -> Path:
    import json

    bundle = {key: read_json(path, [] if key == "activity_log" else {}) for key, path in FILES.items()}
    path = EXPORT_DIR / "kpi-copilot-export.json"
    path.write_text(json.dumps(bundle, indent=2, default=str), encoding="utf-8")
    return path
