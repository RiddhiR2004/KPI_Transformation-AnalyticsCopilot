export type BusinessContext = {
  industry: string;
  organization_level: string;
  kpi_count: number;
  business_priorities: string[];
  business_challenges: string[];
  top_kras: string[];
  functional_areas: string[];
};

export type PromptRecord = {
  prompt: string;
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
  business_purpose: string;
  formula: string;
  business_logic: string;
  source_system: string;
  data_owner: string;
  refresh_frequency: string;
  assumptions: string;
  reporting_requirements: string;
};

export type FunctionalSpecification = {
  items: FunctionalSpecItem[];
  updated_at?: string;
};
