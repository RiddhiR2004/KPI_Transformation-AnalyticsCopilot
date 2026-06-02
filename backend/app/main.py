from __future__ import annotations

import csv
import os
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.models import (
    BusinessContext,
    ExportItem,
    KPIApprovalRequest,
    KPILibrary,
    KPIUpdateRequest,
    PromptRecord,
    WorkflowStatus,
    FunctionalSpecItem,
    FunctionalSpecification,
    KPIStatus,
)
from app.services.activity import list_activity, log_activity
from app.services.documents import export_json_bundle
from app.services.excel import write_kpi_xlsx
from app.services.kpi_engine import normalize_kpi_payload, quality_check, recommendations
from app.services.llm_providers import DemoProvider, demo_kpis, get_provider, llm_status
from app.services.prompting import build_kpi_prompt, build_system_kpi_prompt
from app.storage import EXPORT_DIR, FILES, ensure_data_dir, read_json, write_json

app = FastAPI(title="KPI Transformation & Analytics Copilot API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_data_dir()


def current_context() -> BusinessContext:
    data = read_json(FILES["business_context"], {})
    if not data:
        raise HTTPException(status_code=400, detail="Business context has not been created.")
    return BusinessContext(**data)


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


@app.post("/business-context")
def save_business_context(context: BusinessContext) -> BusinessContext:
    write_json(FILES["business_context"], context.model_dump(mode="json"))
    log_activity("Business Context Created", f"{context.industry} / {context.organization_level}")
    return context


@app.get("/business-context")
def get_business_context() -> dict[str, Any]:
    return read_json(FILES["business_context"], {})


@app.post("/generate-prompt")
async def generate_prompt() -> PromptRecord:
    context = current_context()
    prompt = build_kpi_prompt(context)
    summary = {
        "Business Focus": f"{context.industry or 'Enterprise'} transformation for {context.organization_level or 'business'} leadership.",
        "Primary Challenges": context.business_challenges[:3],
        "Recommended KPI Areas": context.functional_areas,
        "Executive Summary": "The KPI library should prioritize measurable value creation, operational discipline and executive visibility.",
    }
    try:
        payload = await get_provider().generate_json(
            "Return a concise business summary as JSON with Business Focus, Primary Challenges, Recommended KPI Areas, Executive Summary.",
            prompt,
        )
        if isinstance(payload, dict):
            summary.update(payload)
    except Exception:
        pass
    record = PromptRecord(prompt=prompt, ai_summary=summary)
    write_json(FILES["prompts"], record.model_dump(mode="json"))
    log_activity("Prompt Generated", "KPI generation prompt prepared in Prompt Studio")
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
            payload = await provider.generate_json(
                system_prompt,
                prompt,
            )
            items = normalize_kpi_payload(payload, context)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"KPI generation failed through {provider.name}: {exc}") from exc
    
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
                summary_prompt
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


@app.get("/functional-spec")
def get_functional_spec() -> dict[str, Any]:
    return read_json(FILES["functional_spec"], {})


@app.post("/functional-spec")
def save_functional_spec(spec: FunctionalSpecification) -> FunctionalSpecification:
    write_json(FILES["functional_spec"], spec.model_dump(mode="json"))
    log_activity("Functional Spec Saved", f"{len(spec.items)} spec items updated by consultant")
    return spec


@app.post("/generate-spec")
async def generate_spec() -> FunctionalSpecification:
    context = current_context()
    approved_data = read_json(FILES["approved_kpis"], {})
    approved_items_raw = approved_data.get("items") or []
    approved_kpis = [KPI(**item) for item in approved_items_raw]
    if not approved_kpis:
        raise HTTPException(status_code=400, detail="No approved KPIs in library. Please approve KPIs in Step 2 first.")
    
    prompt_parts = []
    prompt_parts.append(f"Industry: {context.industry}")
    prompt_parts.append(f"Organization Level: {context.organization_level}")
    prompt_parts.append("Approved KPIs to document:")
    for k in approved_kpis:
        prompt_parts.append(
            f"- ID: {k.id}\n"
            f"  KPI Name: {k.kpi_name}\n"
            f"  Functional Area: {k.functional_area}\n"
            f"  Category: {k.kpi_category}\n"
            f"  Business Definition: {k.business_definition}\n"
            f"  Formula: {k.formula}\n"
            f"  Numerator: {k.numerator}\n"
            f"  Denominator: {k.denominator}\n"
            f"  Source System: {k.source_system}\n"
            f"  SAP Module: {k.sap_module}\n"
            f"  Business Owner: {k.business_owner}\n"
            f"  Data Owner: {k.data_owner}\n"
            f"  Refresh Cadence: {k.refresh_cadence}\n"
            f"  Target Range: {k.recommended_target_range}\n"
            f"  Threshold Range: {k.recommended_threshold_range}\n"
        )
    
    prompt_parts.append(
        "Instructions:\n"
        "For each approved KPI, generate the consulting-grade Business Assumptions and Reporting Visual Design Requirements. "
        "Return ONLY a JSON list of detailed items. Do not invent synthetic names.\n"
        "Format for each item:\n"
        "- id: Must match the KPI's ID exactly (e.g. kpi-1).\n"
        "- assumptions: Detailed assumptions list for calculation (no TBD/TBC).\n"
        "- reporting_requirements: Visual presentation best practices (e.g., trend lines, gauges, dashboard guidelines).\n"
        "\n"
        "Return ONLY JSON with this shape:\n"
        '{"items": [{"id": "", "assumptions": "", "reporting_requirements": ""}]}'
    )
    
    prompt = "\n".join(prompt_parts)
    provider = get_provider()
    
    enriched_data = {}
    try:
        if isinstance(provider, DemoProvider):
            for k in approved_kpis:
                enriched_data[k.id] = {
                    "assumptions": f"1. Historical transactional data is validated against standard SAP {k.sap_module} tables.\n2. Excludes adjustments or cancellations processed after the 3rd business day of month end.",
                    "reporting_requirements": f"1. Visual: Trend line comparing actuals vs target range ({k.recommended_target_range}).\n2. Drilldowns: Region, Business Unit, Product Category."
                }
        else:
            payload = await provider.generate_json(
                "You are an Enterprise Analytics Architect. Enrich the approved KPIs with assumptions and reporting requirements as JSON.",
                prompt
            )
            raw_items = payload.get("items") or []
            for item in raw_items:
                enriched_data[str(item.get("id"))] = {
                    "assumptions": str(item.get("assumptions") or "No special assumptions documented."),
                    "reporting_requirements": str(item.get("reporting_requirements") or "Default tabular visualization.")
                }
    except Exception:
        for k in approved_kpis:
            enriched_data[k.id] = {
                "assumptions": f"1. Underlying raw transaction files are loaded from SAP {k.sap_module} nightly.\n2. Financial metrics align with GAAP standard reporting schedules.",
                "reporting_requirements": f"1. Visual Layout: Target comparison bar/gauge card.\n2. Dimensions: Corporate hierarchy drilldown."
            }
            
    spec_items = []
    for k in approved_kpis:
        extra = enriched_data.get(k.id, {
            "assumptions": f"1. Values are sourced from {k.source_system} ({k.sap_module}).\n2. Calculation schedules run on standard calendar posting dates.",
            "reporting_requirements": "Recommended display: Scorecard KPI trend indicator."
        })
        
        detailed_logic = (
            f"Business Definition: {k.business_definition}\n\n"
            f"Calculation Parameters:\n"
            f"- Numerator: {k.numerator or 'Count of matching transactions'}\n"
            f"- Denominator: {k.denominator or 'Total transactions in period'}\n\n"
            f"SAP Lineage: Module {k.sap_module or 'Custom Data'}\n"
            f"Owner: {k.business_owner} (Business) / {k.data_owner} (Data Lead)\n"
            f"Target: {k.recommended_target_range}\n"
            f"Thresholds: {k.recommended_threshold_range}"
        )
        
        spec_items.append(
            FunctionalSpecItem(
                id=k.id,
                kpi_name=k.kpi_name,
                business_purpose=k.kpi_description,
                formula=k.formula,
                business_logic=detailed_logic,
                source_system=f"{k.source_system} (Module: {k.sap_module})",
                data_owner=k.data_owner or k.business_owner,
                refresh_frequency=k.refresh_cadence,
                assumptions=extra["assumptions"],
                reporting_requirements=extra["reporting_requirements"]
            )
        )
        
    spec = FunctionalSpecification(items=spec_items)
    write_json(FILES["functional_spec"], spec.model_dump(mode="json"))
    log_activity("Functional Spec Generated", f"Specifications enriched for {len(spec_items)} approved KPIs")
    return spec


@app.get("/exports")
def exports() -> list[ExportItem]:
    has_prompt = bool(read_json(FILES["prompts"], {}))
    has_kpis = bool(read_json(FILES["kpi_library"], {}).get("items"))
    has_spec = bool(read_json(FILES["functional_spec"], {}).get("items"))
    return [
        ExportItem(id="prompt", label="Export Prompt", description="KPI generation prompt from Prompt Studio", formats=["TXT", "JSON"], available=has_prompt),
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
        path.write_text(prompt.prompt if fmt == "txt" else prompt.model_dump_json(indent=2), encoding="utf-8")
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
            generate_docx_spec(path, spec.items, context)
        elif fmt == "pdf":
            from app.services.doc_generators import generate_pdf_spec
            generate_pdf_spec(path, spec.items, context)
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
