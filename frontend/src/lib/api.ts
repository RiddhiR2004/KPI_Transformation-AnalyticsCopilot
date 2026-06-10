import type {
  ActivityEvent,
  BusinessContext,
  ExportItem,
  KPILibrary,
  KPIStatus,
  KPI,
  PromptRecord,
  WorkflowStatus,
  FunctionalSpecification,
  MetadataItem
} from "../types/api";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail.detail ?? "Request failed");
  }
  return response.json();
}

export const api = {
  getContext: () => request<Partial<BusinessContext>>("/business-context"),
  saveContext: (body: BusinessContext) =>
    request<BusinessContext>("/business-context", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) }),
  generatePrompt: (user_instructions?: string) =>
    request<PromptRecord>("/generate-prompt", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ user_instructions: user_instructions ?? "" })
    }),
  refinePrompt: (prompt: string, refinement_instructions: string) =>
    request<PromptRecord>("/refine-prompt", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ prompt, refinement_instructions })
    }),
  getPrompt: () => request<Partial<PromptRecord>>("/prompt"),
  savePrompt: (body: PromptRecord) =>
    request<PromptRecord>("/prompt", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) }),
  generateKpis: () => request<KPILibrary>("/generate-kpis", { method: "POST" }),
  getKpis: () => request<Partial<KPILibrary>>("/kpi-library"),
  approveKpis: (ids: string[], status: KPIStatus) =>
    request<KPILibrary>("/approve-kpis", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ids, status }) }),
  updateKpi: (id: string, patch: Partial<KPI>) =>
    request<KPILibrary>("/kpi-library/update", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ id, patch }) }),
  getFunctionalSpec: () => request<FunctionalSpecification>("/functional-spec"),
  saveFunctionalSpec: (body: FunctionalSpecification) =>
    request<FunctionalSpecification>("/functional-spec", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) }),
  generateSpec: () => request<FunctionalSpecification>("/generate-spec", { method: "POST" }),
  approveSpec: () => request<{ status: string; message: string; updated_at: string }>("/approve-spec", { method: "POST" }),
  getWorkflowStatus: () => request<WorkflowStatus>("/workflow-status"),
  getTimeline: () => request<ActivityEvent[]>("/timeline"),
  getExports: () => request<ExportItem[]>("/exports"),
  getLlmStatus: () =>
    request<{ provider: string; model: string; uses_real_llm: boolean; api_key_configured: boolean; api_key_env: string }>("/llm-status"),
  getMetadata: (category: string) => request<MetadataItem[]>(`/metadata/${category}`)
};

export function exportUrl(id: string, format: string) {
  return `/api/exports/${id}/${format.toLowerCase()}`;
}
