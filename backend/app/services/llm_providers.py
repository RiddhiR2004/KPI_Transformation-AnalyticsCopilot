from __future__ import annotations

from typing import Any
from app.models import BusinessContext, KPI, KPIStatus
from app.services.llm import get_llm_service, get_llm_status
from app.services.llm.langchain_provider import DemoProvider

def get_provider() -> Any:
    return get_llm_service()

def llm_status() -> dict[str, Any]:
    return get_llm_status()

def demo_kpis(context: BusinessContext) -> list[KPI]:
    from app.services.kpi_engine import load_catalog, calculate_recommendation_score
    catalog = load_catalog()
    
    # Calculate scores and sort
    items_with_score = []
    for item in catalog:
        score = calculate_recommendation_score(item, context)
        items_with_score.append((score, item))
        
    # Sort descending by score
    items_with_score.sort(key=lambda x: x[0], reverse=True)
    
    # Filter by selected functional areas
    filtered = []
    selected_areas = {a.lower() for a in context.functional_areas} if context.functional_areas else set()
    
    if selected_areas:
        for score, item in items_with_score:
            if item["functional_area"].lower() in selected_areas:
                filtered.append((score, item))
        
        # Fill remaining slots with other areas if count is less
        if len(filtered) < context.kpi_count:
            for score, item in items_with_score:
                if item["functional_area"].lower() not in selected_areas:
                    filtered.append((score, item))
    else:
        filtered = items_with_score

    # Slice to kpi_count and convert to KPI models
    kpis = []
    for idx, (score, item) in enumerate(filtered[:context.kpi_count]):
        kpis.append(
            KPI(
                id=f"kpi-{idx + 1}",
                kpi_name=item["kpi_name"],
                functional_area=item["functional_area"],
                kra=item["kra"],
                kpi_category=item["kpi_category"],
                business_definition=item["business_definition"],
                kpi_description=item["kpi_description"],
                formula=item["formula"],
                numerator=item["numerator"],
                denominator=item["denominator"],
                source_system=item["source_system"],
                sap_module=item["sap_module"],
                business_owner=item["business_owner"],
                data_owner=item["data_owner"],
                refresh_cadence=item["refresh_cadence"],
                recommended_target_range=item["recommended_target_range"],
                recommended_threshold_range=item["recommended_threshold_range"],
                strategic_focus_area=item["strategic_focus_area"],
                standard_driver=item["standard_driver"],
                sector_driver=item["sector_driver"],
                value_drivers=item["value_drivers"],
                industry_tags=item["industry_tags"],
                recommendation_score=score,
                status=KPIStatus.recommended,
                notes=item["notes"] or ""
            )
        )
    return kpis
