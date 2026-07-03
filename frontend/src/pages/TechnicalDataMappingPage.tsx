import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle, ChevronRight, Download, Loader2, Play, Printer, RefreshCw, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import {
  TechnicalDataMapping,
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
  const [docName, setDocName] = useState("");
  const [activeSection, setActiveSection] = useState<"org" | "summary" | "tech" | "freq" | "test" | "glossary">("org");
  const [editingMapping, setEditingMapping] = useState<TechnicalDataMapping | null>(null);

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
      setMapping(data);
      setEditingMapping(data);
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
      setEditingMapping(data);
      setSaveStatus("Technical Data Mapping generated");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveMapping() {
    if (!editingMapping) return;
    setSaveStatus("Saving Draft...");
    try {
      const updatedMapping = { ...editingMapping, status: "draft" };
      await api.saveTechnicalMapping(updatedMapping);
      setMapping(updatedMapping);
      setSaveStatus("Changes saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError("Failed to save updates");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ey-yellow"></div>
      </div>
    );
  }

  const isApproved = mapping?.status === "approved";
  const hasData = mapping && mapping.document_organization;

  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030] mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 05</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Technical Dataflow Mapping</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Generate and validate the technical implementation blueprints, mapping business objects to physical SAP/ERP structures.
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
            <h3 className="text-lg font-medium text-[#F5F5F5] mb-2">No Technical Mappings Generated</h3>
            <p className="text-[#B0B0B0] mb-6 max-w-md mx-auto">
              You haven't generated the technical data mapping yet. Click below to use AI to build the engineering blueprint based on the functional specifications.
            </p>
            <button onClick={generateMapping} disabled={generating} className="button-yellow !px-6 !py-3 flex items-center justify-center mx-auto">
              {generating ? <><Loader2 size={20} className="animate-spin mr-3" />Generating Mappings...</> : <><Play size={20} className="mr-2 -ml-1" />Generate Technical Mapping</>}
            </button>
          </div>
        ) : (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Control Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm gap-4 sticky top-0 z-40 shadow-lg">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest text-[#FFE600] uppercase">Document Status</span>
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <Check size={10} /> Approved Technical Mapping
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Draft Technical Mapping
                  </span>
                )}
                {saveStatus && <span className="text-xs text-[#FFE600] animate-pulse">{saveStatus}</span>}

                <div className="flex bg-[#111111] p-1 rounded-sm border border-[#303030] sm:ml-4 shrink-0">
                  <button type="button" className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${activeTab === "editor" ? "bg-[#FFE600] text-black" : "text-[#B0B0B0]"}`} onClick={() => setActiveTab("editor")}>Document Editor</button>
                  <button type="button" className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${activeTab === "preview" ? "bg-[#FFE600] text-black" : "text-[#B0B0B0]"}`} onClick={() => setActiveTab("preview")}>Document Preview</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                {activeTab === "editor" && !isApproved && (
                   <button className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5" onClick={saveMapping}>
                     <Save size={14} /> Save Draft
                   </button>
                )}
                {!isApproved ? (
                  <button className="button-secondary !py-1.5 !px-3 !text-xs border border-yellow-500/30 text-yellow-400 flex items-center gap-1.5" onClick={approveMapping}>
                    <CheckCircle size={14} /> Approve Document
                  </button>
                ) : (
                  <button className="button-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5" onClick={reopenMapping}>
                    <RefreshCw size={14} /> Reopen to Edit
                  </button>
                )}
                
                {/* Print Button */}
                {activeTab === "preview" && (
                  <button type="button" className="button-secondary !py-1.5 !px-3 !text-xs border border-gray-500 text-gray-300 flex items-center gap-1.5" onClick={() => window.print()}>
                    <Printer size={12} /> Print / PDF
                  </button>
                )}
                {/* Export buttons */}
                {tdmExport?.available && tdmExport.formats.map((format) => (
                  <a
                    key={format}
                    href={`${exportUrl("technical_mapping", format)}${exportUrl("technical_mapping", format).includes('?') ? '&' : '?'}doc_name=${encodeURIComponent(docName)}`}
                    download={`${docName || "KPI_Technical_Data_Mapping"}.${format.toLowerCase()}`}
                    className="button-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                  >
                    <Download size={12} /> {format}
                  </a>
                ))}

                {isApproved && (
                  <Link to="/step-6" className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5">
                    Proceed to Dashboard <ChevronRight size={14} />
                  </Link>
                )}
              </div>
            </div>

            {activeTab === "editor" && editingMapping ? (
              <div className="bg-[#1B1B1B] border border-[#303030] p-6 rounded-sm">
                <div className="flex border-b border-[#303030] mb-6 overflow-x-auto">
                  {["org", "summary", "tech", "freq", "test", "glossary"].map(tab => {
                     const labels: Record<string, string> = {
                       org: "Document Org", summary: "Object Summary", tech: "Technical Specs", freq: "Data Load Freq", test: "Test Results", glossary: "Glossary"
                     };
                     return (
                        <button key={tab} onClick={() => setActiveSection(tab as any)} className={`py-2 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeSection === tab ? "border-[#FFE600] text-[#FFE600]" : "border-transparent text-[#B0B0B0]"}`}>
                          {labels[tab]}
                        </button>
                     );
                  })}
                </div>
                
                {/* Form fields based on activeSection */}
                {activeSection === "org" && (
                   <div className="space-y-4">
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Document Log</label>
                       <textarea disabled={isApproved} className="field w-full h-40 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.document_organization.document_log} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, document_log: e.target.value}})} />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Related Document Reference</label>
                       <textarea disabled={isApproved} className="field w-full h-32 text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.document_organization.related_document_reference} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, related_document_reference: e.target.value}})} />
                     </div>
                   </div>
                )}

                {activeSection === "summary" && (
                   <div className="space-y-4">
                     <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Object Summary</label>
                     <textarea disabled={isApproved} className="field w-full h-64 text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.object_summary} onChange={e => setEditingMapping({...editingMapping, object_summary: e.target.value})} />
                   </div>
                )}

                {activeSection === "tech" && (
                   <div className="space-y-6">
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Data Flow / Replication Flow</label>
                       <textarea disabled={isApproved} className="field w-full h-32 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.technical_specifications.data_flow} onChange={e => setEditingMapping({...editingMapping, technical_specifications: {...editingMapping.technical_specifications, data_flow: e.target.value}})} />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Data Models</label>
                       <textarea disabled={isApproved} className="field w-full h-40 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.technical_specifications.data_models} onChange={e => setEditingMapping({...editingMapping, technical_specifications: {...editingMapping.technical_specifications, data_models: e.target.value}})} />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Technical Details & Mapping</label>
                       <textarea disabled={isApproved} className="field w-full h-32 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.technical_specifications.technical_details} onChange={e => setEditingMapping({...editingMapping, technical_specifications: {...editingMapping.technical_specifications, technical_details: e.target.value}})} />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Currency Translation</label>
                       <textarea disabled={isApproved} className="field w-full h-24 text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.technical_specifications.currency_translation} onChange={e => setEditingMapping({...editingMapping, technical_specifications: {...editingMapping.technical_specifications, currency_translation: e.target.value}})} />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Row Level Security</label>
                       <textarea disabled={isApproved} className="field w-full h-24 text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.technical_specifications.row_level_security} onChange={e => setEditingMapping({...editingMapping, technical_specifications: {...editingMapping.technical_specifications, row_level_security: e.target.value}})} />
                     </div>
                   </div>
                )}
                
                {activeSection === "freq" && (
                   <div className="space-y-4">
                     <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Data Load Frequency</label>
                     <textarea disabled={isApproved} className="field w-full h-64 text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.data_load_frequency} onChange={e => setEditingMapping({...editingMapping, data_load_frequency: e.target.value})} />
                   </div>
                )}
                
                {activeSection === "test" && (
                   <div className="space-y-4">
                     <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Unit Test Results</label>
                     <textarea disabled={isApproved} className="field w-full h-64 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.unit_test_results} onChange={e => setEditingMapping({...editingMapping, unit_test_results: e.target.value})} />
                   </div>
                )}

                {activeSection === "glossary" && (
                   <div className="space-y-4">
                     <label className="text-xs font-bold text-[#B0B0B0] uppercase block mb-1">Glossary</label>
                     <textarea disabled={isApproved} className="field w-full h-64 font-mono text-xs bg-[#111111] text-[#F5F5F5]" value={editingMapping.glossary} onChange={e => setEditingMapping({...editingMapping, glossary: e.target.value})} />
                   </div>
                )}

              </div>
            ) : null}

            {activeTab === "preview" && mapping && (
              <div className="bg-[#ffffff] text-black p-8 md:p-16 rounded-sm shadow-2xl max-w-4xl mx-auto space-y-10 min-h-[1056px] print:shadow-none print:max-w-none preview-doc">
                <style>{`
                  .preview-doc h1 { font-size: 2rem; font-weight: bold; margin-bottom: 1rem; color: #000; border-bottom: 2px solid #ccc; padding-bottom: 0.5rem; }
                  .preview-doc h2 { font-size: 1.5rem; font-weight: bold; margin-top: 2rem; margin-bottom: 0.75rem; color: #222; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
                  .preview-doc h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333; }
                  .preview-doc p { font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem; color: #333; white-space: pre-wrap; }
                  .preview-doc table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem; }
                  .preview-doc th, .preview-doc td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                  .preview-doc th { background-color: #f5f5f5; font-weight: bold; }
                `}</style>
                
                <div className="text-center mb-16">
                  <h1 className="border-none !text-4xl text-center mb-4">Technical Specification Document</h1>
                  <p className="text-gray-500 text-lg uppercase tracking-widest">{clientProfile?.client_name || "Client"} - Analytics Platform</p>
                </div>

                <div>
                  <h2>1. Document Organization</h2>
                  <h3>1.1 Document Log</h3>
                  <p>{mapping.document_organization?.document_log}</p>
                  <h3>1.2 Related Document Reference</h3>
                  <p>{mapping.document_organization?.related_document_reference}</p>
                </div>

                <div>
                  <h2>2. Object Summary</h2>
                  <p>{mapping.object_summary}</p>
                </div>

                <div>
                  <h2>3. Technical Specifications</h2>
                  <h3>3.1 Data Flow / Replication Flow</h3>
                  <p>{mapping.technical_specifications?.data_flow}</p>
                  
                  <h3>3.2 Data Models</h3>
                  <p>{mapping.technical_specifications?.data_models}</p>
                  
                  <h3>3.3 Technical Details & Mapping</h3>
                  <p>{mapping.technical_specifications?.technical_details}</p>
                  
                  <h3>3.4 Currency Translation</h3>
                  <p>{mapping.technical_specifications?.currency_translation}</p>
                  
                  <h3>3.5 Row Level Security</h3>
                  <p>{mapping.technical_specifications?.row_level_security}</p>
                </div>

                <div>
                  <h2>4. Data Load Frequency</h2>
                  <p>{mapping.data_load_frequency}</p>
                </div>

                <div>
                  <h2>5. Unit Test Results</h2>
                  <p>{mapping.unit_test_results}</p>
                </div>

                <div>
                  <h2>6. Glossary</h2>
                  <p>{mapping.glossary}</p>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
