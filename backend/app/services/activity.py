from __future__ import annotations

from uuid import uuid4

from app.models import ActivityEvent
from app.storage import FILES, read_json, write_json


def log_activity(label: str, detail: str = "") -> ActivityEvent:
    event = ActivityEvent(id=str(uuid4()), label=label, detail=detail)
    events = read_json(FILES["activity_log"], [])
    events.insert(0, event.model_dump(mode="json"))
    write_json(FILES["activity_log"], events[:100])
    return event


def list_activity() -> list[dict]:
    return read_json(FILES["activity_log"], [])

