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


class CustomContextField(BaseModel):
    label: str
    value: str


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
    custom_fields: list[CustomContextField] = Field(default_factory=list)
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

        self.custom_fields = [f for f in self.custom_fields if f.label.strip() or f.value.strip()]

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
            custom_fields=self.custom_fields,
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
    why_important: str = ""
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
    source: str = "ai_generated"  # "ai_generated", "excel_import", "document_parsed", "manual"
    classification: str = "Critical to Progress"
    classification_confidence: float = 1.0
    classification_source: str = "AI"


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


class TDDDocumentOrganization(BaseModel):
    document_version: str = "1.0"
    status: str = "draft"
    generated_date: str = ""
    generated_by: str = ""
    technical_designer: str = "AI Analytics Architect"
    client_name: str = ""
    engagement_name: str = ""
    related_documents: str = ""


class TDDObjectSummaryItem(BaseModel):
    object_name: str = ""
    object_type: str = "Fact"  # Fact / Dimension / View
    business_process: str = ""
    purpose: str = ""
    source_systems: str = ""
    target_layer: str = "Gold"
    database: str = "Snowflake"
    schema_name: str = ""
    primary_keys: str = ""
    refresh_frequency: str = "Daily"
    estimated_volume: str = ""
    data_owner: str = ""
    technical_owner: str = ""
    complexity: str = "Medium"  # Low / Medium / High
    status: str = "TBC"  # TBC / Confirmed
    
    # Backwards compatibility fields
    short_description: str = ""
    technology_stack: str = ""
    primary_source_systems: str = ""


class TDDTechnicalDataFlow(BaseModel):
    diagram_mermaid: str = ""  # Mermaid JS diagram code
    diagram_ascii: str = ""    # ASCII diagram for document/text rendering
    description: str = ""


class TDDDataModelField(BaseModel):
    name: str = ""
    purpose: str = ""
    source: str = ""
    type: str = ""  # Fact / Dimension
    description: str = ""
    grain: str = ""
    primary_key: str = ""
    foreign_keys: str = ""
    measures: str = ""
    dimensions: str = ""
    estimated_record_volume: str = ""
    partition_strategy: str = ""
    natural_key: str = ""
    surrogate_key: str = ""
    scd_type: str = ""  # Slowly Changing Dimension Type
    parent_dimension: str = ""
    update_strategy: str = ""


class TDDPhysicalColumn(BaseModel):
    column_name: str = ""
    data_type: str = ""
    nullable: str = "YES"
    primary_key: str = ""
    foreign_key: str = ""
    description: str = ""
    source_field: str = ""


class TDDPhysicalTable(BaseModel):
    table_name: str = ""
    columns: list[TDDPhysicalColumn] = Field(default_factory=list)


class TDDFieldLevelMappingItem(BaseModel):
    source_system: str = ""
    source_table: str = ""
    source_field: str = ""
    target_table: str = ""
    target_field: str = ""
    transformation: str = ""


class TDDTransformationStep(BaseModel):
    step_number: int = 1
    operation: str = ""
    description: str = ""


class TDDTransformationRuleItem(BaseModel):
    object_name: str = ""
    steps: list[TDDTransformationStep] = Field(default_factory=list)


class TDDkpiSqlGuidance(BaseModel):
    kpi_name: str = ""
    sql_snippet: str = ""


class TDDDatabaseRelationshipDiagram(BaseModel):
    ascii_diagram: str = ""
    description: str = ""


class TDDDataLineageDiagram(BaseModel):
    ascii_lineage: str = ""
    description: str = ""


class TDDTechnicalMappingItem(BaseModel):
    s_no: int = 1
    source_system: str = ""
    source_database: str = ""
    source_schema: str = ""
    source_table: str = ""
    target_database: str = ""
    target_schema: str = ""
    target_table: str = ""
    join_keys: str = ""
    partition_key: str = ""
    incremental_key: str = ""
    load_type: str = "Incremental"
    output_dataset: str = ""
    status: str = "TBC"  # TBC / Confirmed

    # Backwards compatibility fields
    view_or_table_name: str = ""
    database: str = ""
    schema_name: str = ""
    model_type: str = ""
    table_type: str = ""
    functional_area: str = ""
    required_fields: str = ""
    relationships: str = ""
    transformation_logic: str = ""


class TDDSecurityRoleAccess(BaseModel):
    role: str = ""
    accessible_tables: str = ""
    permission: str = "Read"
    masking: str = "No"


class TDDDataLoadStrategy(BaseModel):
    load_frequency: str = ""
    refresh_type: str = ""
    estimated_volume: str = ""
    dependencies: str = ""
    scheduling_considerations: str = ""


class TDDDataQualityRule(BaseModel):
    validation_rule: str = ""
    table_name: str = ""
    severity: str = "Medium"  # Low / Medium / High / Critical
    action: str = ""


class TDDTestCase(BaseModel):
    test_id: str = ""
    scenario: str = ""
    expected_result: str = ""
    status: str = "Pending"
    priority: str = "Medium"


class TDDDataDictionaryItem(BaseModel):
    field_name: str = ""
    definition: str = ""
    data_type: str = ""
    business_meaning: str = ""
    example_value: str = ""


class TDDTraceabilityMatrixItem(BaseModel):
    kpi: str = ""
    fact_table: str = ""
    dimension_tables: str = ""
    source_systems: str = ""
    dashboard: str = ""


class TDDGlossaryItem(BaseModel):
    term: str = ""
    definition: str = ""


class TDDDataTransformationRules(BaseModel):
    aggregations: str = ""
    derived_columns: str = ""
    calculated_fields: str = ""
    business_filters: str = ""
    currency_conversion: str = ""
    unit_conversion: str = ""


class TDDSecurity(BaseModel):
    row_level_security: str = ""
    object_level_security: str = ""
    sensitive_fields: str = ""
    access_roles: str = ""


class TDDDataQualityValidation(BaseModel):
    null_checks: str = ""
    duplicate_checks: str = ""
    mandatory_field_checks: str = ""
    business_rule_validation: str = ""
    kpi_validation_logic: str = ""


class TDDTestingStrategy(BaseModel):
    unit_test_scenarios: str = ""
    integration_test_scenarios: str = ""
    validation_criteria: str = ""


class TechnicalDataMapping(BaseModel):
    document_organization: TDDDocumentOrganization = Field(default_factory=TDDDocumentOrganization)
    object_summary: list[TDDObjectSummaryItem] = Field(default_factory=list)
    technical_data_flow: list[TDDTechnicalDataFlow] = Field(default_factory=list)
    data_models: list[TDDDataModelField] = Field(default_factory=list)
    physical_table_definitions: list[TDDPhysicalTable] = Field(default_factory=list)
    field_level_mappings: list[TDDFieldLevelMappingItem] = Field(default_factory=list)
    transformation_rules: TDDDataTransformationRules = Field(default_factory=TDDDataTransformationRules)
    transformation_rules_list: list[TDDTransformationRuleItem] = Field(default_factory=list)
    kpi_sql_guidance: list[TDDkpiSqlGuidance] = Field(default_factory=list)
    db_relationship_diagrams: list[TDDDatabaseRelationshipDiagram] = Field(default_factory=list)
    data_lineage_diagrams: list[TDDDataLineageDiagram] = Field(default_factory=list)
    technical_mappings: list[TDDTechnicalMappingItem] = Field(default_factory=list)
    security: TDDSecurity = Field(default_factory=TDDSecurity)
    security_access_grid: list[TDDSecurityRoleAccess] = Field(default_factory=list)
    data_load_strategy: TDDDataLoadStrategy = Field(default_factory=TDDDataLoadStrategy)
    data_quality_validation: TDDDataQualityValidation = Field(default_factory=TDDDataQualityValidation)
    data_quality_validation_matrix: list[TDDDataQualityRule] = Field(default_factory=list)
    testing_strategy: TDDTestingStrategy = Field(default_factory=TDDTestingStrategy)
    testing_strategy_matrix: list[TDDTestCase] = Field(default_factory=list)
    data_dictionary: list[TDDDataDictionaryItem] = Field(default_factory=list)
    traceability_matrix: list[TDDTraceabilityMatrixItem] = Field(default_factory=list)
    glossary: list[TDDGlossaryItem] = Field(default_factory=list)
    status: str = "draft"  # "draft" or "approved"
    version: int = 1
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


class TranscriptInsights(BaseModel):
    executive_summary: str = ""
    strategic_priorities: list[str] = Field(default_factory=list)
    business_challenges: list[str] = Field(default_factory=list)
    key_decisions: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    risks_dependencies: list[str] = Field(default_factory=list)
    functional_areas: list[str] = Field(default_factory=list)
    mentioned_metrics: list[str] = Field(default_factory=list)
    stakeholders: list[str] = Field(default_factory=list)


class TranscriptAnalysisRecord(BaseModel):
    id: int
    filename: str
    raw_text: str
    extracted_insights: TranscriptInsights
    status: str
    created_at: datetime
    updated_at: datetime


class TranscriptStatusUpdateRequest(BaseModel):
    status: str


class TranscriptInsightsUpdateRequest(BaseModel):
    extracted_insights: TranscriptInsights


class WorkflowStatus(BaseModel):
    business_context: bool = False
    prompt_generation: bool = False
    kpi_library: bool = False
    functional_specification: bool = False
    technical_mapping: bool = False
    kpi_logic: bool = False
    kpi_tree: bool = False
    dashboard: bool = False


class ActivityEvent(BaseModel):
    id: str
    label: str
    detail: str = ""
    created_at: datetime = Field(default_factory=datetime.now)


class ExportItem(BaseModel):
    id: Literal["prompt", "kpi_library", "functional_document", "technical_mapping", "kpi_driver_tree", "json_bundle"]
    label: str
    description: str
    formats: list[str]
    available: bool


class ClientProfile(BaseModel):
    id: int | None = None
    client_name: str
    industry: str
    sub_industry: str = ""
    country: str
    region: str = ""
    company_size: str = ""
    organization_description: str = ""
    erp_platform: str = ""
    crm_platform: str = ""
    mes_platform: str = ""
    bi_tool: str = ""
    data_warehouse: str = ""
    cloud_platform: str = ""


class ClientInsightItem(BaseModel):
    category: str
    insights: list[str]


class ClientProfileSavePayload(BaseModel):
    profile: ClientProfile
    insights: list[ClientInsightItem]


class ClientProfileResponse(BaseModel):
    id: int
    client_name: str
    industry: str
    sub_industry: str
    country: str
    region: str
    company_size: str
    organization_description: str
    erp_platform: str
    crm_platform: str
    mes_platform: str
    bi_tool: str
    data_warehouse: str
    cloud_platform: str
    insights: list[ClientInsightItem]
    created_at: datetime
    updated_at: datetime


class EngagementCreate(BaseModel):
    client_profile_id: int | None = None
    name: str
    engagement_id: str = ""
    description: str = ""


class EngagementRecord(BaseModel):
    id: int
    client_profile_id: int
    name: str
    engagement_id: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
    workflow_status: WorkflowStatus = Field(default_factory=WorkflowStatus)
