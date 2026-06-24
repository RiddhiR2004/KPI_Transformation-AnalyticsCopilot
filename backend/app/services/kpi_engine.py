from __future__ import annotations

import json
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from app.models import BusinessContext, KPI, KPIStatus


def load_catalog() -> list[dict[str, Any]]:
    """Loads the curated KPI Knowledge Base JSON catalog."""
    catalog_path = Path(__file__).resolve().parent / "kpi_catalog.json"
    try:
        with catalog_path.open(encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def calculate_recommendation_score(kpi_data: dict[str, Any] | KPI, context: BusinessContext) -> int:
    """Calculates a weighted matching score (0-100) between a KPI and the business context."""
    score = 0
    
    # Extract fields based on type
    if isinstance(kpi_data, KPI):
        kpi_name = kpi_data.kpi_name
        functional_area = kpi_data.functional_area
        kra = kpi_data.kra
        value_drivers = kpi_data.value_drivers
        industry_tags = kpi_data.industry_tags
        desc = kpi_data.kpi_description
    else:
        kpi_name = str(kpi_data.get("kpi_name", ""))
        functional_area = str(kpi_data.get("functional_area", ""))
        kra = str(kpi_data.get("kra", ""))
        value_drivers = kpi_data.get("value_drivers", [])
        industry_tags = kpi_data.get("industry_tags", [])
        desc = str(kpi_data.get("kpi_description", ""))

    # STRICT FILTER: Do not recommend KPIs from functional areas that are not explicitly selected
    if context.functional_areas:
        if not any(area.lower() == functional_area.lower() for area in context.functional_areas):
            return 0

    # 1. Industry Match: 30 Points
    if context.industry and any(tag.lower() == context.industry.lower() for tag in industry_tags):
        score += 30
        
    # 2. Functional Area Match: 30 Points
    if context.functional_areas and any(area.lower() == functional_area.lower() for area in context.functional_areas):
        score += 30
        
    # 3. KRA Match: 20 Points
    if context.top_kras and any(kra_name.lower() == kra.lower() for kra_name in context.top_kras):
        score += 20
        
    # 4. Business Priority Match: 10 Points
    priority_matched = False
    for priority in context.business_priorities:
        p_low = priority.lower()
        # Substring checks
        if p_low in kpi_name.lower() or p_low in desc.lower() or any(p_low in vd.lower() for vd in value_drivers):
            priority_matched = True
            break
    if priority_matched:
        score += 10

    # 5. Business Challenge Match: 10 Points
    challenge_matched = False
    for challenge in context.business_challenges:
        c_low = challenge.lower()
        if c_low in kpi_name.lower() or c_low in desc.lower():
            challenge_matched = True
            break
    if challenge_matched:
        score += 10

    return score


def find_best_catalog_match(raw_name: str, catalog: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    """Finds the best catalog KPI matching raw_name using exact and normalized cleaning."""
    raw_name_clean = raw_name.lower().strip().replace("%", "").replace("rate", "").replace("percentage", "").replace("ratio", "").replace("index", "")
    raw_name_clean = "".join(c for c in raw_name_clean if c.isalnum() or c.isspace()).strip()
    
    best_match = None
    best_ratio = 0.0
    
    for item in catalog:
        cat_name = item["kpi_name"]
        # 1. Check exact match (case insensitive)
        if raw_name.lower().strip() == cat_name.lower().strip():
            return item, 1.0
            
        # 2. Check normalized exact match
        cat_name_clean = cat_name.lower().strip().replace("%", "").replace("rate", "").replace("percentage", "").replace("ratio", "").replace("index", "")
        cat_name_clean = "".join(c for c in cat_name_clean if c.isalnum() or c.isspace()).strip()
        if raw_name_clean == cat_name_clean and raw_name_clean != "":
            return item, 0.98
            
        # 3. Check sequence matcher ratio on raw names
        ratio = SequenceMatcher(None, raw_name.lower(), cat_name.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = item
            
        # 4. Check sequence matcher ratio on cleaned names
        if raw_name_clean and cat_name_clean:
            clean_ratio = SequenceMatcher(None, raw_name_clean, cat_name_clean).ratio()
            if clean_ratio > best_ratio:
                best_ratio = clean_ratio
                best_match = item
                
    return best_match, best_ratio


def normalize_kpi_payload(payload: dict[str, Any], context: BusinessContext) -> list[KPI]:
    """
    Normalizes generated KPIs from LLM. Enforces strict name verification against kpi_catalog.json.
    - If a KPI name matches (or fuzzy matches >80%), it is preserved with its metadata, allowing LLM customization.
    - Otherwise, it is discarded and replaced with the next highest-scoring unused catalog item.
    - Finally, fills any remaining slots up to context.kpi_count using ranked catalog items.
    """
    raw_items = payload.get("kpis") or payload.get("KPI Library") or payload.get("items") or []
    catalog = load_catalog()
    
    # Pre-calculate scores for all catalog items (do not strictly filter here, so we have fallback items)
    catalog_scored = []
    for item in catalog:
        score = calculate_recommendation_score(item, context)
        catalog_scored.append((score, item))
    # Sort catalog descending by score
    catalog_scored.sort(key=lambda x: x[0], reverse=True)
    
    selected_kpis: list[KPI] = []
    used_names: set[str] = set()

    # Process items returned by the LLM
    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue
            
        raw_name = str(raw.get("kpi_name") or raw.get("KPI Name") or raw.get("name") or "").strip()
        if not raw_name:
            continue
            
        # Find best match from catalog
        best_match, best_ratio = find_best_catalog_match(raw_name, catalog)
                
        if best_match and best_ratio > 0.80:
            # Fuzzy match succeeded! Overwrite with catalog details but allow LLM customized values
            kpi_name = best_match["kpi_name"]
            if kpi_name in used_names:
                continue # Prevent duplicate KPIs
                
            selected_kpis.append(
                KPI(
                    id=f"kpi-{len(selected_kpis) + 1}",
                    kpi_name=kpi_name,
                    functional_area=best_match["functional_area"],
                    kra=best_match["kra"],
                    kpi_category=best_match["kpi_category"],
                    business_definition=best_match["business_definition"],
                    kpi_description=str(raw.get("kpi_description") or raw.get("business_purpose") or best_match["kpi_description"]),
                    why_important=str(raw.get("why_important") or raw.get("Why Important") or f"Critical for monitoring {best_match['kra']} and driving strategic outcomes within {best_match['functional_area']} operations."),
                    formula=best_match["formula"],
                    numerator=best_match["numerator"],
                    denominator=best_match["denominator"],
                    source_system=best_match["source_system"],
                    sap_module=best_match["sap_module"],
                    business_owner=str(raw.get("business_owner") or raw.get("kpi_owner") or best_match["business_owner"]),
                    data_owner=str(raw.get("data_owner") or best_match["data_owner"]),
                    refresh_cadence=str(raw.get("refresh_cadence") or best_match["refresh_cadence"]),
                    recommended_target_range=str(raw.get("recommended_target_range") or best_match["recommended_target_range"]),
                    recommended_threshold_range=str(raw.get("recommended_threshold_range") or best_match["recommended_threshold_range"]),
                    strategic_focus_area=best_match["strategic_focus_area"],
                    standard_driver=best_match["standard_driver"],
                    sector_driver=best_match["sector_driver"],
                    value_drivers=best_match["value_drivers"],
                    industry_tags=best_match["industry_tags"],
                    recommendation_score=calculate_recommendation_score(best_match, context),
                    status=KPIStatus.recommended,
                    notes=str(raw.get("notes") or best_match["notes"] or "")
                )
            )
            used_names.add(kpi_name)
        else:
            # Discard and select next highest-ranked unused KPI from catalog matching active functional areas first
            selected_areas = {a.lower() for a in context.functional_areas} if context.functional_areas else set()
            inserted = False
            for score, cat_item in catalog_scored:
                c_name = cat_item["kpi_name"]
                if c_name not in used_names:
                    if not selected_areas or cat_item["functional_area"].lower() in selected_areas:
                        selected_kpis.append(
                            KPI(
                                id=f"kpi-{len(selected_kpis) + 1}",
                                kpi_name=c_name,
                                functional_area=cat_item["functional_area"],
                                kra=cat_item["kra"],
                                kpi_category=cat_item["kpi_category"],
                                business_definition=cat_item["business_definition"],
                                kpi_description=cat_item["kpi_description"],
                                why_important=f"Critical for monitoring {cat_item['kra']} and driving strategic outcomes within {cat_item['functional_area']} operations.",
                                formula=cat_item["formula"],
                                numerator=cat_item["numerator"],
                                denominator=cat_item["denominator"],
                                source_system=cat_item["source_system"],
                                sap_module=cat_item["sap_module"],
                                business_owner=cat_item["business_owner"],
                                data_owner=cat_item["data_owner"],
                                refresh_cadence=cat_item["refresh_cadence"],
                                recommended_target_range=cat_item["recommended_target_range"],
                                recommended_threshold_range=cat_item["recommended_threshold_range"],
                                strategic_focus_area=cat_item["strategic_focus_area"],
                                standard_driver=cat_item["standard_driver"],
                                sector_driver=cat_item["sector_driver"],
                                value_drivers=cat_item["value_drivers"],
                                industry_tags=cat_item["industry_tags"],
                                recommendation_score=score,
                                status=KPIStatus.recommended,
                                notes=cat_item["notes"]
                            )
                        )
                        used_names.add(c_name)
                        inserted = True
                        break
            if not inserted:
                # Fallback if no matching functional area unused item exists
                for score, cat_item in catalog_scored:
                    c_name = cat_item["kpi_name"]
                    if c_name not in used_names:
                        selected_kpis.append(
                            KPI(
                                id=f"kpi-{len(selected_kpis) + 1}",
                                kpi_name=c_name,
                                functional_area=cat_item["functional_area"],
                                kra=cat_item["kra"],
                                kpi_category=cat_item["kpi_category"],
                                business_definition=cat_item["business_definition"],
                                kpi_description=cat_item["kpi_description"],
                                why_important=f"Critical for monitoring {cat_item['kra']} and driving strategic outcomes within {cat_item['functional_area']} operations.",
                                formula=cat_item["formula"],
                                numerator=cat_item["numerator"],
                                denominator=cat_item["denominator"],
                                source_system=cat_item["source_system"],
                                sap_module=cat_item["sap_module"],
                                business_owner=cat_item["business_owner"],
                                data_owner=cat_item["data_owner"],
                                refresh_cadence=cat_item["refresh_cadence"],
                                recommended_target_range=cat_item["recommended_target_range"],
                                recommended_threshold_range=cat_item["recommended_threshold_range"],
                                strategic_focus_area=cat_item["strategic_focus_area"],
                                standard_driver=cat_item["standard_driver"],
                                sector_driver=cat_item["sector_driver"],
                                value_drivers=cat_item["value_drivers"],
                                industry_tags=cat_item["industry_tags"],
                                recommendation_score=score,
                                status=KPIStatus.recommended,
                                notes=cat_item["notes"]
                            )
                        )
                        used_names.add(c_name)
                        break

    # If count is less than target kpi_count, fill from remaining catalog prioritizing selected areas
    target_count = context.kpi_count
    if len(selected_kpis) < target_count:
        selected_areas = {a.lower() for a in context.functional_areas} if context.functional_areas else set()
        # First fill with selected functional areas
        for score, cat_item in catalog_scored:
            c_name = cat_item["kpi_name"]
            if c_name not in used_names:
                if not selected_areas or cat_item["functional_area"].lower() in selected_areas:
                    selected_kpis.append(
                        KPI(
                            id=f"kpi-{len(selected_kpis) + 1}",
                            kpi_name=c_name,
                            functional_area=cat_item["functional_area"],
                            kra=cat_item["kra"],
                            kpi_category=cat_item["kpi_category"],
                            business_definition=cat_item["business_definition"],
                            kpi_description=cat_item["kpi_description"],
                            why_important=f"Critical for monitoring {cat_item['kra']} and driving strategic outcomes within {cat_item['functional_area']} operations.",
                            formula=cat_item["formula"],
                            numerator=cat_item["numerator"],
                            denominator=cat_item["denominator"],
                            source_system=cat_item["source_system"],
                            sap_module=cat_item["sap_module"],
                            business_owner=cat_item["business_owner"],
                            data_owner=cat_item["data_owner"],
                            refresh_cadence=cat_item["refresh_cadence"],
                            recommended_target_range=cat_item["recommended_target_range"],
                            recommended_threshold_range=cat_item["recommended_threshold_range"],
                            strategic_focus_area=cat_item["strategic_focus_area"],
                            standard_driver=cat_item["standard_driver"],
                            sector_driver=cat_item["sector_driver"],
                            value_drivers=cat_item["value_drivers"],
                            industry_tags=cat_item["industry_tags"],
                            recommendation_score=score,
                            status=KPIStatus.recommended,
                            notes=cat_item["notes"]
                        )
                    )
                    used_names.add(c_name)
                    if len(selected_kpis) >= target_count:
                        break
                        
    # If still less than target kpi_count, fill from remaining catalog (any functional area)
    if len(selected_kpis) < target_count:
        for score, cat_item in catalog_scored:
            c_name = cat_item["kpi_name"]
            if c_name not in used_names:
                selected_kpis.append(
                    KPI(
                        id=f"kpi-{len(selected_kpis) + 1}",
                        kpi_name=c_name,
                        functional_area=cat_item["functional_area"],
                        kra=cat_item["kra"],
                        kpi_category=cat_item["kpi_category"],
                        business_definition=cat_item["business_definition"],
                        kpi_description=cat_item["kpi_description"],
                        why_important=f"Critical for monitoring {cat_item['kra']} and driving strategic outcomes within {cat_item['functional_area']} operations.",
                        formula=cat_item["formula"],
                        numerator=cat_item["numerator"],
                        denominator=cat_item["denominator"],
                        source_system=cat_item["source_system"],
                        sap_module=cat_item["sap_module"],
                        business_owner=cat_item["business_owner"],
                        data_owner=cat_item["data_owner"],
                        refresh_cadence=cat_item["refresh_cadence"],
                        recommended_target_range=cat_item["recommended_target_range"],
                        recommended_threshold_range=cat_item["recommended_threshold_range"],
                        strategic_focus_area=cat_item["strategic_focus_area"],
                        standard_driver=cat_item["standard_driver"],
                        sector_driver=cat_item["sector_driver"],
                        value_drivers=cat_item["value_drivers"],
                        industry_tags=cat_item["industry_tags"],
                        recommendation_score=score,
                        status=KPIStatus.recommended,
                        notes=cat_item["notes"]
                    )
                )
                used_names.add(c_name)
                if len(selected_kpis) >= target_count:
                    break

    # Ensure list is exactly sliced to target_count
    return selected_kpis[:target_count]


def quality_check(kpis: list[KPI], context: BusinessContext) -> dict[str, Any]:
    """Calculates coverage, uniqueness, and completeness metrics for the KPI library."""
    score = 100
    if not kpis:
        return {"score": 0, "coverage_summary": {}, "coverage_issues": [], "improvement_suggestions": ["Generate KPIs."]}
        
    names = [k.kpi_name.strip().lower() for k in kpis]
    duplicates = [name for name, count in sorted(set((n, names.count(n)) for n in names)) if count > 1]
    
    area_counts = {}
    for k in kpis:
        area_counts[k.functional_area] = area_counts.get(k.functional_area, 0) + 1
        
    missing_areas = [area for area in context.functional_areas if area not in area_counts]
    
    # Calculate completeness
    complete_count = 0
    for k in kpis:
        fields = [
            k.kpi_name, k.functional_area, k.kra, k.kpi_category,
            k.business_definition, k.formula, k.numerator, k.denominator,
            k.source_system, k.sap_module, k.business_owner, k.data_owner,
            k.refresh_cadence, k.recommended_target_range, k.recommended_threshold_range
        ]
        if all(f for f in fields):
            complete_count += 1
            
    score -= len(duplicates) * 12
    score -= len(missing_areas) * 8
    score -= max(0, len(kpis) - complete_count) * 4
    
    final_score = max(0, min(100, score))
    
    suggestions = []
    if duplicates:
        suggestions.append("Consolidate duplicate KPIs from the active scope.")
    if missing_areas:
        suggestions.append(f"Add KPI coverage for: {', '.join(missing_areas)}.")
    if complete_count < len(kpis):
        suggestions.append("Detailed calculation properties (numerator/denominator) are missing for some items.")
    if not suggestions:
        suggestions.append("KPI library meets all corporate governance guidelines.")

    return {
        "score": final_score,
        "duplicates": duplicates,
        "coverage_summary": area_counts,
        "coverage_issues": missing_areas,
        "improvement_suggestions": suggestions,
    }


def recommendations(kpis: list[KPI], context: BusinessContext) -> dict[str, Any]:
    """Generates next-step suggestions based on active KPI library analysis."""
    covered = {k.functional_area for k in kpis}
    missing = [area for area in context.functional_areas if area not in covered]
    return {
        "additional_suggested_kpis": [
            f"{area} Performance Baseline" for area in (missing or context.functional_areas[:2] or ["Finance"])
        ],
        "missing_kpi_areas": missing,
        "business_recommendations": [
            "Validate target ranges with the functional KPI business owners before functional specification generation.",
            "Establish automated data pipelines for SAP integration of the Approved KPIs to avoid manual collection errors.",
            "Use clear, designated data owners for each KPI to establish accountabilities."
        ],
    }
