from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


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
    updated_at: datetime = Field(default_factory=datetime.now)


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
    business_purpose: str = ""
    formula: str = ""
    business_logic: str = ""
    source_system: str = ""
    data_owner: str = ""
    refresh_frequency: str = ""
    assumptions: str = ""
    reporting_requirements: str = ""


class FunctionalSpecification(BaseModel):
    items: list[FunctionalSpecItem] = Field(default_factory=list)
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
