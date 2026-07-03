from __future__ import annotations

import csv
import json
import os
from typing import Any, List

from dotenv import load_dotenv
load_dotenv()

import logging
logger = logging.getLogger("app.main")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.models import (
    BusinessContext,
    ExportItem,
    KPI,
    KPIApprovalRequest,
    KPILibrary,
    KPIUpdateRequest,
    PromptRecord,
    WorkflowStatus,
    FunctionalSpecItem,
    FunctionalSpecification,
    KPIStatus,
    TranscriptInsights,
    TranscriptAnalysisRecord,
    TranscriptStatusUpdateRequest,
    TranscriptInsightsUpdateRequest,
    ClientProfile as ClientProfileSchema,
    ClientInsightItem,
    ClientProfileSavePayload,
    ClientProfileResponse,
    EngagementCreate,
    EngagementRecord,
)
from app.services.activity import list_activity, log_activity
from app.services.documents import export_json_bundle
from app.services.excel import write_kpi_xlsx
from app.services.kpi_engine import normalize_kpi_payload, quality_check, recommendations
from app.services.llm_providers import DemoProvider, demo_kpis, get_provider, llm_status
from app.services.transcript import extract_text_from_bytes, analyze_transcript_text
from app.services.prompting import (
    build_kpi_prompt,
    build_system_kpi_prompt,
    PROMPT_GENERATION_SYSTEM_PROMPT,
    PROMPT_REFINEMENT_SYSTEM_PROMPT,
    SPEC_EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
    SPEC_KPI_ITEM_SYSTEM_PROMPT,
    DYNAMIC_EXTRACTION_SYSTEM_PROMPT,
)
from app.services.asset_parser import extract_text_from_asset
from app.storage import EXPORT_DIR, FILES, ensure_data_dir, read_json, write_json, ROOT

app = FastAPI(title="KPI Transformation & Analytics Copilot API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from app.database import active_engagement_id_ctx

@app.middleware("http")
async def add_engagement_context(request: Request, call_next):
    eng_id_str = request.headers.get("X-Engagement-ID") or request.query_params.get("engagement_id")
    eng_id = None
    if eng_id_str:
        try:
            eng_id = int(eng_id_str)
        except ValueError:
            pass
    token = active_engagement_id_ctx.set(eng_id)
    try:
        response = await call_next(request)
        return response
    finally:
        active_engagement_id_ctx.reset(token)

from datetime import datetime
from sqlalchemy import select
from app.database import (
    SessionLocal,
    IndustryMetadata,
    OrgLevelMetadata,
    FunctionalAreaMetadata,
    BusinessPriorityMetadata,
    BusinessChallengeMetadata,
    KRAMetadata,
    KPICategoryMetadata,
    KPIQualityRatingMetadata,
    TranscriptAnalysis,
    ClientProfile,
    ClientInsight,
    Engagement,
    AuditLog,
)
from app.services.metadata_cache import metadata_cache
from app.services.audit import log_audit, write_audit_log, get_user_info


METADATA_MODELS = {
    "industries": IndustryMetadata,
    "org-levels": OrgLevelMetadata,
    "functional-areas": FunctionalAreaMetadata,
    "priorities": BusinessPriorityMetadata,
    "challenges": BusinessChallengeMetadata,
    "kras": KRAMetadata,
    "kpi-categories": KPICategoryMetadata,
    "quality-ratings": KPIQualityRatingMetadata,
}

class MetadataItemPayload(BaseModel):
    name: str
    is_active: bool = True

@app.get("/metadata/{category}")
def get_metadata_list(category: str):
    if category not in METADATA_MODELS:
        raise HTTPException(status_code=404, detail=f"Metadata category '{category}' not found")
    model = METADATA_MODELS[category]
    return metadata_cache.get(category, model)

@app.post("/metadata/{category}")
def create_metadata_item(category: str, payload: MetadataItemPayload):
    if category not in METADATA_MODELS:
        raise HTTPException(status_code=404, detail=f"Metadata category '{category}' not found")
    model = METADATA_MODELS[category]
    with SessionLocal() as session:
        existing = session.scalar(select(model).filter_by(name=payload.name))
        if existing:
            existing.is_active = payload.is_active
            existing.updated_at = datetime.now()
        else:
            session.add(model(name=payload.name, is_active=payload.is_active))
        session.commit()
    metadata_cache.invalidate(category)
    return {"status": "success"}

@app.delete("/metadata/{category}/{item_id}")
def delete_metadata_item(category: str, item_id: int):
    if category not in METADATA_MODELS:
        raise HTTPException(status_code=404, detail=f"Metadata category '{category}' not found")
    model = METADATA_MODELS[category]
    with SessionLocal() as session:
        item = session.get(model, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        session.delete(item)
        session.commit()
    metadata_cache.invalidate(category)
    return {"status": "success"}

@app.get("/metadata/industries")
def get_industries():
    return get_metadata_list("industries")

@app.get("/metadata/org-levels")
def get_org_levels():
    return get_metadata_list("org-levels")

@app.get("/metadata/functional-areas")
def get_functional_areas():
    return get_metadata_list("functional-areas")

@app.get("/metadata/priorities")
def get_priorities():
    return get_metadata_list("priorities")

@app.get("/metadata/challenges")
def get_challenges():
    return get_metadata_list("challenges")

@app.get("/metadata/kras")
def get_kras():
    return get_metadata_list("kras")

@app.get("/metadata/kpi-categories")
def get_kpi_categories():
    return get_metadata_list("kpi-categories")

@app.get("/metadata/quality-ratings")
def get_quality_ratings():
    return get_metadata_list("quality-ratings")


@app.on_event("startup")
def startup() -> None:
    ensure_data_dir()


def current_context(merged: bool = True) -> BusinessContext:
    data = read_json(FILES["business_context"], {})
    if not data:
        raise HTTPException(status_code=400, detail="Business context has not been created.")
    ctx = BusinessContext(**data)
    return ctx.get_merged() if merged else ctx


def current_prompt() -> PromptRecord:
    data = read_json(FILES["prompts"], {})
    if not data:
        raise HTTPException(status_code=400, detail="Prompt has not been generated.")
    return PromptRecord(**data)


def current_library() -> KPILibrary:
    data = read_json(FILES["kpi_library"], {})
    return KPILibrary(**data) if data else KPILibrary()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/llm-status")
def get_llm_status() -> dict[str, Any]:
    return llm_status()


class AuditLogEventPayload(BaseModel):
    module: str
    action: str
    status: str = "Success"
    entity_type: str | None = None
    entity_name: str | None = None
    previous_value: str | None = None
    new_value: str | None = None
    client_id: int | None = None
    engagement_id: int | None = None


@app.get("/audit-logs")
def get_audit_logs(
    request: Request,
    client_id: int | None = None,
    engagement_id: int | None = None,
    user: str | None = None,
    module: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    q: str | None = None,
):
    with SessionLocal() as session:
        query = select(AuditLog)
        
        if client_id is not None:
            query = query.where(AuditLog.client_id == client_id)
        if engagement_id is not None:
            query = query.where(AuditLog.engagement_id == engagement_id)
        if user:
            query = query.where((AuditLog.user_name.like(f"%{user}%")) | (AuditLog.user_email.like(f"%{user}%")))
        if module:
            query = query.where(AuditLog.module == module)
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.where(AuditLog.timestamp >= start_dt)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
                query = query.where(AuditLog.timestamp <= end_dt)
            except ValueError:
                pass
        if q:
            search_pattern = f"%{q}%"
            query = query.where(
                (AuditLog.user_name.like(search_pattern)) |
                (AuditLog.user_email.like(search_pattern)) |
                (AuditLog.client_name.like(search_pattern)) |
                (AuditLog.engagement_name.like(search_pattern)) |
                (AuditLog.module.like(search_pattern)) |
                (AuditLog.action.like(search_pattern)) |
                (AuditLog.status.like(search_pattern)) |
                (AuditLog.entity_name.like(search_pattern)) |
                (AuditLog.entity_type.like(search_pattern)) |
                (AuditLog.previous_value.like(search_pattern)) |
                (AuditLog.new_value.like(search_pattern))
            )
            
        query = query.order_by(AuditLog.timestamp.desc())
        results = session.scalars(query).all()
        
        return [
            {
                "id": log.id,
                "timestamp": log.timestamp.strftime("%d-%b-%Y %I:%M %p") if log.timestamp else "",
                "user_name": log.user_name,
                "user_email": log.user_email,
                "action_type": log.action_type,
                "entity_type": log.entity_type,
                "entity_name": log.entity_name,
                "previous_value": log.previous_value,
                "new_value": log.new_value,
                "client_id": log.client_id,
                "client_name": log.client_name,
                "engagement_id": log.engagement_id,
                "engagement_name": log.engagement_name,
                "module": log.module,
                "action": log.action,
                "status": log.status
            }
            for log in results
        ]


@app.post("/audit-logs/event")
def create_custom_audit_event(
    request: Request,
    payload: AuditLogEventPayload
):
    log_audit(
        request=request,
        action=payload.action,
        module=payload.module,
        entity_type=payload.entity_type,
        entity_name=payload.entity_name,
        previous_value=payload.previous_value,
        new_value=payload.new_value,
        status=payload.status,
        client_id=payload.client_id,
        engagement_id=payload.engagement_id
    )
    return {"status": "success"}


@app.post("/transcript/upload", response_model=TranscriptAnalysisRecord)
async def upload_transcript(file: UploadFile = File(...)) -> TranscriptAnalysisRecord:
    # 1. Size protection
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 5MB.")

    # 2. Text extraction
    try:
        raw_text = extract_text_from_bytes(file.filename, content)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {exc}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Extracted transcript text is empty.")

    # 3. LLM insights extraction
    try:
        insights_dict = await analyze_transcript_text(raw_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to analyze transcript via LLM: {exc}")

    # Validate insights dict structure
    required_keys = [
        "executive_summary", "strategic_priorities", "business_challenges",
        "key_decisions", "action_items", "risks_dependencies",
        "functional_areas", "mentioned_metrics", "stakeholders"
    ]
    for key in required_keys:
        if key not in insights_dict:
            insights_dict[key] = "" if key == "executive_summary" else []

    # 4. Save to DB
    with SessionLocal() as session:
        db_record = TranscriptAnalysis(
            filename=file.filename,
            raw_text=raw_text,
            extracted_insights=json.dumps(insights_dict),
            status="draft",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(db_record)
        session.commit()
        session.refresh(db_record)
        
        # Build Pydantic response
        record = TranscriptAnalysisRecord(
            id=db_record.id,
            filename=db_record.filename,
            raw_text=db_record.raw_text,
            extracted_insights=TranscriptInsights(**insights_dict),
            status=db_record.status,
            created_at=db_record.created_at,
            updated_at=db_record.updated_at
        )
        
    log_activity("Transcript Uploaded", f"Transcript '{file.filename}' uploaded and analyzed.")
    return record


@app.get("/transcript/list", response_model=List[TranscriptAnalysisRecord])
def list_transcripts() -> List[TranscriptAnalysisRecord]:
    with SessionLocal() as session:
        db_records = session.query(TranscriptAnalysis).all()
        records = []
        for r in db_records:
            try:
                insights_dict = json.loads(r.extracted_insights or "{}")
            except Exception:
                insights_dict = {}
            
            # Ensure standard fields exist
            required_keys = [
                "executive_summary", "strategic_priorities", "business_challenges",
                "key_decisions", "action_items", "risks_dependencies",
                "functional_areas", "mentioned_metrics", "stakeholders"
            ]
            for key in required_keys:
                if key not in insights_dict:
                    insights_dict[key] = "" if key == "executive_summary" else []

            records.append(
                TranscriptAnalysisRecord(
                    id=r.id,
                    filename=r.filename,
                    raw_text=r.raw_text,
                    extracted_insights=TranscriptInsights(**insights_dict),
                    status=r.status,
                    created_at=r.created_at,
                    updated_at=r.updated_at
                )
            )
        return records


@app.post("/transcript/{id}/insights", response_model=TranscriptAnalysisRecord)
def update_transcript_insights(id: int, request: TranscriptInsightsUpdateRequest) -> TranscriptAnalysisRecord:
    with SessionLocal() as session:
        db_record = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.id == id).first()
        if not db_record:
            raise HTTPException(status_code=404, detail="Transcript record not found.")
        
        db_record.extracted_insights = json.dumps(request.extracted_insights.model_dump(mode="json"))
        db_record.updated_at = datetime.now()
        session.commit()
        session.refresh(db_record)
        
        record = TranscriptAnalysisRecord(
            id=db_record.id,
            filename=db_record.filename,
            raw_text=db_record.raw_text,
            extracted_insights=request.extracted_insights,
            status=db_record.status,
            created_at=db_record.created_at,
            updated_at=db_record.updated_at
        )
        return record


@app.post("/transcript/{id}/status", response_model=TranscriptAnalysisRecord)
def update_transcript_status(id: int, request: TranscriptStatusUpdateRequest) -> TranscriptAnalysisRecord:
    with SessionLocal() as session:
        db_record = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.id == id).first()
        if not db_record:
            raise HTTPException(status_code=404, detail="Transcript record not found.")
        
        db_record.status = request.status
        db_record.updated_at = datetime.now()
        session.commit()
        session.refresh(db_record)
        
        try:
            insights_dict = json.loads(db_record.extracted_insights or "{}")
        except Exception:
            insights_dict = {}
            
        record = TranscriptAnalysisRecord(
            id=db_record.id,
            filename=db_record.filename,
            raw_text=db_record.raw_text,
            extracted_insights=TranscriptInsights(**insights_dict),
            status=db_record.status,
            created_at=db_record.created_at,
            updated_at=db_record.updated_at
        )
    log_activity("Transcript Status Updated", f"Transcript '{db_record.filename}' marked as {request.status}.")
    return record


@app.delete("/transcript/{id}")
def delete_transcript(id: int) -> dict[str, str]:
    with SessionLocal() as session:
        db_record = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.id == id).first()
        if not db_record:
            raise HTTPException(status_code=404, detail="Transcript record not found.")
        
        filename = db_record.filename
        session.delete(db_record)
        session.commit()
        
    log_activity("Transcript Deleted", f"Transcript '{filename}' deleted.")
    return {"status": "success", "message": f"Transcript '{filename}' deleted."}


import shutil

def _profile_to_dict(profile, session) -> dict[str, Any]:
    """Helper: serialize a ClientProfile row + its insights."""
    insights = session.query(ClientInsight).filter(ClientInsight.client_profile_id == profile.id).all()
    insight_items = []
    for ins in insights:
        try:
            insights_list = json.loads(ins.content_json)
        except Exception:
            insights_list = []
        insight_items.append({"category": ins.category, "insights": insights_list})
    return {
        "id": profile.id,
        "client_name": profile.client_name,
        "industry": profile.industry,
        "sub_industry": profile.sub_industry,
        "country": profile.country,
        "region": profile.region,
        "company_size": profile.company_size,
        "organization_description": profile.organization_description,
        "erp_platform": profile.erp_platform,
        "crm_platform": profile.crm_platform,
        "mes_platform": profile.mes_platform,
        "bi_tool": profile.bi_tool,
        "data_warehouse": profile.data_warehouse,
        "cloud_platform": profile.cloud_platform,
        "insights": insight_items,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


@app.get("/clients")
def list_clients():
    """Return all client profiles with engagement counts."""
    with SessionLocal() as session:
        profiles = session.query(ClientProfile).order_by(ClientProfile.updated_at.desc()).all()
        results = []
        for p in profiles:
            eng_count = session.query(Engagement).filter(Engagement.client_profile_id == p.id).count()
            results.append({
                **_profile_to_dict(p, session),
                "engagement_count": eng_count,
            })
        return results


@app.get("/clients/{client_id}")
def get_client_by_id(client_id: int):
    """Return a specific client profile by ID."""
    with SessionLocal() as session:
        profile = session.query(ClientProfile).filter(ClientProfile.id == client_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Client not found.")
        return _profile_to_dict(profile, session)


@app.delete("/clients/{client_id}")
def delete_client(request: Request, client_id: int):
    """Delete a client profile, its engagements, and all associated engagement data."""
    with SessionLocal() as session:
        profile = session.query(ClientProfile).filter(ClientProfile.id == client_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Client not found.")
            
        client_name = profile.client_name
        log_audit(
            request=request,
            action="Delete",
            module="Client Profile",
            entity_type="Client",
            entity_name=client_name,
            client_id=client_id,
            db_session=session
        )
            
        engagements = session.query(Engagement).filter(Engagement.client_profile_id == client_id).all()
        eng_ids = [e.id for e in engagements]
        
        if eng_ids:
            from app.database import (
                BusinessContext as DBBusinessContext,
                Prompt as DBPrompt,
                KPILibrary as DBKPILibrary,
                KPITree as DBKPITree,
                FunctionalSpecification as DBFunctionalSpecification,
                ApprovedKPIs as DBApprovedKPIs,
            )
            # Delete orphaned engagement-level records manually since they lack a strict foreign key cascade
            session.query(DBBusinessContext).filter(DBBusinessContext.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            session.query(DBPrompt).filter(DBPrompt.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            session.query(DBKPILibrary).filter(DBKPILibrary.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            session.query(DBKPITree).filter(DBKPITree.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            session.query(DBFunctionalSpecification).filter(DBFunctionalSpecification.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            session.query(DBApprovedKPIs).filter(DBApprovedKPIs.engagement_id.in_(eng_ids)).delete(synchronize_session=False)
            
        # SQLite with PRAGMA foreign_keys=ON will cascade delete engagements and client_insights
        session.delete(profile)
        session.commit()
        return {"status": "success", "message": f"Client {client_name} and related data deleted."}



@app.get("/client-profile", response_model=dict[str, Any])
def get_client_profile():
    with SessionLocal() as session:
        eng_id = active_engagement_id_ctx.get()
        if eng_id:
            eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
            if eng:
                profile = session.query(ClientProfile).filter(ClientProfile.id == eng.client_profile_id).first()
                if profile:
                    return _profile_to_dict(profile, session)
        profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
        if not profile:
            return {}
        return _profile_to_dict(profile, session)


@app.post("/client-profile", response_model=dict[str, Any])
def save_client_profile(request: Request, payload: ClientProfileSavePayload):
    profile_data = payload.profile
    if not profile_data.client_name.strip():
        raise HTTPException(status_code=400, detail="Client Name is required.")
    if not profile_data.industry.strip():
        raise HTTPException(status_code=400, detail="Industry is required.")
    if not profile_data.country.strip():
        raise HTTPException(status_code=400, detail="Country is required.")
        
    with SessionLocal() as session:
        # If the payload includes an id, update that profile; else create new
        profile = None
        is_create = True
        previous_profile_data = None
        
        if profile_data.id:
            profile = session.query(ClientProfile).filter(ClientProfile.id == profile_data.id).first()
            if profile:
                is_create = False
                previous_profile_data = {
                    "client_name": profile.client_name,
                    "industry": profile.industry,
                    "sub_industry": profile.sub_industry,
                    "country": profile.country,
                    "region": profile.region,
                    "company_size": profile.company_size,
                    "organization_description": profile.organization_description,
                    "erp_platform": profile.erp_platform,
                    "crm_platform": profile.crm_platform,
                    "mes_platform": profile.mes_platform,
                    "bi_tool": profile.bi_tool,
                    "data_warehouse": profile.data_warehouse,
                    "cloud_platform": profile.cloud_platform,
                }
                
        if not profile:
            profile = ClientProfile()
            session.add(profile)
            
        profile.client_name = profile_data.client_name
        profile.industry = profile_data.industry
        profile.sub_industry = profile_data.sub_industry
        profile.country = profile_data.country
        profile.region = profile_data.region
        profile.company_size = profile_data.company_size
        profile.organization_description = profile_data.organization_description
        profile.erp_platform = profile_data.erp_platform
        profile.crm_platform = profile_data.crm_platform
        profile.mes_platform = profile_data.mes_platform
        profile.bi_tool = profile_data.bi_tool
        profile.data_warehouse = profile_data.data_warehouse
        profile.cloud_platform = profile_data.cloud_platform
        profile.updated_at = datetime.now()
        
        session.flush() # Populate profile.id
        
        # Clear existing insights
        session.query(ClientInsight).filter(ClientInsight.client_profile_id == profile.id).delete()
        
        # Add new insights
        for item in payload.insights:
            db_insight = ClientInsight(
                client_profile_id=profile.id,
                category=item.category,
                content_json=json.dumps(item.insights)
            )
            session.add(db_insight)
            
        session.commit()

        # Audit logging
        if is_create:
            # Client created
            log_audit(
                request=request,
                action="Create",
                module="Client Profile",
                entity_type="Client",
                entity_name=profile.client_name,
                new_value=json.dumps({"client_name": profile.client_name, "industry": profile.industry, "country": profile.country}),
                client_id=profile.id,
                db_session=session
            )
        else:
            # Client updated
            log_audit(
                request=request,
                action="Update",
                module="Client Profile",
                entity_type="Client",
                entity_name=profile.client_name,
                previous_value=json.dumps(previous_profile_data),
                new_value=json.dumps({k: getattr(profile, k) for k in previous_profile_data.keys()}),
                client_id=profile.id,
                db_session=session
            )
            
            # Check for Client Profile Info changes
            profile_fields = ["client_name", "industry", "sub_industry", "country", "region", "company_size", "organization_description"]
            profile_changed = any(previous_profile_data[f] != getattr(profile, f) for f in profile_fields)
            if profile_changed:
                log_audit(
                    request=request,
                    action="Update",
                    module="Client Profile",
                    entity_type="Client",
                    entity_name=profile.client_name,
                    previous_value=json.dumps({f: previous_profile_data[f] for f in profile_fields}),
                    new_value=json.dumps({f: getattr(profile, f) for f in profile_fields}),
                    client_id=profile.id,
                    db_session=session
                )
                
            # Check for Technology Landscape updates
            tech_fields = ["erp_platform", "crm_platform", "mes_platform", "bi_tool", "data_warehouse", "cloud_platform"]
            tech_changed = any(previous_profile_data[f] != getattr(profile, f) for f in tech_fields)
            if tech_changed:
                log_audit(
                    request=request,
                    action="Update",
                    module="Technology Landscape",
                    entity_type="Client",
                    entity_name=profile.client_name,
                    previous_value=json.dumps({f: previous_profile_data[f] for f in tech_fields}),
                    new_value=json.dumps({f: getattr(profile, f) for f in tech_fields}),
                    client_id=profile.id,
                    db_session=session
                )
        
        # Construct response
        insight_items = []
        insights = session.query(ClientInsight).filter(ClientInsight.client_profile_id == profile.id).all()
        for ins in insights:
            try:
                insights_list = json.loads(ins.content_json)
            except Exception:
                insights_list = []
            insight_items.append({
                "category": ins.category,
                "insights": insights_list
            })
            
        log_activity("Client Setup Completed", f"Client profile for '{profile.client_name}' saved with {len(insight_items)} insight categories.")
        
        return {
            "id": profile.id,
            "client_name": profile.client_name,
            "industry": profile.industry,
            "sub_industry": profile.sub_industry,
            "country": profile.country,
            "region": profile.region,
            "company_size": profile.company_size,
            "organization_description": profile.organization_description,
            "erp_platform": profile.erp_platform,
            "crm_platform": profile.crm_platform,
            "mes_platform": profile.mes_platform,
            "bi_tool": profile.bi_tool,
            "data_warehouse": profile.data_warehouse,
            "cloud_platform": profile.cloud_platform,
            "insights": insight_items,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }


@app.post("/client-profile/upload")
def upload_client_asset(session_id: str, file: UploadFile = File(...)):
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required.")
        
    temp_dir = ROOT / "data" / "temp_uploads" / session_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = temp_dir / file.filename
    try:
        content = file.file.read()
        file_path.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage file: {e}")
        
    return {
        "status": "success",
        "filename": file.filename,
        "size": len(content),
        "message": f"File staged temporarily for session {session_id}."
    }


def model_supports_vision(provider_name: str, model_name: str) -> bool:
    if provider_name == "demo":
        return False
    lower_model = model_name.lower()
    # Check if Gemini, GPT-4, or Claude-3/3.5 models
    if "gemini" in lower_model or "gpt-4" in lower_model or "claude-3" in lower_model:
        return True
    return False


@app.post("/client-profile/analyze")
async def analyze_client_assets(session_id: str) -> dict[str, Any]:
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required.")
        
    temp_dir = ROOT / "data" / "temp_uploads" / session_id
    if not temp_dir.exists() or not temp_dir.is_dir():
        return {} # No files staged
        
    files = list(temp_dir.iterdir())
    if not files:
        return {}
        
    provider = get_provider()
    
    # Check if we should fallback to DemoProvider mock data
    if isinstance(provider, DemoProvider):
        # Delete temp folder
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass
        return {
            "Strategic Priorities": [
                "Scale cloud infrastructure to support 2x customer volume",
                "Automate manual billing and invoice reconciliation",
                "Optimize inventory turn rate in the primary distribution center"
            ],
            "Operational Challenges": [
                "Data latency of 24-48 hours between ERP and BI reporting",
                "High database maintenance overhead on legacy SQL server",
                "Lack of unified KPIs for cross-functional performance tracking"
            ],
            "Technology Stack Notes": [
                "Currently migrating from on-premise SAP ECC to Snowflake data warehouse",
                "Power BI is used for executive reporting but lacks real-time data sync"
            ],
            "Key Decisions & Actions": [
                "Approved POC for a new automated inventory monitoring solution",
                "Assigned IT Lead to review data pipelines for Snowflake migration"
            ]
        }
        
    text_contents = []
    image_payloads = []
    skipped_images = []
    
    # Process files
    for file_path in files:
        if file_path.is_file():
            ext = file_path.suffix.lower()
            if ext in [".png", ".jpg", ".jpeg"]:
                if model_supports_vision(provider.name, provider.model):
                    import base64
                    try:
                        img_bytes = file_path.read_bytes()
                        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                        mime_type = f"image/{ext[1:]}"
                        if ext == ".jpg":
                            mime_type = "image/jpeg"
                        image_payloads.append({"mime_type": mime_type, "data": img_b64})
                    except Exception as e:
                        logger.error(f"Failed to encode image {file_path.name}: {e}")
                        skipped_images.append(file_path.name)
                else:
                    skipped_images.append(file_path.name)
            else:
                try:
                    text = extract_text_from_asset(file_path.name, file_path.read_bytes())
                    text_contents.append(f"--- File: {file_path.name} ---\n{text}")
                except Exception as e:
                    logger.error(f"Failed to extract text from {file_path.name}: {e}")
                    text_contents.append(f"--- File: {file_path.name} ---\n[Error parsing: {e}]")
                    
    # Delete staged files immediately after reading
    try:
        shutil.rmtree(temp_dir)
    except Exception as e:
        logger.error(f"Failed to clean up temp dir {temp_dir}: {e}")
        
    combined_text = "\n\n".join(text_contents)
    user_prompt = f"=== UPLOADED BUSINESS ASSETS ===\n{combined_text}\n"
    if skipped_images:
        user_prompt += f"\n[Note: The following image assets were skipped because the model does not support image analysis or failed to encode: {', '.join(skipped_images)}]\n"
        
    # Call LLM
    try:
        if image_payloads:
            logger.info(f"Invoking LLM {provider.model} with {len(image_payloads)} images and text...")
            payload = await provider.generate_json(
                DYNAMIC_EXTRACTION_SYSTEM_PROMPT,
                user_prompt,
                step_name="analyze_assets_multimodal",
                images=image_payloads
            )
        else:
            logger.info(f"Invoking LLM {provider.model} with text only...")
            payload = await provider.generate_json(
                DYNAMIC_EXTRACTION_SYSTEM_PROMPT,
                user_prompt,
                step_name="analyze_assets_text"
            )
        return payload
    except Exception as e:
        if image_payloads:
            logger.warning(f"Multimodal LLM call failed: {e}. Retrying with text-only payload...")
            payload = await provider.generate_json(
                DYNAMIC_EXTRACTION_SYSTEM_PROMPT,
                user_prompt,
                step_name="analyze_assets_text_fallback"
            )
            return payload
        else:
            logger.error(f"Asset analysis failed: {e}")
            raise HTTPException(status_code=502, detail=f"LLM analysis failed: {e}")



# ─── Engagement Endpoints ──────────────────────────────────────────────────────

from fastapi import Query as FastQuery

@app.get("/engagements", response_model=list[EngagementRecord])
def list_engagements(client_id: int | None = FastQuery(default=None)):
    """Return engagements. If client_id is given, scope to that client; else return all."""
    from app.database import (
        BusinessContext as DBBusinessContext,
        Prompt as DBPrompt,
        KPILibrary as DBKPILibrary,
        FunctionalSpecification as DBFunctionalSpecification,
        TechnicalDataMappingDB,
    )
    with SessionLocal() as session:
        q = session.query(Engagement)
        if client_id is not None:
            q = q.filter(Engagement.client_profile_id == client_id)
        rows = q.order_by(Engagement.created_at.desc()).all()
        
        records = []
        for r in rows:
            # Check step completion for this engagement
            context = bool(session.scalar(select(DBBusinessContext).filter_by(engagement_id=r.id).limit(1)))
            prompt = bool(session.scalar(select(DBPrompt).filter_by(engagement_id=r.id).limit(1)))
            
            lib_row = session.scalar(select(DBKPILibrary).filter_by(engagement_id=r.id).limit(1))
            library = False
            if lib_row:
                try:
                    library = bool(json.loads(lib_row.items or "[]"))
                except Exception:
                    pass
                    
            spec_row = session.scalar(select(DBFunctionalSpecification).filter_by(engagement_id=r.id).limit(1))
            spec = False
            if spec_row:
                try:
                    spec = bool(json.loads(spec_row.items or "[]"))
                except Exception:
                    pass

            tdm_row = session.scalar(select(TechnicalDataMappingDB).filter_by(engagement_id=r.id).limit(1))
            tdm = False
            if tdm_row:
                tdm = tdm_row.status == "approved"
            
            wf_status = WorkflowStatus(
                business_context=context,
                prompt_generation=prompt,
                kpi_library=library,
                functional_specification=spec,
                technical_mapping=tdm,
            )
            records.append(
                EngagementRecord(
                    id=r.id,
                    client_profile_id=r.client_profile_id,
                    name=r.name,
                    engagement_id=r.engagement_id,
                    description=r.description,
                    status=r.status,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                    workflow_status=wf_status,
                )
            )
        return records


@app.post("/engagements", response_model=EngagementRecord)
def create_engagement(request: Request, payload: EngagementCreate):
    """Create a new engagement linked to a specific client profile."""
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Engagement name is required.")

    with SessionLocal() as session:
        # Use client_profile_id from payload if provided, else fall back to latest profile
        if payload.client_profile_id:
            profile = session.query(ClientProfile).filter(ClientProfile.id == payload.client_profile_id).first()
        else:
            profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
        if not profile:
            raise HTTPException(
                status_code=400,
                detail="Client profile not found. Please save the client profile first.",
            )

        # Auto-generate an engagement ID if not provided
        eng_id = payload.engagement_id.strip()
        if not eng_id:
            # 1. Extract uppercase letters from client name for CLIENTCODE. Fallback to first two chars.
            client_code = "".join([c for c in profile.client_name if c.isupper()])
            if not client_code:
                client_code = profile.client_name[:2].upper()
            
            # 2. Get current year
            year = datetime.now().year
            
            # 3. Find the latest engagement for this client to determine sequence
            from sqlalchemy import select, desc
            latest_eng = session.scalar(
                select(Engagement)
                .filter(Engagement.client_profile_id == profile.id)
                .filter(Engagement.engagement_id.like(f"{client_code}-{year}-%"))
                .order_by(desc(Engagement.id))
            )
            
            eng_num = 1
            if latest_eng and latest_eng.engagement_id:
                try:
                    last_num = int(latest_eng.engagement_id.split("-")[-1])
                    eng_num = last_num + 1
                except ValueError:
                    pass
            
            eng_id = f"{client_code}-{year}-{eng_num:03d}"

        now = datetime.now()
        eng = Engagement(
            client_profile_id=profile.id,
            name=payload.name.strip(),
            engagement_id=eng_id,
            description=payload.description.strip(),
            status="active",
            created_at=now,
            updated_at=now,
        )
        session.add(eng)
        session.commit()
        session.refresh(eng)

        log_audit(
            request=request,
            action="Create",
            module="Engagement Management",
            entity_type="Engagement",
            entity_name=eng.name,
            client_id=eng.client_profile_id,
            engagement_id=eng.id,
            db_session=session
        )

        log_activity("Engagement Created", f"Engagement '{eng.name}' ({eng.engagement_id}) created.")

        return EngagementRecord(
            id=eng.id,
            client_profile_id=eng.client_profile_id,
            name=eng.name,
            engagement_id=eng.engagement_id,
            description=eng.description,
            status=eng.status,
            created_at=eng.created_at,
            updated_at=eng.updated_at,
        )

@app.put("/engagements/{engagement_id_path}", response_model=EngagementRecord)
def update_engagement(request: Request, engagement_id_path: int, payload: EngagementCreate):
    """Update an existing engagement's name and description."""
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Engagement name is required.")
        
    with SessionLocal() as session:
        eng = session.query(Engagement).filter(Engagement.id == engagement_id_path).first()
        if not eng:
            raise HTTPException(status_code=404, detail="Engagement not found.")
            
        old_name = eng.name
        eng.name = payload.name.strip()
        eng.description = payload.description.strip()
        eng.updated_at = datetime.now()
        
        session.commit()
        session.refresh(eng)

        log_audit(
            request=request,
            action="Update",
            module="Engagement Management",
            entity_type="Engagement",
            entity_name=eng.name,
            previous_value=old_name,
            new_value=eng.name,
            client_id=eng.client_profile_id,
            engagement_id=eng.id,
            db_session=session
        )
        
        log_activity("Engagement Updated", f"Engagement '{eng.name}' updated.")
        
        from app.database import (
            BusinessContext as DBBusinessContext,
            Prompt as DBPrompt,
            KPILibrary as DBKPILibrary,
            FunctionalSpecification as DBFunctionalSpecification,
        )
        
        context = bool(session.scalar(select(DBBusinessContext).filter_by(engagement_id=eng.id).limit(1)))
        prompt = bool(session.scalar(select(DBPrompt).filter_by(engagement_id=eng.id).limit(1)))
        
        lib_row = session.scalar(select(DBKPILibrary).filter_by(engagement_id=eng.id).limit(1))
        library = False
        if lib_row:
            try:
                library = bool(json.loads(lib_row.items or "[]"))
            except Exception:
                pass
                
        spec_row = session.scalar(select(DBFunctionalSpecification).filter_by(engagement_id=eng.id).limit(1))
        spec = False
        if spec_row:
            try:
                spec = bool(json.loads(spec_row.items or "[]"))
            except Exception:
                pass
        
        wf_status = WorkflowStatus(
            business_context=context,
            prompt_generation=prompt,
            kpi_library=library,
            functional_specification=spec,
        )
        
        return EngagementRecord(
            id=eng.id,
            client_profile_id=eng.client_profile_id,
            name=eng.name,
            engagement_id=eng.engagement_id,
            description=eng.description,
            status=eng.status,
            created_at=eng.created_at,
            updated_at=eng.updated_at,
            workflow_status=wf_status,
        )

@app.delete("/engagements/{engagement_id_path}")
def delete_engagement(request: Request, engagement_id_path: int):
    """Delete a specific engagement by its database ID."""
    with SessionLocal() as session:
        eng = session.query(Engagement).filter(Engagement.id == engagement_id_path).first()
        if not eng:
            raise HTTPException(status_code=404, detail="Engagement not found.")
        name = eng.name
        client_id = eng.client_profile_id
        
        log_audit(
            request=request,
            action="Delete",
            module="Engagement Management",
            entity_type="Engagement",
            entity_name=name,
            client_id=client_id,
            engagement_id=engagement_id_path,
            db_session=session
        )
        
        session.delete(eng)
        session.commit()
    log_activity("Engagement Deleted", f"Engagement '{name}' deleted.")
    return {"status": "success", "message": f"Engagement '{name}' deleted."}


# ──────────────────────────────────────────────────────────────────────────────

@app.post("/business-context")
def save_business_context(request: Request, context: BusinessContext) -> BusinessContext:
    try:
        prev_data = read_json(FILES["business_context"], {})
        previous_val = json.dumps(prev_data) if prev_data else None
    except Exception:
        previous_val = None

    write_json(FILES["business_context"], context.model_dump(mode="json"))
    log_activity("Business Context Created", f"{context.industry} / {context.organization_level}")
    
    log_audit(
        request=request,
        action="Update",
        module="Business Context",
        entity_type="Business Context",
        entity_name=f"{context.industry} / {context.organization_level}",
        previous_value=previous_val,
        new_value=json.dumps(context.model_dump(mode="json"))
    )
    return context


@app.get("/business-context")
def get_business_context() -> dict[str, Any]:
    return read_json(FILES["business_context"], {})


def build_fallback_guidance(user_guidance: str) -> str:
    if not user_guidance.strip():
        return ""
    
    lower_g = user_guidance.lower()
    phrases = []
    
    if "profit" in lower_g or "margin" in lower_g or "cost" in lower_g:
        phrases.append("Place greater emphasis on gross margin optimization, operating cost reduction, and financial performance improvement.")
    if "esg" in lower_g or "sustain" in lower_g:
        phrases.append("Prioritize environmental, social, and governance (ESG) compliance alongside sustainable footprint tracking.")
    if "safety" in lower_g or "compliance" in lower_g:
        phrases.append("Emphasize workplace safety standards, incident rate minimizations, and regulatory compliance protocols (such as OSHA guidelines).")
    if "executive" in lower_g or "leadership" in lower_g:
        phrases.append("Focus primarily on executive-level tracking, high-level dashboards, and strategic alignment parameters.")
    if "operational" in lower_g or "efficiency" in lower_g:
        phrases.append("Heavily prioritize operational KPIs that measure factory throughput, inventory turnover, and overall resource efficiency.")
    
    if phrases:
        integrated = " ".join(phrases)
        return (
            f"\n\n### Specific Advisory Mandates & Directives\n"
            f"The KPI advisory framework must integrate the following consulting-grade guidelines:\n"
            f"• {integrated}\n\n"
            f"All recommended metrics must be customized to prioritize and measure progress against these business goals."
        )
    else:
        # Professional wrapper fallback
        return (
            f"\n\n### Specific Advisory Mandates & Directives\n"
            f"The KPI advisory framework must integrate the following target guidelines:\n"
            f"• {user_guidance.strip()}\n\n"
            f"All recommended metrics must be customized to prioritize and measure progress against these business goals."
        )


def get_approved_transcripts_context() -> str:
    with SessionLocal() as session:
        approved = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.status == "approved").all()
        if not approved:
            return ""
        
        parts = []
        for i, t in enumerate(approved, start=1):
            try:
                insights = json.loads(t.extracted_insights or "{}")
            except Exception:
                continue
            
            t_str = (
                f"--- Transcript Insights {i}: {t.filename} ---\n"
                f"Executive Summary: {insights.get('executive_summary', '')}\n"
                f"Strategic Priorities:\n" + "\n".join(f"  - {p}" for p in insights.get("strategic_priorities", [])) + "\n"
                f"Business Challenges:\n" + "\n".join(f"  - {c}" for c in insights.get("business_challenges", [])) + "\n"
                f"Key Decisions:\n" + "\n".join(f"  - {d}" for d in insights.get("key_decisions", [])) + "\n"
                f"Action Items:\n" + "\n".join(f"  - {a}" for a in insights.get("action_items", [])) + "\n"
                f"Risks & Dependencies:\n" + "\n".join(f"  - {r}" for r in insights.get("risks_dependencies", [])) + "\n"
                f"Mentioned Metrics:\n" + "\n".join(f"  - {m}" for m in insights.get("mentioned_metrics", [])) + "\n"
            )
            parts.append(t_str)
            
        if not parts:
            return ""
            
        return "=== APPROVED TRANSCRIPT ANALYSIS INSIGHTS ===\n" + "\n".join(parts)


def get_approved_client_insights_context() -> str:
    eng_id = active_engagement_id_ctx.get()
    with SessionLocal() as session:
        profile_id = None
        if eng_id:
            eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
            if eng:
                profile_id = eng.client_profile_id
        
        if not profile_id:
            profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
            if not profile:
                return ""
            profile_id = profile.id
            
        insights = session.query(ClientInsight).filter(ClientInsight.client_profile_id == profile_id).all()
        if not insights:
            return ""
            
        parts = []
        for ins in insights:
            try:
                insights_list = json.loads(ins.content_json or "[]")
            except Exception:
                continue
            if not insights_list:
                continue
            
            p_str = (
                f"--- Business Assets Insights Category: {ins.category} ---\n"
                + "\n".join(f"  - {item}" for item in insights_list) + "\n"
            )
            parts.append(p_str)
            
        if not parts:
            return ""
            
        return "=== DYNAMIC BUSINESS ASSET INSIGHTS ===\n" + "\n".join(parts)


class GeneratePromptRequest(BaseModel):
    user_instructions: str = ""


class RefinePromptRequest(BaseModel):
    prompt: str = ""
    refinement_instructions: str


@app.post("/generate-prompt")
async def generate_prompt(request: Request, gen_request: GeneratePromptRequest) -> PromptRecord:
    logger.info("=== GENERATING PROMPT ===")
    logger.info(f"User advisory instructions input: '{gen_request.user_instructions}'")
    context = current_context()
    context_raw = current_context(merged=False)
    provider = get_provider()
    
    logger.info(f"Loaded context for industry: '{context_raw.industry}', org_level: '{context_raw.organization_level}', target count: {context_raw.kpi_count}")
    
    # Check if we are running in DemoProvider mode
    if isinstance(provider, DemoProvider):
        logger.info("Using DemoProvider fallback prompt builder")
        prompt_text = build_kpi_prompt(context)
        transcript_ctx = get_approved_transcripts_context()
        if transcript_ctx:
            prompt_text += f"\n\n{transcript_ctx}"
        asset_insights_ctx = get_approved_client_insights_context()
        if asset_insights_ctx:
            prompt_text += f"\n\n{asset_insights_ctx}"
        prompt_text += build_fallback_guidance(gen_request.user_instructions)
    else:
        # Build prompt using Gemini
        user_prompt = (
            f"=== RAW BUSINESS CONTEXT ===\n"
            f"Industry: {context_raw.industry}\n"
            f"Organization Level: {context_raw.organization_level}\n"
            f"KPI Count: {context_raw.kpi_count}\n"
            f"\n--- Predefined Business Priorities ---\n" + ("\n".join(f"- {p}" for p in context_raw.business_priorities) if context_raw.business_priorities else "None specified") + "\n"
            f"\n--- Additional / Custom Business Priorities ---\n" + ("\n".join(f"- {p}" for p in context_raw.additional_business_priorities) if context_raw.additional_business_priorities else "None specified") + "\n"
            f"\n--- Predefined Business Challenges ---\n" + ("\n".join(f"- {c}" for c in context_raw.business_challenges) if context_raw.business_challenges else "None specified") + "\n"
            f"\n--- Additional / Custom Business Challenges ---\n" + ("\n".join(f"- {c}" for c in context_raw.additional_business_challenges) if context_raw.additional_business_challenges else "None specified") + "\n"
            f"\n--- Predefined Top KRAs ---\n" + ("\n".join(f"- {k}" for k in context_raw.top_kras) if context_raw.top_kras else "None specified") + "\n"
            f"\n--- Additional / Custom KRAs ---\n" + ("\n".join(f"- {k}" for k in context_raw.additional_kras) if context_raw.additional_kras else "None specified") + "\n"
            f"\n--- Predefined Functional Areas ---\n" + ("\n".join(f"- {a}" for a in context_raw.functional_areas) if context_raw.functional_areas else "None specified") + "\n"
            f"\n--- Additional / Custom Functional Areas ---\n" + ("\n".join(f"- {a}" for a in context_raw.additional_functional_areas) if context_raw.additional_functional_areas else "None specified") + "\n"
        )
        
        if getattr(context_raw, "custom_fields", None):
            user_prompt += "\n--- Custom Context Fields / Answers ---\n"
            for f in context_raw.custom_fields:
                if f.label.strip() or f.value.strip():
                    user_prompt += f"- {f.label}: {f.value}\n"
        
        transcript_ctx = get_approved_transcripts_context()
        if transcript_ctx:
            user_prompt += f"\n{transcript_ctx}\n"

        asset_insights_ctx = get_approved_client_insights_context()
        if asset_insights_ctx:
            user_prompt += f"\n{asset_insights_ctx}\n"

        if gen_request.user_instructions:
            user_prompt += (
                f"\n=== USER INSTRUCTIONS / STRATEGIC PREFERENCES ===\n"
                f"{gen_request.user_instructions}\n"
            )
            
        system_prompt = PROMPT_GENERATION_SYSTEM_PROMPT.format(kpi_count=context.kpi_count)
        
        try:
            logger.info(f"Sending prompt generation request to LLM using model {provider.model}...")
            payload = await provider.generate_json(system_prompt, user_prompt, step_name="generate_prompt")
            prompt_text = payload.get("prompt", "").strip()
            if not prompt_text:
                raise ValueError("LLM returned empty prompt text")
            logger.info("Prompt generation succeeded.")
        except Exception as exc:
            # Fallback on failure
            logger.error(f"AI Prompt generation failed: {exc}. Falling back to build_kpi_prompt()", exc_info=True)
            prompt_text = build_kpi_prompt(context)
            prompt_text += build_fallback_guidance(gen_request.user_instructions)
                
    summary = {
        "Business Focus": f"{context.industry or 'Enterprise'} transformation for {context.organization_level or 'business'} leadership.",
        "Primary Challenges": context.business_challenges[:3],
        "Recommended KPI Areas": context.functional_areas,
        "Executive Summary": "The KPI library should prioritize measurable value creation, operational discipline and executive visibility.",
    }
    
    if not isinstance(provider, DemoProvider):
        try:
            logger.info("Generating concise business summary from the generated prompt...")
            summary_payload = await provider.generate_json(
                "Return a concise business summary as JSON with Business Focus, Primary Challenges, Recommended KPI Areas, Executive Summary.",
                prompt_text,
                step_name="generate_business_summary",
            )
            if isinstance(summary_payload, dict):
                summary.update(summary_payload)
                logger.info(f"Business summary generation succeeded: {summary}")
        except Exception as exc:
            logger.warning(f"Business summary generation failed: {exc}", exc_info=True)
            
    record = PromptRecord(
        prompt=prompt_text,
        original_prompt=prompt_text,
        user_instructions=gen_request.user_instructions,
        is_approved=False,
        ai_summary=summary
    )
    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Generated", "AI-driven KPI generation prompt prepared in Prompt Studio")
    
    log_audit(
        request=request,
        action="Generate",
        module="Prompt Generation",
        entity_type="Prompt",
        entity_name="AI Prompt",
        new_value=record.prompt
    )
    return record


@app.post("/refine-prompt")
async def refine_prompt(request: Request, refine_request: RefinePromptRequest) -> PromptRecord:
    logger.info("=== REFINING PROMPT ===")
    logger.info(f"Refinement instructions: '{refine_request.refinement_instructions}'")
    
    record = current_prompt()
    # Use workspace text from request body, fallback to DB prompt
    current_workspace_prompt = refine_request.prompt if refine_request.prompt.strip() else record.prompt
    
    provider = get_provider()
    context = current_context()
    context_raw = current_context(merged=False)
    
    if isinstance(provider, DemoProvider):
        logger.info("Using DemoProvider fallback prompt refiner")
        refined_prompt = current_workspace_prompt + f"\n\n[Refined with guidelines: {refine_request.refinement_instructions}]"
    else:
        user_prompt = (
            f"=== RAW BUSINESS CONTEXT ===\n"
            f"Industry: {context_raw.industry}\n"
            f"Org Level: {context_raw.organization_level}\n"
            f"KPI Count: {context_raw.kpi_count}\n"
            f"\n--- Predefined Business Priorities ---\n" + ("\n".join(f"- {p}" for p in context_raw.business_priorities) if context_raw.business_priorities else "None specified") + "\n"
            f"\n--- Additional / Custom Business Priorities ---\n" + ("\n".join(f"- {p}" for p in context_raw.additional_business_priorities) if context_raw.additional_business_priorities else "None specified") + "\n"
            f"\n--- Predefined Business Challenges ---\n" + ("\n".join(f"- {c}" for c in context_raw.business_challenges) if context_raw.business_challenges else "None specified") + "\n"
            f"\n--- Additional / Custom Business Challenges ---\n" + ("\n".join(f"- {c}" for c in context_raw.additional_business_challenges) if context_raw.additional_business_challenges else "None specified") + "\n"
            f"\n--- Predefined Top KRAs ---\n" + ("\n".join(f"- {k}" for k in context_raw.top_kras) if context_raw.top_kras else "None specified") + "\n"
            f"\n--- Additional / Custom KRAs ---\n" + ("\n".join(f"- {k}" for k in context_raw.additional_kras) if context_raw.additional_kras else "None specified") + "\n"
            f"\n--- Predefined Functional Areas ---\n" + ("\n".join(f"- {a}" for a in context_raw.functional_areas) if context_raw.functional_areas else "None specified") + "\n"
            f"\n--- Additional / Custom Functional Areas ---\n" + ("\n".join(f"- {a}" for a in context_raw.additional_functional_areas) if context_raw.additional_functional_areas else "None specified") + "\n\n"
        )
        
        transcript_ctx = get_approved_transcripts_context()
        if transcript_ctx:
            user_prompt += f"{transcript_ctx}\n\n"
            
        asset_insights_ctx = get_approved_client_insights_context()
        if asset_insights_ctx:
            user_prompt += f"{asset_insights_ctx}\n\n"

        user_prompt += (
            f"=== CURRENT PROMPT TO REFINE ===\n"
            f"{current_workspace_prompt}\n\n"
            f"=== NEW REFINEMENT INSTRUCTIONS ===\n"
            f"{refine_request.refinement_instructions}\n\n"
            f"Please refine the current prompt using the guidelines in the system instructions. Ensure that the refined prompt retains all details of the original business context and integrates the new refinement instructions seamlessly without copying them verbatim."
        )
        try:
            logger.info(f"Sending prompt refinement request to LLM using model {provider.model}...")
            system_prompt = PROMPT_REFINEMENT_SYSTEM_PROMPT.format(kpi_count=context.kpi_count)
            payload = await provider.generate_json(system_prompt, user_prompt, step_name="refine_prompt")
            refined_prompt = payload.get("prompt", "").strip()
            if not refined_prompt:
                raise ValueError("LLM returned empty refined prompt")
            logger.info("Prompt refinement succeeded.")
        except Exception as exc:
            logger.error(f"Prompt refinement failed: {exc}", exc_info=True)
            raise HTTPException(status_code=502, detail=f"Prompt refinement failed: {exc}") from exc
            
    record.prompt = refined_prompt
    record.is_approved = False
    from datetime import datetime
    record.updated_at = datetime.now()
    
    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Refined", "AI-driven KPI prompt refined in Prompt Studio")
    
    log_audit(
        request=request,
        action="Update",
        module="Prompt Generation",
        entity_type="Prompt",
        entity_name="AI Prompt",
        previous_value=current_workspace_prompt,
        new_value=record.prompt
    )
    return record


@app.get("/prompt")
def get_prompt() -> dict[str, Any]:
    return read_json(FILES["prompts"], {})


@app.post("/prompt")
def save_prompt(request: Request, record: PromptRecord) -> PromptRecord:
    try:
        prev_data = read_json(FILES["prompts"], {})
        previous_val = prev_data.get("prompt") if prev_data else None
    except Exception:
        previous_val = None

    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Saved", "Prompt Studio edits saved")
    
    log_audit(
        request=request,
        action="Update",
        module="Prompt Generation",
        entity_type="Prompt",
        entity_name="AI Prompt",
        previous_value=previous_val,
        new_value=record.prompt
    )
    return record


@app.post("/generate-kpis")
async def generate_kpis(request: Request) -> KPILibrary:
    context = current_context()
    prompt = current_prompt().prompt
    provider = get_provider()
    try:
        if isinstance(provider, DemoProvider):
            items = demo_kpis(context)
        else:
            system_prompt = build_system_kpi_prompt(context)
            try:
                user_prompt = prompt
                transcript_ctx = get_approved_transcripts_context()
                if transcript_ctx and transcript_ctx not in user_prompt:
                    user_prompt += f"\n\n{transcript_ctx}"
                asset_insights_ctx = get_approved_client_insights_context()
                if asset_insights_ctx and asset_insights_ctx not in user_prompt:
                    user_prompt += f"\n\n{asset_insights_ctx}"
                payload = await provider.generate_json(
                    system_prompt,
                    user_prompt,
                    step_name="generate_kpis",
                )
                items = normalize_kpi_payload(payload, context)
            except Exception as exc:
                print(f"KPI generation via provider failed: {exc}. Falling back to catalog-based KPIs.")
                items = demo_kpis(context)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"KPI generation failed: {exc}") from exc
    
    # Calculate quality metrics
    quality = quality_check(items, context)
    
    # Generate Executive Summary paragraph
    exec_summary_text = "The KPI library has been designed to align with corporate strategic priorities, focusing on margin expansion, operational efficiency, and supply chain reliability."
    
    if not isinstance(provider, DemoProvider):
        try:
            summary_prompt = (
                f"Write a professional, 3-sentence executive summary paragraph for a KPI advisory engagement. "
                f"Industry: {context.industry}. priorities: {', '.join(context.business_priorities)}. "
                f"Challenges: {', '.join(context.business_challenges)}. "
                f"Selected KPIs: {', '.join(k.kpi_name for k in items)}."
            )
            summary_payload = await provider.generate_json(
                "Return a JSON object with 'summary_text': 'your summary here'. Do not return any other text.",
                summary_prompt,
                step_name="generate_executive_summary",
            )
            if isinstance(summary_payload, dict) and summary_payload.get("summary_text"):
                exec_summary_text = summary_payload["summary_text"]
        except Exception:
            pass
            
    # Compile complete Executive Summary
    exec_summary = {
        "summary_text": exec_summary_text,
        "industry": context.industry,
        "primary_priorities": context.business_priorities,
        "generated_kpis_count": len(items),
        "top_functional_areas": list(set(k.functional_area for k in items)),
        "coverage_score": quality["score"]
    }
    
    library = KPILibrary(
        items=items,
        quality=quality,
        recommendations=recommendations(items, context),
        executive_summary=exec_summary
    )
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Clear approved KPIs on regeneration
    write_json(FILES["approved_kpis"], {"items": []})
    
    log_activity("KPI Library Generated", f"{len(items)} KPIs created")
    
    log_audit(
        request=request,
        action="Generate",
        module="KPI Library",
        entity_type="KPI Library",
        entity_name="KPI Library",
        new_value=f"Generated {len(library.items)} KPIs"
    )
    return library


@app.get("/kpi-catalog")
def get_kpi_catalog() -> list[dict[str, Any]]:
    from app.services.kpi_engine import load_catalog
    return load_catalog()


@app.get("/kpi-library")
def get_kpi_library() -> dict[str, Any]:
    return read_json(FILES["kpi_library"], {})


@app.post("/kpi-library/upload")
async def upload_kpi_library(request: Request, file: UploadFile = File(...)) -> KPILibrary:
    import csv
    import codecs
    import uuid
    from app.services.kpi_engine import quality_check, recommendations
    import openpyxl
    
    context = current_context()
    library = current_library()
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    rows = []
    if file.filename.lower().endswith('.csv'):
        reader = csv.DictReader(codecs.iterdecode(file.file, 'utf-8-sig'))
        rows = list(reader)
    elif file.filename.lower().endswith('.xlsx') or file.filename.lower().endswith('.xls'):
        wb = openpyxl.load_workbook(file.file, data_only=True)
        sheet = wb.active
        headers = [str(cell.value) if cell.value is not None else "" for cell in sheet[1]]
        for row_cells in sheet.iter_rows(min_row=2, values_only=True):
            if any(row_cells): # skip empty rows
                row_dict = {headers[i]: val for i, val in enumerate(row_cells) if i < len(headers)}
                rows.append(row_dict)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel.")

    new_items = []
    for row in rows:
        kpi_dict = {}
        # normalize keys
        normalized_row = {k.strip().lower().replace(" ", "_"): v for k, v in row.items() if k}
        
        # map to KPI model
        for key, value in normalized_row.items():
            if value is None:
                continue
            if key == "description":
                key = "kpi_description"
            if key in KPI.model_fields:
                kpi_dict[key] = str(value).strip()
                
        # set defaults for mandatory fields
        if not kpi_dict.get("id"):
            kpi_dict["id"] = f"KPI-UPL-{uuid.uuid4().hex[:6].upper()}"
        if not kpi_dict.get("kpi_name"):
            kpi_dict["kpi_name"] = "Unnamed KPI"
        if not kpi_dict.get("functional_area"):
            kpi_dict["functional_area"] = "Unknown"
        if not kpi_dict.get("kra"):
            kpi_dict["kra"] = "Unknown"
        if not kpi_dict.get("kpi_description"):
            kpi_dict["kpi_description"] = "No description provided."
        if not kpi_dict.get("formula"):
            kpi_dict["formula"] = "TBD"
        if not kpi_dict.get("source_system"):
            kpi_dict["source_system"] = "TBD"
        if not kpi_dict.get("refresh_cadence"):
            kpi_dict["refresh_cadence"] = "TBD"
            
        kpi_dict["status"] = KPIStatus.draft
        
        try:
            kpi = KPI(**kpi_dict)
            new_items.append(kpi)
        except Exception as e:
            logger.error(f"Failed to parse KPI row {row}: {e}")
            continue

    library.items = new_items

    # Update quality and recommendations
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    
    # Save back to database (json file)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Log the action
    log_activity("KPI Template Uploaded", f"{len(rows)} KPIs parsed from {file.filename}")
    log_audit(
        request=request,
        action="Upload",
        module="KPI Library",
        entity_type="KPI Template",
        entity_name=file.filename,
        new_value=f"Imported {len(rows)} KPIs"
    )
    
    return library


@app.post("/approve-kpis")
def approve_kpis(request: Request, approval_req: KPIApprovalRequest) -> KPILibrary:
    context = current_context()
    library = current_library()
    ids = set(approval_req.ids)
    for item in library.items:
        if item.id in ids:
            item.status = approval_req.status
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Sync approved KPIs
    approved_items = [item.model_dump(mode="json") for item in library.items if item.status == KPIStatus.approved]
    write_json(FILES["approved_kpis"], {"items": approved_items})
    
    log_activity("KPI Approval Updated", f"{len(ids)} KPI(s) marked {approval_req.status.value}")
    
    action_val = "Approve" if approval_req.status == KPIStatus.approved else "Reject"
    log_audit(
        request=request,
        action=action_val,
        module="KPI Library",
        entity_type="KPI",
        entity_name=f"{len(approval_req.ids)} KPIs",
        new_value=", ".join(approval_req.ids)
    )
    return library


@app.post("/kpi-library/update")
def update_kpi(request: Request, update_req: KPIUpdateRequest) -> KPILibrary:
    context = current_context()
    library = current_library()
    
    old_item = None
    for item in library.items:
        if item.id == update_req.id:
            old_item = item.model_dump(mode="json")
            break

    for index, item in enumerate(library.items):
        if item.id == update_req.id:
            data = item.model_dump()
            data.update(update_req.patch)
            library.items[index] = type(item)(**data)
            break
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Sync approved KPIs
    approved_items = [item.model_dump(mode="json") for item in library.items if item.status == KPIStatus.approved]
    write_json(FILES["approved_kpis"], {"items": approved_items})
    
    log_activity("KPI Edited", update_req.id)
    
    log_audit(
        request=request,
        action="Update",
        module="KPI Library",
        entity_type="KPI",
        entity_name=update_req.id,
        previous_value=json.dumps(old_item) if old_item else None,
        new_value=json.dumps(update_req.patch)
    )
    return library


class KPIAddRequest(BaseModel):
    item: KPI

@app.post("/kpi-library/add")
def add_kpi(request: Request, add_req: KPIAddRequest) -> KPILibrary:
    import time
    context = current_context()
    library = current_library()
    
    new_id = f"kpi-custom-{len(library.items) + 1}-{int(time.time())}"
    add_req.item.id = new_id
    if not add_req.item.status:
        add_req.item.status = KPIStatus.recommended
        
    library.items.insert(0, add_req.item)
    
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    log_activity("KPI Added", f"Custom KPI '{add_req.item.kpi_name}' added to library")
    
    log_audit(
        request=request,
        action="Create",
        module="KPI Library",
        entity_type="KPI",
        entity_name=add_req.item.kpi_name,
        new_value=json.dumps(add_req.item.model_dump(mode="json"))
    )
    return library


def classify_kpi_heuristically(kpi: KPI) -> str:
    name = (kpi.kpi_name or "").lower()
    desc = (kpi.kpi_description or "").lower()
    why = (kpi.why_important or "").lower()
    purpose = (getattr(kpi, "business_purpose", "") or "").lower()
    
    # Text to check
    full_text = f"{name} {desc} {why} {purpose}"
    
    # Check for Revenue
    revenue_keywords = ["revenue", "sales", "customer acquisition", "customer retention", "market share", "cross-sell", "upsell", "pricing", "conversion", "retention"]
    if any(kw in full_text for kw in revenue_keywords):
        return "Critical to Revenue"
        
    # Check for Cost
    cost_keywords = ["cost", "optimization", "inventory", "procurement", "manufacturing cost", "resource utilization", "waste", "productivity", "efficiency", "savings", "margin"]
    if any(kw in full_text for kw in cost_keywords):
        return "Critical to Cost"
        
    # Default to Progress
    return "Critical to Progress"


def sync_classifications_from_tree(tree_dict: dict, request: Request | None):
    # Extract KPI classifications from tree JSON
    classifications = {}
    sfas = tree_dict.get("strategic_focus_areas", [])
    for sfa in sfas:
        for sd in sfa.get("drivers", []):
            for ssd in sd.get("sector_specific_drivers", []) or sd.get("sector_drivers", []) or []:
                for kpi in ssd.get("kpis", []):
                    name = kpi.get("name") or kpi.get("kpi_name")
                    classification = kpi.get("classification") or "Critical to Progress"
                    if name:
                        classifications[name] = {
                            "classification": classification,
                            "classification_confidence": kpi.get("classification_confidence", 0.9 if classification != "Critical to Progress" else 1.0),
                            "classification_source": kpi.get("classification_source", "AI")
                        }
                        
    if not classifications:
        return
        
    # Read current library
    library_data = read_json(FILES["kpi_library"], {})
    items = library_data.get("items") or []
    updated = False
    
    for item in items:
        name = item.get("kpi_name")
        if name in classifications:
            cls_info = classifications[name]
            # Only update if changed
            if item.get("classification") != cls_info["classification"] or item.get("classification_source") != cls_info["classification_source"]:
                item["classification"] = cls_info["classification"]
                item["classification_confidence"] = float(cls_info["classification_confidence"])
                item["classification_source"] = cls_info["classification_source"]
                updated = True
                
    if updated:
        write_json(FILES["kpi_library"], library_data)
        # Sync approved KPIs
        approved_items = [item for item in items if item.get("status") == "approved"]
        write_json(FILES["approved_kpis"], {"items": approved_items})
        
        # Log audit: KPI Library Classification Synced
        with SessionLocal() as session:
            log_audit(
                request=request,
                action="KPI Library Classification Synced",
                module="KPI Library",
                entity_type="KPI Library",
                entity_name="KPI Library",
                new_value=f"Synced {len(classifications)} classifications from tree",
                db_session=session
            )


def generate_demo_driver_tree(context: BusinessContext, approved_kpis: list[KPI], profile: Any) -> dict:
    sfas = []
    
    # Group by functional area to create SFAs
    by_area = {}
    for k in approved_kpis:
        area = k.functional_area or "Operations"
        if area not in by_area:
            by_area[area] = []
        by_area[area].append(k)
        
    for area, kpis in by_area.items():
        sfa_name = f"{area} Process Excellence"
        sfa_desc = f"Focuses on driving productivity, quality, and cycle time reductions within {area} workflows."
        sfa_rationale = f"Generated to support the primary functional area: {area} as defined in client priorities."
        
        objs = [p for p in context.business_priorities if area.lower() in p.lower()] or context.business_priorities[:2]
        chals = [c for c in context.business_challenges if area.lower() in c.lower()] or context.business_challenges[:2]
        
        sfa_context = {
            "strategic_objectives": objs,
            "business_challenges": chals,
            "kras": list(set(k.kra for k in kpis if k.kra)) or ["Operational Excellence"],
            "functional_areas": [area],
            "custom_parameters": [f.label for f in getattr(context, "custom_fields", []) if f.label]
        }
        
        # Group by category to create Standard Drivers
        by_cat = {}
        for k in kpis:
            cat = k.kpi_category or "Operational"
            if cat not in by_cat:
                by_cat[cat] = []
            by_cat[cat].append(k)
            
        drivers = []
        for cat, cat_kpis in by_cat.items():
            sd_name = f"Optimize {cat} Levers"
            sd_desc = f"Ensure disciplined execution of {cat.lower()} workflows and resource controls."
            sd_rationale = f"Aligns with the {cat} KPI category requirements for {area} governance."
            sd_context = {
                "strategic_objectives": sfa_context["strategic_objectives"],
                "business_challenges": sfa_context["business_challenges"],
                "kras": list(set(k.kra for k in cat_kpis if k.kra)) or ["Process Control"],
                "functional_areas": [area],
                "custom_parameters": sfa_context["custom_parameters"]
            }
            
            # Group by KRA to create Sector-Specific Drivers
            by_kra = {}
            for k in cat_kpis:
                kra = k.kra or "Operational Excellence"
                if kra not in by_kra:
                    by_kra[kra] = []
                by_kra[kra].append(k)
                
            sector_drivers = []
            for kra, kra_kpis in by_kra.items():
                ssd_name = f"{kra} Optimization ({profile.industry if profile else 'Generic'})"
                ssd_desc = f"Operational levers designed specifically for {kra} within {profile.industry if profile else 'the enterprise'} context."
                ssd_rationale = f"Generated specifically to address the Key Result Area: {kra} using local source telemetry."
                ssd_context = {
                    "strategic_objectives": sd_context["strategic_objectives"],
                    "business_challenges": sd_context["business_challenges"],
                    "kras": [kra],
                    "functional_areas": [area],
                    "custom_parameters": sd_context["custom_parameters"]
                }
                
                mapped_kpis = []
                for k in kra_kpis:
                    mapped_kpis.append({
                        "name": k.kpi_name,
                        "description": k.kpi_description,
                        "importance": k.why_important or f"Critical for measuring {kra} in {area}.",
                        "placement_rationale": f"Directly traces from strategic objectives to {k.kpi_name} under {kra}.",
                        "classification": classify_kpi_heuristically(k),
                        "classification_confidence": 1.0,
                        "classification_source": "AI",
                        "source_context": {
                            "strategic_objectives": ssd_context["strategic_objectives"],
                            "business_challenges": ssd_context["business_challenges"],
                            "kras": [kra],
                            "functional_areas": [area],
                            "custom_parameters": ssd_context["custom_parameters"]
                        }
                    })
                    
                sector_drivers.append({
                    "name": ssd_name,
                    "description": ssd_desc,
                    "business_rationale": ssd_rationale,
                    "source_context": ssd_context,
                    "kpis": mapped_kpis
                })
                
            drivers.append({
                "name": sd_name,
                "description": sd_desc,
                "business_rationale": sd_rationale,
                "source_context": sd_context,
                "sector_specific_drivers": sector_drivers
            })
            
        sfas.append({
            "name": sfa_name,
            "description": sfa_desc,
            "business_rationale": sfa_rationale,
            "source_context": sfa_context,
            "drivers": drivers
        })
        
    return {"strategic_focus_areas": sfas}


class KpiTreeSaveRequest(BaseModel):
    name: str = "Default Tree"
    data: dict
    action: str | None = None
    entity_type: str | None = None
    entity_name: str | None = None
    previous_value: str | None = None
    new_value: str | None = None


class KpiTreeApproveRequest(BaseModel):
    approved: bool


@app.get("/kpi-tree")
def get_kpi_tree():
    from app.database import KPITree
    with SessionLocal() as session:
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
        else:
            row = session.scalar(select(KPITree).filter_by(id=1))
            
        if not row:
            raise HTTPException(status_code=404, detail="KPI Driver Tree has not been generated yet.")
            
        return {
            "name": row.name,
            "client_id": row.client_id,
            "version": row.version,
            "status": row.status,
            "created_by": row.created_by,
            "updated_by": row.updated_by,
            "data": json.loads(row.tree_json or row.data or "{}"),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


@app.post("/kpi-tree")
def save_kpi_tree(request: Request, payload: KpiTreeSaveRequest):
    from app.database import KPITree
    user_name, _ = get_user_info(request)
    eng_id = active_engagement_id_ctx.get()
    
    with SessionLocal() as session:
        client_id = None
        if eng_id:
            eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
            if eng:
                client_id = eng.client_profile_id
                
        if eng_id is not None:
            row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
            if not row:
                row = KPITree(engagement_id=eng_id, created_by=user_name, version=1, status="draft")
                session.add(row)
        else:
            row = session.scalar(select(KPITree).filter_by(id=1))
            if not row:
                row = KPITree(id=1, created_by=user_name, version=1, status="draft")
                session.add(row)
                
        prev_data = row.tree_json
        
        row.name = payload.name
        row.client_id = client_id
        row.tree_json = json.dumps(payload.data)
        row.data = json.dumps(payload.data)
        row.updated_by = user_name
        row.updated_at = datetime.now()

        # Update metadata counts
        total_focus_areas = len(payload.data.get("strategic_focus_areas", []))
        total_standard_drivers = 0
        total_sector_drivers = 0
        total_kpis = 0
        total_revenue_kpis = 0
        total_cost_kpis = 0
        total_progress_kpis = 0
        
        for sfa in payload.data.get("strategic_focus_areas", []):
            drivers = sfa.get("drivers", [])
            total_standard_drivers += len(drivers)
            for sd in drivers:
                ssds = sd.get("sector_specific_drivers", []) or sd.get("sector_drivers", []) or []
                total_sector_drivers += len(ssds)
                for ssd in ssds:
                    kpis = ssd.get("kpis", [])
                    total_kpis += len(kpis)
                    for k in kpis:
                        cls = k.get("classification") or "Critical to Progress"
                        if cls == "Critical to Revenue":
                            total_revenue_kpis += 1
                        elif cls == "Critical to Cost":
                            total_cost_kpis += 1
                        else:
                            total_progress_kpis += 1
                            
        row.total_focus_areas = total_focus_areas
        row.total_standard_drivers = total_standard_drivers
        row.total_sector_drivers = total_sector_drivers
        row.total_kpis = total_kpis
        row.total_revenue_kpis = total_revenue_kpis
        row.total_cost_kpis = total_cost_kpis
        row.total_progress_kpis = total_progress_kpis

        session.commit()
        
        # Sync to library
        sync_classifications_from_tree(payload.data, request)
        
        log_audit(
            request=request,
            action=payload.action or "Tree Edited",
            module="KPI Driver Tree",
            entity_type=payload.entity_type or "KPI Driver Tree",
            entity_name=payload.entity_name or row.name,
            previous_value=payload.previous_value or prev_data,
            new_value=payload.new_value or row.tree_json,
            db_session=session
        )
        
    log_activity(payload.action or "KPI Driver Tree Saved", f"Driver tree updated by {user_name}")
    return {"status": "success", "message": "KPI Driver Tree saved successfully."}


@app.post("/approve-kpi-tree")
def approve_kpi_tree(request: Request, payload: KpiTreeApproveRequest):
    from app.database import KPITree
    user_name, _ = get_user_info(request)
    eng_id = active_engagement_id_ctx.get()
    
    with SessionLocal() as session:
        if eng_id is not None:
            row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
        else:
            row = session.scalar(select(KPITree).filter_by(id=1))
            
        if not row:
            raise HTTPException(status_code=404, detail="KPI Driver Tree not found.")
            
        status_val = "approved" if payload.approved else "draft"
        action_val = "Tree Approved" if payload.approved else "Tree Unapproved"
        
        row.status = status_val
        row.updated_by = user_name
        row.updated_at = datetime.now()
        if payload.approved:
            row.approved_by = user_name
            row.approved_at = datetime.now()
        else:
            row.approved_by = ""
            row.approved_at = None
        session.commit()
        
        log_audit(
            request=request,
            action=action_val,
            module="KPI Driver Tree",
            entity_type="KPI Driver Tree",
            entity_name=row.name,
            new_value=status_val,
            db_session=session
        )
        
    log_activity(action_val, f"KPI Driver Tree marked as {status_val} by {user_name}")
    return {"status": "success", "status_value": status_val}


@app.post("/generate-kpi-tree")
async def generate_kpi_tree(request: Request):
    from app.database import KPITree
    from app.services.prompting import KPI_DRIVER_TREE_SYSTEM_PROMPT
    user_name, _ = get_user_info(request)
    context = current_context()
    
    # Load approved KPIs
    approved_data = read_json(FILES["approved_kpis"], {})
    approved_items_raw = approved_data.get("items") or []
    approved_kpis = [KPI(**item) for item in approved_items_raw]
    if not approved_kpis:
        raise HTTPException(status_code=400, detail="No approved KPIs in library. Please approve KPIs in Step 2 first.")
        
    eng_id = active_engagement_id_ctx.get()
    profile = None
    with SessionLocal() as session:
        if eng_id:
            eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
            if eng:
                profile = session.query(ClientProfile).filter(ClientProfile.id == eng.client_profile_id).first()
        if not profile:
            profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
            
    import time
    start_time = time.perf_counter()
    provider = get_provider()
    
    # Check if we are running in DemoProvider mode or not
    if isinstance(provider, DemoProvider):
        tree_json_dict = generate_demo_driver_tree(context, approved_kpis, profile)
    else:
        # Build prompt using Gemini
        system_prompt = KPI_DRIVER_TREE_SYSTEM_PROMPT
        user_prompt = (
            f"=== CLIENT PROFILE ===\n"
            f"Client Name: {profile.client_name if profile else 'N/A'}\n"
            f"Industry: {profile.industry if profile else 'N/A'}\n"
            f"Sub-Industry: {profile.sub_industry if profile else 'N/A'}\n"
            f"Country: {profile.country if profile else 'N/A'}\n"
            f"Region: {profile.region if profile else 'N/A'}\n"
            f"Technology Landscape:\n"
            f"  - ERP: {profile.erp_platform if profile else 'N/A'}\n"
            f"  - CRM: {profile.crm_platform if profile else 'N/A'}\n"
            f"  - MES: {profile.mes_platform if profile else 'N/A'}\n"
            f"  - BI Tool: {profile.bi_tool if profile else 'N/A'}\n"
            f"  - Data Warehouse: {profile.data_warehouse if profile else 'N/A'}\n"
            f"  - Cloud: {profile.cloud_platform if profile else 'N/A'}\n"
            f"Description: {profile.organization_description if profile else 'N/A'}\n\n"
            f"=== BUSINESS CONTEXT ===\n"
            f"Industry: {context.industry}\n"
            f"Organization Level: {context.organization_level}\n"
            f"Strategic Objectives / Priorities:\n"
            + "\n".join(f"- {p}" for p in context.business_priorities) + "\n"
            f"Business Challenges:\n"
            + "\n".join(f"- {c}" for c in context.business_challenges) + "\n"
            f"Key Result Areas (KRAs):\n"
            + "\n".join(f"- {k}" for k in context.top_kras) + "\n"
            f"Functional Areas:\n"
            + "\n".join(f"- {a}" for a in context.functional_areas) + "\n\n"
        )
        if getattr(context, "custom_fields", None):
            user_prompt += "=== CUSTOM PARAMETERS ===\n"
            for f in context.custom_fields:
                if f.label.strip() or f.value.strip():
                    user_prompt += f"- {f.label}: {f.value}\n"
            user_prompt += "\n"
            
        user_prompt += "=== APPROVED KPIS FOR DECOMPOSITION ===\n"
        for idx, k in enumerate(approved_kpis, start=1):
            user_prompt += (
                f"KPI {idx}: {k.kpi_name}\n"
                f"  - Description: {k.kpi_description}\n"
                f"  - Why Important: {k.why_important or 'N/A'}\n"
                f"  - Category: {k.kpi_category}\n"
                f"  - Functional Area: {k.functional_area}\n"
                f"  - KRA: {k.kra}\n"
                f"  - Formula: {k.formula}\n"
                f"  - Numerator: {k.numerator}\n"
                f"  - Denominator: {k.denominator}\n\n"
            )
            
        try:
            logger.info("Generating KPI Driver Tree from LLM...")
            tree_json_dict = await provider.generate_json(KPI_DRIVER_TREE_SYSTEM_PROMPT, user_prompt, step_name="generate_kpi_tree")
            if not isinstance(tree_json_dict, dict) or "strategic_focus_areas" not in tree_json_dict:
                raise ValueError("Invalid JSON format from LLM.")
        except Exception as exc:
            logger.error(f"KPI Driver Tree LLM generation failed: {exc}. Falling back to demo generator.", exc_info=True)
            tree_json_dict = generate_demo_driver_tree(context, approved_kpis, profile)

    gen_time_ms = int((time.perf_counter() - start_time) * 1000)

    # Save to database
    with SessionLocal() as session:
        client_id = profile.id if profile else None
        
        prev_version = 0
        if eng_id is not None:
            row = session.scalar(select(KPITree).filter_by(engagement_id=eng_id))
            if not row:
                row = KPITree(engagement_id=eng_id, created_by=user_name, name="KPI Driver Tree")
                session.add(row)
            else:
                prev_version = row.version or 0
        else:
            row = session.scalar(select(KPITree).filter_by(id=1))
            if not row:
                row = KPITree(id=1, created_by=user_name, name="KPI Driver Tree")
                session.add(row)
            else:
                prev_version = row.version or 0
                
        row.version = prev_version + 1
        row.status = "draft"
        row.client_id = client_id
        row.tree_json = json.dumps(tree_json_dict)
        row.data = json.dumps(tree_json_dict)
        row.updated_by = user_name
        row.updated_at = datetime.now()
        
        # Populate metadata
        row.generated_by = user_name
        row.generated_at = datetime.now()
        row.approved_by = ""
        row.approved_at = None
        row.llm_provider = provider.name
        row.llm_model = provider.model
        row.generation_time_ms = gen_time_ms

        total_focus_areas = len(tree_json_dict.get("strategic_focus_areas", []))
        total_standard_drivers = 0
        total_sector_drivers = 0
        total_kpis = 0
        total_revenue_kpis = 0
        total_cost_kpis = 0
        total_progress_kpis = 0
        
        for sfa in tree_json_dict.get("strategic_focus_areas", []):
            drivers = sfa.get("drivers", [])
            total_standard_drivers += len(drivers)
            for sd in drivers:
                ssds = sd.get("sector_specific_drivers", []) or sd.get("sector_drivers", []) or []
                total_sector_drivers += len(ssds)
                for ssd in ssds:
                    kpis = ssd.get("kpis", [])
                    total_kpis += len(kpis)
                    for k in kpis:
                        cls = k.get("classification") or "Critical to Progress"
                        if cls == "Critical to Revenue":
                            total_revenue_kpis += 1
                        elif cls == "Critical to Cost":
                            total_cost_kpis += 1
                        else:
                            total_progress_kpis += 1
                            
        row.total_focus_areas = total_focus_areas
        row.total_standard_drivers = total_standard_drivers
        row.total_sector_drivers = total_sector_drivers
        row.total_kpis = total_kpis
        row.total_revenue_kpis = total_revenue_kpis
        row.total_cost_kpis = total_cost_kpis
        row.total_progress_kpis = total_progress_kpis

        session.commit()
        
        # Sync classifications to library
        sync_classifications_from_tree(tree_json_dict, request)

        action_val = "Version Regenerated" if prev_version > 0 else "Tree Generated"
        log_audit(
            request=request,
            action=action_val,
            module="KPI Driver Tree",
            entity_type="KPI Driver Tree",
            entity_name=row.name,
            new_value=json.dumps({"version": row.version, "status": row.status}),
            db_session=session
        )
        
        # Log Business Classification Generated audit event
        log_audit(
            request=request,
            action="Business Classification Generated",
            module="KPI Driver Tree",
            entity_type="KPI Driver Tree",
            entity_name=row.name,
            new_value=json.dumps({
                "version": row.version,
                "status": row.status,
                "total_kpis": total_kpis,
                "total_revenue_kpis": total_revenue_kpis,
                "total_cost_kpis": total_cost_kpis,
                "total_progress_kpis": total_progress_kpis
            }),
            db_session=session
        )

        log_activity("KPI Driver Tree Generated", f"Traceability tree generated (Version {row.version})")
        
        return {
            "name": row.name,
            "client_id": row.client_id,
            "version": row.version,
            "status": row.status,
            "created_by": row.created_by,
            "updated_by": row.updated_by,
            "data": tree_json_dict,
            "updated_at": row.updated_at.isoformat()
        }


@app.get("/workflow-status")
def workflow_status() -> WorkflowStatus:
    context = bool(read_json(FILES["business_context"], {}))
    prompt = bool(read_json(FILES["prompts"], {}))
    library = bool(read_json(FILES["kpi_library"], {}).get("items"))
    spec = bool(read_json(FILES["functional_spec"], {}).get("items"))
    tech_mapping = bool(read_json(FILES["technical_mapping"], {}).get("items"))
    
    # Check if tree exists
    with SessionLocal() as session:
        from app.database import KPITree as DBKPITree
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            tree_row = session.scalar(select(DBKPITree).filter_by(engagement_id=eng_id))
        else:
            tree_row = session.scalar(select(DBKPITree).filter_by(id=1))
        has_tree = bool(tree_row and tree_row.tree_json and tree_row.tree_json != "{}")
        
    return WorkflowStatus(
        business_context=context,
        prompt_generation=prompt,
        kpi_library=library,
        functional_specification=spec,
        kpi_tree=has_tree,
        technical_mapping=tech_mapping,
    )


@app.get("/timeline")
def timeline() -> list[dict[str, Any]]:
    return list_activity()


def build_mock_spec_item(kpi: KPI, context: BusinessContext) -> FunctionalSpecItem:
    pri = context.business_priorities[0] if context.business_priorities else "Operational Excellence"
    chal = context.business_challenges[0] if context.business_challenges else "Process variance"
    kra = kpi.kra or (context.top_kras[0] if context.top_kras else "Operational Discipline")
    area = kpi.functional_area or (context.functional_areas[0] if context.functional_areas else "Operations")

    # Check if approved transcripts exist to inject textual trace
    transcript_trace_note = ""
    with SessionLocal() as session:
        from app.database import TranscriptAnalysis
        approved_t = session.query(TranscriptAnalysis).filter(TranscriptAnalysis.status == "approved").first()
        if approved_t:
            try:
                insights_dict = json.loads(approved_t.extracted_insights or "{}")
                decisions = insights_dict.get("key_decisions") or []
                actions = insights_dict.get("action_items") or []
                decision_str = f"'{decisions[0]}'" if decisions else "alignment meeting decision"
                action_str = f"'{actions[0]}'" if actions else "the agreed roadmap action items"
                transcript_trace_note = f" [Traceable to meeting decision: {decision_str}. Action: {action_str}]"
            except Exception:
                transcript_trace_note = " [Traceable to approved meeting transcript decisions]"

    return FunctionalSpecItem(
        id=kpi.id,
        kpi_name=kpi.kpi_name,
        kpi_category=kpi.kpi_category or "Operational",
        functional_area=area,
        related_kra=kra,
        strategic_objective_supported=pri,
        business_challenge_addressed=chal,
        business_owner=kpi.business_owner or "VP of Operations",
        data_owner=kpi.data_owner or "Data Analytics Lead",
        business_purpose_relevance=(
            f"Why it exists: Sourced directly to support strategic tracking of {kra}.\n"
            f"Business value: Enables the steering committee to monitor process bottlenecks and drive resource efficiency.{transcript_trace_note}\n"
            f"Decisions supported: Operational resource planning, shift schedules, and capacity allocations.\n"
            f"Risks of not monitoring: Operational margin leakage and process variability."
        ),
        kpi_definition=f"Measures and evaluates the efficiency of {kpi.kpi_name} against design parameters to ensure stable throughput.",
        formula=kpi.formula or "Good Output / Total Input",
        numerator=kpi.numerator or f"Total conforming units of {kpi.kpi_name} produced in reporting window",
        denominator=kpi.denominator or "Total material or time inputs scheduled for production",
        calculation_methodology=(
            f"1. Extract the raw transaction history from {kpi.source_system}.\n"
            f"2. Filter out non-conforming test runs and quality checkpoints.\n"
            f"3. Sum the daily output for the numerator.\n"
            f"4. Divide by the total inputs in the denominator, then multiply by 100 for the percentage score."
        ),
        inclusion_rules="Include all validated customer orders and completed production lots.",
        exclusion_rules="Exclude raw material waste, testing scrap, and canceled orders.",
        sample_calculation=f"If good units = 9,500 and total started = 10,000, then KPI = (9,500 / 10,000) * 100 = 95.00%.",
        business_rules="Standard monthly posting dates apply. Manual overrides require VP approval.",
        data_validation_rules="KPI must lie in the range [0, 100]. Denominator must be strictly positive.",
        exception_handling_rules="In case of zero transactions, default the metric score to Null to avoid division by zero errors.",
        data_quality_expectations="Timeliness: Data loaded within 24 hours of period close. Completeness: >99.9%.",
        source_systems_lineage=(
            f"Source system: {kpi.source_system} (Module: {kpi.sap_module or 'Custom'}).\n"
            f"Dependencies: Master transactional tables and inventory logs.\n"
            f"Upstream: ERP transaction ledger. Downstream: C-suite dashboard."
        ),
        ownership_governance=(
            f"Business Owner ({kpi.business_owner or 'VP'}): Reviews variance and coordinates corrective actions.\n"
            f"Data Owner ({kpi.data_owner or 'Lead'}): Maintains data integration pipeline and semantic views.\n"
            f"Governance: Subject to monthly audits by the data steering committee."
        ),
        assumptions_constraints=(
            "Assumptions: Continuous data stream availability and stable ERP schemas.\n"
            f"Constraints: Batch processing latency may delay daily refresh.{transcript_trace_note}"
        ),
        reporting_requirements=f"Visual layout: Gauge card and trend line showing actuals vs target of {kpi.recommended_target_range}.",
        dashboard_recommendations="Include on the Executive Performance Dashboard as a primary card.",
        threshold_guidance=f"Green: >= Target, Amber: Within 5% of target, Red: Below target ({kpi.recommended_threshold_range}).",
        implementation_guidance=(
            "Integration: Sourced via standard API endpoints.\n"
            f"Technical Risks: Sync latency between master replica database.{transcript_trace_note}\n"
            "Change Management: Training workshop for operations managers."
        ),
        business_purpose=kpi.kpi_description,
        business_logic=f"Formula: {kpi.formula}\nNumerator: {kpi.numerator}\nDenominator: {kpi.denominator}",
        source_system=kpi.source_system,
        refresh_frequency=kpi.refresh_cadence,
        assumptions=f"Assumes active data extraction from SAP module {kpi.sap_module}."
    )


def build_mock_executive_summary(context: BusinessContext, approved_kpis: list[KPI]) -> str:
    pri = ", ".join(context.business_priorities[:3]) if context.business_priorities else "Operational Excellence"
    chal = ", ".join(context.business_challenges[:3]) if context.business_challenges else "Process variance"
    return (
        f"This Functional Specification Document establishes the governance and calculation standards for the "
        f"corporate KPI transformation initiative within the {context.industry} sector. Guided by executive mandates "
        f"at the {context.organization_level} level, this initiative directly aligns with key business priorities "
        f"including {pri}. In addressing critical challenges such as {chal}, the program deploys "
        f"{len(approved_kpis)} approved metrics. By detailing data ownership, source systems (SAP/ERP lineage), "
        f"and calculation boundaries, this document ensures absolute transparency and credibility, providing "
        f"implementation-ready specifications for engineering and dashboard scripting teams."
    )


@app.get("/functional-spec")
def get_functional_spec() -> dict[str, Any]:
    from app.database import FunctionalSpecification as DBFunctionalSpecification
    import json
    with SessionLocal() as session:
        db_spec = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
        if not db_spec:
            db_spec = DBFunctionalSpecification(
                executive_summary="This document outlines the governed metrics specification.",
                draft_items="[]",
                approved_items="[]",
                status="draft"
            )
            session.add(db_spec)
            session.commit()
            session.refresh(db_spec)
        
        draft_items_list = json.loads(db_spec.draft_items or "[]")
        approved_items_list = json.loads(db_spec.approved_items or "[]")
        updated_at_str = db_spec.updated_at.isoformat() if db_spec.updated_at else None
        
        return {
            "items": draft_items_list,
            "approved_items": approved_items_list,
            "executive_summary": db_spec.executive_summary,
            "status": db_spec.status,
            "updated_at": updated_at_str
        }


@app.post("/functional-spec")
def save_functional_spec(request: Request, spec: FunctionalSpecification) -> FunctionalSpecification:
    from app.database import FunctionalSpecification as DBFunctionalSpecification
    import json
    with SessionLocal() as session:
        db_spec = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
        if not db_spec:
            db_spec = DBFunctionalSpecification()
            session.add(db_spec)
        
        items_json = json.dumps([item.model_dump(mode="json") for item in spec.items])
        db_spec.draft_items = items_json
        db_spec.executive_summary = spec.executive_summary
        db_spec.status = "draft"  # manual edits revert status to draft
        db_spec.updated_at = datetime.now()
        session.commit()
        
        # Write to JSON for backward compatibility
        write_json(FILES["functional_spec"], spec.model_dump(mode="json"))
        
        log_audit(
            request=request,
            action="Update",
            module="Functional Specification",
            entity_type="FSD",
            entity_name="Functional Specification",
            new_value=f"Updated {len(spec.items)} items",
            db_session=session
        )
        
    log_activity("Functional Spec Saved", f"{len(spec.items)} spec items updated by consultant")
    return spec


@app.post("/approve-spec")
def approve_spec(request: Request) -> dict[str, Any]:
    from app.database import FunctionalSpecification as DBFunctionalSpecification
    import json
    with SessionLocal() as session:
        db_spec = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
        if not db_spec:
            raise HTTPException(status_code=400, detail="No specification found. Please generate first.")
        
        db_spec.approved_items = db_spec.draft_items
        db_spec.status = "approved"
        db_spec.updated_at = datetime.now()
        session.commit()
        
        # Sync with JSON file
        draft_items_list = json.loads(db_spec.draft_items or "[]")
        pydantic_spec = FunctionalSpecification(
            items=draft_items_list,
            executive_summary=db_spec.executive_summary,
            status="approved",
            updated_at=db_spec.updated_at
        )
        write_json(FILES["functional_spec"], pydantic_spec.model_dump(mode="json"))
        
        log_audit(
            request=request,
            action="Approve",
            module="Functional Specification",
            entity_type="FSD",
            entity_name="Functional Specification",
            new_value="Approved Functional Specification Document",
            db_session=session
        )
        updated_at_str = db_spec.updated_at.isoformat()
        
    log_activity("Functional Spec Approved", "The functional specification document was signed off.")
    return {
        "status": "success",
        "message": "Functional specification approved",
        "updated_at": updated_at_str
    }


@app.post("/generate-spec")
async def generate_spec(request: Request) -> dict[str, Any]:
    import json
    context = current_context()
    approved_data = read_json(FILES["approved_kpis"], {})
    approved_items_raw = approved_data.get("items") or []
    approved_kpis = [KPI(**item) for item in approved_items_raw]
    if not approved_kpis:
        raise HTTPException(status_code=400, detail="No approved KPIs in library. Please approve KPIs in Step 2 first.")
    
    provider = get_provider()
    
    from app.services.spec_validator import validate_spec_item

    if isinstance(provider, DemoProvider):
        executive_summary = build_mock_executive_summary(context, approved_kpis)
        spec_items = []
        for k in approved_kpis:
            item = build_mock_spec_item(k, context)
            item.validation_warnings = validate_spec_item(item, k)
            spec_items.append(item)
    else:
        # Load curated advisory prompt from step 1/2
        try:
            advisory_prompt_rec = current_prompt()
            advisory_prompt = advisory_prompt_rec.prompt
        except Exception:
            advisory_prompt = "No approved advisory prompt available."

        # Compile approved KPIs metadata
        kpi_metadata_list = []
        for k in approved_kpis:
            kpi_metadata_list.append({
                "id": k.id,
                "kpi_name": k.kpi_name,
                "kra": k.kra,
                "kpi_category": k.kpi_category,
                "business_definition": k.business_definition,
                "kpi_description": k.kpi_description,
                "formula": k.formula,
                "numerator": k.numerator,
                "denominator": k.denominator,
                "business_owner": k.business_owner,
                "data_owner": k.data_owner,
                "source_system": k.source_system,
                "sap_module": k.sap_module,
                "refresh_cadence": k.refresh_cadence,
                "recommended_target_range": k.recommended_target_range,
                "recommended_threshold_range": k.recommended_threshold_range,
                "notes": k.notes
            })
        kpi_metadata_str = json.dumps(kpi_metadata_list, indent=2)

        transcript_ctx = get_approved_transcripts_context()
        transcript_ctx_part = f"=== APPROVED TRANSCRIPT ANALYSIS INSIGHTS ===\n{transcript_ctx}\n\n" if transcript_ctx else ""

        user_prompt = (
            f"=== BUSINESS CONTEXT ===\n"
            f"Industry: {context.industry}\n"
            f"Organization Level: {context.organization_level}\n"
            f"Strategic Objectives / Priorities:\n"
            + "\n".join(f"- {p}" for p in context.business_priorities) + "\n"
            f"Business Challenges:\n"
            + "\n".join(f"- {c}" for c in context.business_challenges) + "\n"
            f"Key Result Areas (KRAs):\n"
            + "\n".join(f"- {k}" for k in context.top_kras) + "\n"
            f"Functional Areas:\n"
            + "\n".join(f"- {a}" for a in context.functional_areas) + "\n\n"
            f"{transcript_ctx_part}"
            f"=== APPROVED ADVISORY PROMPT ===\n"
            f"{advisory_prompt}\n\n"
            f"=== APPROVED KPIS METADATA ===\n"
            f"{kpi_metadata_str}\n\n"
            f"Please generate the complete Functional Specification Document. "
            f"For each of the {len(approved_kpis)} approved KPIs, output its specification object in the 'items' array with the exact 'id' and 'kpi_name' as provided."
        )

        try:
            logger.info("Generating complete Functional Specification Document via LLM in a single invocation...")
            from app.services.prompting import SPEC_DOCUMENT_SYSTEM_PROMPT
            
            doc_payload = await provider.generate_json(
                SPEC_DOCUMENT_SYSTEM_PROMPT,
                user_prompt,
                step_name="generate_spec_document"
            )
            
            executive_summary = doc_payload.get("executive_summary", "")
            if not executive_summary:
                executive_summary = build_mock_executive_summary(context, approved_kpis)
                
            items_payload = doc_payload.get("items") or []
            # Convert items to FunctionalSpecItem
            spec_items = []
            payload_items_dict = {item.get("id") or item.get("kpi_name"): item for item in items_payload if isinstance(item, dict)}
            
            for k in approved_kpis:
                kpi_payload = payload_items_dict.get(k.id) or payload_items_dict.get(k.kpi_name)
                
                if kpi_payload:
                    spec_item = FunctionalSpecItem(
                        id=k.id,
                        kpi_name=k.kpi_name,
                        kpi_category=str(kpi_payload.get("kpi_category") or k.kpi_category or ""),
                        functional_area=str(kpi_payload.get("functional_area") or k.functional_area or ""),
                        related_kra=str(kpi_payload.get("related_kra") or k.kra or ""),
                        strategic_objective_supported=str(kpi_payload.get("strategic_objective_supported") or ""),
                        business_challenge_addressed=str(kpi_payload.get("business_challenge_addressed") or ""),
                        business_owner=str(kpi_payload.get("business_owner") or k.business_owner or ""),
                        data_owner=str(kpi_payload.get("data_owner") or k.data_owner or ""),
                        business_purpose_relevance=str(kpi_payload.get("business_purpose_relevance") or ""),
                        kpi_definition=str(kpi_payload.get("kpi_definition") or k.business_definition or k.kpi_description or ""),
                        formula=str(kpi_payload.get("formula") or k.formula or ""),
                        numerator=str(kpi_payload.get("numerator") or k.numerator or ""),
                        denominator=str(kpi_payload.get("denominator") or k.denominator or ""),
                        calculation_methodology=str(kpi_payload.get("calculation_methodology") or ""),
                        inclusion_rules=str(kpi_payload.get("inclusion_rules") or ""),
                        exclusion_rules=str(kpi_payload.get("exclusion_rules") or ""),
                        sample_calculation=str(kpi_payload.get("sample_calculation") or ""),
                        business_rules=str(kpi_payload.get("business_rules") or ""),
                        data_validation_rules=str(kpi_payload.get("data_validation_rules") or ""),
                        exception_handling_rules=str(kpi_payload.get("exception_handling_rules") or ""),
                        data_quality_expectations=str(kpi_payload.get("data_quality_expectations") or ""),
                        source_systems_lineage=str(kpi_payload.get("source_systems_lineage") or ""),
                        ownership_governance=str(kpi_payload.get("ownership_governance") or ""),
                        assumptions_constraints=str(kpi_payload.get("assumptions_constraints") or ""),
                        reporting_requirements=str(kpi_payload.get("reporting_requirements") or ""),
                        dashboard_recommendations=str(kpi_payload.get("dashboard_recommendations") or ""),
                        threshold_guidance=str(kpi_payload.get("threshold_guidance") or ""),
                        implementation_guidance=str(kpi_payload.get("implementation_guidance") or ""),
                        
                        # Backward compatibility
                        business_purpose=str(kpi_payload.get("business_purpose") or k.kpi_description or ""),
                        business_logic=f"Formula: {k.formula}\nNumerator: {k.numerator}\nDenominator: {k.denominator}",
                        source_system=k.source_system,
                        refresh_frequency=k.refresh_cadence,
                        assumptions=str(kpi_payload.get("assumptions") or k.notes or "")
                    )
                else:
                    logger.warning(f"KPI '{k.kpi_name}' (ID: {k.id}) not found in LLM specification payload. Using mock fallback.")
                    spec_item = build_mock_spec_item(k, context)
                
                spec_item.validation_warnings = validate_spec_item(spec_item, k)
                spec_items.append(spec_item)
                
        except Exception as exc:
            logger.error(f"Single-invocation LLM generate_spec failed: {exc}. Using mock fallback for all KPIs.")
            executive_summary = build_mock_executive_summary(context, approved_kpis)
            spec_items = []
            for k in approved_kpis:
                spec_item = build_mock_spec_item(k, context)
                spec_item.validation_warnings = validate_spec_item(spec_item, k)
                spec_items.append(spec_item)

    # 3. Save to database & file
    from app.database import FunctionalSpecification as DBFunctionalSpecification
    import json
    with SessionLocal() as session:
        db_spec = session.query(DBFunctionalSpecification).order_by(DBFunctionalSpecification.id.desc()).first()
        if not db_spec:
            db_spec = DBFunctionalSpecification()
            session.add(db_spec)
            
        items_json = json.dumps([item.model_dump(mode="json") for item in spec_items])
        db_spec.draft_items = items_json
        db_spec.executive_summary = executive_summary
        db_spec.status = "draft"
        db_spec.updated_at = datetime.now()
        session.commit()
        
        # Write to JSON for backward compatibility
        pydantic_spec = FunctionalSpecification(
            items=spec_items,
            executive_summary=executive_summary,
            status="draft",
            updated_at=db_spec.updated_at
        )
        write_json(FILES["functional_spec"], pydantic_spec.model_dump(mode="json"))
        
        log_audit(
            request=request,
            action="Generate",
            module="Functional Specification",
            entity_type="FSD",
            entity_name="Functional Specification",
            new_value=f"Generated specs for {len(spec_items)} KPIs",
            db_session=session
        )
        updated_at_str = db_spec.updated_at.isoformat()
        
    log_activity("Functional Spec Generated", f"Specifications enriched for {len(spec_items)} approved KPIs")
    return {
        "items": [item.model_dump(mode="json") for item in spec_items],
        "executive_summary": executive_summary,
        "status": "draft",
        "updated_at": updated_at_str
    }


# -----------------------------------------------------------------------------------------
# TECHNICAL DATA MAPPING ENDPOINTS (Step 4)
# -----------------------------------------------------------------------------------------

from app.models import TechnicalDataMapping
from app.database import TechnicalDataMappingDB

@app.get("/technical-mapping")
def get_technical_mapping() -> dict[str, Any]:
    return read_json(FILES["technical_mapping"], {})


@app.post("/technical-mapping")
def save_technical_mapping(request: Request, mapping: TechnicalDataMapping) -> TechnicalDataMapping:
    mapping.updated_at = datetime.now()
    write_json(FILES["technical_mapping"], mapping.model_dump(mode="json"))
    
    with SessionLocal() as session:
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(engagement_id=eng_id))
        else:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(id=1))
            
        if not db_mapping:
            db_mapping = TechnicalDataMappingDB(engagement_id=eng_id)
            session.add(db_mapping)
            
        db_mapping.items = "[]"
        db_mapping.executive_summary = mapping.object_summary
        db_mapping.status = mapping.status
        db_mapping.updated_at = mapping.updated_at
        session.commit()

    log_activity("Technical Data Mapping Saved", f"Saved updates to Technical Data Mapping. Status: {mapping.status}")
    
    log_audit(
        request=request,
        action="Update",
        module="Technical Data Mapping",
        entity_type="TDM",
        entity_name="Technical Data Mapping",
        new_value=f"Status: {mapping.status}, Items: {len(mapping.items)}"
    )
    return mapping


@app.post("/generate-technical-mapping")
async def generate_technical_mapping(request: Request) -> dict[str, Any]:
    context = current_context()
    approved_data = read_json(FILES["approved_kpis"], {})
    approved_items_raw = approved_data.get("items") or []
    approved_kpis = [KPI(**item) for item in approved_items_raw]
    if not approved_kpis:
        raise HTTPException(status_code=400, detail="No approved KPIs in library. Please approve KPIs in Step 2 first.")
    
    provider = get_provider()
    
    if isinstance(provider, DemoProvider):
        # Demo generation
        mapping = TechnicalDataMapping(
            document_organization=TDMDocumentOrganization(
                document_log="| Version | Date | Author | Description |\n|---|---|---|---|\n| 1.0 | Today | System | Initial Draft |",
                related_document_reference="Refer to Functional Specification Document."
            ),
            object_summary="This document outlines the technical dataflow for the approved KPIs.",
            technical_specifications=TDMTechnicalSpecifications(
                data_flow="Data flows from SAP ECC to SAP BW to SAP Analytics Cloud.",
                data_models="Master Data Models and Transaction Data Models...",
                technical_details="Daily snapshot required. Incremental load logic applied.",
                currency_translation="All local currencies translated to USD.",
                row_level_security="Secured by Region and Company Code."
            ),
            data_load_frequency="Daily batch loads at 2:00 AM UTC.",
            unit_test_results="| Scenario | Expected | Status |\n|---|---|---|\n| Revenue load | Matches FI | Pending |",
            glossary="| Term | Definition |\n|---|---|\n| KPI | Key Performance Indicator |"
        )
    else:
        # LLM Generation
        from app.services.prompting import TDM_SYSTEM_PROMPT
        
        # We also need the FSD definitions if they exist to provide better context
        fsd_data = read_json(FILES["functional_spec"], {})
        fsd_items = fsd_data.get("items", [])
        
        # Build prompt inputs
        kpis_json = json.dumps([k.model_dump(mode="json") for k in approved_kpis], indent=2)
        fsd_json = json.dumps(fsd_items, indent=2) if fsd_items else "No functional specification generated yet."
        
        user_prompt = f"""
        === APPROVED KPIs ===
        {kpis_json}
        
        === EXISTING FUNCTIONAL SPECIFICATION (For Context) ===
        {fsd_json}
        
        Please generate the Technical Data Mapping document for all these approved KPIs.
        """
        
        try:
            payload = await provider.generate_json(
                TDM_SYSTEM_PROMPT,
                user_prompt,
                step_name="generate_technical_mapping"
            )
            
            mapping = TechnicalDataMapping(**payload)
        except Exception as exc:
            logger.error(f"Failed to generate Technical Data Mapping: {exc}", exc_info=True)
            raise HTTPException(status_code=502, detail=f"Failed to generate Technical Data Mapping: {exc}")
    
    mapping.status = "draft"
    mapping.updated_at = datetime.now()
    
    write_json(FILES["technical_mapping"], mapping.model_dump(mode="json"))
    
    with SessionLocal() as session:
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(engagement_id=eng_id))
        else:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(id=1))
            
        if not db_mapping:
            db_mapping = TechnicalDataMappingDB(engagement_id=eng_id)
            session.add(db_mapping)
            
        db_mapping.items = "[]"
        db_mapping.executive_summary = mapping.object_summary
        db_mapping.status = mapping.status
        db_mapping.updated_at = mapping.updated_at
        session.commit()
        
    log_activity("Technical Data Mapping Generated", f"AI generated mapping for {len(approved_kpis)} KPIs.")
    
    log_audit(
        request=request,
        action="Generate",
        module="Technical Data Mapping",
        entity_type="TDM",
        entity_name="Technical Data Mapping",
        new_value=f"Generated mapping for {len(approved_kpis)} KPIs"
    )
    
    return mapping.model_dump(mode="json")


@app.post("/approve-technical-mapping")
def approve_technical_mapping(request: Request) -> dict[str, Any]:
    mapping_data = read_json(FILES["technical_mapping"], {})
    if not mapping_data or not mapping_data.get("object_summary"):
        raise HTTPException(status_code=400, detail="Technical Data Mapping has not been generated yet.")
        
    with SessionLocal() as session:
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(engagement_id=eng_id))
        else:
            db_mapping = session.scalar(select(TechnicalDataMappingDB).filter_by(id=1))
            
        if not db_mapping:
            raise HTTPException(status_code=404, detail="Technical Data Mapping record not found.")
            
        db_mapping.status = "approved"
        db_mapping.updated_at = datetime.now()
        session.commit()
        session.refresh(db_mapping)
        
        log_audit(
            request=request,
            action="Approve",
            module="Technical Data Mapping",
            entity_type="TDM",
            entity_name="Technical Data Mapping",
            new_value="Approved Technical Data Mapping",
            db_session=session
        )
        updated_at_str = db_mapping.updated_at.isoformat()
        
    log_activity("Technical Data Mapping Approved", "The technical data mapping document was signed off.")
    return {
        "status": "success",
        "message": "Technical data mapping approved",
        "updated_at": updated_at_str
    }




@app.get("/exports")
def exports() -> list[ExportItem]:
    has_prompt = bool(read_json(FILES["prompts"], {}))
    has_kpis = bool(read_json(FILES["kpi_library"], {}).get("items"))
    has_spec = bool(read_json(FILES["functional_spec"], {}).get("items"))
    
    with SessionLocal() as session:
        from app.database import KPITree as DBKPITree
        eng_id = active_engagement_id_ctx.get()
        if eng_id is not None:
            tree_row = session.scalar(select(DBKPITree).filter_by(engagement_id=eng_id))
        else:
            tree_row = session.scalar(select(DBKPITree).filter_by(id=1))
        has_tree = bool(tree_row and tree_row.tree_json and tree_row.tree_json != "{}")

    return [
        ExportItem(id="prompt", label="Export Prompt", description="KPI generation prompt from Prompt Studio", formats=["DOCX", "JSON"], available=has_prompt),
        ExportItem(id="kpi_library", label="Export KPI Library", description="Approved and draft KPI library", formats=["XLSX", "CSV", "JSON"], available=has_kpis),
        ExportItem(id="functional_document", label="Functional Specification", description="Governed business functional specification document", formats=["DOCX", "PDF", "JSON"], available=has_spec),
        ExportItem(id="technical_mapping", label="Technical Data Mapping", description="Technical data blueprint for engineering teams", formats=["DOCX", "PDF", "JSON"], available=True),
        ExportItem(id="kpi_driver_tree", label="KPI Driver Tree", description="Approved strategy-to-KPI driver tree specification", formats=["PDF", "JSON"], available=has_tree),
        ExportItem(id="json_bundle", label="Export JSON Bundle", description="Complete session data for audit or migration", formats=["JSON"], available=True),
    ]


@app.get("/exports/{export_id}/{fmt}")
def download_export(request: Request, export_id: str, fmt: str, doc_name: str | None = None) -> FileResponse:
    import json
    fmt = fmt.lower()
    EXPORT_DIR.mkdir(exist_ok=True)
    if export_id == "prompt":
        prompt = current_prompt()
        path = EXPORT_DIR / f"kpi-prompt.{fmt}"
        if fmt == "docx":
            context = current_context()
            from app.services.doc_generators import generate_docx_prompt
            generate_docx_prompt(path, prompt.prompt, context)
        elif fmt == "txt":
            path.write_text(prompt.prompt, encoding="utf-8")
        else:
            path.write_text(prompt.model_dump_json(indent=2), encoding="utf-8")
    elif export_id == "kpi_library":
        library = current_library()
        path = EXPORT_DIR / f"kpi-library.{fmt}"
        if fmt == "xlsx":
            write_kpi_xlsx(path, library.items)
        elif fmt == "csv":
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(library.items[0].model_dump().keys()))
                writer.writeheader()
                writer.writerows([item.model_dump() for item in library.items])
        else:
            path.write_text(library.model_dump_json(indent=2), encoding="utf-8")
    elif export_id == "functional_document":
        spec_data = read_json(FILES["functional_spec"], {})
        if not spec_data or not spec_data.get("items"):
            raise HTTPException(status_code=400, detail="Functional specification has not been generated.")
        
        spec = FunctionalSpecification(**spec_data)
        context_data = read_json(FILES["business_context"], {})
        context = BusinessContext(**context_data) if context_data else BusinessContext()
        
        path = EXPORT_DIR / f"kpi-functional-specification.{fmt}"
        if fmt == "docx":
            from app.services.doc_generators import generate_docx_spec
            generate_docx_spec(path, spec, context)
        elif fmt == "pdf":
            from app.services.doc_generators import generate_pdf_spec
            generate_pdf_spec(path, spec, context, doc_name=doc_name)
        elif fmt == "json":
            import json
            path.write_text(json.dumps(spec.model_dump(mode="json"), indent=2, default=str), encoding="utf-8")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format for functional document: {fmt}")
    elif export_id == "kpi_driver_tree":
        from app.database import KPITree as DBKPITree
        with SessionLocal() as session:
            eng_id = active_engagement_id_ctx.get()
            if eng_id is not None:
                row = session.scalar(select(DBKPITree).filter_by(engagement_id=eng_id))
            else:
                row = session.scalar(select(DBKPITree).filter_by(id=1))
                
            if not row or not row.tree_json or row.tree_json == "{}":
                raise HTTPException(status_code=400, detail="KPI Driver Tree has not been generated yet.")
                
            tree_data = json.loads(row.tree_json)
            
            profile = None
            if eng_id:
                eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
                if eng:
                    profile = session.query(ClientProfile).filter(ClientProfile.id == eng.client_profile_id).first()
            if not profile:
                profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
                
            context_data = read_json(FILES["business_context"], {})
            context = BusinessContext(**context_data) if context_data else BusinessContext()
            
            path = EXPORT_DIR / f"kpi-driver-tree.{fmt}"
            if fmt == "pdf":
                from app.services.doc_generators import generate_pdf_driver_tree
                generate_pdf_driver_tree(path, tree_data, context, profile, doc_name=doc_name)
            elif fmt == "json":
                path.write_text(json.dumps(tree_data, indent=2, default=str), encoding="utf-8")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported format for KPI Driver Tree: {fmt}")
    elif export_id == "technical_mapping":
        mapping_data = read_json(FILES["technical_mapping"], {})
        if not mapping_data or not mapping_data.get("document_organization"):
            raise HTTPException(status_code=400, detail="Technical Data Mapping has not been generated.")
        
        mapping = TechnicalDataMapping(**mapping_data)
        context_data = read_json(FILES["business_context"], {})
        context = BusinessContext(**context_data) if context_data else BusinessContext()
        
        path = EXPORT_DIR / f"technical-data-mapping.{fmt}"
        if fmt == "docx":
            from app.services.doc_generators import generate_docx_tdm
            generate_docx_tdm(path, mapping, context)
        elif fmt == "pdf":
            from app.services.doc_generators import generate_pdf_tdm
            generate_pdf_tdm(path, mapping, context, doc_name=doc_name)
        elif fmt == "json":
            import json
            path.write_text(json.dumps(mapping.model_dump(mode="json"), indent=2, default=str), encoding="utf-8")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format for Technical Data Mapping: {fmt}")
    elif export_id == "json_bundle":
        path = export_json_bundle()
    else:
        raise HTTPException(status_code=404, detail="Unknown export.")

    if doc_name and doc_name.strip():
        import re
        safe_name = re.sub(r'[\\/*?:"<>|]', "", doc_name.strip())
        safe_name = safe_name.replace(" ", "_")
        if not safe_name.lower().endswith(f".{fmt}"):
            download_name = f"{safe_name}.{fmt}"
        else:
            download_name = safe_name
    else:
        # Generate default: {ClientName}_{Industry}_KPI_Functional_Specification
        client_name_part = ""
        industry_part = ""
        with SessionLocal() as session:
            eng_id = active_engagement_id_ctx.get()
            profile = None
            if eng_id:
                eng = session.query(Engagement).filter(Engagement.id == eng_id).first()
                if eng:
                    profile = session.query(ClientProfile).filter(ClientProfile.id == eng.client_profile_id).first()
            if not profile:
                profile = session.query(ClientProfile).order_by(ClientProfile.id.desc()).first()
            
            if profile:
                client_name_part = profile.client_name.strip()
                industry_part = profile.industry.strip()
        
        import re
        parts = []
        if client_name_part:
            parts.append(re.sub(r'\s+', "_", client_name_part))
        if industry_part:
            parts.append(re.sub(r'\s+', "_", industry_part))
        
        if export_id == "functional_document":
            parts.append("KPI_Functional_Specification")
        elif export_id == "prompt":
            parts.append("KPI_Prompt")
        elif export_id == "kpi_library":
            parts.append("KPI_Library")
        else:
            parts.append(export_id)
            
        base_default_name = "_".join(parts)
        base_default_name = re.sub(r'[\\/*?:"<>|]', "", base_default_name)
        download_name = f"{base_default_name}.{fmt}"

    # Audit log document exports
    log_audit(
        request=request,
        action="Export",
        module="Document Export",
        entity_type="Document",
        entity_name=export_id,
        new_value=f"Format: {fmt}, Filename: {download_name}"
    )

    return FileResponse(path, filename=download_name)
