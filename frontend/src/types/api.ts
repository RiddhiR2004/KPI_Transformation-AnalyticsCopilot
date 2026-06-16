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
  technical_mapping: boolean;
  kpi_tree: boolean;
  dashboard: boolean;
};

export type ActivityEvent = {
  id: string;
  label: string;
  detail: string;
  created_at: string;
};

export type ExportItem = {
  id: "prompt" | "kpi_library" | "functional_document" | "json_bundle";
  label: string;
  description: string;
  formats: string[];
  available: boolean;
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

