import { Check, CheckCheck, Download, Edit3, Search, X, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import type { BusinessContext, ExportItem, KPI, KPILibrary, KPIStatus } from "../types/api";

const columns: Array<[keyof KPI, string]> = [
  ["kpi_name", "KPI Name"],
  ["functional_area", "Functional Area"],
  ["kra", "KRA"],
  ["sap_module", "SAP Module"],
  ["business_owner", "KPI Owner"]
];

export function KpiLibrary({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [library, setLibrary] = useState<KPILibrary>({ items: [], quality: {}, recommendations: {} });
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof KPI>("kpi_name");
  const [page, setPage] = useState(1);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<KPI | null>(null);
  const navigate = useNavigate();
  const pageSize = 6;

  useEffect(() => {
    refresh();
  }, [exports]);

  async function refresh() {
    const [data, contextData] = await Promise.all([
      api.getKpis(),
      api.getContext()
    ]);
    if (data.items) setLibrary(data as KPILibrary);
    if (contextData) setContext(contextData as BusinessContext);
  }

  async function setStatus(ids: string[], status: KPIStatus) {
    const updated = await api.approveKpis(ids, status);
    setLibrary(updated);
    if (selectedKpi && ids.includes(selectedKpi.id)) {
      const match = updated.items.find(item => item.id === selectedKpi.id);
      if (match) {
        setSelectedKpi(match);
        setEditForm(match);
      }
    }
    onChange();
  }

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return [...library.items]
      .filter((item) => JSON.stringify(item).toLowerCase().includes(needle))
      .sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === "number" && typeof valB === "number") {
          return valB - valA; // Descending for scores
        }
        return String(valA ?? "").localeCompare(String(valB ?? ""));
      });
  }, [library.items, query, sortKey]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const kpiExport = exports.find((item) => item.id === "kpi_library");
  const hasApproved = library.items.some((item) => item.status === "approved");
  const coverage = library.quality.coverage_summary || {};
  const totalKpis = library.items.length;
  
  const uniqueAreasCount = new Set(library.items.map(k => k.functional_area)).size;
  // Only show coverage if we have KPIs
  const showCoverage = totalKpis > 0;

  return (
    <section className="panel p-7">
      {/* Workflow Indicator */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#B0B0B0] border-b border-[#303030]/50 pb-4">
        <span className="text-[#FFE600] flex items-center gap-1">
          Business Context <span className="text-emerald-400 font-bold">✓</span>
        </span>
        <span className="text-[#FFE600]/40 px-1">→</span>
        <span className="text-[#FFE600] flex items-center gap-1">
          KPI Generation <span className="text-emerald-400 font-bold">✓</span>
        </span>
        <span className="text-[#FFE600]/40 px-1">→</span>
        <span className="text-[#F5F5F5] bg-[#303030] px-2.5 py-0.5 border border-[#FFE600]/20 font-bold rounded-sm select-none">
          KPI Review (Current)
        </span>
        <span className="text-[#FFE600]/40 px-1">→</span>
        <span>Functional Specification</span>
      </div>

      {/* Live AI Executive Summary Card */}
      {library.executive_summary?.summary_text && (
        <div className="mb-6 border border-[#FFE600]/30 bg-[#FFE600]/5 p-6 rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-[#FFE600]" />
          
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFE600]">Live AI Executive Summary</p>
              <p className="mt-3 text-sm leading-6 text-[#F5F5F5] font-medium">
                {library.executive_summary.summary_text}
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-[#303030] pt-4 lg:pt-0 lg:pl-6">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Sector Context</span>
                <span className="text-xs font-semibold text-[#F5F5F5] block mt-1 truncate max-w-[120px]" title={library.executive_summary.industry}>
                  {library.executive_summary.industry || "—"}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Metrics Advisory</span>
                <span className="text-xs font-semibold text-[#FFE600] block mt-1">
                  {library.executive_summary.generated_kpis_count ?? library.items.length} KPIs
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Target Areas</span>
                <span className="text-xs font-semibold text-[#F5F5F5] block mt-1 truncate max-w-[200px]" title={library.executive_summary.top_functional_areas?.join(", ")}>
                  {library.executive_summary.top_functional_areas?.join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFE600]">KPI Governance</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#F5F5F5]">Generated KPI Library</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
            Review KPI definitions, edit business metadata, approve records, and export the library for review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" disabled={!library.items.length} onClick={() => setStatus(library.items.map((item) => item.id), "rejected")}>
            <X size={16} />
            Bulk Reject
          </button>
          <button className="button-primary" disabled={!library.items.length} onClick={() => setStatus(library.items.map((item) => item.id), "approved")}>
            <CheckCheck size={16} />
            Bulk Approve
          </button>
          {hasApproved && (
            <button className="button-yellow border border-black/10" onClick={() => navigate("/step-3")}>
              Proceed to Spec
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-[#B0B0B0]/40" size={16} />
          <input className="field pl-10" placeholder="Search KPI names, owners, formulas or source systems..." aria-label="Search KPI names, owners, formulas or source systems" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select className="field text-xs font-semibold uppercase tracking-wider" value={sortKey} onChange={(event) => setSortKey(event.target.value as keyof KPI)}>
          {columns.map(([key, label]) => <option key={key} value={key} className="bg-[#1B1B1B] text-[#F5F5F5]">Sort by {label}</option>)}
        </select>
        <div className="flex gap-2">
          {(kpiExport?.formats ?? ["XLSX"]).map((format) => (
            <a key={format} className={`button-secondary !px-3 ${kpiExport?.available ? "" : "pointer-events-none opacity-40"}`} href={kpiExport?.available ? exportUrl("kpi_library", format) : undefined}>
              <Download size={15} />
              {format === "XLSX" ? "Excel" : format}
            </a>
          ))}
        </div>
      </div>

      {/* KPI Summary Card & Business Context Card Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* KPI Summary Card */}
        <div className="border border-[#303030] bg-[#111111] p-5 rounded-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFE600] mb-3">KPI Summary Profile</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#303030]/30 pb-1.5">
                <span className="text-[#B0B0B0]">Total KPIs Sourced:</span>
                <span className="font-bold text-[#F5F5F5]">{totalKpis}</span>
              </div>
              <div className="flex justify-between border-b border-[#303030]/30 pb-1.5">
                <span className="text-[#B0B0B0]">Functional Areas:</span>
                <span className="font-bold text-[#FFE600]">{uniqueAreasCount}</span>
              </div>
              <div className="flex justify-between border-b border-[#303030]/30 pb-1.5">
                <span className="text-[#B0B0B0]">KRAs Covered:</span>
                <span className="font-bold text-[#F5F5F5]">{new Set(library.items.map(k => k.kra)).size}</span>
              </div>
              <div className="flex justify-between border-b border-[#303030]/30 pb-1.5">
                <span className="text-[#B0B0B0]">Industry Alignment:</span>
                <span className="font-bold text-[#FFE600]">{context?.industry || "—"}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-[#B0B0B0]">Organization Level:</span>
                <span className="font-bold text-[#F5F5F5]">{context?.organization_level || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Business Context Card */}
        <div className="border border-[#303030] bg-[#111111] p-5 rounded-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFE600] mb-3">Business Context</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1">Business Priorities</span>
                <ul className="list-disc list-inside space-y-1 text-[#F5F5F5] font-semibold">
                  {context?.business_priorities && context.business_priorities.length > 0 ? (
                    context.business_priorities.map(p => (
                      <li key={p} className="truncate text-[11px]" title={p}>{p}</li>
                    ))
                  ) : (
                    <span className="text-[#B0B0B0]/40">—</span>
                  )}
                </ul>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1">Top KRAs</span>
                <ul className="list-disc list-inside space-y-1 text-[#FFE600] font-semibold">
                  {context?.top_kras && context.top_kras.length > 0 ? (
                    context.top_kras.map(k => (
                      <li key={k} className="truncate text-[11px]" title={k}>{k}</li>
                    ))
                  ) : (
                    <span className="text-[#B0B0B0]/40">—</span>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden border border-[#303030] bg-[#1B1B1B]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
            <thead className="bg-[#111111] text-[10px] uppercase tracking-[0.18em] text-[#FFE600] border-b border-[#303030]">
              <tr>
                <th className="px-4 py-3">Status</th>
                {columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303030]">
              {paged.map((item) => (
                <tr 
                  key={item.id} 
                  className="align-middle hover:bg-[#111111]/40 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedKpi(item);
                    setIsEditing(false);
                    setEditForm(item);
                  }}
                >
                  <td className="px-4 py-4">
                    <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.status === "approved" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : item.status === "rejected" ? "border-rose-500 text-rose-400 bg-rose-500/10" : item.status === "recommended" ? "border-[#FFE600] text-[#FFE600] bg-[#FFE600]/10" : "border-[#B0B0B0]/40 text-[#B0B0B0] bg-[#B0B0B0]/5"}`}>
                      {item.status}
                    </span>
                  </td>
                  {columns.map(([key]) => {
                    return (
                      <td key={key} className="max-w-[260px] px-4 py-4 text-[#F5F5F5] text-xs leading-relaxed truncate">
                        {String(item[key] ?? "") || "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button 
                        className="icon-button !h-8 !w-8" 
                        title="Approve KPI" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus([item.id], "approved");
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        className="icon-button !h-8 !w-8" 
                        title="Reject KPI" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus([item.id], "rejected");
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[#B0B0B0]/40 text-xs" colSpan={columns.length + 2}>
                    Generate the KPI library from the saved prompt to populate this table.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#B0B0B0]">
        <span></span>
        <div className="flex items-center gap-2">
          <button className="button-secondary !px-3 !py-1.5" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="button-secondary !px-3 !py-1.5" disabled={page === pages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>



      {/* KPI Details Side Drawer */}
      {selectedKpi && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => {
              setSelectedKpi(null);
              setIsEditing(false);
            }}
          />
          
          {/* Drawer sheet panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-[#1B1B1B] border-l border-[#303030] shadow-2xl z-50 overflow-hidden flex flex-col transition-all duration-300">
            
            {/* Header */}
            <div className="p-6 border-b border-[#303030] bg-[#111111] flex justify-between items-start shrink-0">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFE600]">
                    {selectedKpi.functional_area}
                  </span>
                  <span className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedKpi.status === "approved" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : selectedKpi.status === "rejected" ? "border-rose-500 text-rose-400 bg-rose-500/10" : selectedKpi.status === "recommended" ? "border-[#FFE600] text-[#FFE600] bg-[#FFE600]/10" : "border-[#B0B0B0]/40 text-[#B0B0B0] bg-[#B0B0B0]/5"}`}>
                    {selectedKpi.status}
                  </span>
                </div>
                
                <h3 className="mt-2 text-xl font-semibold text-[#F5F5F5] tracking-tight">
                  {selectedKpi.kpi_name}
                </h3>
              </div>
              
              <button 
                className="text-[#B0B0B0] hover:text-[#F5F5F5] transition-colors p-1"
                aria-label="Close details"
                onClick={() => {
                  setSelectedKpi(null);
                  setIsEditing(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-6">
                
                {/* Classifications Grid */}
                <div className="grid grid-cols-3 gap-4 bg-[#111111] p-4 border border-[#303030] rounded-sm">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Functional Area</span>
                    <span className="text-xs font-semibold text-[#FFE600] block mt-1">{selectedKpi.functional_area || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">KRA</span>
                    <span className="text-xs font-semibold text-[#F5F5F5] block mt-1">{selectedKpi.kra || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Refresh Cadence</span>
                    <span className="text-xs font-semibold text-[#F5F5F5] block mt-1">{selectedKpi.refresh_cadence || "—"}</span>
                  </div>
                </div>

                {/* Business Purpose / Description */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600] mb-2">Business Purpose / Description</h4>
                  <p className="text-xs text-[#B0B0B0] leading-relaxed whitespace-pre-wrap">
                    {selectedKpi.kpi_description || "—"}
                  </p>
                </div>

                {/* Formula and Numerator/Denominator */}
                <div className="bg-[#111111] p-4 border border-[#303030] rounded-sm space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Calculation Details</h4>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Formula</span>
                    <code className="text-xs text-[#FFE600] block mt-1.5 font-mono break-all bg-[#1B1B1B] p-2 border border-[#303030] rounded-sm leading-relaxed">
                      {selectedKpi.formula || "—"}
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Numerator</span>
                      <span className="text-xs text-[#F5F5F5] font-medium block mt-1">{selectedKpi.numerator || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Denominator</span>
                      <span className="text-xs text-[#F5F5F5] font-medium block mt-1">{selectedKpi.denominator || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Ownership & Source System */}
                <div className="bg-[#111111]/40 border border-[#303030] p-4 rounded-sm">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600] mb-3">Enterprise Governance & Infrastructure</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Business Owner</span>
                      <span className="text-xs font-semibold text-[#F5F5F5] block mt-1">{selectedKpi.business_owner || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Data Owner</span>
                      <span className="text-xs font-semibold text-[#F5F5F5] block mt-1">{selectedKpi.data_owner || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block">Source System</span>
                      <span className="text-xs font-semibold text-[#F5F5F5] block mt-1">{selectedKpi.source_system || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Target & Threshold Ranges */}
                <div className="bg-[#111111]/40 border border-[#303030] p-4 rounded-sm">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600] mb-3">Threshold / Target</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1">Target Range</span>
                      <p className="text-xs text-[#F5F5F5] font-semibold leading-relaxed">
                        {selectedKpi.recommended_target_range || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1">Threshold Range</span>
                      <p className="text-xs text-[#F5F5F5] font-semibold leading-relaxed">
                        {selectedKpi.recommended_threshold_range || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes / Assumptions */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600] mb-2">Notes / Assumptions</h4>
                  <p className="text-xs text-[#B0B0B0] leading-relaxed italic whitespace-pre-wrap bg-[#111111] p-4 border-l-2 border-[#FFE600] rounded-r-sm">
                    {selectedKpi.notes || "—"}
                  </p>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#303030] bg-[#111111] flex justify-between gap-3 shrink-0">
              <div className="flex gap-2">
                <button 
                  className="button-secondary !py-2" 
                  onClick={async () => {
                    await setStatus([selectedKpi.id], "approved");
                  }}
                >
                  <Check size={14} className="text-emerald-400" />
                  Approve
                </button>
                <button 
                  className="button-secondary !py-2" 
                  onClick={async () => {
                    await setStatus([selectedKpi.id], "rejected");
                  }}
                >
                  <X size={14} className="text-rose-400" />
                  Reject
                </button>
              </div>

              <button 
                className="button-secondary" 
                onClick={() => {
                  setSelectedKpi(null);
                  setIsEditing(false);
                }}
              >
                Close
              </button>
            </div>

          </div>
        </>
      )}
    </section>
  );
}
