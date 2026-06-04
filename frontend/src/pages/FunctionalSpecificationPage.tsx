import { AlertCircle, ArrowLeft, CheckCircle, Download, Edit3, FileText, Play, Save, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import type { ExportItem, FunctionalSpecification, FunctionalSpecItem, KPILibrary } from "../types/api";

export function FunctionalSpecificationPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [library, setLibrary] = useState<KPILibrary>({ items: [], quality: {}, recommendations: {} });
  const [spec, setSpec] = useState<FunctionalSpecification>({ items: [] });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FunctionalSpecItem | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kpiData, specData] = await Promise.all([
        api.getKpis(),
        api.getWorkflowStatus().then((status) => 
          status.functional_specification ? api.getFunctionalSpec() : { items: [] }
        )
      ]);
      
      if (kpiData.items) {
        setLibrary(kpiData as KPILibrary);
      }
      if (specData.items) {
        setSpec(specData as FunctionalSpecification);
        if (specData.items.length > 0) {
          setSelectedItemId(specData.items[0].id);
        }
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
      if (data.items.length > 0) {
        setSelectedItemId(data.items[0].id);
      }
      setSaveStatus("Specification generated");
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
    
    const updatedItems = spec.items.map((item) =>
      item.id === editingItem.id ? editingItem : item
    );
    const updatedSpec = { ...spec, items: updatedItems };
    
    setSaveStatus("Saving...");
    try {
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setEditingItem(null);
      setSaveStatus("Changes saved successfully");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to save specification updates");
    }
  }

  const approvedKpis = library.items.filter((kpi) => kpi.status === "approved");
  const selectedSpecItem = spec.items.find((item) => item.id === selectedItemId);
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
      {/* Header */}
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 03</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Functional Specification</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Enrich and formalize approved KPI definitions into comprehensive consulting-grade functional specifications. Generate Word, PDF, and JSON assets for engineering deployment.
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
        /* State: Specifications generated and ready to edit / export */
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          
          {/* Spec Navigation Pane */}
          <div className="space-y-4">
            <div className="panel p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Approved Metrics</p>
              <div className="space-y-1.5 max-h-[450px] overflow-y-auto">
                {spec.items.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left px-3 py-2.5 text-xs font-medium border transition-colors ${
                      item.id === selectedItemId
                        ? "border-[#FFE600] bg-[#FFE600]/10 text-[#FFE600]"
                        : "border-[#303030] bg-[#111111] text-[#B0B0B0] hover:border-[#FFE600]/40 hover:text-[#F5F5F5]"
                    }`}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setEditingItem(null);
                    }}
                  >
                    {item.kpi_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions / Exports Box */}
            <div className="panel p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Export Deliverables</p>
              <div className="grid gap-2">
                {specExport?.available ? (
                  specExport.formats.map((format) => (
                    <a
                      key={format}
                      href={exportUrl("functional_document", format)}
                      className="button-secondary !py-2 !text-xs"
                    >
                      <Download size={14} />
                      Download {format}
                    </a>
                  ))
                ) : (
                  <span className="text-xs text-[#B0B0B0]/40">Export format building...</span>
                )}
                
                <button className="button-yellow border border-black/10 !py-2 !text-xs mt-2" onClick={generateSpec} disabled={generating}>
                  {generating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Re-synthesize Spec
                </button>
              </div>
            </div>
          </div>

          {/* Details / Editor Pane */}
          <div className="panel p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-[#303030] pb-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#FFE600] uppercase">Governed Schema</p>
                <h3 className="text-2xl font-bold text-[#F5F5F5]">{selectedSpecItem?.kpi_name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#FFE600]">{saveStatus}</span>
                {!editingItem ? (
                  <button className="button-yellow" onClick={() => setEditingItem(selectedSpecItem || null)}>
                    <Edit3 size={15} />
                    Edit Spec
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button className="button-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                    <button className="button-yellow" onClick={saveSpecItem}>
                      <Save size={15} />
                      Save Updates
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Details Grid */}
            {selectedSpecItem && (
              <div className="grid gap-6">
                {!editingItem ? (
                  /* Display Mode */
                  <div className="grid gap-5 md:grid-cols-2">
                    {[
                      ["Business Purpose", selectedSpecItem.business_purpose],
                      ["Formula Logic", selectedSpecItem.formula],
                      ["Calculation Logic & Boundaries", selectedSpecItem.business_logic],
                      ["Source System Mapping", selectedSpecItem.source_system],
                      ["Data Owner", selectedSpecItem.data_owner],
                      ["Refresh Frequency", selectedSpecItem.refresh_frequency],
                      ["Strategic Assumptions", selectedSpecItem.assumptions],
                      ["Reporting & Visual Requirements", selectedSpecItem.reporting_requirements]
                    ].map(([label, text]) => (
                      <div key={label} className={`border border-[#303030] bg-[#111111] p-4 space-y-1.5 ${
                        label === "Business Purpose" || label === "Calculation Logic & Boundaries" || label === "Strategic Assumptions" || label === "Reporting & Visual Requirements"
                          ? "md:col-span-2"
                          : ""
                      }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">{label}</p>
                        <p className="text-xs leading-relaxed text-[#B0B0B0] whitespace-pre-wrap">{text || "Not detailed."}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Editing Mode */
                  <div className="grid gap-4 md:grid-cols-2 text-xs">
                    <div className="md:col-span-2">
                      <label className="label">KPI Name</label>
                      <input
                        className="field"
                        value={editingItem.kpi_name}
                        onChange={(e) => setEditingItem({ ...editingItem, kpi_name: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Business Purpose</label>
                      <textarea
                        className="field min-h-16"
                        value={editingItem.business_purpose}
                        onChange={(e) => setEditingItem({ ...editingItem, business_purpose: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Formula Logic</label>
                      <input
                        className="field"
                        value={editingItem.formula}
                        onChange={(e) => setEditingItem({ ...editingItem, formula: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Source System Mapping</label>
                      <input
                        className="field"
                        value={editingItem.source_system}
                        onChange={(e) => setEditingItem({ ...editingItem, source_system: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Data Owner</label>
                      <input
                        className="field"
                        value={editingItem.data_owner}
                        onChange={(e) => setEditingItem({ ...editingItem, data_owner: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Refresh Frequency</label>
                      <input
                        className="field"
                        value={editingItem.refresh_frequency}
                        onChange={(e) => setEditingItem({ ...editingItem, refresh_frequency: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Calculation Logic & Boundaries</label>
                      <textarea
                        className="field min-h-20"
                        value={editingItem.business_logic}
                        onChange={(e) => setEditingItem({ ...editingItem, business_logic: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Strategic Assumptions</label>
                      <textarea
                        className="field min-h-20"
                        value={editingItem.assumptions}
                        onChange={(e) => setEditingItem({ ...editingItem, assumptions: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Reporting & Visual Requirements</label>
                      <textarea
                        className="field min-h-20"
                        value={editingItem.reporting_requirements}
                        onChange={(e) => setEditingItem({ ...editingItem, reporting_requirements: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
