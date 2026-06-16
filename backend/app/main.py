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
)
from app.storage import EXPORT_DIR, FILES, ensure_data_dir, read_json, write_json

app = FastAPI(title="KPI Transformation & Analytics Copilot API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
)
from app.services.metadata_cache import metadata_cache

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


@app.post("/business-context")
def save_business_context(context: BusinessContext) -> BusinessContext:
    write_json(FILES["business_context"], context.model_dump(mode="json"))
    log_activity("Business Context Created", f"{context.industry} / {context.organization_level}")
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


class GeneratePromptRequest(BaseModel):
    user_instructions: str = ""


class RefinePromptRequest(BaseModel):
    prompt: str = ""
    refinement_instructions: str


@app.post("/generate-prompt")
async def generate_prompt(request: GeneratePromptRequest) -> PromptRecord:
    logger.info("=== GENERATING PROMPT ===")
    logger.info(f"User advisory instructions input: '{request.user_instructions}'")
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
        prompt_text += build_fallback_guidance(request.user_instructions)
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
        
        transcript_ctx = get_approved_transcripts_context()
        if transcript_ctx:
            user_prompt += f"\n{transcript_ctx}\n"

        if request.user_instructions:
            user_prompt += (
                f"\n=== USER INSTRUCTIONS / STRATEGIC PREFERENCES ===\n"
                f"{request.user_instructions}\n"
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
            prompt_text += build_fallback_guidance(request.user_instructions)
                
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
        user_instructions=request.user_instructions,
        is_approved=False,
        ai_summary=summary
    )
    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Generated", "AI-driven KPI generation prompt prepared in Prompt Studio")
    return record


@app.post("/refine-prompt")
async def refine_prompt(request: RefinePromptRequest) -> PromptRecord:
    logger.info("=== REFINING PROMPT ===")
    logger.info(f"Refinement instructions: '{request.refinement_instructions}'")
    
    record = current_prompt()
    # Use workspace text from request body, fallback to DB prompt
    current_workspace_prompt = request.prompt if request.prompt.strip() else record.prompt
    
    provider = get_provider()
    context = current_context()
    context_raw = current_context(merged=False)
    
    if isinstance(provider, DemoProvider):
        logger.info("Using DemoProvider fallback prompt refiner")
        refined_prompt = current_workspace_prompt + f"\n\n[Refined with guidelines: {request.refinement_instructions}]"
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

        user_prompt += (
            f"=== CURRENT PROMPT TO REFINE ===\n"
            f"{current_workspace_prompt}\n\n"
            f"=== NEW REFINEMENT INSTRUCTIONS ===\n"
            f"{request.refinement_instructions}\n\n"
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
    return record


@app.get("/prompt")
def get_prompt() -> dict[str, Any]:
    return read_json(FILES["prompts"], {})


@app.post("/prompt")
def save_prompt(record: PromptRecord) -> PromptRecord:
    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Saved", "Prompt Studio edits saved")
    return record


@app.post("/generate-kpis")
async def generate_kpis() -> KPILibrary:
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
    return library


@app.get("/kpi-library")
def get_kpi_library() -> dict[str, Any]:
    return read_json(FILES["kpi_library"], {})


@app.post("/approve-kpis")
def approve_kpis(request: KPIApprovalRequest) -> KPILibrary:
    context = current_context()
    library = current_library()
    ids = set(request.ids)
    for item in library.items:
        if item.id in ids:
            item.status = request.status
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Sync approved KPIs
    approved_items = [item.model_dump(mode="json") for item in library.items if item.status == KPIStatus.approved]
    write_json(FILES["approved_kpis"], {"items": approved_items})
    
    log_activity("KPI Approval Updated", f"{len(ids)} KPI(s) marked {request.status.value}")
    return library


@app.post("/kpi-library/update")
def update_kpi(request: KPIUpdateRequest) -> KPILibrary:
    context = current_context()
    library = current_library()
    for index, item in enumerate(library.items):
        if item.id == request.id:
            data = item.model_dump()
            data.update(request.patch)
            library.items[index] = type(item)(**data)
            break
    library.quality = quality_check(library.items, context)
    library.recommendations = recommendations(library.items, context)
    write_json(FILES["kpi_library"], library.model_dump(mode="json"))
    
    # Sync approved KPIs
    approved_items = [item.model_dump(mode="json") for item in library.items if item.status == KPIStatus.approved]
    write_json(FILES["approved_kpis"], {"items": approved_items})
    
    log_activity("KPI Edited", request.id)
    return library


@app.get("/workflow-status")
def workflow_status() -> WorkflowStatus:
    context = bool(read_json(FILES["business_context"], {}))
    prompt = bool(read_json(FILES["prompts"], {}))
    library = bool(read_json(FILES["kpi_library"], {}).get("items"))
    spec = bool(read_json(FILES["functional_spec"], {}).get("items"))
    return WorkflowStatus(
        business_context=context,
        prompt_generation=prompt,
        kpi_library=library,
        functional_specification=spec,
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


def load_db_spec() -> Any:
    from app.database import FunctionalSpecification as DBFunctionalSpecification
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
        return db_spec


@app.get("/functional-spec")
def get_functional_spec() -> dict[str, Any]:
    db_spec = load_db_spec()
    import json
    draft_items_list = json.loads(db_spec.draft_items or "[]")
    approved_items_list = json.loads(db_spec.approved_items or "[]")
    return {
        "items": draft_items_list,
        "approved_items": approved_items_list,
        "executive_summary": db_spec.executive_summary,
        "status": db_spec.status,
        "updated_at": db_spec.updated_at.isoformat() if db_spec.updated_at else None
    }


@app.post("/functional-spec")
def save_functional_spec(spec: FunctionalSpecification) -> FunctionalSpecification:
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
        
    log_activity("Functional Spec Saved", f"{len(spec.items)} spec items updated by consultant")
    return spec


@app.post("/approve-spec")
def approve_spec() -> dict[str, Any]:
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
        
    log_activity("Functional Spec Approved", "The functional specification package was signed off.")
    return {
        "status": "success",
        "message": "Functional specification approved",
        "updated_at": db_spec.updated_at.isoformat()
    }


@app.post("/generate-spec")
async def generate_spec() -> dict[str, Any]:
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
        
    log_activity("Functional Spec Generated", f"Specifications enriched for {len(spec_items)} approved KPIs")
    return {
        "items": [item.model_dump(mode="json") for item in spec_items],
        "executive_summary": executive_summary,
        "status": "draft",
        "updated_at": db_spec.updated_at.isoformat()
    }



@app.get("/exports")
def exports() -> list[ExportItem]:
    has_prompt = bool(read_json(FILES["prompts"], {}))
    has_kpis = bool(read_json(FILES["kpi_library"], {}).get("items"))
    has_spec = bool(read_json(FILES["functional_spec"], {}).get("items"))
    return [
        ExportItem(id="prompt", label="Export Prompt", description="KPI generation prompt from Prompt Studio", formats=["DOCX", "JSON"], available=has_prompt),
        ExportItem(id="kpi_library", label="Export KPI Library", description="Approved and draft KPI library", formats=["XLSX", "CSV", "JSON"], available=has_kpis),
        ExportItem(id="functional_document", label="Functional Specification", description="Governed business functional specification document", formats=["DOCX", "PDF", "JSON"], available=has_spec),
        ExportItem(id="json_bundle", label="Export JSON Bundle", description="Complete session data for audit or migration", formats=["JSON"], available=True),
    ]


@app.get("/exports/{export_id}/{fmt}")
def download_export(export_id: str, fmt: str) -> FileResponse:
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
            generate_pdf_spec(path, spec, context)
        elif fmt == "json":
            import json
            path.write_text(json.dumps(spec.model_dump(mode="json"), indent=2, default=str), encoding="utf-8")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format for functional document: {fmt}")
    elif export_id == "json_bundle":
        path = export_json_bundle()
    else:
        raise HTTPException(status_code=404, detail="Unknown export.")
    return FileResponse(path, filename=path.name)
