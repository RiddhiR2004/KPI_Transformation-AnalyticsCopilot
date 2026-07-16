import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity, CheckCircle, XCircle, Clock, AlertTriangle, Info, RefreshCw, 
  MoreVertical, LayoutGrid, ListTodo, Search, ChevronRight, AlertCircle,
  TrendingUp, TrendingDown, Target, Building2, Bell, ArrowUpRight, X
} from "lucide-react";
import { api } from "../lib/api";
import type { KPI, KPILibrary, BusinessContext, ClientProfile, KPIStatus } from "../types/api";

type SemanticState = "error" | "warning" | "success" | "info" | "neutral";

/* ══════════════════════════════════════════════════
   HELPERS & MOCKS
   ══════════════════════════════════════════════════ */
const getSemanticColor = (state: SemanticState) => {
  switch (state) {
    case "error": return "text-[#ef4444]";
    case "warning": return "text-[#f59e0b]";
    case "success": return "text-[#10b981]";
    case "info": return "text-[#0ea5e9]";
    default: return "text-[#B0B0B0]";
  }
};

const getSemanticBg = (state: SemanticState) => {
  switch (state) {
    case "error": return "bg-[#ef4444]/10 border-[#ef4444]/20";
    case "warning": return "bg-[#f59e0b]/10 border-[#f59e0b]/20";
    case "success": return "bg-[#10b981]/10 border-[#10b981]/20";
    case "info": return "bg-[#0ea5e9]/10 border-[#0ea5e9]/20";
    default: return "bg-[#111] border-[#333]";
  }
};

// Micro Sparkline for Fiori Tiles
function Sparkline({ data, state }: { data: number[]; state: SemanticState }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 140, height = 30;
  
  const colors = {
    error: "#ef4444", warning: "#f59e0b", success: "#10b981", info: "#0ea5e9", neutral: "#666"
  };
  const color = colors[state];

  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");

  return (
    <svg width={width} height={height} className="mt-2 opacity-80 overflow-visible">
      <defs>
        <linearGradient id={`grad-${state}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#grad-${state})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="3" fill={color} />
    </svg>
  );
}

// Fiori Insight Tile
function FioriTile({
  title, value, unit, subtitle, state, icon: Icon, trend, active, onClick, sparklineData
}: {
  title: string; value: string | number; unit?: string; subtitle?: string;
  state: SemanticState; icon?: any; trend?: "up" | "down" | "flat";
  active?: boolean; onClick?: () => void; sparklineData?: number[];
}) {
  return (
    <div 
      className={`ssc-tile ${active ? 'active' : ''}`} 
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[11px] font-bold text-[#888] tracking-wider uppercase">{title}</h3>
        {Icon && <Icon size={14} className={getSemanticColor(state)} />}
      </div>
      
      <div className="flex items-baseline gap-1 my-1 sac-count-up">
        <span className={`text-3xl font-light tracking-tight ${getSemanticColor(state)}`}>{value}</span>
        {unit && <span className={`text-sm ${getSemanticColor(state)} opacity-80`}>{unit}</span>}
      </div>

      <div className="flex items-center gap-1.5 mt-auto">
        {trend === "up" && <TrendingUp size={12} className={getSemanticColor(state)} />}
        {trend === "down" && <TrendingDown size={12} className={getSemanticColor(state)} />}
        {trend === "flat" && <Target size={12} className={getSemanticColor(state)} />}
        {subtitle && <span className="text-[10px] text-[#666]">{subtitle}</span>}
      </div>

      {sparklineData && <Sparkline data={sparklineData} state={state} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function KpiDashboardPage({ onChange }: { onChange: () => void }) {
  const [library, setLibrary] = useState<KPILibrary>({ items: [], quality: {}, recommendations: {} });
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Worklist state
  const [activeFilter, setActiveFilter] = useState<string>("All"); // "All", "Draft", "Rejected", "Pending"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQueue, setSelectedQueue] = useState<string>("Global"); // Area filter
  
  // Processing Modal State
  const [processingKpi, setProcessingKpi] = useState<KPI | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getKpis(),
      api.getContext(),
      api.getClientProfile().catch(() => null),
    ]).then(([kpiData, ctxData, profile]) => {
      if (kpiData.items) setLibrary(kpiData as KPILibrary);
      if (ctxData) setContext(ctxData as BusinessContext);
      if (profile) setClientProfile(profile as ClientProfile);
      setLoading(false);
    });
  }, []);

  const allKpis = library.items;
  const approvedKpis = useMemo(() => allKpis.filter(k => k.status === "approved"), [allKpis]);
  const rejectedKpis = useMemo(() => allKpis.filter(k => k.status === "rejected"), [allKpis]);
  const draftKpis = useMemo(() => allKpis.filter(k => k.status === "draft" || k.status === "recommended"), [allKpis]);
  
  const functionalAreas = useMemo(() => Array.from(new Set(allKpis.map(k => k.functional_area))).sort(), [allKpis]);

  const displayedKpis = useMemo(() => {
    let items = allKpis;
    if (selectedQueue !== "Global") items = items.filter(k => k.functional_area === selectedQueue);
    
    if (activeFilter === "Approved") items = items.filter(k => k.status === "approved");
    if (activeFilter === "Rejected") items = items.filter(k => k.status === "rejected");
    if (activeFilter === "Pending") items = items.filter(k => k.status === "draft" || k.status === "recommended");
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(k => k.kpi_name.toLowerCase().includes(q) || k.functional_area.toLowerCase().includes(q));
    }
    return items;
  }, [allKpis, selectedQueue, activeFilter, searchQuery]);

  const approvalRate = allKpis.length > 0 ? Math.round((approvedKpis.length / allKpis.length) * 100) : 0;
  
  // Simulated SSC Alert Logic
  const activeAlerts = useMemo(() => {
    const alerts: { id: number; text: string; type: "error"|"warning"|"info" }[] = [];
    if (rejectedKpis.length > 5) {
      alerts.push({ id: 1, text: `High volume of rejected cases (${rejectedKpis.length}). Immediate review required.`, type: "error" });
    }
    const financeDrafts = allKpis.filter(k => k.functional_area === "Finance" && k.status !== "approved").length;
    if (financeDrafts > 0) {
      alerts.push({ id: 2, text: `Finance queue has ${financeDrafts} aging items pending approval.`, type: "warning" });
    }
    if (approvalRate < 100) {
      alerts.push({ id: 3, text: "Service Level Agreement (SLA) for KPI approval cycle is at risk.", type: "info" });
    }
    return alerts;
  }, [rejectedKpis.length, allKpis, approvalRate]);

  const handleProcessSubmit = async (status: KPIStatus) => {
    if (!processingKpi) return;
    setIsProcessing(true);
    try {
      await api.approveKpis([processingKpi.id], status);
      // Optimistically update local state
      setLibrary(prev => ({
        ...prev,
        items: prev.items.map(k => k.id === processingKpi.id ? { ...k, status } : k)
      }));
      setProcessingKpi(null);
    } catch (err) {
      console.error("Failed to process KPI", err);
      alert("Failed to process KPI. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Activity size={40} className="text-[#0ea5e9] animate-pulse mx-auto" />
          <p className="text-sm text-[#B0B0B0]">Loading SAP Shared Services Center...</p>
        </div>
      </div>
    );
  }

  if (allKpis.length === 0) {
    return (
      <section className="border border-[#303030] bg-[#1B1B1B] p-10">
        <h2 className="text-2xl font-semibold text-[#F5F5F5]">SSC Worklist Empty</h2>
        <p className="mt-2 text-sm text-[#B0B0B0]">No KPIs generated. Please complete previous steps.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ── Fiori Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-1 bg-[#0ea5e9] rounded-full" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Shared Services Center</h1>
            <p className="text-[11px] text-[#888] flex items-center gap-2 mt-0.5 uppercase tracking-wider">
              <span>SAP Fiori</span> <span className="text-[#444]">•</span>
              <span>KPI Service Desk</span>
              {clientProfile?.client_name && (
                <>
                  <span className="text-[#444]">•</span>
                  <span className="flex items-center gap-1 text-[#0ea5e9]">
                    <Building2 size={10} /> {clientProfile.client_name}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="button-secondary !py-1.5 !px-3 !text-xs rounded-full">
            <Bell size={14} className={activeAlerts.length ? "text-[#ef4444] animate-pulse" : ""} />
            Alerts ({activeAlerts.length})
          </button>
        </div>
      </div>

      {/* ── Alerts Panel ── */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2 sac-slide-in">
          {activeAlerts.map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 border ${getSemanticBg(alert.type)} p-3 rounded-sm`}>
              {alert.type === "error" ? <AlertCircle size={16} className="text-[#ef4444] mt-0.5 shrink-0" /> :
               alert.type === "warning" ? <AlertTriangle size={16} className="text-[#f59e0b] mt-0.5 shrink-0" /> :
               <Info size={16} className="text-[#0ea5e9] mt-0.5 shrink-0" />}
              <div className="text-sm font-medium text-[#E0E0E0]">{alert.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Fiori Analytical Tiles (Insight Cards) ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#666] mb-3 ml-1">My Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FioriTile
            title="SLA: Approval Rate" value={approvalRate} unit="%"
            subtitle="vs target 95%"
            state={approvalRate >= 95 ? "success" : approvalRate >= 80 ? "warning" : "error"}
            icon={Target} trend={approvalRate >= 80 ? "up" : "down"}
            sparklineData={[60, 65, 62, 70, 75, 80, approvalRate]}
            active={activeFilter === "All"}
            onClick={() => setActiveFilter("All")}
          />
          <FioriTile
            title="Pending Requests" value={draftKpis.length}
            subtitle="KPIs requiring action"
            state={draftKpis.length > 15 ? "warning" : "info"}
            icon={ListTodo} trend="flat"
            active={activeFilter === "Pending"}
            onClick={() => setActiveFilter("Pending")}
          />
          <FioriTile
            title="Rejected Items" value={rejectedKpis.length}
            subtitle="Require rework"
            state={rejectedKpis.length > 5 ? "error" : "success"}
            icon={XCircle} trend={rejectedKpis.length > 5 ? "up" : "down"}
            active={activeFilter === "Rejected"}
            onClick={() => setActiveFilter("Rejected")}
          />
          <FioriTile
            title="Total Cases Processed" value={allKpis.length}
            subtitle="Current cycle volume"
            state="neutral" icon={Activity} trend="up"
            sparklineData={[10, 15, 12, 18, 22, 28, allKpis.length]}
          />
        </div>
      </div>

      {/* ── Agent Workspace / Queue Management ── */}
      <div className="border border-[#303030] bg-[#1B1B1B] rounded-sm flex flex-col min-h-[500px]">
        {/* Workspace Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-[#252525] bg-gradient-to-b from-[#222] to-[#1B1B1B]">
          <div className="flex items-center gap-3">
            <LayoutGrid size={18} className="text-[#0ea5e9]" />
            <h2 className="text-sm font-bold text-[#F5F5F5]">Service Request Worklist</h2>
            <span className="bg-[#333] text-[#F5F5F5] text-[10px] px-2 py-0.5 rounded-full font-bold">
              {displayedKpis.length} Items
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3 md:mt-0">
            {/* Queue Selector */}
            <select
              className="field !py-1.5 !text-xs w-40"
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
            >
              <option value="Global">Global Queue</option>
              {functionalAreas.map(a => <option key={a} value={a}>{a} Queue</option>)}
            </select>
            
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-[#666]" />
              <input
                type="text"
                placeholder="Search case ID or name..."
                className="field !py-1.5 !pl-8 !text-xs w-48"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button className="icon-button !h-8 !w-8 rounded-sm">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Worklist Table */}
        <div className="overflow-x-auto sac-scroll flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111] text-[#888] uppercase tracking-wider text-[9px] font-bold">
              <tr>
                <th className="p-3 w-10 text-center">Status</th>
                <th className="p-3">Case ID / KPI Name</th>
                <th className="p-3">Functional Area</th>
                <th className="p-3">Priority / KRA</th>
                <th className="p-3">Complexity</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedKpis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#666]">
                    No service requests match the current filters.
                  </td>
                </tr>
              ) : (
                displayedKpis.map((kpi, idx) => {
                  const sColor = kpi.status === "approved" ? "text-[#10b981]" : 
                                 kpi.status === "rejected" ? "text-[#ef4444]" : "text-[#f59e0b]";
                  const Icon = kpi.status === "approved" ? CheckCircle :
                               kpi.status === "rejected" ? XCircle : Clock;
                  
                  return (
                    <tr key={idx} className="ssc-worklist-row group">
                      <td className="p-3 text-center">
                        <Icon size={16} className={`${sColor} mx-auto`} />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#E0E0E0] group-hover:text-[#0ea5e9] transition-colors cursor-pointer flex items-center gap-1.5">
                          {kpi.kpi_name}
                          <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] text-[#666] mt-0.5 line-clamp-1 max-w-md">{kpi.kpi_description}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-[#222] border border-[#333] px-2 py-0.5 rounded-sm text-[#A0A0A0]">
                          {kpi.functional_area}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-[#C0C0C0] font-medium">{kpi.kra}</div>
                        {idx % 3 === 0 && <span className="text-[9px] text-[#ef4444] font-bold uppercase">High Priority</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <div className={`h-1.5 w-4 rounded-full ${idx%2===0?'bg-[#0ea5e9]':'bg-[#10b981]'}`} />
                          <div className={`h-1.5 w-4 rounded-full ${idx%2===0?'bg-[#333]':'bg-[#10b981]'}`} />
                          <div className="h-1.5 w-4 rounded-full bg-[#333]" />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => setProcessingKpi(kpi)}
                          className="button-secondary !py-1 !px-2 !text-[10px] text-[#0ea5e9] border-[#0ea5e9]/30 hover:border-[#0ea5e9]"
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="border-t border-[#252525] p-3 flex justify-between items-center text-[#666] text-xs">
          <div>Showing 1 to {displayedKpis.length} of {displayedKpis.length} entries</div>
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-[#303030] bg-[#111] rounded-sm disabled:opacity-50" disabled>Prev</button>
            <button className="px-2 py-1 border border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9] rounded-sm">1</button>
            <button className="px-2 py-1 border border-[#303030] bg-[#111] rounded-sm disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>

      {/* ── Processing Modal ── */}
      {processingKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1B1B1B] border border-[#303030] rounded-md shadow-2xl w-[600px] max-w-[95vw] overflow-hidden sac-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#252525] bg-[#111]">
              <div className="flex items-center gap-2">
                <ListTodo size={16} className="text-[#0ea5e9]" />
                <h3 className="font-bold text-[#F5F5F5]">Process Service Request</h3>
              </div>
              <button onClick={() => setProcessingKpi(null)} className="text-[#888] hover:text-[#F5F5F5]">
                <X size={18} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">KPI Name</label>
                <div className="text-lg font-bold text-[#F5F5F5]">{processingKpi.kpi_name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] p-3 rounded-sm border border-[#303030]">
                  <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider block mb-1">Functional Area</label>
                  <div className="text-sm text-[#E0E0E0]">{processingKpi.functional_area}</div>
                </div>
                <div className="bg-[#111] p-3 rounded-sm border border-[#303030]">
                  <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider block mb-1">KRA</label>
                  <div className="text-sm text-[#E0E0E0]">{processingKpi.kra}</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider block mb-1">Business Definition</label>
                <div className="text-sm text-[#A0A0A0] bg-[#111] p-3 rounded-sm border border-[#303030] leading-relaxed">
                  {processingKpi.business_definition}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-[#252525] bg-[#111] flex justify-end gap-3">
              <button 
                onClick={() => setProcessingKpi(null)}
                className="button-secondary !py-2 !px-4 text-xs disabled:opacity-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleProcessSubmit("rejected")}
                className="inline-flex items-center justify-center border border-[#ef4444]/30 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] px-4 py-2 text-xs font-bold rounded-sm transition-colors disabled:opacity-50"
                disabled={isProcessing || processingKpi.status === "rejected"}
              >
                Reject Case
              </button>
              <button 
                onClick={() => handleProcessSubmit("approved")}
                className="inline-flex items-center justify-center bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 text-xs font-bold rounded-sm transition-colors disabled:opacity-50"
                disabled={isProcessing || processingKpi.status === "approved"}
              >
                {isProcessing ? "Processing..." : "Approve Case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
