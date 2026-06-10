from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class KPIStatus(str, Enum):
    draft = "draft"
    recommended = "recommended"
    approved = "approved"
    rejected = "rejected"


class BusinessContext(BaseModel):
    industry: str = ""
    organization_level: str = ""
    kpi_count: int = Field(default=8, ge=1, le=50)
    business_priorities: list[str] = Field(default_factory=list)
    business_challenges: list[str] = Field(default_factory=list)
    top_kras: list[str] = Field(default_factory=list)
    functional_areas: list[str] = Field(default_factory=list)
    additional_business_priorities: list[str] = Field(default_factory=list)
    additional_business_challenges: list[str] = Field(default_factory=list)
    additional_kras: list[str] = Field(default_factory=list)
    additional_functional_areas: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.now)

    @model_validator(mode="after")
    def validate_and_clean_lists(self) -> BusinessContext:
        def clean_list(items: list[str]) -> list[str]:
            cleaned = []
            seen = set()
            for item in items:
                trimmed = item.strip()[:100]
                if not trimmed:
                    continue
                lower = trimmed.lower()
                if lower not in seen:
                    seen.add(lower)
                    cleaned.append(trimmed)
            return cleaned

        self.business_priorities = clean_list(self.business_priorities)
        self.business_challenges = clean_list(self.business_challenges)
        self.top_kras = clean_list(self.top_kras)
        self.functional_areas = clean_list(self.functional_areas)

        def clean_custom_list(custom_items: list[str], predefined_items: list[str]) -> list[str]:
            predefined_seen = {p.strip().lower() for p in predefined_items if p.strip()}
            cleaned = []
            seen = set()
            for item in custom_items:
                trimmed = item.strip()[:100]
                if not trimmed:
                    continue
                lower = trimmed.lower()
                if lower not in predefined_seen and lower not in seen:
                    seen.add(lower)
                    cleaned.append(trimmed)
            return cleaned

        self.additional_business_priorities = clean_custom_list(self.additional_business_priorities, self.business_priorities)
        self.additional_business_challenges = clean_custom_list(self.additional_business_challenges, self.business_challenges)
        self.additional_kras = clean_custom_list(self.additional_kras, self.top_kras)
        self.additional_functional_areas = clean_custom_list(self.additional_functional_areas, self.functional_areas)

        return self

    def get_merged(self) -> BusinessContext:
        """
        Returns a new BusinessContext with predefined and custom lists combined,
        while maintaining the original separate lists.
        """
        return BusinessContext(
            industry=self.industry,
            organization_level=self.organization_level,
            kpi_count=self.kpi_count,
            business_priorities=self.business_priorities + self.additional_business_priorities,
            business_challenges=self.business_challenges + self.additional_business_challenges,
            top_kras=self.top_kras + self.additional_kras,
            functional_areas=self.functional_areas + self.additional_functional_areas,
            additional_business_priorities=self.additional_business_priorities,
            additional_business_challenges=self.additional_business_challenges,
            additional_kras=self.additional_kras,
            additional_functional_areas=self.additional_functional_areas,
            updated_at=self.updated_at
        )


class PromptRecord(BaseModel):
    prompt: str
    original_prompt: str = ""
    user_instructions: str = ""
    is_approved: bool = False
    ai_summary: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.now)


class KPI(BaseModel):
    id: str
    kpi_name: str
    functional_area: str
    kra: str
    kpi_category: str = "Financial"
    business_definition: str = ""
    kpi_description: str
    formula: str
    numerator: str = ""
    denominator: str = ""
    source_system: str
    sap_module: str = ""
    business_owner: str = ""
    data_owner: str = ""
    refresh_cadence: str
    recommended_target_range: str = ""
    recommended_threshold_range: str = ""
    notes: str = ""
    strategic_focus_area: str = ""
    standard_driver: str = ""
    sector_driver: str = ""
    value_drivers: list[str] = Field(default_factory=list)
    industry_tags: list[str] = Field(default_factory=list)
    recommendation_score: int = 100
    status: KPIStatus = KPIStatus.draft


class FunctionalSpecItem(BaseModel):
    id: str
    kpi_name: str
    
    # Sections A: KPI Overview
    kpi_category: str = ""
    functional_area: str = ""
    related_kra: str = ""
    strategic_objective_supported: str = ""
    business_challenge_addressed: str = ""
    business_owner: str = ""
    data_owner: str = ""

    # Section B: Business Purpose & Strategic Relevance
    business_purpose_relevance: str = ""

    # Section C: KPI Definition
    kpi_definition: str = ""

    # Section D: Calculation Methodology
    formula: str = ""
    numerator: str = ""
    denominator: str = ""
    calculation_methodology: str = ""
    inclusion_rules: str = ""
    exclusion_rules: str = ""
    sample_calculation: str = ""

    # Section E: Business Rules & Validation
    business_rules: str = ""
    data_validation_rules: str = ""
    exception_handling_rules: str = ""
    data_quality_expectations: str = ""

    # Section F: Source Systems & Data Lineage
    source_systems_lineage: str = ""

    # Section G: Ownership & Governance
    ownership_governance: str = ""

    # Section H: Assumptions & Constraints
    assumptions_constraints: str = ""

    # Section I: Reporting Requirements
    reporting_requirements: str = ""
    dashboard_recommendations: str = ""
    threshold_guidance: str = ""

    # Section J: Implementation Guidance
    implementation_guidance: str = ""

    validation_warnings: list[str] = Field(default_factory=list)

    # Backward Compatibility fields
    business_purpose: str = ""
    business_logic: str = ""
    source_system: str = ""
    refresh_frequency: str = ""
    assumptions: str = ""


class FunctionalSpecification(BaseModel):
    items: list[FunctionalSpecItem] = Field(default_factory=list)
    executive_summary: str = ""
    status: str = "draft"  # "draft" or "approved"
    updated_at: datetime = Field(default_factory=datetime.now)


class KPILibrary(BaseModel):
    items: list[KPI] = Field(default_factory=list)
    quality: dict[str, Any] = Field(default_factory=dict)
    recommendations: dict[str, Any] = Field(default_factory=dict)
    executive_summary: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.now)


class KPIApprovalRequest(BaseModel):
    ids: list[str]
    status: KPIStatus


class KPIUpdateRequest(BaseModel):
    id: str
    patch: dict[str, Any]


class WorkflowStatus(BaseModel):
    business_context: bool = False
    prompt_generation: bool = False
    kpi_library: bool = False
    functional_specification: bool = False
    technical_mapping: bool = False
    kpi_tree: bool = False
    dashboard: bool = False


class ActivityEvent(BaseModel):
    id: str
    label: str
    detail: str = ""
    created_at: datetime = Field(default_factory=datetime.now)


class ExportItem(BaseModel):
    id: Literal["prompt", "kpi_library", "functional_document", "json_bundle"]
    label: str
    description: str
    formats: list[str]
    available: bool
