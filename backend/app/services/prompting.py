from __future__ import annotations

import json
from app.models import BusinessContext
from app.services.kpi_engine import load_catalog

USER_PROMPT_TEMPLATE = """You are an Enterprise KPI Transformation Consultant.

Generate a KPI Library for the following business context.

Industry: {industry}
Organization Level: {organization_level}

Business Priorities:
{business_priorities}

Business Challenges:
{business_challenges}

Top KRAs:
{top_kras}

Functional Areas:
{functional_areas}

Generate {kpi_count} KPI definitions.

For each KPI provide custom values for:
- KPI Name (must match catalog name exactly)
- KPI Description (customized business purpose)
- Business Owner
- Data Owner
- Refresh Cadence
- Target Range
- Threshold Range
- Notes

Prioritize KPIs that best support the stated business objectives and challenges."""

SYSTEM_PROMPT_TEMPLATE = """You are a strictly governed KPI generation backend.
Your job is to generate a structured KPI library in JSON format based on the user's business context.

=================================================
STRICT GOVERNANCE RULE:
You must select KPI Names strictly from the curated catalog of standard metrics provided below.
DO NOT create new KPI names, DO NOT invent synthetic names, and DO NOT rename or tweak the names from the curated list.
All generated KPI names must match the catalog names exactly.
=================================================

=================================================
KPI SELECTION RULES & SCORING LOGIC:
1. Try to select KPIs from the catalog whose functional_area matches the user's selected Functional Areas. If there are not enough KPIs in the selected areas to meet the target count of {kpi_count}, you may select KPIs from other functional areas, but prioritize the selected ones first.
2. Rank the catalog KPIs based on the following alignment scores:
   - Industry Match: 30% weight
   - Functional Area Match: 30% weight
   - KRA Match: 20% weight
   - Priority Match: 10% weight
   - Challenge Match: 10% weight
3. Output the top highest-scoring KPIs up to the requested number of KPIs ({kpi_count}).
=================================================

=================================================
GOVERNANCE & VALIDATION RULES:
1. For each KPI you output, you must retain its exact name.
2. You should populate or customize the ownership, target ranges, description, and cadence to fit the user's business context, but the KPI Name must match its catalog definition exactly.
=================================================

CURATED KPI CATALOG LIST (JSON format):
{catalog_json}

=================================================
JSON OUTPUT FORMAT:
You must return ONLY a JSON object matching this exact schema:
{{
  "kpis": [
    {{
      "kpi_name": "Exact Name from Catalog",
      "kpi_description": "Customized business purpose / description text tailored to the context",
      "business_owner": "Business Owner role tailored to context",
      "data_owner": "Data Owner role tailored to context",
      "refresh_cadence": "Weekly/Monthly/Quarterly",
      "recommended_target_range": "Target range e.g. 10-15%",
      "recommended_threshold_range": "Red < 10%, Amber 10-12%, Green >= 12%",
      "notes": "Implementation notes / assumptions"
    }}
  ]
}}
DO NOT wrap the response in markdown blocks or return any text other than the JSON object.
"""

def build_kpi_prompt(context: BusinessContext) -> str:
    priorities_str = "\n".join(f"- {p}" for p in context.business_priorities) or "- Not specified"
    challenges_str = "\n".join(f"- {c}" for c in context.business_challenges) or "- Not specified"
    kras_str = "\n".join(f"- {k}" for k in context.top_kras) or "- Not specified"
    functional_areas_str = "\n".join(f"- {a}" for a in context.functional_areas) or "- Not specified"
    
    return USER_PROMPT_TEMPLATE.format(
        industry=context.industry,
        organization_level=context.organization_level,
        business_priorities=priorities_str,
        business_challenges=challenges_str,
        top_kras=kras_str,
        functional_areas=functional_areas_str,
        kpi_count=context.kpi_count
    )

def build_system_kpi_prompt(context: BusinessContext) -> str:
    catalog = load_catalog()
    minimized_catalog = []
    for item in catalog:
        minimized_catalog.append({
            "kpi_name": item["kpi_name"],
            "functional_area": item["functional_area"],
            "kra": item["kra"],
            "kpi_description": item["kpi_description"],
            "industry_tags": item["industry_tags"]
        })
    catalog_json = json.dumps(minimized_catalog, indent=2)
    return SYSTEM_PROMPT_TEMPLATE.format(catalog_json=catalog_json, kpi_count=context.kpi_count)

