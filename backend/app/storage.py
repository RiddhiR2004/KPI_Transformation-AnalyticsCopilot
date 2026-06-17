from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from sqlalchemy import select, delete

from app.database import (
    SessionLocal,
    init_db,
    BusinessContext,
    Prompt,
    KPILibrary,
    KPITree,
    ActivityLog,
    FunctionalSpecification,
    ApprovedKPIs,
    DATA_DIR,
    TranscriptAnalysis,
    active_engagement_id_ctx,
)

ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = DATA_DIR / "exports"

FILES = {
    "business_context": DATA_DIR / "business_context.json",
    "prompts": DATA_DIR / "prompts.json",
    "kpi_library": DATA_DIR / "kpi_library.json",
    "activity_log": DATA_DIR / "activity_log.json",
    "functional_spec": DATA_DIR / "functional_specification.json",
    "approved_kpis": DATA_DIR / "approved_kpi_library.json",
}


def _key_for_path(path: Path) -> str:
    for key, file_path in FILES.items():
        if file_path == path:
            return key
    return path.stem


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    EXPORT_DIR.mkdir(exist_ok=True)
    init_db()
    migrate_existing_data()


def read_json(path: Path, default: Any) -> Any:
    ensure_data_dir()
    key = _key_for_path(path)
    eng_id = active_engagement_id_ctx.get()
    
    with SessionLocal() as session:
        if key == "business_context":
            if eng_id is not None:
                row = session.scalar(select(BusinessContext).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(BusinessContext).filter_by(id=1))
            if not row:
                return default
            return {
                "industry": row.industry,
                "organization_level": row.organization_level,
                "kpi_count": row.kpi_count,
                "business_priorities": json.loads(row.business_priorities or "[]"),
                "business_challenges": json.loads(row.business_challenges or "[]"),
                "top_kras": json.loads(row.top_kras or "[]"),
                "functional_areas": json.loads(row.functional_areas or "[]"),
                "additional_business_priorities": json.loads(row.additional_business_priorities or "[]"),
                "additional_business_challenges": json.loads(row.additional_business_challenges or "[]"),
                "additional_kras": json.loads(row.additional_kras or "[]"),
                "additional_functional_areas": json.loads(row.additional_functional_areas or "[]"),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        elif key == "prompts":
            if eng_id is not None:
                row = session.scalar(select(Prompt).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(Prompt).filter_by(id=1))
            if not row:
                return default
            return {
                "prompt": row.prompt,
                "original_prompt": row.original_prompt,
                "user_instructions": row.user_instructions,
                "is_approved": row.is_approved,
                "ai_summary": json.loads(row.ai_summary),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        elif key == "kpi_library":
            if eng_id is not None:
                row = session.scalar(select(KPILibrary).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(KPILibrary).filter_by(id=1))
            if not row:
                return default
            return {
                "items": json.loads(row.items),
                "quality": json.loads(row.quality),
                "recommendations": json.loads(row.recommendations),
                "executive_summary": json.loads(row.executive_summary),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        elif key == "functional_spec":
            if eng_id is not None:
                row = session.scalar(select(FunctionalSpecification).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(FunctionalSpecification).filter_by(id=1))
            if not row:
                return default
            return {
                "items": json.loads(row.items),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        elif key == "approved_kpis":
            if eng_id is not None:
                row = session.scalar(select(ApprovedKPIs).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(ApprovedKPIs).filter_by(id=1))
            if not row:
                return default
            return {
                "items": json.loads(row.items),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        elif key == "activity_log":
            rows = session.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc())).all()
            return [
                {
                    "id": r.id,
                    "label": r.label,
                    "detail": r.detail,
                    "created_at": r.created_at.isoformat() if r.created_at else now_iso(),
                }
                for r in rows
            ]
            
        elif key == "kpi_tree":
            if eng_id is not None:
                row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(KPITree).filter_by(id=1))
            if not row:
                return default
            return {
                "name": row.name,
                "data": json.loads(row.data),
                "updated_at": row.updated_at.isoformat() if row.updated_at else now_iso(),
            }
            
        else:
            return default


def write_json(path: Path, data: Any) -> None:
    ensure_data_dir()
    key = _key_for_path(path)
    eng_id = active_engagement_id_ctx.get()
    
    with SessionLocal() as session:
        if key == "business_context":
            from app.models import BusinessContext as PydanticBusinessContext
            validated = PydanticBusinessContext(**data)
            
            if eng_id is not None:
                row = session.scalar(select(BusinessContext).filter_by(engagement_id=eng_id))
                if not row:
                    row = BusinessContext(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(BusinessContext).filter_by(id=1))
                if not row:
                    row = BusinessContext(id=1)
                    session.add(row)
            row.industry = validated.industry
            row.organization_level = validated.organization_level
            row.kpi_count = validated.kpi_count
            row.business_priorities = json.dumps(validated.business_priorities)
            row.business_challenges = json.dumps(validated.business_challenges)
            row.top_kras = json.dumps(validated.top_kras)
            row.functional_areas = json.dumps(validated.functional_areas)
            row.additional_business_priorities = json.dumps(validated.additional_business_priorities)
            row.additional_business_challenges = json.dumps(validated.additional_business_challenges)
            row.additional_kras = json.dumps(validated.additional_kras)
            row.additional_functional_areas = json.dumps(validated.additional_functional_areas)
            row.updated_at = datetime.now()
            session.commit()
            
        elif key == "prompts":
            if eng_id is not None:
                row = session.scalar(select(Prompt).filter_by(engagement_id=eng_id))
                if not row:
                    row = Prompt(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(Prompt).filter_by(id=1))
                if not row:
                    row = Prompt(id=1)
                    session.add(row)
            row.prompt = data.get("prompt", "")
            row.original_prompt = data.get("original_prompt", "")
            row.user_instructions = data.get("user_instructions", "")
            row.is_approved = data.get("is_approved", False)
            row.ai_summary = json.dumps(data.get("ai_summary", {}))
            row.updated_at = datetime.now()
            session.commit()
            
        elif key == "kpi_library":
            if eng_id is not None:
                row = session.scalar(select(KPILibrary).filter_by(engagement_id=eng_id))
                if not row:
                    row = KPILibrary(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(KPILibrary).filter_by(id=1))
                if not row:
                    row = KPILibrary(id=1)
                    session.add(row)
            row.items = json.dumps(data.get("items", []))
            row.quality = json.dumps(data.get("quality", {}))
            row.recommendations = json.dumps(data.get("recommendations", {}))
            row.executive_summary = json.dumps(data.get("executive_summary", {}))
            row.updated_at = datetime.now()
            session.commit()
            
        elif key == "functional_spec":
            if eng_id is not None:
                row = session.scalar(select(FunctionalSpecification).filter_by(engagement_id=eng_id))
                if not row:
                    row = FunctionalSpecification(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(FunctionalSpecification).filter_by(id=1))
                if not row:
                    row = FunctionalSpecification(id=1)
                    session.add(row)
            row.items = json.dumps(data.get("items", []))
            row.updated_at = datetime.now()
            session.commit()
            
        elif key == "approved_kpis":
            if eng_id is not None:
                row = session.scalar(select(ApprovedKPIs).filter_by(engagement_id=eng_id))
                if not row:
                    row = ApprovedKPIs(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(ApprovedKPIs).filter_by(id=1))
                if not row:
                    row = ApprovedKPIs(id=1)
                    session.add(row)
            row.items = json.dumps(data.get("items", []))
            row.updated_at = datetime.now()
            session.commit()
            
        elif key == "activity_log":
            session.execute(delete(ActivityLog))
            if isinstance(data, list):
                for item in data:
                    created_at = datetime.now()
                    if item.get("created_at"):
                        try:
                            created_at = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
                        except ValueError:
                            pass
                    session.add(ActivityLog(
                        id=item.get("id", ""),
                        label=item.get("label", ""),
                        detail=item.get("detail", ""),
                        created_at=created_at
                    ))
            session.commit()
            
        elif key == "kpi_tree":
            if eng_id is not None:
                row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
                if not row:
                    row = KPITree(engagement_id=eng_id)
                    session.add(row)
            else:
                row = session.scalar(select(KPITree).filter_by(id=1))
                if not row:
                    row = KPITree(id=1)
                    session.add(row)
            row.name = data.get("name", "Default Tree")
            row.data = json.dumps(data.get("data", {}))
            row.updated_at = datetime.now()
            session.commit()


def now_iso() -> str:
    return datetime.now().isoformat()


def seed_from_dict(data: dict[str, Any]) -> None:
    with SessionLocal() as session:
        # BusinessContext
        bc_data = data.get("business_context")
        if bc_data and isinstance(bc_data, dict):
            updated_at = datetime.now()
            if bc_data.get("updated_at"):
                try:
                    updated_at = datetime.fromisoformat(bc_data["updated_at"].replace("Z", "+00:00"))
                except ValueError:
                    pass
            session.add(BusinessContext(
                id=1,
                industry=bc_data.get("industry", ""),
                organization_level=bc_data.get("organization_level", ""),
                kpi_count=bc_data.get("kpi_count", 8),
                business_priorities=json.dumps(bc_data.get("business_priorities", [])),
                business_challenges=json.dumps(bc_data.get("business_challenges", [])),
                top_kras=json.dumps(bc_data.get("top_kras", [])),
                functional_areas=json.dumps(bc_data.get("functional_areas", [])),
                additional_business_priorities=json.dumps(bc_data.get("additional_business_priorities", [])),
                additional_business_challenges=json.dumps(bc_data.get("additional_business_challenges", [])),
                additional_kras=json.dumps(bc_data.get("additional_kras", [])),
                additional_functional_areas=json.dumps(bc_data.get("additional_functional_areas", [])),
                updated_at=updated_at
            ))

        # Prompt
        pr_data = data.get("prompts")
        if pr_data and isinstance(pr_data, dict):
            updated_at = datetime.now()
            if pr_data.get("updated_at"):
                try:
                    updated_at = datetime.fromisoformat(pr_data["updated_at"].replace("Z", "+00:00"))
                except ValueError:
                    pass
            session.add(Prompt(
                id=1,
                prompt=pr_data.get("prompt", ""),
                original_prompt=pr_data.get("original_prompt", ""),
                user_instructions=pr_data.get("user_instructions", ""),
                is_approved=pr_data.get("is_approved", False),
                ai_summary=json.dumps(pr_data.get("ai_summary", {})),
                updated_at=updated_at
            ))

        # KPILibrary
        kl_data = data.get("kpi_library")
        if kl_data and isinstance(kl_data, dict):
            updated_at = datetime.now()
            if kl_data.get("updated_at"):
                try:
                    updated_at = datetime.fromisoformat(kl_data["updated_at"].replace("Z", "+00:00"))
                except ValueError:
                    pass
            session.add(KPILibrary(
                id=1,
                items=json.dumps(kl_data.get("items", [])),
                quality=json.dumps(kl_data.get("quality", {})),
                recommendations=json.dumps(kl_data.get("recommendations", {})),
                executive_summary=json.dumps(kl_data.get("executive_summary", {})),
                updated_at=updated_at
            ))

        # FunctionalSpecification
        fs_data = data.get("functional_spec")
        if fs_data and isinstance(fs_data, dict):
            updated_at = datetime.now()
            if fs_data.get("updated_at"):
                try:
                    updated_at = datetime.fromisoformat(fs_data["updated_at"].replace("Z", "+00:00"))
                except ValueError:
                    pass
            session.add(FunctionalSpecification(
                id=1,
                items=json.dumps(fs_data.get("items", [])),
                updated_at=updated_at
            ))

        # ApprovedKPIs
        ak_data = data.get("approved_kpis")
        if ak_data and isinstance(ak_data, dict):
            session.add(ApprovedKPIs(
                id=1,
                items=json.dumps(ak_data.get("items", [])),
                updated_at=datetime.now()
            ))

        # ActivityLog
        al_data = data.get("activity_log")
        if al_data and isinstance(al_data, list):
            for item in al_data:
                created_at = datetime.now()
                if item.get("created_at"):
                    try:
                        created_at = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
                    except ValueError:
                        pass
                session.add(ActivityLog(
                    id=item.get("id", ""),
                    label=item.get("label", ""),
                    detail=item.get("detail", ""),
                    created_at=created_at
                ))

        session.commit()


def migrate_existing_data() -> None:
    # Check if kpi.db is empty by checking if there's any BusinessContext
    with SessionLocal() as session:
        has_context = session.scalar(select(BusinessContext).limit(1))
        if has_context:
            return  # Already migrated/seeded

    # 1. Try migrating from kpi_copilot.db if it exists
    copilot_db_path = DATA_DIR / "kpi_copilot.db"
    if copilot_db_path.exists():
        print(f"Migrating data from old database {copilot_db_path}...")
        try:
            import sqlite3
            conn = sqlite3.connect(copilot_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM app_state")
            rows = cursor.fetchall()
            old_data = {row[0]: json.loads(row[1]) for row in rows}
            conn.close()
            
            seed_from_dict(old_data)
            print("Successfully migrated data from old database to new schema.")
            return
        except Exception as e:
            print(f"Error migrating from old database: {e}")

    # 2. Fallback: Try migrating from JSON files if they exist
    print("Falling back to migrating from JSON files...")
    old_data = {}
    for key, path in FILES.items():
        if path.exists():
            try:
                old_data[key] = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                pass
    if old_data:
        try:
            seed_from_dict(old_data)
            print("Successfully migrated data from JSON files to new schema.")
        except Exception as e:
            print(f"Error migrating from JSON files: {e}")
