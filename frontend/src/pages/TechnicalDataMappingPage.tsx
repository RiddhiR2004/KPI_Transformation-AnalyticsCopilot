import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle, ChevronRight, Download, Loader2, Play, Printer, RefreshCw, Save, Plus, Trash2, Edit3, Eye, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import {
  TechnicalDataMapping,
  ClientProfile,
  ExportItem,
  TDDObjectSummaryItem,
  TDDDataModelField,
  TDDTechnicalMappingItem,
  TDDGlossaryItem
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
  const [editingMapping, setEditingMapping] = useState<TechnicalDataMapping | null>(null);
  const [previewPageNum, setPreviewPageNum] = useState(1);

  const tdmExport = exports.find((e) => e.id === "technical_mapping");

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (clientProfile && clientProfile.client_name && (docName === "" || docName === "KPI_Technical_Design_Document")) {
      const clientPart = clientProfile.client_name.trim().replace(/\s+/g, "_");
      const industryPart = (clientProfile.industry || "").trim().replace(/\s+/g, "_");
      const parts = [];
      if (clientPart) parts.push(clientPart);
      if (industryPart) parts.push(industryPart);
      parts.push("KPI_Technical_Design_Document");
      setDocName(parts.join("_"));
    } else if (!docName) {
      setDocName("KPI_Technical_Design_Document");
    }
  }, [clientProfile]);

  async function fetchData() {
    try {
      setLoading(true);
      const data = await api.getTechnicalMapping();
      
      // Handle the raw data structure (draft_items/approved_items format)
      let resolvedMapping: TechnicalDataMapping | null = null;
      if (data && data.draft_items && Object.keys(data.draft_items).length > 0) {
        resolvedMapping = {
          ...data.draft_items,
          status: data.status || "draft",
          version: data.version || 1
        };
      } else if (data && (data as any).document_organization) {
        resolvedMapping = data as unknown as TechnicalDataMapping;
      }
      
      setMapping(resolvedMapping);
      setEditingMapping(resolvedMapping);
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
      setSaveStatus("Technical Design Document generated");
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
      if (editingMapping) {
        setEditingMapping({ ...editingMapping, status: "approved" });
      }
      onChange();
      setSaveStatus("Technical Design Document Approved!");
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
      setEditingMapping(updatedMapping);
      onChange();
      setSaveStatus("Document reopened to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setError("Failed to reopen document");
    }
  }

  // Row modifier helpers for inline lists
  function addObjectRow() {
    if (!editingMapping) return;
    const newRow: TDDObjectSummaryItem = {
      object_name: "New_Logical_Table",
      short_description: "Logical table description.",
      complexity: "Medium",
      business_process: "",
      technology_stack: "",
      primary_source_systems: ""
    };
    setEditingMapping({
      ...editingMapping,
      object_summary: [...(editingMapping.object_summary || []), newRow]
    });
  }

  function deleteObjectRow(idx: number) {
    if (!editingMapping) return;
    const list = [...(editingMapping.object_summary || [])];
    list.splice(idx, 1);
    setEditingMapping({ ...editingMapping, object_summary: list });
  }

  function addModelRow() {
    if (!editingMapping) return;
    const newRow: TDDDataModelField = {
      name: "New_Model_View",
      purpose: "Provide consolidated KPI source dataset",
      source: "TBC",
      type: "Fact",
      description: ""
    };
    setEditingMapping({
      ...editingMapping,
      data_models: [...(editingMapping.data_models || []), newRow]
    });
  }

  function deleteModelRow(idx: number) {
    if (!editingMapping) return;
    const list = [...(editingMapping.data_models || [])];
    list.splice(idx, 1);
    setEditingMapping({ ...editingMapping, data_models: list });
  }

  function addMappingRow() {
    if (!editingMapping) return;
    const newRow: TDDTechnicalMappingItem = {
      s_no: (editingMapping.technical_mappings || []).length + 1,
      view_or_table_name: "Suggested_View_Name",
      source_system: "TBC",
      database: "TBC",
      schema_name: "TBC",
      model_type: "Transactional",
      table_type: "Fact",
      functional_area: "",
      required_fields: "",
      join_keys: "",
      relationships: "Many-to-One",
      transformation_logic: "",
      output_dataset: "",
      status: "TBC"
    };
    setEditingMapping({
      ...editingMapping,
      technical_mappings: [...(editingMapping.technical_mappings || []), newRow]
    });
  }

  function deleteMappingRow(idx: number) {
    if (!editingMapping) return;
    const list = [...(editingMapping.technical_mappings || [])];
    list.splice(idx, 1);
    setEditingMapping({ ...editingMapping, technical_mappings: list });
  }

  function addGlossaryRow() {
    if (!editingMapping) return;
    const newRow: TDDGlossaryItem = {
      term: "New Term",
      definition: "Definition here."
    };
    setEditingMapping({
      ...editingMapping,
      glossary: [...(editingMapping.glossary || []), newRow]
    });
  }

  function deleteGlossaryRow(idx: number) {
    if (!editingMapping) return;
    const list = [...(editingMapping.glossary || [])];
    list.splice(idx, 1);
    setEditingMapping({ ...editingMapping, glossary: list });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffe600]"></div>
      </div>
    );
  }

  const isApproved = mapping?.status === "approved";
  const hasData = mapping && mapping.object_summary && mapping.object_summary.length > 0;

  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030] mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 05</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Technical Design Document (TDD)</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Generate and customize a consulting-grade Technical Design Document detailing logical flows, table mappings, security policies, SQL views, and test strategies.
        </p>
      </section>

      <div className="space-y-6">
        {error && (
          <div className="border border-red-950 bg-red-950/30 p-4 text-xs text-red-400 flex items-start gap-3 mb-6">
            <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
            <span>{error}</span>
          </div>
        )}

        {!hasData ? (
          <div className="text-center py-16 px-4 border border-[#303030] bg-[#1B1B1B]">
            <FileText className="mx-auto text-gray-500 mb-4" size={48} />
            <h3 className="text-lg font-medium text-[#F5F5F5] mb-2">No Technical Design Document Generated</h3>
            <p className="text-[#B0B0B0] mb-6 max-w-md mx-auto">
              The blueprint has not been created yet. Click below to automatically generate it by extracting settings from Step 1 through Step 4.
            </p>
            <button onClick={generateMapping} disabled={generating} className="button-yellow !px-6 !py-3 flex items-center justify-center mx-auto">
              {generating ? <><Loader2 size={20} className="animate-spin mr-3" />Generating Blueprint...</> : <><Play size={20} className="mr-2 -ml-1" />Generate Technical Design Document</>}
            </button>
          </div>
        ) : (
          <div className="space-y-8 max-w-7xl mx-auto">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm gap-4 sticky top-0 z-40 shadow-lg">
              <div className="flex items-center gap-3 flex-wrap">
                {saveStatus && <span className="text-xs text-[#FFE600] animate-pulse">{saveStatus}</span>}

                <div className="flex bg-[#111111] p-1 rounded-sm border border-[#303030] shrink-0">
                  <button type="button" className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${activeTab === "editor" ? "bg-[#FFE600] text-black" : "text-[#B0B0B0]"}`} onClick={() => setActiveTab("editor")}><Edit3 size={12} className="inline mr-1" />Document Editor</button>
                  <button type="button" className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${activeTab === "preview" ? "bg-[#FFE600] text-black" : "text-[#B0B0B0]"}`} onClick={() => setActiveTab("preview")}><Eye size={12} className="inline mr-1" />Document Preview</button>
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
                    <CheckCircle size={14} /> Approve TDD
                  </button>
                ) : (
                  <button className="button-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5" onClick={reopenMapping}>
                    <RefreshCw size={14} /> Reopen to Edit
                  </button>
                )}
                
                {/* Print Button */}
                {activeTab === "preview" && (
                  <button type="button" className="button-secondary !py-1.5 !px-3 !text-xs border border-gray-500 text-gray-300 flex items-center gap-1.5" onClick={() => window.print()}>
                    <Printer size={12} /> Print
                  </button>
                )}
                
                {/* Export downloads */}
                {tdmExport?.available && tdmExport.formats.map((format) => (
                  <a
                    key={format}
                    href={`${exportUrl("technical_mapping", format)}${exportUrl("technical_mapping", format).includes('?') ? '&' : '?'}doc_name=${encodeURIComponent(docName)}`}
                    download={`${docName || "KPI_Technical_Design_Document"}.${format.toLowerCase()}`}
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
              <div className="bg-[#1B1B1B] border border-[#303030] p-8 rounded-sm space-y-16">
                <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">1. Document Control & Organization</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Document Version</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.document_organization.document_version} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, document_version: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Technical Designer</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.document_organization.technical_designer} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, technical_designer: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Client Name</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.document_organization.client_name} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, client_name: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Engagement Name</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.document_organization.engagement_name} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, engagement_name: e.target.value}})} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Related Document References</label>
                        <textarea disabled={isApproved} rows={6} className="field w-full text-xs" value={editingMapping.document_organization.related_documents} onChange={e => setEditingMapping({...editingMapping, document_organization: {...editingMapping.document_organization, related_documents: e.target.value}})} />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <div className="flex justify-between items-center border-b border-[#303030] pb-2 mb-4">
                        <h3 className="text-lg font-bold text-[#FFE600]">2. Object Summary</h3>
                        {!isApproved && (
                          <button onClick={addObjectRow} className="button-yellow !py-1 !px-2.5 !text-[10px] flex items-center gap-1">
                            <Plus size={12} /> Add Object
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-[#303030] text-xs">
                          <thead>
                            <tr className="bg-[#111111] text-[#B0B0B0]">
                              <th className="border border-[#303030] p-2 text-left">Object Name</th>
                              <th className="border border-[#303030] p-2 text-left">Description</th>
                              <th className="border border-[#303030] p-2 text-left">Complexity</th>
                              <th className="border border-[#303030] p-2 text-left">Process</th>
                              <th className="border border-[#303030] p-2 text-left">Source Systems</th>
                              {!isApproved && <th className="border border-[#303030] p-2 text-center w-12">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(editingMapping.object_summary || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#202020]">
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.object_name} onChange={e => {
                                    const list = [...editingMapping.object_summary];
                                    list[idx].object_name = e.target.value;
                                    setEditingMapping({ ...editingMapping, object_summary: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.short_description} onChange={e => {
                                    const list = [...editingMapping.object_summary];
                                    list[idx].short_description = e.target.value;
                                    setEditingMapping({ ...editingMapping, object_summary: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1 w-24">
                                  <select disabled={isApproved} className="bg-[#111111] border-0 text-white text-xs p-1 rounded-sm w-full" value={row.complexity} onChange={e => {
                                    const list = [...editingMapping.object_summary];
                                    list[idx].complexity = e.target.value;
                                    setEditingMapping({ ...editingMapping, object_summary: list });
                                  }}>
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                  </select>
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.business_process} onChange={e => {
                                    const list = [...editingMapping.object_summary];
                                    list[idx].business_process = e.target.value;
                                    setEditingMapping({ ...editingMapping, object_summary: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.primary_source_systems} onChange={e => {
                                    const list = [...editingMapping.object_summary];
                                    list[idx].primary_source_systems = e.target.value;
                                    setEditingMapping({ ...editingMapping, object_summary: list });
                                  }} />
                                </td>
                                {!isApproved && (
                                  <td className="border border-[#303030] p-2 text-center">
                                    <button onClick={() => deleteObjectRow(idx)} className="text-red-400 hover:text-red-300">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">3.1 Technical Data Flow & Visual Architecture</h3>
                      {editingMapping.technical_data_flow && editingMapping.technical_data_flow.map((flow, idx) => (
                        <div key={idx} className="space-y-4 p-4 border border-[#303030] bg-[#151515] rounded-sm">
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Flow Description</label>
                            <textarea disabled={isApproved} rows={6} className="field w-full text-xs" value={flow.description} onChange={e => {
                              const list = [...editingMapping.technical_data_flow];
                              list[idx].description = e.target.value;
                              setEditingMapping({ ...editingMapping, technical_data_flow: list });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Mermaid.js Flow Diagram Code</label>
                            <textarea disabled={isApproved} rows={6} className="field w-full font-mono text-xs bg-black text-[#58A6FF]" value={flow.diagram_mermaid} onChange={e => {
                              const list = [...editingMapping.technical_data_flow];
                              list[idx].diagram_mermaid = e.target.value;
                              setEditingMapping({ ...editingMapping, technical_data_flow: list });
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <div className="flex justify-between items-center border-b border-[#303030] pb-2 mb-4">
                        <h3 className="text-lg font-bold text-[#FFE600]">3.2 Data Models</h3>
                        {!isApproved && (
                          <button onClick={addModelRow} className="button-yellow !py-1 !px-2.5 !text-[10px] flex items-center gap-1">
                            <Plus size={12} /> Add Model
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-[#303030] text-xs">
                          <thead>
                            <tr className="bg-[#111111] text-[#B0B0B0]">
                              <th className="border border-[#303030] p-2 text-left">Model Name</th>
                              <th className="border border-[#303030] p-2 text-left">Purpose</th>
                              <th className="border border-[#303030] p-2 text-left">Source Tables</th>
                              <th className="border border-[#303030] p-2 text-left">Type</th>
                              <th className="border border-[#303030] p-2 text-left">Description</th>
                              {!isApproved && <th className="border border-[#303030] p-2 text-center w-12">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(editingMapping.data_models || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#202020]">
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.name} onChange={e => {
                                    const list = [...editingMapping.data_models];
                                    list[idx].name = e.target.value;
                                    setEditingMapping({ ...editingMapping, data_models: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.purpose} onChange={e => {
                                    const list = [...editingMapping.data_models];
                                    list[idx].purpose = e.target.value;
                                    setEditingMapping({ ...editingMapping, data_models: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.source} onChange={e => {
                                    const list = [...editingMapping.data_models];
                                    list[idx].source = e.target.value;
                                    setEditingMapping({ ...editingMapping, data_models: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1 w-24">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.type} onChange={e => {
                                    const list = [...editingMapping.data_models];
                                    list[idx].type = e.target.value;
                                    setEditingMapping({ ...editingMapping, data_models: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.description} onChange={e => {
                                    const list = [...editingMapping.data_models];
                                    list[idx].description = e.target.value;
                                    setEditingMapping({ ...editingMapping, data_models: list });
                                  }} />
                                </td>
                                {!isApproved && (
                                  <td className="border border-[#303030] p-2 text-center">
                                    <button onClick={() => deleteModelRow(idx)} className="text-red-400 hover:text-red-300">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <div className="flex justify-between items-center border-b border-[#303030] pb-2 mb-4">
                        <h3 className="text-lg font-bold text-[#FFE600]">3.3 Technical Details & Mapping Table</h3>
                        {!isApproved && (
                          <button onClick={addMappingRow} className="button-yellow !py-1 !px-2.5 !text-[10px] flex items-center gap-1">
                            <Plus size={12} /> Add Row
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-[#303030] text-xs">
                          <thead>
                            <tr className="bg-[#111111] text-[#B0B0B0]">
                              <th className="border border-[#303030] p-2 text-left w-10">S.No</th>
                              <th className="border border-[#303030] p-2 text-left">Logical Table</th>
                              <th className="border border-[#303030] p-2 text-left">Src System</th>
                              <th className="border border-[#303030] p-2 text-left">DB</th>
                              <th className="border border-[#303030] p-2 text-left">Schema</th>
                              <th className="border border-[#303030] p-2 text-left">Model Type</th>
                              <th className="border border-[#303030] p-2 text-left">Table Type</th>
                              <th className="border border-[#303030] p-2 text-left">Transformation Logic</th>
                              <th className="border border-[#303030] p-2 text-left">Output Dataset</th>
                              <th className="border border-[#303030] p-2 text-center w-16">Status</th>
                              {!isApproved && <th className="border border-[#303030] p-2 text-center w-10">Act</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(editingMapping.technical_mappings || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#202020]">
                                <td className="border border-[#303030] p-1 text-center font-bold text-[#FFE600]">{row.s_no}</td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.view_or_table_name} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].view_or_table_name = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.source_system} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].source_system = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.database} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].database = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.schema_name} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].schema_name = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.model_type} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].model_type = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.table_type} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].table_type = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <textarea disabled={isApproved} rows={4} className="bg-[#111111] border-0 focus:ring-0 w-full p-1 text-xs text-white rounded-sm" value={row.transformation_logic} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].transformation_logic = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.output_dataset} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].output_dataset = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1 w-20">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-center font-bold text-yellow-400" value={row.status} onChange={e => {
                                    const list = [...editingMapping.technical_mappings];
                                    list[idx].status = e.target.value;
                                    setEditingMapping({ ...editingMapping, technical_mappings: list });
                                  }} />
                                </td>
                                {!isApproved && (
                                  <td className="border border-[#303030] p-1 text-center">
                                    <button onClick={() => deleteMappingRow(idx)} className="text-red-400 hover:text-red-300">
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">3.4 Data Transformation Rules</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Aggregations</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.transformation_rules.aggregations} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, aggregations: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Derived Columns</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.transformation_rules.derived_columns} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, derived_columns: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Calculated Fields</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.transformation_rules.calculated_fields} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, calculated_fields: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Business Filters</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.transformation_rules.business_filters} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, business_filters: e.target.value}})} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Currency Conversion</label>
                            <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.transformation_rules.currency_conversion} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, currency_conversion: e.target.value}})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Unit Conversion</label>
                            <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.transformation_rules.unit_conversion} onChange={e => setEditingMapping({...editingMapping, transformation_rules: {...editingMapping.transformation_rules, unit_conversion: e.target.value}})} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">3.5 Security Policies</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Row-Level Security (RLS)</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.security.row_level_security} onChange={e => setEditingMapping({...editingMapping, security: {...editingMapping.security, row_level_security: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Object-Level Security (OLS)</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.security.object_level_security} onChange={e => setEditingMapping({...editingMapping, security: {...editingMapping.security, object_level_security: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Sensitive Fields & Masking</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.security.sensitive_fields} onChange={e => setEditingMapping({...editingMapping, security: {...editingMapping.security, sensitive_fields: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Access Roles</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.security.access_roles} onChange={e => setEditingMapping({...editingMapping, security: {...editingMapping.security, access_roles: e.target.value}})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">4. Data Load Strategy</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Load Frequency</label>
                            <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.data_load_strategy.load_frequency} onChange={e => setEditingMapping({...editingMapping, data_load_strategy: {...editingMapping.data_load_strategy, load_frequency: e.target.value}})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Refresh Type</label>
                            <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.data_load_strategy.refresh_type} onChange={e => setEditingMapping({...editingMapping, data_load_strategy: {...editingMapping.data_load_strategy, refresh_type: e.target.value}})} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Estimated Volumes</label>
                          <input disabled={isApproved} type="text" className="field w-full text-xs" value={editingMapping.data_load_strategy.estimated_volume} onChange={e => setEditingMapping({...editingMapping, data_load_strategy: {...editingMapping.data_load_strategy, estimated_volume: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Dependencies</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_load_strategy.dependencies} onChange={e => setEditingMapping({...editingMapping, data_load_strategy: {...editingMapping.data_load_strategy, dependencies: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Scheduling Considerations</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_load_strategy.scheduling_considerations} onChange={e => setEditingMapping({...editingMapping, data_load_strategy: {...editingMapping.data_load_strategy, scheduling_considerations: e.target.value}})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">5. Data Quality & Validation</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Null Checks</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_quality_validation.null_checks} onChange={e => setEditingMapping({...editingMapping, data_quality_validation: {...editingMapping.data_quality_validation, null_checks: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Duplicate Checks</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_quality_validation.duplicate_checks} onChange={e => setEditingMapping({...editingMapping, data_quality_validation: {...editingMapping.data_quality_validation, duplicate_checks: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Mandatory Field Checks</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_quality_validation.mandatory_field_checks} onChange={e => setEditingMapping({...editingMapping, data_quality_validation: {...editingMapping.data_quality_validation, mandatory_field_checks: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Business Rule Validation</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_quality_validation.business_rule_validation} onChange={e => setEditingMapping({...editingMapping, data_quality_validation: {...editingMapping.data_quality_validation, business_rule_validation: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">KPI Validation Logic</label>
                          <textarea disabled={isApproved} rows={4} className="field w-full text-xs" value={editingMapping.data_quality_validation.kpi_validation_logic} onChange={e => setEditingMapping({...editingMapping, data_quality_validation: {...editingMapping.data_quality_validation, kpi_validation_logic: e.target.value}})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <h3 className="text-lg font-bold text-[#FFE600] border-b border-[#303030] pb-2 mb-4">6. Testing Strategy</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Unit Test Scenarios</label>
                          <textarea disabled={isApproved} rows={6} className="field w-full text-xs" value={editingMapping.testing_strategy.unit_test_scenarios} onChange={e => setEditingMapping({...editingMapping, testing_strategy: {...editingMapping.testing_strategy, unit_test_scenarios: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Integration Test Scenarios</label>
                          <textarea disabled={isApproved} rows={6} className="field w-full text-xs" value={editingMapping.testing_strategy.integration_test_scenarios} onChange={e => setEditingMapping({...editingMapping, testing_strategy: {...editingMapping.testing_strategy, integration_test_scenarios: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#B0B0B0] uppercase block mb-1">Validation Handoff Criteria</label>
                          <textarea disabled={isApproved} rows={6} className="field w-full text-xs" value={editingMapping.testing_strategy.validation_criteria} onChange={e => setEditingMapping({...editingMapping, testing_strategy: {...editingMapping.testing_strategy, validation_criteria: e.target.value}})} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#303030]">
                      <div className="flex justify-between items-center border-b border-[#303030] pb-2 mb-4">
                        <h3 className="text-lg font-bold text-[#FFE600]">7. Glossary</h3>
                        {!isApproved && (
                          <button onClick={addGlossaryRow} className="button-yellow !py-1 !px-2.5 !text-[10px] flex items-center gap-1">
                            <Plus size={12} /> Add Term
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-[#303030] text-xs">
                          <thead>
                            <tr className="bg-[#111111] text-[#B0B0B0]">
                              <th className="border border-[#303030] p-2 text-left w-1/4">Term</th>
                              <th className="border border-[#303030] p-2 text-left">Definition</th>
                              {!isApproved && <th className="border border-[#303030] p-2 text-center w-12">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(editingMapping.glossary || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#202020]">
                                <td className="border border-[#303030] p-1 font-bold text-[#FFE600]">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.term} onChange={e => {
                                    const list = [...editingMapping.glossary];
                                    list[idx].term = e.target.value;
                                    setEditingMapping({ ...editingMapping, glossary: list });
                                  }} />
                                </td>
                                <td className="border border-[#303030] p-1">
                                  <input disabled={isApproved} type="text" className="bg-transparent border-0 focus:ring-0 w-full p-1 text-xs text-white" value={row.definition} onChange={e => {
                                    const list = [...editingMapping.glossary];
                                    list[idx].definition = e.target.value;
                                    setEditingMapping({ ...editingMapping, glossary: list });
                                  }} />
                                </td>
                                {!isApproved && (
                                  <td className="border border-[#303030] p-2 text-center">
                                    <button onClick={() => deleteGlossaryRow(idx)} className="text-red-400 hover:text-red-300">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </div>
              </div>
            ) : null}

            {activeTab === "preview" && mapping && (() => {
              const previewPages = [];
              
              previewPages.push(
                <div key="cover" className="preview-page flex flex-col justify-between py-24">
                  <div className="text-center my-auto">
                    <p className="text-[#B49600] text-sm font-bold uppercase tracking-[0.25em] mb-4">KPI Advisory & Transformation</p>
                    <h1 className="border-none !text-4xl text-center mb-6">Technical Design Document (TDD)</h1>
                    <p className="text-gray-500 text-md italic max-w-lg mx-auto">
                      Technical specifications, data lineages, entity relations, transformation rules, and load jobs blueprint.
                    </p>
                  </div>
                  <div className="text-center text-xs text-gray-400 border-t border-gray-100 pt-6">
                    EY Advisory Services &copy; {new Date().getFullYear()}
                  </div>
                </div>
              );

              previewPages.push(
                <div key="doc-control" className="preview-page">
                  <h2>1. Document Control & Organization</h2>
                  <div className="h-2.5"></div>
                  <table>
                    <tbody>
                      <tr>
                        <th>Document Version</th>
                        <td>{mapping.document_organization.document_version}</td>
                      </tr>
                      <tr>
                        <th>Generated Date</th>
                        <td>{mapping.document_organization.generated_date}</td>
                      </tr>
                      <tr>
                        <th>Status</th>
                        <td className="font-bold uppercase text-yellow-600">{mapping.status}</td>
                      </tr>
                      <tr>
                        <th>Generated By</th>
                        <td>{mapping.document_organization.generated_by}</td>
                      </tr>
                      <tr>
                        <th>Technical Designer</th>
                        <td>{mapping.document_organization.technical_designer}</td>
                      </tr>
                      <tr>
                        <th>Client Name</th>
                        <td>{mapping.document_organization.client_name}</td>
                      </tr>
                      <tr>
                        <th>Engagement Name</th>
                        <td>{mapping.document_organization.engagement_name}</td>
                      </tr>
                      <tr>
                        <th>Related Documents</th>
                        <td>{mapping.document_organization.related_documents}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );

              previewPages.push(
                <div key="object-summary" className="preview-page">
                  <h2>2. Object Summary</h2>
                  <p className="mb-4 text-xs text-gray-500">
                    Enterprise implementation inventory of transactional facts, dimensions, and reporting views:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th>Object Name</th>
                          <th>Type</th>
                          <th>Process</th>
                          <th>Purpose</th>
                          <th>Sources</th>
                          <th>Target Layer</th>
                          <th>DB / Schema</th>
                          <th>Primary Keys</th>
                          <th>Refresh</th>
                          <th>Est. Volume</th>
                          <th>Owners</th>
                          <th>Complexity</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mapping.object_summary || []).map((obj, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{obj.object_name}</td>
                            <td>{obj.object_type || "N/A"}</td>
                            <td>{obj.business_process || "N/A"}</td>
                            <td>{obj.purpose || obj.short_description || "N/A"}</td>
                            <td>{obj.source_systems || obj.primary_source_systems || "N/A"}</td>
                            <td>{obj.target_layer || "N/A"}</td>
                            <td>{obj.database || "TBC"}.{obj.schema_name || "TBC"}</td>
                            <td>{obj.primary_keys || "N/A"}</td>
                            <td>{obj.refresh_frequency || "N/A"}</td>
                            <td>{obj.estimated_volume || "N/A"}</td>
                            <td>
                              <div className="text-[10px]">
                                <div>Bus: {obj.data_owner || "TBC"}</div>
                                <div>Tech: {obj.technical_owner || "TBC"}</div>
                              </div>
                            </td>
                            <td>{obj.complexity}</td>
                            <td className="font-bold text-yellow-700">{obj.status || "TBC"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              previewPages.push(
                <div key="tech-flow" className="preview-page">
                  <h2>3. Technical Specifications</h2>
                  <h3>3.1 Technical Data Flow Blueprint</h3>
                  {(mapping.technical_data_flow || []).map((flow, idx) => (
                    <div key={idx} className="space-y-4 mb-6 text-xs">
                      <p className="text-gray-700 leading-relaxed">{flow.description}</p>
                      {flow.diagram_ascii && (
                        <div>
                          <p className="font-bold mb-1 text-gray-500 uppercase text-[10px]">Architecture Pipeline Flow</p>
                          <div className="bg-gray-900 text-yellow-400 p-4 rounded-sm font-mono text-[11px] whitespace-pre overflow-x-auto border border-[#303030]">
                            {flow.diagram_ascii}
                          </div>
                        </div>
                      )}
                      {flow.diagram_mermaid && (
                        <div>
                          <p className="font-bold mb-1 text-gray-500 uppercase text-[10px]">Mermaid JS Pipeline</p>
                          <div className="bg-gray-50 border border-gray-200 p-4 rounded-sm font-mono text-[10px] text-gray-700 whitespace-pre overflow-x-auto">
                            {flow.diagram_mermaid}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );

              previewPages.push(
                <div key="data-models" className="preview-page">
                  <h2>3.2 Data Models Specification</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th>Model Name</th>
                          <th>Purpose / Source</th>
                          <th>Type</th>
                          <th>Grain / Keys</th>
                          <th>Measures / Dimensions</th>
                          <th>Volume / SCD</th>
                          <th>Update Strategy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mapping.data_models || []).map((m, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{m.name}</td>
                            <td>
                              <div><strong>Purpose:</strong> {m.purpose}</div>
                              <div className="text-[10px] text-gray-500 mt-1"><strong>Src:</strong> {m.source}</div>
                            </td>
                            <td>{m.type}</td>
                            <td>
                              <div><strong>Grain:</strong> {m.grain || "N/A"}</div>
                              <div className="text-[10px] text-gray-500 mt-1"><strong>PK:</strong> {m.primary_key || "N/A"}</div>
                              <div className="text-[10px] text-gray-500"><strong>FK:</strong> {m.foreign_keys || "N/A"}</div>
                            </td>
                            <td>
                              <div><strong>Measures:</strong> {m.measures || "N/A"}</div>
                              <div className="text-[10px] text-gray-500 mt-1"><strong>Dims:</strong> {m.dimensions || "N/A"}</div>
                            </td>
                            <td>
                              <div><strong>Vol:</strong> {m.estimated_record_volume || "N/A"}</div>
                              <div className="text-[10px] text-gray-500 mt-1"><strong>SCD:</strong> {m.scd_type || "N/A"}</div>
                            </td>
                            <td>
                              <div><strong>Partition:</strong> {m.partition_strategy || "N/A"}</div>
                              <div className="text-[10px] text-gray-500 mt-1"><strong>Update:</strong> {m.update_strategy || "N/A"}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              if (mapping.physical_table_definitions && mapping.physical_table_definitions.length > 0) {
                previewPages.push(
                  <div key="physical-tables" className="preview-page">
                    <h2>3.3 Physical Table Definitions</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Physical column schemas, data types, and primary/foreign key mappings:
                    </p>
                    {mapping.physical_table_definitions.map((tbl, idx) => (
                      <div key={idx} className="mb-6">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 border-b pb-1">Table: {tbl.table_name}</h4>
                        <table className="text-xs">
                          <thead>
                            <tr>
                              <th>Column Name</th>
                              <th>Data Type</th>
                              <th>Nullable</th>
                              <th>PK</th>
                              <th>FK</th>
                              <th>Description</th>
                              <th>Source Field</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(tbl.columns || []).map((col, cIdx) => (
                              <tr key={cIdx}>
                                <td className="font-semibold font-mono">{col.column_name}</td>
                                <td className="font-mono">{col.data_type}</td>
                                <td>{col.nullable}</td>
                                <td className="text-center">{col.primary_key ? "✔️" : ""}</td>
                                <td className="text-center">{col.foreign_key ? "✔️" : ""}</td>
                                <td>{col.description}</td>
                                <td className="font-mono text-gray-500">{col.source_field}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              }

              if (mapping.field_level_mappings && mapping.field_level_mappings.length > 0) {
                previewPages.push(
                  <div key="field-mappings" className="preview-page">
                    <h2>3.4 Field-Level Source Mappings</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Granular mapping from ERP/CRM origin tables to analytics warehouse target fields:
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Source System</th>
                          <th>Source Table</th>
                          <th>Source Field</th>
                          <th>Target Table</th>
                          <th>Target Field</th>
                          <th>Transformation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.field_level_mappings.map((flm, idx) => (
                          <tr key={idx}>
                            <td>{flm.source_system}</td>
                            <td className="font-mono">{flm.source_table}</td>
                            <td className="font-mono">{flm.source_field}</td>
                            <td className="font-semibold">{flm.target_table}</td>
                            <td className="font-semibold font-mono">{flm.target_field}</td>
                            <td>{flm.transformation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              previewPages.push(
                <div key="transform-rules" className="preview-page">
                  <h2>3.5 Data Transformation Rules</h2>
                  {mapping.transformation_rules_list && mapping.transformation_rules_list.length > 0 ? (
                    mapping.transformation_rules_list.map((rule, idx) => (
                      <div key={idx} className="mb-6">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 border-b pb-1">Ruleset: {rule.object_name}</h4>
                        <table>
                          <thead>
                            <tr>
                              <th className="w-16">Step</th>
                              <th className="w-40">Operation</th>
                              <th>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(rule.steps || []).map((step, sIdx) => (
                              <tr key={sIdx}>
                                <td>{step.step_number}</td>
                                <td className="font-semibold">{step.operation}</td>
                                <td>{step.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-4 text-xs mt-4">
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Aggregations</p>
                        <p>{(mapping.transformation_rules as any).aggregations || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Derived Columns</p>
                        <p>{(mapping.transformation_rules as any).derived_columns || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Calculated Fields</p>
                        <p>{(mapping.transformation_rules as any).calculated_fields || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Business Filters</p>
                        <p>{(mapping.transformation_rules as any).business_filters || "N/A"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );

              if (mapping.kpi_sql_guidance && mapping.kpi_sql_guidance.length > 0) {
                previewPages.push(
                  <div key="sql-guidance" className="preview-page">
                    <h2>3.6 SQL & Logic Snippet Guidance</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Standard query blocks demonstrating joins, groups, and filters to calculate KPIs:
                    </p>
                    {mapping.kpi_sql_guidance.map((sql, idx) => (
                      <div key={idx} className="mb-6">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 border-b pb-1">KPI logic: {sql.kpi_name}</h4>
                        <div className="bg-gray-900 text-yellow-300 p-4 rounded-sm font-mono text-[11px] whitespace-pre overflow-x-auto border border-[#303030]">
                          {sql.sql_snippet}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (mapping.db_relationship_diagrams && mapping.db_relationship_diagrams.length > 0) {
                previewPages.push(
                  <div key="db-rel" className="preview-page">
                    <h2>3.7 Database Entity-Relationship Diagram</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Logical schema joins connecting facts and dimensions:
                    </p>
                    {mapping.db_relationship_diagrams.map((diag, idx) => (
                      <div key={idx} className="mb-6 text-xs">
                        <div className="bg-gray-900 text-green-400 p-4 rounded-sm font-mono text-[11px] whitespace-pre overflow-x-auto border border-[#303030] text-center">
                          {diag.ascii_diagram}
                        </div>
                        <p className="text-gray-500 italic text-[11px] mt-2">{diag.description}</p>
                      </div>
                    ))}
                  </div>
                );
              }

              if (mapping.data_lineage_diagrams && mapping.data_lineage_diagrams.length > 0) {
                previewPages.push(
                  <div key="lineage" className="preview-page">
                    <h2>3.8 Source-to-KPI Data Lineage</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      End-to-end data tracing from ERP transactional source to executive dashboard KPIs:
                    </p>
                    {mapping.data_lineage_diagrams.map((lin, idx) => (
                      <div key={idx} className="mb-6 text-xs">
                        <div className="bg-gray-900 text-teal-400 p-4 rounded-sm font-mono text-[11px] whitespace-pre overflow-x-auto border border-[#303030] text-center">
                          {lin.ascii_lineage}
                        </div>
                        <p className="text-gray-500 italic text-[11px] mt-2">{lin.description}</p>
                      </div>
                    ))}
                  </div>
                );
              }

              previewPages.push(
                <div key="tech-mappings" className="preview-page">
                  <h2>3.9 Technical Mappings Details</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="w-8">S.No</th>
                          <th>Src System</th>
                          <th>Src Database</th>
                          <th>Src Schema</th>
                          <th>Src Table</th>
                          <th>Target DB</th>
                          <th>Target Schema</th>
                          <th>Target Table</th>
                          <th>Join Keys</th>
                          <th>Partition Key</th>
                          <th>Incremental Key</th>
                          <th>Load Type</th>
                          <th>Output</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mapping.technical_mappings || []).map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.s_no}</td>
                            <td>{item.source_system}</td>
                            <td className="font-mono">{item.source_database || item.database || "TBC"}</td>
                            <td className="font-mono">{item.source_schema || item.schema_name || "TBC"}</td>
                            <td className="font-semibold font-mono">{item.source_table || item.view_or_table_name || "N/A"}</td>
                            <td className="font-mono">{item.target_database || "TBC"}</td>
                            <td className="font-mono">{item.target_schema || "TBC"}</td>
                            <td className="font-semibold font-mono">{item.target_table || item.output_dataset || "TBC"}</td>
                            <td className="text-[10px]">{item.join_keys || "N/A"}</td>
                            <td className="font-mono">{item.partition_key || "N/A"}</td>
                            <td className="font-mono">{item.incremental_key || "N/A"}</td>
                            <td>{item.load_type || item.model_type || "Incremental"}</td>
                            <td>{item.output_dataset || "N/A"}</td>
                            <td className="font-bold text-yellow-700">{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              previewPages.push(
                <div key="security" className="preview-page">
                  <h2>3.10 Security & Access Recommendations</h2>
                  {mapping.security_access_grid && mapping.security_access_grid.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Accessible Tables / Layers</th>
                          <th>Permissions</th>
                          <th>Data Masking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.security_access_grid.map((sec, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{sec.role}</td>
                            <td className="font-mono">{sec.accessible_tables}</td>
                            <td>{sec.permission}</td>
                            <td>{sec.masking}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-4 text-xs mt-4">
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Row-Level Security (RLS)</p>
                        <p>{(mapping.security as any).row_level_security || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Object-Level Security (OLS)</p>
                        <p>{(mapping.security as any).object_level_security || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Sensitive Fields & Masking</p>
                        <p>{(mapping.security as any).sensitive_fields || "N/A"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );

              previewPages.push(
                <div key="load-strategy" className="preview-page">
                  <h2>4. Data Load Strategy</h2>
                  <div className="space-y-4 text-sm mt-4 text-xs">
                    <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                      <p className="font-bold mb-1">Load Frequency</p>
                      <p>{mapping.data_load_strategy.load_frequency || "N/A"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                      <p className="font-bold mb-1">Refresh Type</p>
                      <p>{mapping.data_load_strategy.refresh_type || "N/A"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                      <p className="font-bold mb-1">Estimated Volume</p>
                      <p>{mapping.data_load_strategy.estimated_volume || "N/A"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                      <p className="font-bold mb-1">Dependencies</p>
                      <p>{mapping.data_load_strategy.dependencies || "N/A"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                      <p className="font-bold mb-1">Scheduling Considerations</p>
                      <p>{mapping.data_load_strategy.scheduling_considerations || "N/A"}</p>
                    </div>
                  </div>
                </div>
              );

              previewPages.push(
                <div key="quality" className="preview-page">
                  <h2>5. Data Quality & Validation Matrix</h2>
                  {mapping.data_quality_validation_matrix && mapping.data_quality_validation_matrix.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Validation Rule</th>
                          <th>Table Name</th>
                          <th>Severity</th>
                          <th>Enforcement Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.data_quality_validation_matrix.map((dq, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{dq.validation_rule}</td>
                            <td className="font-mono">{dq.table_name}</td>
                            <td className={`font-bold ${dq.severity.toLowerCase() === "critical" ? "text-red-600" : "text-yellow-600"}`}>{dq.severity}</td>
                            <td>{dq.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-4 text-xs mt-4">
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Null Checks</p>
                        <p>{(mapping.data_quality_validation as any).null_checks || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Duplicate Checks</p>
                        <p>{(mapping.data_quality_validation as any).duplicate_checks || "N/A"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );

              previewPages.push(
                <div key="testing" className="preview-page">
                  <h2>6. Testing Strategy & Scenarios</h2>
                  {mapping.testing_strategy_matrix && mapping.testing_strategy_matrix.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th className="w-20">Test ID</th>
                          <th>Scenario</th>
                          <th>Expected Result</th>
                          <th>Priority</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.testing_strategy_matrix.map((tc, idx) => (
                          <tr key={idx}>
                            <td className="font-bold font-mono">{tc.test_id}</td>
                            <td>{tc.scenario}</td>
                            <td>{tc.expected_result}</td>
                            <td>{tc.priority}</td>
                            <td>{tc.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-4 text-xs mt-4">
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Unit Test Scenarios</p>
                        <p>{(mapping.testing_strategy as any).unit_test_scenarios || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border-l-4 border-gray-400">
                        <p className="font-bold mb-1">Integration Test Scenarios</p>
                        <p>{(mapping.testing_strategy as any).integration_test_scenarios || "N/A"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );

              if (mapping.data_dictionary && mapping.data_dictionary.length > 0) {
                previewPages.push(
                  <div key="data-dict" className="preview-page">
                    <h2>7. Data Dictionary</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Standard metadata dictionary for business fields:
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Field Name</th>
                          <th>Definition</th>
                          <th>Data Type</th>
                          <th>Business Meaning</th>
                          <th>Example Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.data_dictionary.map((dict, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold font-mono">{dict.field_name}</td>
                            <td>{dict.definition}</td>
                            <td className="font-mono">{dict.data_type}</td>
                            <td>{dict.business_meaning}</td>
                            <td className="font-mono text-gray-600">{dict.example_value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              if (mapping.traceability_matrix && mapping.traceability_matrix.length > 0) {
                previewPages.push(
                  <div key="traceability" className="preview-page">
                    <h2>8. KPI-to-Table Traceability Matrix</h2>
                    <p className="mb-4 text-xs text-gray-500">
                      Advisory traceability tracking KPIs back to tables and target reports:
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>KPI</th>
                          <th>Fact Table</th>
                          <th>Dimension Tables</th>
                          <th>Source Systems</th>
                          <th>Dashboard Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapping.traceability_matrix.map((tm, idx) => (
                          <tr key={idx}>
                            <td className="font-bold">{tm.kpi}</td>
                            <td className="font-mono">{tm.fact_table}</td>
                            <td className="font-mono text-xs">{tm.dimension_tables}</td>
                            <td>{tm.source_systems}</td>
                            <td className="text-gray-600 font-semibold">{tm.dashboard}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              previewPages.push(
                <div key="glossary" className="preview-page">
                  <h2>9. Glossary</h2>
                  <table>
                    <thead>
                      <tr>
                        <th className="w-1/4">Term</th>
                        <th>Definition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mapping.glossary || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold">{item.term}</td>
                          <td>{item.definition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );

              const totalPages = previewPages.length;

              return (
                <div className="max-w-4xl mx-auto space-y-6">
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
                        className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs"
                      >
                        &larr; Prev
                      </button>
                      <button
                        onClick={() => setPreviewPageNum(p => Math.min(totalPages, p + 1))}
                        disabled={previewPageNum === totalPages}
                        className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  </div>

                  <div className="preview-doc space-y-8 print:space-y-0 print:bg-white">
                    <style>{`
                      .preview-page {
                        background: #ffffff;
                        color: #111111;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                        border: 1px solid #e5e7eb;
                        margin-bottom: 2rem;
                        padding: 3rem;
                        min-height: 1056px;
                        position: relative;
                        page-break-after: always;
                        break-after: page;
                      }
                      .preview-doc h1 { font-size: 2.2rem; font-weight: bold; margin-bottom: 1.5rem; color: #111; border-bottom: 3px solid #FFE600; padding-bottom: 0.75rem; }
                      .preview-doc h2 { font-size: 1.4rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.75rem; color: #1B1B1B; border-bottom: 1.5px solid #1B1B1B; padding-bottom: 0.35rem; }
                      .preview-doc h3 { font-size: 1.15rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #333; }
                      .preview-doc p { font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem; color: #333; }
                      .preview-doc table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem; }
                      .preview-doc th, .preview-doc td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                      .preview-doc th { background-color: #1b1b1b; color: #ffffff; font-weight: bold; }
                      .preview-doc tr:nth-child(even) { background-color: #f9f9f9; }
                      @media print {
                        .preview-page {
                          box-shadow: none !important;
                          border: none !important;
                          margin: 0 !important;
                          padding: 0 !important;
                          min-height: auto !important;
                        }
                      }
                    `}</style>
                    
                    {previewPages.map((page, index) => (
                      <div key={page.key} className={`${previewPageNum === index + 1 ? 'block' : 'hidden print:block'}`}>
                        {page}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        )}
      </div>
    </div>
  );
}
