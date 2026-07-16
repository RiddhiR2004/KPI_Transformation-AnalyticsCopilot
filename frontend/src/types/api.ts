export type CustomContextField = {
  label: string;
  value: string;
};

export type BusinessContext = {
  industry: string;
  organization_level: string;
  kpi_count: number;
  business_priorities: string[];
  business_challenges: string[];
  top_kras: string[];
  functional_areas: string[];
  additional_business_priorities?: string[];
  additional_business_challenges?: string[];
  additional_kras?: string[];
  additional_functional_areas?: string[];
  custom_fields?: CustomContextField[];
};

export type PromptRecord = {
  prompt: string;
  original_prompt?: string;
  user_instructions?: string;
  is_approved?: boolean;
  ai_summary: Record<string, unknown>;
  updated_at?: string;
};

export type KPIStatus = "draft" | "recommended" | "approved" | "rejected";

export type KPI = {
  id: string;
  kpi_name: string;
  functional_area: string;
  kra: string;
  kpi_category: string;
  business_definition: string;
  kpi_description: string;
  why_important?: string;
  formula: string;
  numerator: string;
  denominator: string;
  source_system: string;
  sap_module: string;
  business_owner: string;
  data_owner: string;
  refresh_cadence: string;
  recommended_target_range: string;
  recommended_threshold_range: string;
  notes: string;
  strategic_focus_area: string;
  standard_driver: string;
  sector_driver: string;
  value_drivers: string[];
  industry_tags: string[];
  recommendation_score: number;
  status: KPIStatus;
  source?: "ai_generated" | "excel_import" | "document_parsed" | "manual";
};

export type KPILibrary = {
  items: KPI[];
  quality: {
    score?: number;
    duplicates?: string[];
    coverage_summary?: Record<string, number>;
    missing_categories?: string[];
    coverage_issues?: string[];
    improvement_suggestions?: string[];
  };
  recommendations: {
    additional_suggested_kpis?: string[];
    missing_kpi_areas?: string[];
    business_recommendations?: string[];
  };
  executive_summary?: {
    summary_text?: string;
    industry?: string;
    primary_priorities?: string[];
    generated_kpis_count?: number;
    top_functional_areas?: string[];
    coverage_score?: number;
  };
};

export type WorkflowStatus = {
  business_context: boolean;
  prompt_generation: boolean;
  kpi_library: boolean;
  functional_specification: boolean;
  technical_mapping?: boolean;
  kpi_tree?: boolean;
  kpi_logic?: boolean;
  dashboard?: boolean;
};

export type ActivityEvent = {
  id: string;
  label: string;
  detail: string;
  created_at: string;
};

export type ExportItem = {
  id: "prompt" | "kpi_library" | "functional_document" | "technical_mapping" | "kpi_driver_tree" | "json_bundle";
  label: string;
  description: string;
  formats: string[];
  available: boolean;
};

export type KpiTreeSourceContext = {
  strategic_objectives: string[];
  business_challenges: string[];
  kras: string[];
  functional_areas: string[];
  custom_parameters: string[];
};

export type KpiTreeKpiNode = {
  kpi_name: string;
  kpi_description?: string;
  source_context?: KpiTreeSourceContext;
  classification?: string;
  classification_confidence?: number;
  classification_source?: string;
  x_offset?: number;
  y_offset?: number;
  x_position?: number;
  y_position?: number;
  collapsed?: boolean;
};

export type KpiTreeSectorDriverNode = {
  name: string;
  description?: string;
  business_rationale?: string;
  source_context?: KpiTreeSourceContext;
  kpis: KpiTreeKpiNode[];
  x_offset?: number;
  y_offset?: number;
  x_position?: number;
  y_position?: number;
  collapsed?: boolean;
};

export type KpiTreeStandardDriverNode = {
  name: string;
  description?: string;
  business_rationale?: string;
  source_context?: KpiTreeSourceContext;
  sector_specific_drivers: KpiTreeSectorDriverNode[];
  x_offset?: number;
  y_offset?: number;
  x_position?: number;
  y_position?: number;
  collapsed?: boolean;
};

export type KpiTreeStrategicFocusAreaNode = {
  name: string;
  description?: string;
  business_rationale?: string;
  source_context?: KpiTreeSourceContext;
  drivers: KpiTreeStandardDriverNode[];
  x_offset?: number;
  y_offset?: number;
  x_position?: number;
  y_position?: number;
  collapsed?: boolean;
};

export type KpiTreeData = {
  strategic_focus_areas: KpiTreeStrategicFocusAreaNode[];
};

export type KpiTreeRecord = {
  name: string;
  client_id?: number;
  version: number;
  status: "draft" | "approved";
  created_by?: string;
  updated_by?: string;
  data: KpiTreeData;
  updated_at?: string;
};

export type FunctionalSpecItem = {
  id: string;
  kpi_name: string;
  
  // Section A: KPI Overview
  kpi_category?: string;
  functional_area?: string;
  related_kra?: string;
  strategic_objective_supported?: string;
  business_challenge_addressed?: string;
  business_owner?: string;
  data_owner?: string;

  // Section B: Business Purpose & Strategic Relevance
  business_purpose_relevance?: string;

  // Section C: KPI Definition
  kpi_definition?: string;

  // Section D: Calculation Methodology
  formula?: string;
  numerator?: string;
  denominator?: string;
  calculation_methodology?: string;
  inclusion_rules?: string;
  exclusion_rules?: string;
  sample_calculation?: string;

  // Section E: Business Rules & Validation
  business_rules?: string;
  data_validation_rules?: string;
  exception_handling_rules?: string;
  data_quality_expectations?: string;

  // Section F: Source Systems & Data Lineage
  source_systems_lineage?: string;

  // Section G: Ownership & Governance
  ownership_governance?: string;

  // Section H: Assumptions & Constraints
  assumptions_constraints?: string;

  // Section I: Reporting Requirements
  reporting_requirements?: string;
  dashboard_recommendations?: string;
  threshold_guidance?: string;

  // Section J: Implementation Guidance
  implementation_guidance?: string;

  validation_warnings?: string[];

  // Backward Compatibility fields
  business_purpose?: string;
  business_logic?: string;
  source_system?: string;
  refresh_frequency?: string;
  assumptions?: string;
};

export type FunctionalSpecification = {
  items: FunctionalSpecItem[];
  approved_items?: FunctionalSpecItem[];
  executive_summary?: string;
  status?: string;
  updated_at?: string;
};

export type TDDDocumentOrganization = {
  document_version: string;
  status: string;
  generated_date: string;
  generated_by: string;
  technical_designer: string;
  client_name: string;
  engagement_name: string;
  related_documents: string;
};

export type TDDObjectSummaryItem = {
  object_name: string;
  object_type?: string;
  business_process?: string;
  purpose?: string;
  source_systems?: string;
  target_layer?: string;
  database?: string;
  schema_name?: string;
  primary_keys?: string;
  refresh_frequency?: string;
  estimated_volume?: string;
  data_owner?: string;
  technical_owner?: string;
  complexity?: string;
  status?: string;
  // Compatibility fields
  short_description?: string;
  technology_stack?: string;
  primary_source_systems?: string;
};

export type TDDTechnicalDataFlow = {
  diagram_mermaid: string;
  diagram_ascii: string;
  description: string;
};

export type TDDDataModelField = {
  name: string;
  purpose: string;
  source: string;
  type: string;
  description: string;
  grain?: string;
  primary_key?: string;
  foreign_keys?: string;
  measures?: string;
  dimensions?: string;
  estimated_record_volume?: string;
  partition_strategy?: string;
  natural_key?: string;
  surrogate_key?: string;
  scd_type?: string;
  parent_dimension?: string;
  update_strategy?: string;
};

export type TDDPhysicalColumn = {
  column_name: string;
  data_type: string;
  nullable: string;
  primary_key: string;
  foreign_key: string;
  description: string;
  source_field: string;
};

export type TDDPhysicalTable = {
  table_name: string;
  columns: TDDPhysicalColumn[];
};

export type TDDFieldLevelMappingItem = {
  source_system: string;
  source_table: string;
  source_field: string;
  target_table: string;
  target_field: string;
  transformation: string;
};

export type TDDTransformationStep = {
  step_number: number;
  operation: string;
  description: string;
};

export type TDDTransformationRuleItem = {
  object_name: string;
  steps: TDDTransformationStep[];
};

export type TDDkpiSqlGuidance = {
  kpi_name: string;
  sql_snippet: string;
};

export type TDDDatabaseRelationshipDiagram = {
  ascii_diagram: string;
  description: string;
};

export type TDDDataLineageDiagram = {
  ascii_lineage: string;
  description: string;
};

export type TDDTechnicalMappingItem = {
  s_no: number;
  source_system?: string;
  source_database?: string;
  source_schema?: string;
  source_table?: string;
  target_database?: string;
  target_schema?: string;
  target_table?: string;
  join_keys?: string;
  partition_key?: string;
  incremental_key?: string;
  load_type?: string;
  output_dataset?: string;
  status?: string;
  // Compatibility fields
  view_or_table_name?: string;
  database?: string;
  schema_name?: string;
  model_type?: string;
  table_type?: string;
  functional_area?: string;
  required_fields?: string;
  relationships?: string;
  transformation_logic?: string;
};

export type TDDSecurityRoleAccess = {
  role: string;
  accessible_tables: string;
  permission: string;
  masking: string;
};

export type TDDDataLoadStrategy = {
  load_frequency: string;
  refresh_type: string;
  estimated_volume: string;
  dependencies: string;
  scheduling_considerations: string;
};

export type TDDDataQualityRule = {
  validation_rule: string;
  table_name: string;
  severity: string;
  action: string;
};

export type TDDTestCase = {
  test_id: string;
  scenario: string;
  expected_result: string;
  status: string;
  priority: string;
};

export type TDDDataDictionaryItem = {
  field_name: string;
  definition: string;
  data_type: string;
  business_meaning: string;
  example_value: string;
};

export type TDDTraceabilityMatrixItem = {
  kpi: string;
  fact_table: string;
  dimension_tables: string;
  source_systems: string;
  dashboard: string;
};

export type TDDGlossaryItem = {
  term: string;
  definition: string;
};

export type TDDDataTransformationRules = {
  aggregations: string;
  derived_columns: string;
  calculated_fields: string;
  business_filters: string;
  currency_conversion: string;
  unit_conversion: string;
};

export type TDDSecurity = {
  row_level_security: string;
  object_level_security: string;
  sensitive_fields: string;
  access_roles: string;
};

export type TDDDataQualityValidation = {
  null_checks: string;
  duplicate_checks: string;
  mandatory_field_checks: string;
  business_rule_validation: string;
  kpi_validation_logic: string;
};

export type TDDTestingStrategy = {
  unit_test_scenarios: string;
  integration_test_scenarios: string;
  validation_criteria: string;
};

export type TechnicalDataMapping = {
  document_organization: TDDDocumentOrganization;
  object_summary: TDDObjectSummaryItem[];
  technical_data_flow: TDDTechnicalDataFlow[];
  data_models: TDDDataModelField[];
  physical_table_definitions?: TDDPhysicalTable[];
  field_level_mappings?: TDDFieldLevelMappingItem[];
  transformation_rules: TDDDataTransformationRules;
  transformation_rules_list?: TDDTransformationRuleItem[];
  kpi_sql_guidance?: TDDkpiSqlGuidance[];
  db_relationship_diagrams?: TDDDatabaseRelationshipDiagram[];
  data_lineage_diagrams?: TDDDataLineageDiagram[];
  technical_mappings: TDDTechnicalMappingItem[];
  security: TDDSecurity;
  security_access_grid?: TDDSecurityRoleAccess[];
  data_load_strategy: TDDDataLoadStrategy;
  data_quality_validation: TDDDataQualityValidation;
  data_quality_validation_matrix?: TDDDataQualityRule[];
  testing_strategy: TDDTestingStrategy;
  testing_strategy_matrix?: TDDTestCase[];
  data_dictionary?: TDDDataDictionaryItem[];
  traceability_matrix?: TDDTraceabilityMatrixItem[];
  glossary: TDDGlossaryItem[];
  status: string;
  version: number;
  updated_at?: string;
};

export type TechnicalMappingResponse = {
  draft_items: TechnicalDataMapping;
  approved_items: TechnicalDataMapping;
  status: string;
  version: number;
  updated_at?: string;
};

export type MetadataItem = {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TranscriptInsights = {
  executive_summary: string;
  strategic_priorities: string[];
  business_challenges: string[];
  key_decisions: string[];
  action_items: string[];
  risks_dependencies: string[];
  functional_areas: string[];
  mentioned_metrics: string[];
  stakeholders: string[];
};

export type TranscriptAnalysisRecord = {
  id: number;
  filename: string;
  raw_text: string;
  extracted_insights: TranscriptInsights;
  status: "draft" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};


export type ClientProfile = {
  id?: number;
  client_name: string;
  industry: string;
  sub_industry?: string;
  country: string;
  region?: string;
  company_size?: string;
  organization_description?: string;
  erp_platform?: string;
  crm_platform?: string;
  mes_platform?: string;
  bi_tool?: string;
  data_warehouse?: string;
  cloud_platform?: string;
  created_at?: string;
  updated_at?: string;
};


export type ClientInsightItem = {
  category: string;
  insights: string[];
};


export type ClientProfileSavePayload = {
  profile: ClientProfile;
  insights: ClientInsightItem[];
};


export type EngagementCreate = {
  client_profile_id?: number;
  name: string;
  engagement_id?: string;
  description?: string;
};


export type EngagementRecord = {
  id: number;
  client_profile_id: number;
  name: string;
  engagement_id: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  workflow_status?: WorkflowStatus;
};


export type ClientProfileWithCount = ClientProfile & {
  insights?: ClientInsightItem[];
  engagement_count: number;
};
