import { AlertCircle, ArrowLeft, CheckCircle, Download, Edit3, FileText, Play, Save, RefreshCw, ChevronDown, ChevronRight, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import type { ExportItem, FunctionalSpecification, FunctionalSpecItem, KPILibrary, BusinessContext } from "../types/api";

const sectionConfigs = [
  {
    id: "section-A",
    title: "Section A: KPI Overview",
    fields: [
      { key: "kpi_category", label: "KPI Category", type: "input" },
      { key: "functional_area", label: "Functional Area", type: "input" },
      { key: "related_kra", label: "Related KRA", type: "input" },
      { key: "strategic_objective_supported", label: "Strategic Objective Supported", type: "input" },
      { key: "business_challenge_addressed", label: "Business Challenge Addressed", type: "input" },
      { key: "business_owner", label: "Business Owner", type: "input" },
      { key: "data_owner", label: "Data Owner", type: "input" },
    ]
  },
  {
    id: "section-B",
    title: "Section B: Business Purpose & Strategic Relevance",
    fields: [
      { key: "business_purpose_relevance", label: "Business Purpose & Strategic Relevance", type: "textarea" }
    ]
  },
  {
    id: "section-C",
    title: "Section C: KPI Definition",
    fields: [
      { key: "kpi_definition", label: "KPI Definition", type: "textarea" }
    ]
  },
  {
    id: "section-D",
    title: "Section D: Calculation Methodology",
    fields: [
      { key: "formula", label: "Formula Logic", type: "input" },
      { key: "numerator", label: "Numerator Detail", type: "input" },
      { key: "denominator", label: "Denominator Detail", type: "input" },
      { key: "calculation_methodology", label: "Calculation Methodology", type: "textarea" },
      { key: "inclusion_rules", label: "Inclusion Rules", type: "textarea" },
      { key: "exclusion_rules", label: "Exclusion Rules", type: "textarea" },
      { key: "sample_calculation", label: "Sample Calculation", type: "textarea" },
    ]
  },
  {
    id: "section-E",
    title: "Section E: Business Rules & Validation",
    fields: [
      { key: "business_rules", label: "Business Rules", type: "textarea" },
      { key: "data_validation_rules", label: "Data Validation Rules", type: "textarea" },
      { key: "exception_handling_rules", label: "Exception Handling", type: "textarea" },
      { key: "data_quality_expectations", label: "Data Quality Expectations", type: "textarea" },
    ]
  },
  {
    id: "section-F",
    title: "Section F: Source Systems & Data Lineage",
    fields: [
      { key: "source_systems_lineage", label: "Source Systems & Lineage", type: "textarea" }
    ]
  },
  {
    id: "section-G",
    title: "Section G: Ownership & Governance",
    fields: [
      { key: "ownership_governance", label: "Ownership & Governance Details", type: "textarea" }
    ]
  },
  {
    id: "section-H",
    title: "Section H: Assumptions & Constraints",
    fields: [
      { key: "assumptions_constraints", label: "Assumptions & Constraints", type: "textarea" }
    ]
  },
  {
    id: "section-I",
    title: "Section I: Reporting Requirements & Thresholds",
    fields: [
      { key: "reporting_requirements", label: "Reporting Requirements", type: "textarea" },
      { key: "dashboard_recommendations", label: "Dashboard Recommendations", type: "textarea" },
      { key: "threshold_guidance", label: "Threshold Guidance", type: "textarea" },
    ]
  },
  {
    id: "section-J",
    title: "Section J: Implementation & Adoption Guidance",
    fields: [
      { key: "implementation_guidance", label: "Implementation Guidance", type: "textarea" }
    ]
  }
] as const;

export function FunctionalSpecificationPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [library, setLibrary] = useState<KPILibrary>({ items: [], quality: {}, recommendations: {} });
  const [spec, setSpec] = useState<FunctionalSpecification>({ items: [] });
  const [context, setContext] = useState<Partial<BusinessContext>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  
  // Navigation & expanded states
  const [expandedKpis, setExpandedKpis] = useState<Record<string, boolean>>({});

  // Editing states
  const [editingItem, setEditingItem] = useState<FunctionalSpecItem | null>(null);
  const [isEditingExec, setIsEditingExec] = useState(false);
  const [execSummaryValue, setExecSummaryValue] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const handleFieldChange = (key: keyof FunctionalSpecItem, value: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      [key]: value
    });
  };

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kpiData, specData, contextData] = await Promise.all([
        api.getKpis(),
        api.getWorkflowStatus().then((status) => 
          status.functional_specification ? api.getFunctionalSpec() : { items: [] }
        ),
        api.getContext()
      ]);
      
      if (kpiData.items) {
        setLibrary(kpiData as KPILibrary);
      }
      if (specData.items) {
        setSpec(specData as FunctionalSpecification);
        setExecSummaryValue(specData.executive_summary || "");
        
        // Auto expand all KPIs by default
        const initialExpanded: Record<string, boolean> = {};
        specData.items.forEach((item: FunctionalSpecItem) => {
          initialExpanded[item.id] = true;
        });
        setExpandedKpis(initialExpanded);
      }
      if (contextData) {
        setContext(contextData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function generateSpec() {
    setGenerating(true);
    setError("");
    try {
      const data = await api.generatePrompt().then(() => api.generateSpec());
      setSpec(data);
      setExecSummaryValue(data.executive_summary || "");
      
      // Auto expand all KPIs by default
      const initialExpanded: Record<string, boolean> = {};
      data.items.forEach((item: FunctionalSpecItem) => {
        initialExpanded[item.id] = true;
      });
      setExpandedKpis(initialExpanded);

      setSaveStatus("Specification package generated");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSpecItem() {
    if (!editingItem) return;
    
    // Sync backward compatibility fields
    const updatedItem = {
      ...editingItem,
      business_purpose: editingItem.business_purpose_relevance || editingItem.business_purpose || "",
      business_logic: `Formula: ${editingItem.formula}\nNumerator: ${editingItem.numerator}\nDenominator: ${editingItem.denominator}`,
      source_system: editingItem.source_systems_lineage || editingItem.source_system || "",
      refresh_frequency: editingItem.kpi_definition || editingItem.refresh_frequency || "",
      assumptions: editingItem.assumptions_constraints || editingItem.assumptions || ""
    };

    const updatedItems = spec.items.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    const updatedSpec = { ...spec, items: updatedItems, status: "draft" };
    
    setSaveStatus("Saving Draft...");
    try {
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setEditingItem(null);
      setSaveStatus("Changes saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to save specification updates");
    }
  }

  async function saveExecutiveSummary() {
    const updatedSpec = { ...spec, executive_summary: execSummaryValue, status: "draft" };
    setSaveStatus("Saving Draft...");
    try {
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setIsEditingExec(false);
      setSaveStatus("Executive summary saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to save executive summary updates");
    }
  }

  async function approveSpecification() {
    setSaveStatus("Approving Package...");
    try {
      await api.approveSpec();
      setSpec((prev) => ({ ...prev, status: "approved" }));
      setSaveStatus("Specification Package Approved!");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve specification package");
    }
  }

  async function reopenSpec() {
    setSaveStatus("Reopening Specification...");
    try {
      const updatedSpec = { ...spec, status: "draft" };
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setSaveStatus("Package status set to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to reopen specification");
    }
  }

  const approvedKpis = library.items.filter((kpi) => kpi.status === "approved");
  const specExport = exports.find((item) => item.id === "functional_document");

  const isOutOfSync = useMemo(() => {
    if (approvedKpis.length === 0 || spec.items.length === 0) return false;
    if (approvedKpis.length !== spec.items.length) return true;
    const specIds = new Set(spec.items.map((item) => item.id));
    for (const kpi of approvedKpis) {
      if (!specIds.has(kpi.id)) return true;
    }
    return false;
  }, [approvedKpis, spec.items]);

  const toggleKpi = (kpiId: string) => {
    setExpandedKpis((prev) => ({
      ...prev,
      [kpiId]: !prev[kpiId],
    }));
  };

  const expandAllKpis = () => {
    const next: Record<string, boolean> = {};
    spec.items.forEach((item) => {
      next[item.id] = true;
    });
    setExpandedKpis(next);
  };

  const collapseAllKpis = () => {
    setExpandedKpis({});
  };

  const isApproved = spec.status === "approved";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[#FFE600]">
        <RefreshCw size={28} className="animate-spin" />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Enterprise Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 03</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Functional Specification Studio</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Enrich and formalize approved KPI definitions into comprehensive consulting-grade functional specifications. Manage drafts, edit sections, approve deliverables, and export client-ready documentation.
        </p>
      </section>

      {/* Error Alert */}
      {error ? (
        <div className="border border-red-900 bg-red-950/30 p-4 text-xs text-red-400 flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Out of Sync Notice */}
      {spec.items.length > 0 && isOutOfSync && (
        <div className="border border-[#FFE600]/30 bg-[#FFE600]/5 p-4 rounded-sm flex items-start gap-3 justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5 text-[#FFE600]" size={16} />
            <div>
              <p className="text-xs font-bold text-[#FFE600] uppercase tracking-wider">Specification Out of Sync</p>
              <p className="text-[11px] text-[#B0B0B0] mt-1">
                The approved KPI library has changed. Re-synthesize the functional specification to align it with the currently approved metrics.
              </p>
            </div>
          </div>
          <button 
            className="button-yellow !py-1.5 !px-3 !text-[11px] shrink-0 border border-black/10 flex items-center gap-1.5" 
            disabled={generating} 
            onClick={generateSpec}
          >
            <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
            Re-synthesize Spec
          </button>
        </div>
      )}

      {/* Check State: No Approved KPIs */}
      {approvedKpis.length === 0 ? (
        <section className="panel p-10 text-center space-y-4">
          <AlertCircle className="mx-auto text-[#FFE600]" size={40} />
          <h3 className="text-lg font-semibold text-[#F5F5F5]">No Approved Metrics Available</h3>
          <p className="max-w-md mx-auto text-xs text-[#B0B0B0] leading-relaxed">
            Functional specifications are constructed only for KPIs that have undergone strategic review. Please navigate to Step 2 (KPI Library) to approve candidate metrics first.
          </p>
          <div className="pt-2">
            <Link to="/step-2" className="button-yellow">
              <ArrowLeft size={16} />
              Return to KPI Library
            </Link>
          </div>
        </section>
      ) : spec.items.length === 0 ? (
        /* State: Approved KPIs exist but spec is not generated yet */
        <section className="panel p-10 text-center space-y-6">
          <FileText className="mx-auto text-[#FFE600]/80" size={48} />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#F5F5F5]">Ready for AI Document Enrichment</h3>
            <p className="max-w-lg mx-auto text-xs text-[#B0B0B0] leading-relaxed">
              We detected <span className="text-[#FFE600] font-semibold">{approvedKpis.length} approved metrics</span>. 
              The system will enrich these metrics with business purpose statements, detailed calculation rules, metadata assumptions, and visual design requirements.
            </p>
          </div>
          <div>
            <button className="button-yellow" disabled={generating} onClick={generateSpec}>
              {generating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {generating ? "Synthesizing Specification..." : "Generate Functional Specification"}
            </button>
          </div>
        </section>
      ) : (
        /* State: Specifications generated and ready to view in a unified layout */
        <div className="space-y-8 max-w-6xl mx-auto">
          
          {/* Top Sticky/Control Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm gap-4 sticky top-0 z-10 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-widest text-[#FFE600] uppercase">Document Status</span>
              {isApproved ? (
                <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <Check size={10} />
                  Approved Specification Package
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Draft Specification Package
                </span>
              )}
              {saveStatus && <span className="text-xs text-[#FFE600] animate-pulse">{saveStatus}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
              {/* Export buttons */}
              <div className="flex items-center gap-2">
                {specExport?.available ? (
                  specExport.formats.map((format) => (
                    <a
                      key={format}
                      href={exportUrl("functional_document", format)}
                      className="button-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                      id={`export-${format.toLowerCase()}`}
                    >
                      <Download size={12} />
                      Download {format}
                    </a>
                  ))
                ) : (
                  <span className="text-[11px] text-[#B0B0B0]/40">Compiling exports...</span>
                )}
              </div>

              {/* Approve / Reopen triggers */}
              {!isApproved ? (
                <button 
                  className="button-secondary !py-1.5 !px-3 !text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-1.5" 
                  onClick={approveSpecification}
                  id="approve-spec-btn"
                >
                  <CheckCircle size={14} />
                  Approve Package
                </button>
              ) : (
                <button 
                  className="button-secondary !py-1.5 !px-3 !text-xs border border-[#303030] text-[#B0B0B0] hover:border-yellow-500/30 hover:text-yellow-400 flex items-center gap-1.5" 
                  onClick={reopenSpec}
                  id="reopen-spec-btn"
                >
                  <RefreshCw size={14} />
                  Reopen to Edit
                </button>
              )}

              {/* Re-synthesize button */}
              <button 
                className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5" 
                onClick={generateSpec} 
                disabled={generating}
                id="re-synthesize-spec-btn"
              >
                <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
                Re-synthesize Spec
              </button>
            </div>
          </div>

          {/* SINGLE CONSOLIDATED DOCUMENT PANEL */}
          <div className="space-y-12 bg-[#1B1B1B]/40 border border-[#303030] p-8 md:p-12 rounded-sm shadow-xl relative">
            
            {/* Title / Cover Section */}
            <div id="section-metadata" className="border-b border-[#303030] pb-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#FFE600]">KPI Advisory & Analytics</p>
                <h1 className="text-4xl font-extrabold tracking-tight text-[#F5F5F5]">Functional Specification Document</h1>
                <p className="text-sm text-[#B0B0B0] italic max-w-2xl">
                  A unified blueprint translating business strategy into governed, measurable performance metrics.
                </p>
              </div>

              {/* Metadata Control Table */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-[#303030]/60">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Document Version</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">1.0</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Generated Date</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">
                    {spec.updated_at ? new Date(spec.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft Date'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Number of KPIs</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{spec.items.length} Approved Performance Metrics</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Industry</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{context.industry || "Not Specified"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Organizational Level</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{context.organization_level || "Not Specified"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Approval Status</p>
                  <div className="mt-1">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Approved Spec
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Draft Spec
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Table of Contents */}
            <div className="bg-[#111111]/60 border border-[#303030] p-6 rounded-sm space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">Table of Contents</p>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <a href="#section-metadata" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  Document Control & Metadata
                </a>
                <a href="#section-exec-summary" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  1. Executive Summary
                </a>
                <a href="#section-kpi-landscape" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  2. KPI Landscape Overview
                </a>
                <a href="#section-traceability" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  3. Strategic Traceability Matrix
                </a>
                <a href="#section-kpi-specs" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  4. Individual KPI Specifications ({spec.items.length})
                </a>
                <a href="#section-governance" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  5. Governance Framework
                </a>
                <a href="#section-reporting" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  6. Reporting & Dashboard Requirements
                </a>
                <a href="#section-assumptions" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  7. Assumptions & Constraints
                </a>
                <a href="#section-implementation" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  8. Implementation Considerations
                </a>
                <a href="#section-appendix" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  9. Appendix
                </a>
              </div>
            </div>

            {/* 1. Executive Summary */}
            <div id="section-exec-summary" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#F5F5F5]">1. Executive Summary</h3>
                {!isEditingExec ? (
                  <button 
                    className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1.5" 
                    onClick={() => {
                      setExecSummaryValue(spec.executive_summary || "");
                      setIsEditingExec(true);
                    }}
                    disabled={isApproved}
                    title={isApproved ? "Reopen package to edit contents" : ""}
                    id="edit-exec-summary-btn"
                  >
                    <Edit3 size={12} />
                    Edit Summary
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button className="button-secondary !py-1 !px-2.5 !text-xs" onClick={() => setIsEditingExec(false)}>Cancel</button>
                    <button className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1.5" onClick={saveExecutiveSummary} id="save-exec-summary-btn">
                      <Save size={12} />
                      Save Summary
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                This document-wide Executive Summary establishes the strategic and financial context, downstream alignment goals, and engagement scope for performance measurement governance.
              </p>

              {!isEditingExec ? (
                <div className="border border-[#303030] bg-[#111111] p-6 rounded-sm whitespace-pre-wrap text-sm leading-7 text-[#D5D5D5] border-l-4 border-l-[#FFE600]">
                  {spec.executive_summary || "No executive summary available. Please click 'Edit Summary' or regenerate to establish one."}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">Executive Summary Text</label>
                  <textarea
                    className="field min-h-[250px] leading-6 text-xs w-full"
                    value={execSummaryValue}
                    onChange={(e) => setExecSummaryValue(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* 2. KPI Landscape Overview */}
            <div id="section-kpi-landscape" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">2. KPI Landscape Overview</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                The following table provides a high-level catalog of all approved performance indicators within the scope of this transformation initiative.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                      <th className="p-3 border-r border-[#303030] w-24">KPI ID</th>
                      <th className="p-3 border-r border-[#303030]">KPI Name</th>
                      <th className="p-3 border-r border-[#303030] w-40">Category</th>
                      <th className="p-3 w-40">Functional Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303030]">
                    {spec.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors">
                        <td className="p-3 border-r border-[#303030] font-mono text-[#FFE600]">KPI-{String(idx + 1).padStart(3, '0')}</td>
                        <td className="p-3 border-r border-[#303030] font-semibold text-[#F5F5F5]">
                          <a href={`#kpi-${item.id}`} className="hover:underline text-[#FFE600]">
                            {item.kpi_name}
                          </a>
                        </td>
                        <td className="p-3 border-r border-[#303030] text-[#B0B0B0]">{item.kpi_category || "Operational"}</td>
                        <td className="p-3 text-[#B0B0B0]">{item.functional_area || "Operations"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Strategic Traceability Matrix */}
            <div id="section-traceability" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">3. Strategic Traceability Matrix</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                This matrix illustrates the strategic alignment from executive objectives down to specific key performance indicators, providing visibility into strategic translation.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                      <th className="p-3 border-r border-[#303030] w-1/5">Strategic Objective</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">Business Challenge</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">KRA</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">Functional Area</th>
                      <th className="p-3 w-1/5">KPI Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303030]">
                    {spec.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                        <td className="p-3 border-r border-[#303030] text-xs">{item.strategic_objective_supported || "Optimize Strategy"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.business_challenge_addressed || "Inefficient Processes"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.related_kra || "Operational Excellence"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.functional_area || "Operations"}</td>
                        <td className="p-3 font-semibold text-[#FFE600] text-xs">
                          <a href={`#kpi-${item.id}`} className="hover:underline">
                            {item.kpi_name}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Individual KPI Specifications */}
            <div id="section-kpi-specs" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">4. Individual KPI Specifications</h3>
                  <p className="text-xs text-[#B0B0B0] leading-relaxed mt-1">
                    Detailed functional blueprints for each approved metric, outlining definitions, lineage, calculations, and rules.
                  </p>
                </div>

                <div className="flex gap-3 text-xs shrink-0 bg-[#111111] border border-[#303030] px-3 py-1.5 rounded-sm">
                  <button className="text-[#B0B0B0] hover:text-[#FFE600] font-semibold transition" onClick={expandAllKpis}>Expand All</button>
                  <span className="text-[#303030]">|</span>
                  <button className="text-[#B0B0B0] hover:text-[#FFE600] font-semibold transition" onClick={collapseAllKpis}>Collapse All</button>
                </div>
              </div>

              {/* Loop over spec items */}
              <div className="space-y-8">
                {spec.items.map((item, index) => {
                  const isKpiExpanded = !!expandedKpis[item.id];
                  const isKpiEditing = editingItem?.id === item.id;
                  
                  return (
                    <div 
                      key={item.id} 
                      id={`kpi-${item.id}`} 
                      className="border border-[#303030] bg-[#1c1c1e]/40 rounded-sm overflow-hidden space-y-4 relative scroll-mt-24"
                    >
                      {/* Left accent border to indicate status/category */}
                      <div className="absolute left-0 top-0 h-full w-1 bg-[#FFE600]" />
                      
                      {/* Card Header */}
                      <div className="flex justify-between items-center bg-[#1B1B1B] px-6 py-4 border-b border-[#303030]/60">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#FFE600] bg-[#FFE600]/10 px-2.5 py-1 border border-[#FFE600]/30 rounded-sm font-mono">
                            Metric {index + 1}
                          </span>
                          <h4 className="text-base font-bold text-[#F5F5F5]">{item.kpi_name}</h4>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {isKpiEditing ? (
                            <div className="flex gap-2">
                              <button 
                                className="button-secondary !py-1 !px-2.5 !text-xs" 
                                onClick={() => setEditingItem(null)}
                              >
                                Cancel
                              </button>
                              <button 
                                className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1" 
                                onClick={saveSpecItem}
                                id={`save-spec-${item.id}`}
                              >
                                <Save size={12} />
                                Save Updates
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                className="text-xs font-semibold text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-1 px-2.5 py-1 bg-[#111111] border border-[#303030] rounded-sm transition"
                                onClick={() => toggleKpi(item.id)}
                              >
                                {isKpiExpanded ? "Hide Details" : "Show Details"}
                              </button>
                              <button 
                                className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1" 
                                onClick={() => {
                                  setEditingItem(item);
                                  setExpandedKpis(prev => ({ ...prev, [item.id]: true }));
                                }}
                                disabled={isApproved}
                                title={isApproved ? "Reopen package to edit contents" : ""}
                                id={`edit-spec-${item.id}`}
                              >
                                <Edit3 size={12} />
                                Edit Spec
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="px-6 pb-6 pt-2 space-y-6">
                        {/* Quality Validation Warnings */}
                        {item.validation_warnings && item.validation_warnings.length > 0 && (
                          <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-sm text-xs space-y-1">
                            <div className="font-bold text-[#FF3B30] flex items-center gap-1.5">
                              <AlertCircle size={14} /> Quality Validation Warnings ({item.validation_warnings.length})
                            </div>
                            <ul className="list-disc pl-4 text-[#E5E5EA] space-y-1">
                              {item.validation_warnings.map((w, wIdx) => (
                                <li key={wIdx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Quick Reference Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#111111]/60 p-4 border border-[#303030]/50 rounded-sm text-xs">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">KPI Category</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.kpi_category || "Operational"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Functional Area</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.functional_area || "Operations"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Business Owner</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.business_owner || "TBD"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Data Owner</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.data_owner || "TBD"}</p>
                          </div>
                        </div>

                        {/* Expanded details block */}
                        {isKpiExpanded && (
                          <div className="space-y-6 border-t border-[#303030]/40 pt-4">
                            {/* Strategic Traceability mapping banner inside card */}
                            {(() => {
                              let parts = [
                                item.strategic_objective_supported || "Strategic Objective",
                                item.business_challenge_addressed || "Business Challenge",
                                item.related_kra || "KRA",
                                item.functional_area || "Functional Area",
                                item.kpi_name
                              ];
                              const traceStr = item.strategic_objective_supported || "";
                              if (traceStr.includes(" &rarr; ") || traceStr.includes(" → ")) {
                                const separator = traceStr.includes(" &rarr; ") ? " &rarr; " : " → ";
                                const parsed = traceStr.split(separator).map(s => s.trim());
                                if (parsed.length > 0) {
                                  parts = parsed;
                                  if (parts[parts.length - 1] !== item.kpi_name) {
                                    parts.push(item.kpi_name);
                                  }
                                }
                              }
                              
                              return (
                                <div className="bg-[#111111]/40 border border-[#303030]/50 p-3 rounded-sm">
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#FFE600]">Strategic Alignment Traceability</div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#F5F5F5] pt-1 font-semibold">
                                    {parts.map((part, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        <span className={idx === parts.length - 1 ? "text-[#FFE600] font-bold" : "text-[#B0B0B0]"}>
                                          {part}
                                        </span>
                                        {idx < parts.length - 1 && (
                                          <span className="text-[#FFE600]/60">&rarr;</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {isKpiEditing ? (
                              /* Editing Mode Form */
                              <div className="space-y-6">
                                {sectionConfigs.map((sect) => (
                                  <div key={sect.id} className="space-y-3 bg-[#111111]/30 p-4 border border-[#303030]/60 rounded-sm">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#FFE600] border-b border-[#303030]/60 pb-1">
                                      {sect.title}
                                    </h5>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {sect.fields.map((field) => {
                                        const val = (editingItem[field.key as keyof FunctionalSpecItem] as string) || "";
                                        const isSpan = sect.fields.length === 1 || field.key === "strategic_objective_supported" || field.key === "business_challenge_addressed" || field.key === "calculation_methodology" || field.key === "inclusion_rules" || field.key === "exclusion_rules";
                                        return (
                                          <div key={field.key} className={`space-y-1.5 ${isSpan ? "md:col-span-2" : ""}`}>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#B0B0B0]">{field.label}</label>
                                            {field.type === "input" ? (
                                              <input
                                                type="text"
                                                className="field w-full text-xs"
                                                value={val}
                                                onChange={(e) => handleFieldChange(field.key as keyof FunctionalSpecItem, e.target.value)}
                                              />
                                            ) : (
                                              <textarea
                                                className="field w-full min-h-20 leading-relaxed text-xs"
                                                value={val}
                                                onChange={(e) => handleFieldChange(field.key as keyof FunctionalSpecItem, e.target.value)}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Read Only Subsections Display */
                              <div className="space-y-6">
                                {sectionConfigs.map((sect) => (
                                  <div key={sect.id} className="space-y-3">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#FFE600] border-b border-[#303030]/40 pb-1">
                                      {sect.title}
                                    </h5>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {sect.fields.map((field) => {
                                        const val = item[field.key as keyof FunctionalSpecItem] || "";
                                        const isSpan = sect.fields.length === 1 || field.key === "strategic_objective_supported" || field.key === "business_challenge_addressed" || field.key === "calculation_methodology" || field.key === "inclusion_rules" || field.key === "exclusion_rules";
                                        return (
                                          <div key={field.key} className={`space-y-1 ${isSpan ? "md:col-span-2" : ""}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B0B0B0]">{field.label}</p>
                                            <p className="text-xs leading-relaxed text-[#F5F5F5] whitespace-pre-wrap bg-[#111111]/30 p-3 border border-[#303030]/40 rounded-sm">
                                              {val || <span className="text-[#B0B0B0]/30 italic">Not specified</span>}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Governance Framework */}
            <div id="section-governance" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">5. Governance Framework</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                To ensure metric consistency, accountability, and ongoing relevance, a formal governance framework is established for all approved KPIs. This structure assigns clear responsibilities and defines escalation paths.
              </p>

              {/* Roles & Responsibilities */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">Roles and Responsibilities</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Business Owner: </strong>
                    Responsible for defining the business logic, validating calculation results, approving target thresholds, and driving operational performance based on metric insights.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Data Owner: </strong>
                    Accountable for technical lineage, data completeness, source-to-target mapping, ETL data quality checks, and resolving data ingestion or availability issues.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Escalation Path: </strong>
                    In case of data quality discrepancies or alignment disputes, issues are escalated to the Data Governance Committee and KPI Advisory Board for review and reconciliation.
                  </li>
                </ul>
              </div>

              {/* Ownership and Governance Matrix Table */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Ownership & Governance Matrix</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                    <thead>
                      <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                        <th className="p-3 border-r border-[#303030] w-1/4">Metric Name</th>
                        <th className="p-3 border-r border-[#303030] w-1/5">Business Owner</th>
                        <th className="p-3 border-r border-[#303030] w-1/5">Data Owner</th>
                        <th className="p-3">Governance Policy Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#303030]">
                      {spec.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                          <td className="p-3 border-r border-[#303030] font-semibold text-[#FFE600]">
                            <a href={`#kpi-${item.id}`} className="hover:underline">{item.kpi_name}</a>
                          </td>
                          <td className="p-3 border-r border-[#303030] text-xs">{item.business_owner || "Business Sponsor"}</td>
                          <td className="p-3 border-r border-[#303030] text-xs">{item.data_owner || "Data Custodian"}</td>
                          <td className="p-3 text-xs leading-relaxed">{item.ownership_governance || "Subject to standard quarterly advisory audits and performance reviews."}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 6. Reporting & Dashboard Requirements */}
            <div id="section-reporting" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">6. Reporting & Dashboard Requirements</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                Visualization layout and threshold criteria dictate how data is displayed to support decision-making. The matrix below outlines reporting recommendations and performance thresholds for each metric.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                      <th className="p-3 border-r border-[#303030] w-1/4">Metric Name</th>
                      <th className="p-3 border-r border-[#303030] w-1/4">Reporting Guidelines</th>
                      <th className="p-3 border-r border-[#303030] w-1/4">Dashboard Placement</th>
                      <th className="p-3">Threshold Guidance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303030]">
                    {spec.items.map((item) => {
                      const get_default_reporting = (category: string) => {
                        const cat = (category || "").toLowerCase();
                        if (cat.includes("financial")) return "Monthly trended charts, quarterly variance reporting, and margin analysis. Drill down capability by cost center and profit center.";
                        if (cat.includes("operational")) return "Weekly performance run-charts, daily process monitor scorecards. Comparative tracking against prior 30-day rolling averages.";
                        if (cat.includes("strategic")) return "C-Suite quarterly scorecards, progress bars against annual target milestones, and executive summaries.";
                        return "Standard monthly performance dashboard, with trailing 12-month trend charts and period-over-period variance metrics.";
                      };

                      const get_default_threshold = (category: string) => {
                        const cat = (category || "").toLowerCase();
                        if (cat.includes("financial")) return "Green: Within +/- 2% of budget target. Amber: 2% to 5% variance. Red: > 5% variance or actual spend exceeding budget.";
                        if (cat.includes("operational")) return "Green: Meets or exceeds 95% operating efficiency. Amber: 90% to 94% efficiency. Red: < 90% operating efficiency.";
                        if (cat.includes("strategic")) return "Green: Project milestone achieved on time. Amber: 1-2 weeks delay in milestone. Red: > 2 weeks delay in critical path.";
                        return "Green: Target achieved or exceeded. Amber: 5% to 10% negative variance from target. Red: > 10% negative variance.";
                      };

                      const defRep = get_default_reporting(item.kpi_category || "");
                      const defThresh = get_default_threshold(item.kpi_category || "");
                      const repVal = item.reporting_requirements || defRep;
                      const dashVal = item.dashboard_recommendations || "Standard Performance Dashboard.";
                      const threshVal = item.threshold_guidance || defThresh;

                      return (
                        <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                          <td className="p-3 border-r border-[#303030] font-semibold text-[#FFE600]">
                            <a href={`#kpi-${item.id}`} className="hover:underline">{item.kpi_name}</a>
                          </td>
                          <td className="p-3 border-r border-[#303030] text-xs leading-relaxed">{repVal}</td>
                          <td className="p-3 border-r border-[#303030] text-xs leading-relaxed">{dashVal}</td>
                          <td className="p-3 text-xs leading-relaxed">{threshVal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. Assumptions & Constraints */}
            <div id="section-assumptions" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">7. Assumptions & Constraints</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                A clear understanding of business and technical assumptions is critical for successful implementation. The following list represents consolidated baseline assumptions and constraints.
              </p>

              {/* General Architectural Assumptions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">General Architectural Assumptions</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Data Availability: </strong>
                    Source transactional tables are assumed to be loaded into the central reporting repository on a standard nightly batch cadence.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Fiscal Calendar: </strong>
                    Standard calendar year rules are assumed unless otherwise explicitly documented in specific financial indicators.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">System Uptime: </strong>
                    Target source ERP ledgers are assumed to maintain 99.5% uptime during standard reporting extraction windows.
                  </li>
                </ul>
              </div>

              {/* Metric-Specific Assumptions */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Metric-Specific Assumptions and Limitations</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  {spec.items.map((item) => {
                    const cleanedAsm = (item.assumptions_constraints || "").trim();
                    if (!cleanedAsm || cleanedAsm.toLowerCase() === "not specified") return null;
                    return (
                      <li key={item.id}>
                        <strong className="text-[#F5F5F5]">{item.kpi_name}: </strong>
                        {cleanedAsm}
                      </li>
                    );
                  })}
                  {spec.items.every(item => !(item.assumptions_constraints || "").trim() || (item.assumptions_constraints || "").trim().toLowerCase() === "not specified") && (
                    <li className="italic text-gray-500">No custom metric-specific assumptions defined.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* 8. Implementation Considerations */}
            <div id="section-implementation" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">8. Implementation Considerations</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                Transitioning these specifications into functional BI tools requires rigorous testing, change management, and data reconciliation. Standard implementation considerations are outlined below.
              </p>

              {/* Standard Implementation Guidelines */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">Standard Implementation Guidelines</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Data Reconciliation: </strong>
                    All KPI calculation outcomes must be audited and reconciled against official books of record or audited financial statements.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">User Acceptance Testing (UAT): </strong>
                    Business owners must perform visual and numeric validation of dashboard mockups prior to production sign-off.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Change Management: </strong>
                    Training sessions and clear system documentation are required to support user onboarding and ensure high organizational adoption.
                  </li>
                </ul>
              </div>

              {/* Metric-Specific Technical Considerations */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Metric-Specific Technical Considerations</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  {spec.items.map((item) => {
                    const cleanedImp = (item.implementation_guidance || "").trim();
                    if (!cleanedImp || cleanedImp.toLowerCase() === "not specified") return null;
                    return (
                      <li key={item.id}>
                        <strong className="text-[#F5F5F5]">{item.kpi_name}: </strong>
                        {cleanedImp}
                      </li>
                    );
                  })}
                  {spec.items.every(item => !(item.implementation_guidance || "").trim() || (item.implementation_guidance || "").trim().toLowerCase() === "not specified") && (
                    <li className="italic text-gray-500">No custom metric-specific considerations defined.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* 9. Appendix */}
            <div id="section-appendix" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">9. Appendix</h3>
              
              {/* KPI Glossary */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">KPI Glossary</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">KPI (Key Performance Indicator): </strong>A quantifiable measure used to evaluate the success of an organization or activity in meeting performance objectives.</li>
                  <li><strong className="text-[#F5F5F5]">KRA (Key Result Area): </strong>Primary focus areas of outcomes or outputs for which an organizational unit or role is responsible.</li>
                  <li><strong className="text-[#F5F5F5]">Numerator: </strong>The upper portion of a division representing the measured subset of occurrences.</li>
                  <li><strong className="text-[#F5F5F5]">Denominator: </strong>The lower portion of a division representing the total base population.</li>
                </ul>
              </div>

              {/* Data Quality Principles */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Data Quality Principles</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">Accuracy: </strong>Data correctly represents the real-world operational event it records.</li>
                  <li><strong className="text-[#F5F5F5]">Completeness: </strong>All necessary dataset components are present without omission.</li>
                  <li><strong className="text-[#F5F5F5]">Consistency: </strong>Metrics align across various systems, business units, and report interfaces.</li>
                  <li><strong className="text-[#F5F5F5]">Timeliness: </strong>Updates occur within the required reporting cadence and operational windows.</li>
                </ul>
              </div>

              {/* Acronym Reference */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Acronym Reference</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">ERP: </strong>Enterprise Resource Planning</li>
                  <li><strong className="text-[#F5F5F5]">SAP FI-CO: </strong>Financial Accounting & Controlling</li>
                  <li><strong className="text-[#F5F5F5]">SAP SD: </strong>Sales & Distribution</li>
                  <li><strong className="text-[#F5F5F5]">SAP MM: </strong>Materials Management</li>
                  <li><strong className="text-[#F5F5F5]">BI / DWH: </strong>Business Intelligence / Data Warehouse</li>
                  <li><strong className="text-[#F5F5F5]">UAT: </strong>User Acceptance Testing</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
