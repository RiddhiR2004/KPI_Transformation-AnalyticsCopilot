import { useEffect, useState, useMemo } from "react";
import { AlertCircle, Check, CheckCircle, ChevronRight, Download, Loader2, Play, Printer, RefreshCw, Edit3, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import {
  TechnicalDataMapping,
  TechnicalDataMappingItem,
  ClientProfile,
  ExportItem,
} from "../types/api";

export function TechnicalDataMappingPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [mapping, setMapping] = useState<TechnicalDataMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);

  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [activeSection, setActiveSection] = useState<"synopsis" | "detailed" | "dimensions">("synopsis");
  const [previewPageNum, setPreviewPageNum] = useState(1);
  const totalPages = 7;
  const [editingItem, setEditingItem] = useState<TechnicalDataMappingItem | null>(null);
  const [expandedKpis, setExpandedKpis] = useState<Record<string, boolean>>({});
  
  const [isEditingExec, setIsEditingExec] = useState(false);
  const [execSummaryValue, setExecSummaryValue] = useState("");
  const [docName, setDocName] = useState("");

  const tdmExport = exports.find((e) => e.id === "technical_mapping");

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (clientProfile && clientProfile.client_name && (docName === "" || docName === "KPI_Technical_Data_Mapping")) {
      const clientPart = clientProfile.client_name.trim().replace(/\s+/g, "_");
      const industryPart = (clientProfile.industry || "").trim().replace(/\s+/g, "_");
      const parts = [];
      if (clientPart) parts.push(clientPart);
      if (industryPart) parts.push(industryPart);
      parts.push("KPI_Technical_Data_Mapping");
      setDocName(parts.join("_"));
    } else if (!docName) {
      setDocName("KPI_Technical_Data_Mapping");
    }
  }, [clientProfile]);

  async function fetchData() {
    try {
      setLoading(true);
      const data = await api.getTechnicalMapping();
      if (!data.items) {
        data.items = [];
      }
      setMapping(data);
      setExecSummaryValue(data.executive_summary || "");
      try {
        const profile = await api.getClientProfile();
        setClientProfile(profile);
      } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function generateMapping() {
    setGenerating(true);
    setError("");
    try {
      const data = await api.generateTechnicalMapping();
      setMapping(data);
      setExecSummaryValue(data.executive_summary || "");
      
      const initialExpanded: Record<string, boolean> = {};
      data.items.forEach((item: TechnicalDataMappingItem) => {
        initialExpanded[item.id] = true;
      });
      setExpandedKpis(initialExpanded);

      setSaveStatus("Technical Data Mapping generated");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveMappingItem() {
    if (!editingItem || !mapping) return;
    
    const updatedItems = mapping.items.map((item) =>
      item.id === editingItem.id ? editingItem : item
    );
    const updatedMapping = { ...mapping, items: updatedItems, status: "draft" };
    
    setSaveStatus("Saving Draft...");
    try {
      await api.saveTechnicalMapping(updatedMapping);
      setMapping(updatedMapping);
      setEditingItem(null);
      setSaveStatus("Changes saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError("Failed to save updates");
    }
  }

  async function saveExecutiveSummary() {
    if (!mapping) return;
    const updatedMapping = { ...mapping, executive_summary: execSummaryValue, status: "draft" };
    setSaveStatus("Saving Draft...");
    try {
      await api.saveTechnicalMapping(updatedMapping);
      setMapping(updatedMapping);
      setIsEditingExec(false);
      setSaveStatus("Executive summary saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError("Failed to save executive summary updates");
    }
  }

  async function approveMapping() {
    setSaveStatus("Approving Document...");
    try {
      await api.approveTechnicalMapping();
      setMapping((prev) => prev ? { ...prev, status: "approved" } : null);
      onChange();
      setSaveStatus("Technical Data Mapping Approved!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve document");
    }
  }

  async function reopenMapping() {
    if (!mapping) return;
    setSaveStatus("Reopening Document...");
    try {
      const updatedMapping = { ...mapping, status: "draft" };
      await api.saveTechnicalMapping(updatedMapping);
      setMapping(updatedMapping);
      onChange();
      setSaveStatus("Document reopened to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError("Failed to reopen document");
    }
  }

  async function handleExport(format: "pdf" | "docx") {
    if (!mapping?.items.length) return;
    try {
      const url = exportUrl("technical_mapping", format);
      const clientName = clientProfile?.client_name?.replace(/\s+/g, '_') || "Client";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clientName}_Technical_Data_Mapping.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError("Export failed");
    }
  }

  const toggleKpi = (id: string) => {
    setExpandedKpis((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditItem = (item: TechnicalDataMappingItem) => {
    setEditingItem({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  // Group KPIs by Functional Area
  const groupedKpis = useMemo(() => {
    if (!mapping?.items) return {};
    return mapping.items.reduce((acc, kpi) => {
      const area = kpi.type_of_kpi || "Uncategorized";
      if (!acc[area]) acc[area] = [];
      acc[area].push(kpi);
      return acc;
    }, {} as Record<string, TechnicalDataMappingItem[]>);
  }, [mapping?.items]);

  // Priority Matrix Calculation for KPI Synopsis
  const priorityMatrix = useMemo(() => {
    if (!mapping?.items) return [];
    
    const areas = Object.keys(groupedKpis);
    return areas.map(area => {
      const kpis = groupedKpis[area];
      const l1 = kpis.filter(k => k.priority === "L1").length;
      const l2 = kpis.filter(k => k.priority === "L2").length;
      const l3 = kpis.filter(k => k.priority === "L3").length;
      return { area, l1, l2, l3, total: l1 + l2 + l3 };
    });
  }, [groupedKpis, mapping?.items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ey-yellow"></div>
      </div>
    );
  }

  const isApproved = mapping?.status === "approved";
  const hasData = mapping && mapping.items && mapping.items.length > 0;

  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030] mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 05</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Technical Data Mapping Studio</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Generate and validate the technical implementation blueprints for approved KPIs.
        </p>
      </section>

      <div className="space-y-6">
        {error && !error.includes("RESOURCE_EXHAUSTED") && !error.includes("Quota exceeded") && !error.includes("429") && (
          <div className="border border-red-900 bg-red-950/30 p-4 text-xs text-red-400 flex items-start gap-3 mb-6">
            <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Quota Limit Popup Modal */}
        {(error.includes("RESOURCE_EXHAUSTED") || error.includes("Quota exceeded") || error.includes("429")) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#111111] border border-[#303030] rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-[#303030] flex items-center gap-4 bg-red-950/20">
                <div className="p-3 bg-red-500/10 rounded-full flex-shrink-0">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">API Quota Exhausted</h3>
                  <p className="text-sm text-[#B0B0B0] mt-1">You have hit the daily Free-Tier limits for the AI Provider.</p>
                </div>
              </div>
              <div className="p-6 space-y-4 text-sm text-[#B0B0B0]">
                <p>
                  The configured Google Gemini model has reached its usage limit (20 requests/day on the free tier).
                </p>
                {error.match(/retry in ([\d\.]+)s/) && (
                  <div className="bg-[#1A1A1A] border border-[#303030] p-4 rounded-md flex justify-between items-center">
                    <span className="font-semibold text-[#F5F5F5]">Cooldown Timer:</span>
                    <span className="text-[#FFE600] font-mono font-bold">
                      {Math.ceil(parseFloat(error.match(/retry in ([\d\.]+)s/)![1]))} seconds
                    </span>
                  </div>
                )}
                <p className="text-xs text-[#B0B0B0] border-t border-[#303030] pt-4 mt-4">
                  <strong>Developer Note:</strong> To increase limits, update your API Key to a paid billing account, or wait for the cooldown timer to reset.
                </p>
              </div>
              <div className="p-4 bg-[#1A1A1A] border-t border-[#303030] flex justify-end">
                <button
                  onClick={() => setError("")}
                  className="px-4 py-2 bg-[#1B1B1B] text-black text-sm font-bold rounded hover:bg-gray-200 transition-colors"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}

        {!hasData ? (
          <div className="text-center py-16 px-4">
            <svg className="mx-auto h-12 w-12 text-[#B0B0B0] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-[#F5F5F5] mb-2">No Technical Mappings Generated</h3>
            <p className="text-[#B0B0B0] mb-6 max-w-md mx-auto">
              You haven't generated the technical data mapping yet. Click below to use AI to build the engineering blueprint based on the functional specifications.
            </p>
            <button
              onClick={generateMapping}
              disabled={generating}
              className="button-yellow !px-6 !py-3 flex items-center justify-center mx-auto"
            >
              {generating ? (
                <>
                  <Loader2 size={20} className="animate-spin mr-3" />
                  Generating Mappings...
                </>
              ) : (
                <>
                  <Play size={20} className="mr-2 -ml-1" />
                  Generate Technical Mapping
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Top Sticky/Control Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm gap-4 sticky top-0 z-40 shadow-lg">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest text-[#FFE600] uppercase">Document Status</span>
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <Check size={10} />
                    Approved Technical Mapping
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Draft Technical Mapping
                  </span>
                )}
                {saveStatus && <span className="text-xs text-[#FFE600] animate-pulse">{saveStatus}</span>}

                {/* Tab Swapper */}
                <div className="flex bg-[#111111] p-1 rounded-sm border border-[#303030] sm:ml-4 shrink-0">
                  <button
                    type="button"
                    className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${
                      activeTab === "editor"
                        ? "bg-[#FFE600] text-black"
                        : "text-[#B0B0B0] hover:text-[#F5F5F5]"
                    }`}
                    onClick={() => setActiveTab("editor")}
                  >
                    Document Editor
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${
                      activeTab === "preview"
                        ? "bg-[#FFE600] text-black"
                        : "text-[#B0B0B0] hover:text-[#F5F5F5]"
                    }`}
                    onClick={() => setActiveTab("preview")}
                  >
                    Document Preview
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                {/* Document Name Customization */}
                <div className="flex items-center gap-2 bg-[#111111] px-2 py-1.5 rounded-sm border border-[#303030]">
                  <span className="text-[10px] font-bold tracking-widest text-[#B0B0B0] uppercase whitespace-nowrap">Doc Name:</span>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Enter document name..."
                    className="bg-transparent text-xs text-[#F5F5F5] placeholder-gray-600 focus:outline-none w-48 sm:w-64"
                  />
                </div>

                {/* Export buttons */}
                <div className="flex items-center gap-2">
                  {tdmExport?.available ? (
                    tdmExport.formats.map((format) => (
                      <a
                        key={format}
                        href={`${exportUrl("technical_mapping", format)}${exportUrl("technical_mapping", format).includes('?') ? '&' : '?'}doc_name=${encodeURIComponent(docName)}`}
                        download={`${docName || "KPI_Technical_Data_Mapping"}.${format.toLowerCase()}`}
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
                    onClick={approveMapping}
                    id="approve-mapping-btn"
                  >
                    <CheckCircle size={14} />
                    Approve Document
                  </button>
                ) : (
                  <button 
                    className="button-secondary !py-1.5 !px-3 !text-xs border border-[#303030] text-[#B0B0B0] hover:border-yellow-500/30 hover:text-yellow-400 flex items-center gap-1.5" 
                    onClick={reopenMapping}
                    id="reopen-mapping-btn"
                  >
                    <RefreshCw size={14} />
                    Reopen to Edit
                  </button>
                )}

                {/* Proceed to Next Step */}
                {isApproved && (
                  <Link
                    to="/step-6"
                    className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                  >
                    Proceed to Dashboard & Visualization Design
                    <ChevronRight size={14} />
                  </Link>
                )}

                {/* Print Button (only shown in preview tab) */}
                {activeTab === "preview" && (
                  <button
                    type="button"
                    className="button-secondary !py-1.5 !px-3 !text-xs border border-gray-500 text-gray-300 hover:bg-gray-500/10 flex items-center gap-1.5"
                    onClick={() => window.print()}
                    id="print-spec-btn"
                  >
                    <Printer size={12} />
                    Print / PDF
                  </button>
                )}

                {/* Re-synthesize button */}
                <button 
                  className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5" 
                  onClick={generateMapping} 
                  disabled={generating}
                  id="re-synthesize-mapping-btn"
                >
                  <Loader2 size={12} className={generating ? "animate-spin" : ""} />
                  Re-synthesize Mapping
                </button>
              </div>
            </div>

            {activeTab === "editor" ? (
              <div className="space-y-8 bg-[#1B1B1B] border border-[#303030] p-8 md:p-12 rounded-sm relative">
                {/* 1. Executive Summary */}
                <div id="section-exec-summary" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#F5F5F5]">1. Executive Summary</h3>
                    {!isEditingExec ? (
                      <button 
                        className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1.5" 
                        onClick={() => {
                          setExecSummaryValue(mapping?.executive_summary || "");
                          setIsEditingExec(true);
                        }}
                        disabled={isApproved}
                        title={isApproved ? "Reopen document to edit contents" : ""}
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
                    This document-wide Executive Summary establishes the technical context, downstream alignment goals, and engineering specifications for performance measurement governance.
                  </p>

                  {!isEditingExec ? (
                    <div className="border border-[#303030] bg-[#111111] p-6 rounded-sm whitespace-pre-wrap text-sm leading-7 text-[#D5D5D5] border-l-4 border-l-[#FFE600]">
                      {execSummaryValue || "No executive summary provided. Please click 'Edit Summary' or regenerate to establish one."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">Executive Summary Text</label>
                      <textarea
                        className="field min-h-[250px] leading-6 text-xs w-full bg-[#111111] text-[#F5F5F5]"
                        value={execSummaryValue}
                        onChange={(e) => setExecSummaryValue(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                
                {/* Section Tabs */}
                <div className="flex border-b border-[#303030] mt-8 mb-0">
                  <button
                    onClick={() => setActiveSection("synopsis")}
                    className={`py-2 px-6 text-sm font-bold border-b-2 transition-colors ${
                      activeSection === "synopsis"
                        ? "border-[#FFE600] text-[#FFE600]"
                        : "border-transparent text-[#B0B0B0] hover:text-[#F5F5F5] hover:border-[#303030]"
                    }`}
                  >
                    KPI Synopsis
                  </button>
                  <button
                    onClick={() => setActiveSection("detailed")}
                    className={`py-2 px-6 text-sm font-bold border-b-2 transition-colors ${
                      activeSection === "detailed"
                        ? "border-[#FFE600] text-[#FFE600]"
                        : "border-transparent text-[#B0B0B0] hover:text-[#F5F5F5] hover:border-[#303030]"
                    }`}
                  >
                    Detailed KPIs
                  </button>
                  <button
                    onClick={() => setActiveSection("dimensions")}
                    className={`py-2 px-6 text-sm font-bold border-b-2 transition-colors ${
                      activeSection === "dimensions"
                        ? "border-[#FFE600] text-[#FFE600]"
                        : "border-transparent text-[#B0B0B0] hover:text-[#F5F5F5] hover:border-[#303030]"
                    }`}
                  >
                    Dimension List
                  </button>
                </div>
                {activeSection === "synopsis" && (
                <div className="space-y-6">
                {/* KPI Synopsis Grid */}
                <div className="bg-[#1B1B1B] p-6 rounded-lg border border-[#303030] shadow-sm">
                  <h3 className="text-lg font-medium text-[#F5F5F5] mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-[#B0B0B0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    KPI Synopsis
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#111111]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">Functional Area</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">L1</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">L2</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">L3</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#B0B0B0] uppercase tracking-wider font-bold">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#1B1B1B] divide-y divide-gray-200">
                        {priorityMatrix.map((row) => (
                          <tr key={row.area}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#F5F5F5]">{row.area}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#B0B0B0] text-center">{row.l1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#B0B0B0] text-center">{row.l2}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#B0B0B0] text-center">{row.l3}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#F5F5F5] text-center bg-[#111111]">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                                </div>
                )}

                {activeSection === "detailed" && (
                <div className="space-y-6">
                  {/* KPI Editor List */}
                  {Object.entries(groupedKpis).map(([area, kpis]) => (
                    <div key={area} className="mb-8">
                      <h4 className="text-lg font-bold text-[#F5F5F5] mb-4 border-b pb-2 flex items-center">
                        <span className="w-2 h-6 bg-ey-yellow mr-3"></span>
                        {area}
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {kpis.length} metrics
                        </span>
                      </h4>
                      
                      <div className="space-y-4">
                        {kpis.map((item, index) => {
                          const isEditing = editingItem?.id === item.id;
                          const currentItem = isEditing ? editingItem : item;
                          const isExpanded = expandedKpis[item.id];
                          
                          return (
                            <div key={item.id} className="bg-[#1B1B1B] border border-[#303030] rounded-lg shadow-sm overflow-hidden transition-all duration-200">
                              <div 
                                className={`px-6 py-4 flex justify-between items-center cursor-pointer ${isExpanded ? 'bg-[#111111] border-b border-[#303030]' : 'hover:bg-[#111111]'}`}
                                onClick={() => toggleKpi(item.id)}
                              >
                                <div className="flex items-center">
                                  <svg 
                                    className={`w-5 h-5 text-[#B0B0B0] mr-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="font-mono text-xs text-[#B0B0B0] mr-4 w-12">M{String(index + 1).padStart(2, '0')}</span>
                                  <h5 className="text-md font-bold text-[#F5F5F5]">{currentItem.kpi_name}</h5>
                                  <span className={`ml-4 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    currentItem.priority === 'L1' ? 'bg-purple-100 text-purple-800' :
                                    currentItem.priority === 'L2' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {currentItem.priority}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-4">
                                  {!isEditing && !isApproved && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditItem(item);
                                        setExpandedKpis(prev => ({...prev, [item.id]: true}));
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                      Edit
                                    </button>
                                  )}
                                  {isEditing && (
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); saveMappingItem(); }}
                                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                        className="text-sm text-[#B0B0B0] hover:text-gray-800"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {isExpanded && (
                                <div className="p-6">
                                  {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-bold text-[#D5D5D5]">KPI Name</label>
                                        <input
                                          type="text"
                                          value={currentItem.kpi_name}
                                          onChange={(e) => setEditingItem({ ...currentItem, kpi_name: e.target.value })}
                                          className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                        />
                                      </div>
                                      
                                      <div className="space-y-6">
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Priority Level</label>
                                          <select
                                            value={currentItem.priority}
                                            onChange={(e) => setEditingItem({ ...currentItem, priority: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          >
                                            <option value="L1">L1 - Strategic</option>
                                            <option value="L2">L2 - Operational</option>
                                            <option value="L3">L3 - Granular</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Critical to Measure</label>
                                          <input
                                            type="text"
                                            value={currentItem.critical_to_measure}
                                            onChange={(e) => setEditingItem({ ...currentItem, critical_to_measure: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Description</label>
                                          <textarea
                                            value={currentItem.description}
                                            onChange={(e) => setEditingItem({ ...currentItem, description: e.target.value })}
                                            rows={3}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Logic / Calculation</label>
                                          <textarea
                                            value={currentItem.logic_calculation}
                                            onChange={(e) => setEditingItem({ ...currentItem, logic_calculation: e.target.value })}
                                            rows={2}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-6">
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Dimensions</label>
                                          <input
                                            type="text"
                                            value={currentItem.dimensions}
                                            onChange={(e) => setEditingItem({ ...currentItem, dimensions: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Measures & UoM</label>
                                          <div className="flex space-x-2 mt-1">
                                            <input
                                              type="text"
                                              placeholder="Measures (e.g. SUM)"
                                              value={currentItem.measures}
                                              onChange={(e) => setEditingItem({ ...currentItem, measures: e.target.value })}
                                              className="block w-2/3 rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                            />
                                            <input
                                              type="text"
                                              placeholder="UoM"
                                              value={currentItem.uom}
                                              onChange={(e) => setEditingItem({ ...currentItem, uom: e.target.value })}
                                              className="block w-1/3 rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Technical Details</label>
                                          <textarea
                                            value={currentItem.technical_details}
                                            onChange={(e) => setEditingItem({ ...currentItem, technical_details: e.target.value })}
                                            rows={3}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Action Direction</label>
                                          <select
                                            value={currentItem.action}
                                            onChange={(e) => setEditingItem({ ...currentItem, action: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-[#303030] shadow-sm focus:border-ey-yellow focus:ring-ey-yellow sm:text-sm"
                                          >
                                            <option value="Improve">Improve</option>
                                            <option value="Increase">Increase</option>
                                            <option value="Grow">Grow</option>
                                            <option value="Reduce">Reduce</option>
                                            <option value="Maintain">Maintain</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Dimensions List Editor */}
                                      <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t">
                                        <div className="flex justify-between items-center mb-2">
                                          <label className="block text-sm font-bold text-[#D5D5D5]">Dimension List</label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newList = [...(currentItem.dimension_list || [])];
                                              newList.push({
                                                dimension_type: "Standard",
                                                dimension: "New Dimension",
                                                dimension_requirement: "",
                                                example: "",
                                                source_logic_table_field: "",
                                                is_further_input_required: "No",
                                                source_sap: "",
                                                table_field_sap: "",
                                                owner_if_manual: "",
                                                comments: ""
                                              });
                                              setEditingItem({ ...currentItem, dimension_list: newList });
                                            }}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-2 rounded font-medium"
                                          >
                                            + Add Dimension
                                          </button>
                                        </div>
                                        
                                        <div className="overflow-x-auto border rounded bg-[#111111]">
                                          <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-100">
                                              <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-[#B0B0B0]">Dimension Type</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-[#B0B0B0]">Dimension Name</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-[#B0B0B0]">Requirement</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-[#B0B0B0]">Source Logic</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-[#B0B0B0]"></th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                              {(currentItem.dimension_list || []).map((dim, dimIdx) => (
                                                <tr key={dimIdx} className="bg-[#1B1B1B]">
                                                  <td className="px-2 py-2">
                                                    <input 
                                                      type="text" 
                                                      value={dim.dimension_type} 
                                                      onChange={(e) => {
                                                        const newList = [...currentItem.dimension_list];
                                                        newList[dimIdx].dimension_type = e.target.value;
                                                        setEditingItem({ ...currentItem, dimension_list: newList });
                                                      }}
                                                      className="block w-full text-xs rounded border-[#303030]" 
                                                    />
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <input 
                                                      type="text" 
                                                      value={dim.dimension} 
                                                      onChange={(e) => {
                                                        const newList = [...currentItem.dimension_list];
                                                        newList[dimIdx].dimension = e.target.value;
                                                        setEditingItem({ ...currentItem, dimension_list: newList });
                                                      }}
                                                      className="block w-full text-xs rounded border-[#303030]" 
                                                    />
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <input 
                                                      type="text" 
                                                      value={dim.dimension_requirement} 
                                                      onChange={(e) => {
                                                        const newList = [...currentItem.dimension_list];
                                                        newList[dimIdx].dimension_requirement = e.target.value;
                                                        setEditingItem({ ...currentItem, dimension_list: newList });
                                                      }}
                                                      className="block w-full text-xs rounded border-[#303030]" 
                                                    />
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <input 
                                                      type="text" 
                                                      value={dim.source_logic_table_field} 
                                                      onChange={(e) => {
                                                        const newList = [...currentItem.dimension_list];
                                                        newList[dimIdx].source_logic_table_field = e.target.value;
                                                        setEditingItem({ ...currentItem, dimension_list: newList });
                                                      }}
                                                      className="block w-full text-xs rounded border-[#303030]" 
                                                    />
                                                  </td>
                                                  <td className="px-2 py-2 text-center">
                                                    <button 
                                                      type="button"
                                                      onClick={() => {
                                                        const newList = [...currentItem.dimension_list];
                                                        newList.splice(dimIdx, 1);
                                                        setEditingItem({ ...currentItem, dimension_list: newList });
                                                      }}
                                                      className="text-red-500 hover:text-red-700"
                                                    >
                                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                      </svg>
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>

                                    </div>
                                  ) : (
                                    <div className="space-y-6">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Description</h6>
                                          <p className="text-sm text-[#F5F5F5]">{currentItem.description || "-"}</p>
                                        </div>
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Logic / Calculation</h6>
                                          <p className="text-sm text-[#F5F5F5] font-mono bg-[#111111] p-2 rounded">{currentItem.logic_calculation || "-"}</p>
                                        </div>
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Dimensions</h6>
                                          <p className="text-sm text-[#F5F5F5]">{currentItem.dimensions || "-"}</p>
                                        </div>
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Measures & UoM</h6>
                                          <p className="text-sm text-[#F5F5F5]">
                                            {currentItem.measures ? <span className="font-semibold">{currentItem.measures}</span> : "-"}
                                            {currentItem.uom && <span className="ml-2 text-[#B0B0B0]">({currentItem.uom})</span>}
                                          </p>
                                        </div>
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Technical Details</h6>
                                          <p className="text-sm text-[#F5F5F5] whitespace-pre-wrap">{currentItem.technical_details || "-"}</p>
                                        </div>
                                        <div>
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-1">Critical to Measure</h6>
                                          <p className="text-sm text-[#F5F5F5]">{currentItem.critical_to_measure || "-"}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Readonly Dimensions List */}
                                      {currentItem.dimension_list && currentItem.dimension_list.length > 0 && (
                                        <div className="mt-4 border-t pt-4">
                                          <h6 className="text-xs font-semibold text-[#B0B0B0] uppercase tracking-wider mb-2">Detailed Dimensions</h6>
                                          <div className="overflow-x-auto rounded border border-[#303030]">
                                            <table className="min-w-full divide-y divide-gray-200">
                                              <thead className="bg-[#111111]">
                                                <tr>
                                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#B0B0B0]">Type</th>
                                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#B0B0B0]">Name</th>
                                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#B0B0B0]">Requirement</th>
                                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#B0B0B0]">Source Logic</th>
                                                </tr>
                                              </thead>
                                              <tbody className="bg-[#1B1B1B] divide-y divide-gray-100">
                                                {currentItem.dimension_list.map((dim, dimIdx) => (
                                                  <tr key={dimIdx} className="hover:bg-[#111111]">
                                                    <td className="px-4 py-2 text-xs text-[#F5F5F5]">{dim.dimension_type}</td>
                                                    <td className="px-4 py-2 text-xs font-medium text-[#F5F5F5]">{dim.dimension}</td>
                                                    <td className="px-4 py-2 text-xs text-[#B0B0B0]">{dim.dimension_requirement}</td>
                                                    <td className="px-4 py-2 text-xs text-[#B0B0B0] font-mono">{dim.source_logic_table_field}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                )}
                
                {activeSection === "dimensions" && (
                  <div className="bg-[#1B1B1B] p-6 rounded-lg border border-[#303030] shadow-sm">
                    <h3 className="text-lg font-medium text-[#F5F5F5] mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-[#B0B0B0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Consolidated Dimension List
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[#303030]">
                        <thead className="bg-[#111111]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">KPI Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">Dimension Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">Dimension Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#B0B0B0] uppercase tracking-wider">Requirement</th>
                          </tr>
                        </thead>
                        <tbody className="bg-[#1c1c1e] divide-y divide-[#303030]">
                          {mapping.items.flatMap(item => 
                            (item.dimension_list || []).map((dim, dimIdx) => (
                              <tr key={`${item.id}-${dimIdx}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#FFE600]">{item.kpi_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#F5F5F5]">{dim.dimension_type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#F5F5F5]">{dim.dimension}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D5D5D5]">{dim.dimension_requirement}</td>
                              </tr>
                            ))
                          )}
                          {mapping.items.every(item => !(item.dimension_list && item.dimension_list.length > 0)) && (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#B0B0B0] italic">
                                No dimensions defined yet across any KPI.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Pagination controls for screen */}
              <div className="flex justify-between items-center bg-[#1B1B1B] border border-[#303030] p-3 rounded-sm print:hidden shadow-lg">
                <div className="text-xs text-[#B0B0B0] font-sans flex items-center gap-2">
                  <span>Viewing Page</span>
                  <select
                    value={previewPageNum}
                    onChange={(e) => setPreviewPageNum(Number(e.target.value))}
                    className="bg-[#111] text-[#FFE600] border border-[#303030] rounded px-2 py-0.5 text-xs font-bold focus:border-[#FFE600] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num} className="bg-[#1B1B1B] text-[#F5F5F5]">
                        {num}
                      </option>
                    ))}
                  </select>
                  <span>of <span className="font-bold text-[#F5F5F5]">{totalPages}</span></span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewPageNum(p => Math.max(1, p - 1))}
                    disabled={previewPageNum === 1}
                    className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs border border-[#303030] hover:border-yellow-500 text-[#B0B0B0] hover:text-[#F5F5F5]"
                  >
                    &larr; Prev
                  </button>
                  <button
                    onClick={() => setPreviewPageNum(p => Math.min(totalPages, p + 1))}
                    disabled={previewPageNum === totalPages}
                    className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs border border-[#303030] hover:border-yellow-500 text-[#B0B0B0] hover:text-[#F5F5F5]"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>

              {/* The Pages Container */}
              <div className="space-y-8 print:space-y-0 print:bg-white">
                {/* PAGE 1: COVER PAGE */}
                <div className={`${previewPageNum === 1 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFE600] print:hidden" />
                  <div className="h-6" />
                  <div className="flex-grow flex flex-col justify-center space-y-8 py-10">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFE600] drop-shadow-sm">KPI Advisory & Analytics</p>
                      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 font-sans">Technical Data Mapping Document</h1>
                      <p className="text-sm text-gray-500 italic max-w-xl font-serif">
                        A unified blueprint translating business strategy into governed, measurable performance metrics.
                      </p>
                    </div>
                    <div className="h-1 bg-[#FFE600] w-full" />
                  </div>
                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 1 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 2: DOCUMENT CONTROL & METADATA */}
                <div className={`${previewPageNum === 2 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>Document Control & Metadata</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  <div className="flex-grow space-y-6 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">Document Control & Metadata</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 text-xs bg-gray-50 border border-gray-200 p-6 rounded-sm">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Document Version</p>
                        <p className="text-xs text-gray-900 font-semibold mt-1">1.0</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Generated Date</p>
                        <p className="text-xs text-gray-900 font-semibold mt-1">
                          {mapping.updated_at ? new Date(mapping.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft Date'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Number of KPIs</p>
                        <p className="text-xs text-gray-900 font-semibold mt-1">{mapping.items.length} KPIs Mapped</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Industry</p>
                        <p className="text-xs text-gray-900 font-semibold mt-1">{clientProfile?.industry || "Not Specified"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Approval Status</p>
                        <div className="mt-1">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 border border-green-600 bg-green-50 text-green-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              Approved Blueprint
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 border border-yellow-600 bg-yellow-50 text-yellow-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              Draft Blueprint
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 2 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 3: TABLE OF CONTENTS */}
                <div className={`${previewPageNum === 3 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>Table of Contents</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  <div className="flex-grow space-y-6 flex flex-col justify-center">
                    <div className="bg-gray-50 border border-gray-200 p-6 rounded-sm space-y-4 font-sans">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Table of Contents</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] text-gray-600">
                        <div>Document Control & Metadata</div>
                        <div>1. Executive Summary</div>
                        <div>2. KPI Synopsis</div>
                        <div>3. Detailed KPIs Blueprint</div>
                        <div>4. Consolidated Dimension List</div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 3 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 4: EXECUTIVE SUMMARY */}
                <div className={`${previewPageNum === 4 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>1. Executive Summary</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  
                  <div className="flex-grow space-y-12">
                    <div className="space-y-4">
                      <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">1. Executive Summary</h2>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{execSummaryValue || "No summary provided."}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 4 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 5: KPI SYNOPSIS */}
                <div className={`${previewPageNum === 5 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>2. KPI Synopsis</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  
                  <div className="flex-grow space-y-12">
                    <div className="space-y-4">
                      <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">2. KPI Synopsis</h2>
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">Functional Area</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700">L1</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700">L2</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700">L3</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-900">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {priorityMatrix.map((row) => (
                            <tr key={row.area}>
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.area}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 text-center">{row.l1}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 text-center">{row.l2}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 text-center">{row.l3}</td>
                              <td className="px-4 py-2 text-sm font-bold text-gray-900 text-center bg-gray-50">{row.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 5 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 6: DETAILED KPIS BLUEPRINT */}
                <div className={`${previewPageNum === 6 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>3. Detailed KPIs Blueprint</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  
                  <div className="flex-grow space-y-12">
                    <div className="space-y-4">
                      <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">3. Detailed KPIs Blueprint</h2>
                      <div className="space-y-6">
                        {Object.entries(groupedKpis).map(([area, kpis]) => (
                          <div key={area} className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 bg-gray-100 p-2">{area}</h3>
                            {kpis.map((item, index) => (
                              <div key={item.id} className="border border-gray-300 p-4 rounded bg-gray-50 page-break-inside-avoid">
                                <h4 className="font-bold text-md text-gray-900 mb-2">{index + 1}. {item.kpi_name}</h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div className="col-span-2"><span className="font-semibold text-gray-700">Technical Details:</span> {item.technical_details || "N/A"}</div>
                                  <div><span className="font-semibold text-gray-700">Data Type:</span> {item.data_type || "N/A"}</div>
                                  <div><span className="font-semibold text-gray-700">Action Direction:</span> {item.action || "N/A"}</div>
                                  <div className="col-span-2"><span className="font-semibold text-gray-700">SQL Formula / Logic:</span> <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px] break-all">{item.sql_formula || "N/A"}</code></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 6 of {totalPages}</div>
                  </div>
                </div>

                {/* PAGE 7: CONSOLIDATED DIMENSION LIST */}
                <div className={`${previewPageNum === 7 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                  <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                    <div>4. Consolidated Dimension List</div>
                    <div>Technical Data Mapping Document</div>
                  </div>
                  
                  <div className="flex-grow space-y-12">
                    <div className="space-y-4">
                      <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">4. Consolidated Dimension List</h2>
                      <table className="min-w-full text-left border-collapse border border-gray-300">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 text-xs font-bold text-gray-700">KPI Name</th>
                            <th className="p-3 text-xs font-bold text-gray-700">Type</th>
                            <th className="p-3 text-xs font-bold text-gray-700">Dimension</th>
                            <th className="p-3 text-xs font-bold text-gray-700">Requirement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mapping.items.flatMap(item => 
                            (item.dimension_list || []).map((dim, dimIdx) => (
                              <tr key={`prev-dim-${item.id}-${dimIdx}`} className="border-b border-gray-200">
                                <td className="p-3 text-xs font-medium text-gray-900">{item.kpi_name}</td>
                                <td className="p-3 text-xs text-gray-700">{dim.dimension_type}</td>
                                <td className="p-3 text-xs text-gray-700">{dim.dimension}</td>
                                <td className="p-3 text-xs text-gray-700">{dim.dimension_requirement}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                    <div>Confidential - Advisory Work Product</div>
                    <div>Page 7 of {totalPages}</div>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
