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
  MetadataItem,
  TranscriptInsights,
  TranscriptAnalysisRecord,
  ClientProfile,
  ClientInsightItem,
  ClientProfileSavePayload,
  ClientProfileWithCount,
  EngagementCreate,
  EngagementRecord,
  KpiTreeRecord,
  TechnicalDataMapping,
  FunctionalSpecItem,
} from "../types/api";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const activeEngId = localStorage.getItem("active_engagement_id");
  if (activeEngId) {
    headers.set("X-Engagement-ID", activeEngId);
  }
  
  // Set custom user headers for audit log tracking
  const userName = localStorage.getItem("user_name") || "riddhi.r";
  const userEmail = localStorage.getItem("user_email") || "riddhi.r@example.com";
  headers.set("X-User-Name", userName);
  headers.set("X-User-Email", userEmail);

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  });
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
  addKpi: (item: Partial<KPI>) =>
    request<KPILibrary>("/kpi-library/add", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ item }) }),
  getFunctionalSpec: () => request<FunctionalSpecification>("/functional-spec"),
  saveFunctionalSpec: (spec: FunctionalSpecification) =>
    request<FunctionalSpecification>("/functional-spec", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(spec),
    }),
  generateSpec: () =>
    request<{ items: FunctionalSpecItem[]; executive_summary: string }>("/generate-spec", {
      method: "POST",
    }),
  approveSpec: () =>
    request<{ status: string; message: string; updated_at: string }>("/approve-spec", {
      method: "POST",
    }),

  // Technical Data Mapping
  getTechnicalMapping: () => request<TechnicalDataMapping>("/technical-mapping"),
  saveTechnicalMapping: (mapping: TechnicalDataMapping) =>
    request<TechnicalDataMapping>("/technical-mapping", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(mapping),
    }),
  generateTechnicalMapping: () =>
    request<TechnicalDataMapping>("/generate-technical-mapping", {
      method: "POST",
    }),
  approveTechnicalMapping: () =>
    request<{ status: string; message: string; updated_at: string }>("/approve-technical-mapping", {
      method: "POST",
    }),

  getKpiTree: () => request<KpiTreeRecord>("/kpi-tree"),
  saveKpiTree: (payload: {
    name: string;
    data: any;
    action?: string;
    entity_type?: string;
    entity_name?: string;
    previous_value?: string;
    new_value?: string;
  }) =>
    request<{ status: string; message: string }>("/kpi-tree", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  approveKpiTree: (approved: boolean) =>
    request<{ status: string; status_value: string }>("/approve-kpi-tree", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ approved }) }),
  generateKpiTree: () => request<KpiTreeRecord>("/generate-kpi-tree", { method: "POST" }),
  getWorkflowStatus: () => request<WorkflowStatus>("/workflow-status"),
  getTimeline: () => request<ActivityEvent[]>("/timeline"),
  getExports: () => request<ExportItem[]>("/exports"),
  getLlmStatus: () =>
    request<{ provider: string; model: string; uses_real_llm: boolean; api_key_configured: boolean; api_key_env: string }>("/llm-status"),
  getMetadata: (category: string) => request<MetadataItem[]>(`/metadata/${category}`),
  getCatalog: () => request<KPI[]>("/kpi-catalog"),

  // Transcripts API
  getTranscripts: () => request<TranscriptAnalysisRecord[]>("/transcript/list"),
  uploadTranscript: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<TranscriptAnalysisRecord>("/transcript/upload", {
      method: "POST",
      body: formData
    });
  },
  updateTranscriptInsights: (id: number, insights: TranscriptInsights) =>
    request<TranscriptAnalysisRecord>(`/transcript/${id}/insights`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ extracted_insights: insights })
    }),
  updateTranscriptStatus: (id: number, status: "draft" | "approved" | "rejected") =>
    request<TranscriptAnalysisRecord>(`/transcript/${id}/status`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ status })
    }),
  deleteTranscript: (id: number) =>
    request<{ status: string; message: string }>(`/transcript/${id}`, {
      method: "DELETE"
    }),

  // Multi-client API
  getClients: () => request<ClientProfileWithCount[]>("/clients"),
  getClientById: (id: number) => request<ClientProfileWithCount>(`/clients/${id}`),
  deleteClient: (id: number) => 
    request<{ status: string; message: string }>(`/clients/${id}`, { method: "DELETE" }),


  getClientProfile: () => request<ClientProfile & { insights: ClientInsightItem[] }>("/client-profile"),
  saveClientProfile: (body: ClientProfileSavePayload) =>
    request<ClientProfile & { insights: ClientInsightItem[] }>("/client-profile", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body)
    }),
  uploadClientAsset: (file: File, sessionId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ status: string; filename: string; size: number }>(`/client-profile/upload?session_id=${encodeURIComponent(sessionId)}`, {
      method: "POST",
      body: formData
    });
  },
  analyzeClientAssets: (sessionId: string) =>
    request<Record<string, string[]>>(`/client-profile/analyze?session_id=${encodeURIComponent(sessionId)}`, {
      method: "POST"
    }),

  // Engagement API
  getEngagements: (clientId?: number) => {
    const qs = clientId != null ? `?client_id=${clientId}` : "";
    return request<EngagementRecord[]>(`/engagements${qs}`);
  },
  createEngagement: (body: EngagementCreate) =>
    request<EngagementRecord>("/engagements", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),
  updateEngagement: (id: number, body: EngagementCreate) =>
    request<EngagementRecord>(`/engagements/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),
  deleteEngagement: (id: number) =>
    request<{ status: string; message: string }>(`/engagements/${id}`, {
      method: "DELETE",
    }),

  // Audit API
  getAuditLogs: (filters?: {
    client_id?: number;
    engagement_id?: number;
    user?: string;
    module?: string;
    start_date?: string;
    end_date?: string;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          params.append(key, String(val));
        }
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<any[]>(`/audit-logs${qs}`);
  },
  logAuditEvent: (body: {
    module: string;
    action: string;
    status: string;
    entity_type?: string;
    entity_name?: string;
    previous_value?: string;
    new_value?: string;
    client_id?: number;
    engagement_id?: number;
  }) =>
    request<{ status: string }>("/audit-logs/event", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body)
    }),
};

export function exportUrl(id: string, format: string) {
  const activeEngId = localStorage.getItem("active_engagement_id");
  const userName = encodeURIComponent(localStorage.getItem("user_name") || "riddhi.r");
  const userEmail = encodeURIComponent(localStorage.getItem("user_email") || "riddhi.r@example.com");
  const base = `/api/exports/${id}/${format.toLowerCase()}`;
  let qs = `?user_name=${userName}&user_email=${userEmail}`;
  if (activeEngId) {
    qs += `&engagement_id=${activeEngId}`;
  }
  return `${base}${qs}`;
}
