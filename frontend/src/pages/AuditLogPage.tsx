import React, { useState, useEffect, useMemo } from "react";
import { 
  Shield, Search, Calendar, User, Filter, RefreshCw, X, ChevronDown, ChevronUp, 
  ExternalLink, CheckCircle2, AlertCircle, Clock, Database, UserCheck
} from "lucide-react";
import { api } from "../lib/api";
import type { ClientProfileWithCount, EngagementRecord } from "../types/api";

interface AuditLog {
  id: number;
  timestamp: string;
  user_name: string;
  user_email: string | null;
  action_type: string;
  entity_type: string | null;
  entity_name: string | null;
  previous_value: string | null;
  new_value: string | null;
  client_id: number | null;
  client_name: string | null;
  engagement_id: number | null;
  engagement_name: string | null;
  module: string;
  action: string;
  status: string;
}

const SUPPORTED_MODULES = [
  "Client Profile",
  "Technology Landscape",
  "Engagement Management",
  "Business Context",
  "Prompt Generation",
  "KPI Library",
  "Functional Specification",
  "Document Export",
  "Settings",
  "User Management"
];

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [clients, setClients] = useState<ClientProfileWithCount[]>([]);
  const [engagements, setEngagements] = useState<EngagementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<string>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filters State
  const [q, setQ] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedEngagement, setSelectedEngagement] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [userQuery, setUserQuery] = useState("");

  // Load clients and engagements for filter dropdowns
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [clientList, engList] = await Promise.all([
          api.getClients(),
          api.getEngagements()
        ]);
        setClients(clientList);
        setEngagements(engList);
      } catch (err) {
        console.error("Failed to load metadata filters:", err);
      }
    }
    loadMetadata();
  }, []);

  // Fetch logs with current filters
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const filters = {
        client_id: selectedClient ? Number(selectedClient) : undefined,
        engagement_id: selectedEngagement ? Number(selectedEngagement) : undefined,
        module: selectedModule || undefined,
        user: userQuery || undefined,
        q: q || undefined
      };
      const data = await api.getAuditLogs(filters);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedClient, selectedEngagement, selectedModule]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleResetFilters = () => {
    setQ("");
    setSelectedClient("");
    setSelectedEngagement("");
    setSelectedModule("");
    setUserQuery("");
    // Trigger reloading logs by calling fetch directly
    setTimeout(() => {
      setLogs([]);
      api.getAuditLogs({}).then(setLogs).catch(console.error);
    }, 50);
  };

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to descending
    }
  };

  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <span className="text-gray-600 ml-1 text-[9px] opacity-40">⇅</span>;
    }
    return sortDirection === "asc" ? (
      <span className="text-[#FFE600] ml-1 text-[9px]">▲</span>
    ) : (
      <span className="text-[#FFE600] ml-1 text-[9px]">▼</span>
    );
  };

  // Memoized sorted logs
  const sortedLogs = useMemo(() => {
    const sorted = [...logs];
    sorted.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";

      if (sortField === "timestamp") {
        aVal = a.timestamp ? Date.parse(a.timestamp) || 0 : 0;
        bVal = b.timestamp ? Date.parse(b.timestamp) || 0 : 0;
      } else if (sortField === "user") {
        aVal = (a.user_name || "").toLowerCase();
        bVal = (b.user_name || "").toLowerCase();
      } else if (sortField === "client") {
        aVal = (a.client_name || "").toLowerCase();
        bVal = (b.client_name || "").toLowerCase();
      } else if (sortField === "engagement") {
        aVal = (a.engagement_name || "").toLowerCase();
        bVal = (b.engagement_name || "").toLowerCase();
      } else if (sortField === "module") {
        aVal = (a.module || "").toLowerCase();
        bVal = (b.module || "").toLowerCase();
      } else if (sortField === "action") {
        aVal = (a.action || "").toLowerCase();
        bVal = (b.action || "").toLowerCase();
      } else if (sortField === "status") {
        aVal = (a.status || "").toLowerCase();
        bVal = (b.status || "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [logs, sortField, sortDirection]);



  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 size={12} /> Success
        </span>
      );
    } else if (s === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={12} /> Failed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock size={12} /> Pending
        </span>
      );
    }
  };

  // Helper to check if a log has actual payload values worth expanding
  const hasPayload = (log: AuditLog) => {
    const prev = log.previous_value;
    const next = log.new_value;
    const hasPrev = prev && prev !== "N/A" && prev.trim() !== "" && prev.trim() !== "null";
    const hasNext = next && next !== "N/A" && next.trim() !== "" && next.trim() !== "null";
    return !!(hasPrev || hasNext);
  };

  const formatJSONValue = (val: string | null) => {
    if (!val || val === "N/A" || val === "null" || val.trim() === "") return <span className="text-[#666] italic text-xs font-mono">N/A</span>;
    try {
      const parsed = JSON.parse(val);
      return <pre className="text-xs bg-[#111] border border-[#303030] p-4 rounded-sm overflow-x-auto text-[#B0B0B0] font-mono leading-relaxed max-w-full">{JSON.stringify(parsed, null, 2)}</pre>;
    } catch {
      return <div className="text-xs font-mono bg-[#111] border border-[#303030] p-4 rounded-sm break-all text-[#B0B0B0]">{val}</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-8 rounded-sm shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <Shield size={24} className="text-[#FFE600]" />
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5] font-sans">
                Audit Log & Governance
              </h2>
            </div>
            <p className="max-w-2xl text-xs text-[#B0B0B0] leading-relaxed">
              Provides real-time activity tracking, entity state diffing, and complete traceability of who performed what action, when, and where.
            </p>
          </div>
          <button 
            onClick={fetchLogs} 
            className="button-yellow inline-flex items-center gap-2 px-5 py-2.5 self-center shadow-md font-semibold text-xs transition-all"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </section>



      {/* Advanced Filter Toolbar */}
      <div className="border border-[#303030] bg-[#1B1B1B] p-6 rounded-sm space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#303030] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[#FFE600]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5] font-sans">
              Governance Filter Console
            </h3>
          </div>
          <button 
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] font-semibold text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-1.5 transition-colors"
          >
            <X size={12} /> Clear Filter Parameters
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Global Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Keyword Search</label>
            <div className="relative">
              <input 
                type="text" 
                className="field pl-9 w-full text-xs py-2" 
                placeholder="Search audit content..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-[#555]" size={13} />
            </div>
          </div>

          {/* Client Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Filter by Client</label>
            <select 
              className="field w-full text-xs py-2 cursor-pointer"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>

          {/* Engagement Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Filter by Engagement</label>
            <select 
              className="field w-full text-xs py-2 cursor-pointer"
              value={selectedEngagement}
              onChange={(e) => setSelectedEngagement(e.target.value)}
            >
              <option value="">All Engagements</option>
              {engagements
                .filter(eng => !selectedClient || eng.client_profile_id === Number(selectedClient))
                .map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.name} ({eng.engagement_id})</option>
                ))}
            </select>
          </div>

          {/* Module Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Filter by Module</label>
            <select 
              className="field w-full text-xs py-2 cursor-pointer"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="">All Modules</option>
              {SUPPORTED_MODULES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Filter by User</label>
            <div className="relative">
              <input 
                type="text" 
                className="field pl-9 w-full text-xs py-2" 
                placeholder="User name or email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <User className="absolute left-3 top-2.5 text-[#555]" size={13} />
            </div>
          </div>

          {/* Search Trigger Button */}
          <div className="flex items-end">
            <button 
              type="submit" 
              className="button-yellow w-full py-2 flex items-center justify-center gap-2 shadow-sm"
            >
              <Search size={13} />
              <span>Apply Filters</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Audit Log Table */}
      <div className="border border-[#303030] bg-[#1B1B1B] rounded-sm overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111111] border-b border-[#303030] text-[10px] font-bold uppercase tracking-wider text-[#888] select-none">
                <th className="py-4 px-6 w-[30px] text-center"></th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("timestamp")}
                >
                  Timestamp {renderSortIndicator("timestamp")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("user")}
                >
                  User {renderSortIndicator("user")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("client")}
                >
                  Client {renderSortIndicator("client")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("engagement")}
                >
                  Engagement {renderSortIndicator("engagement")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("module")}
                >
                  Module {renderSortIndicator("module")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("action")}
                >
                  Action {renderSortIndicator("action")}
                </th>
                
                <th 
                  className="py-4 px-4 cursor-pointer hover:text-[#FFE600] transition-colors"
                  onClick={() => handleSort("status")}
                >
                  Status {renderSortIndicator("status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303030]/40 text-xs text-[#E0E0E0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#888]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-[#FFE600]" />
                      <span>Loading governance logs...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#888]">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                      <Shield size={32} className="text-[#303030]" />
                      <span className="font-semibold text-sm text-[#F5F5F5]">No audit records match the selected filter criteria.</span>
                      <span className="text-[11px] text-gray-500">Try adjusting your filter parameters or search terms to locate specific compliance logs.</span>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 button-yellow !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5"
                      >
                        <RefreshCw size={11} />
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedLogs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  const logHasPayload = hasPayload(log);
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={logHasPayload ? () => setExpandedLogId(isExpanded ? null : log.id) : undefined}
                        className={`border-l-4 transition-all duration-150 ${
                          logHasPayload 
                            ? "hover:bg-[#111]/45 cursor-pointer" 
                            : "hover:bg-transparent cursor-default"
                        } ${
                          isExpanded ? "bg-[#111]/30 border-l-[#FFE600]" : "border-l-transparent"
                        }`}
                      >
                        <td className="py-4 px-6 text-center text-[#555]">
                          {logHasPayload ? (
                            isExpanded ? (
                              <ChevronUp size={14} className="text-[#FFE600]" />
                            ) : (
                              <ChevronDown size={14} className="hover:text-gray-400" />
                            )
                          ) : (
                            <span className="inline-block w-1 h-1 bg-[#303030] rounded-full" />
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono font-medium text-[#B0B0B0] whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-[#F5F5F5]">{log.user_name}</div>
                          <div className="text-[10px] text-[#666]">{log.user_email || "No Email"}</div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-[#F5F5F5]">
                          {log.client_name || <span className="text-[#555] font-semibold">—</span>}
                        </td>
                        <td className="py-4 px-4 text-[#F5F5F5]">
                          {log.engagement_name || <span className="text-[#555] font-semibold">—</span>}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 bg-[#111] border border-[#303030] rounded-sm text-[10px] font-semibold text-[#FFE600] whitespace-nowrap">
                            {log.module}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#FFE600] whitespace-nowrap font-sans">
                          {log.action}
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(log.status)}
                        </td>
                      </tr>
                      {isExpanded && logHasPayload && (
                        <tr className="bg-[#111111]/50 border-t border-[#303030]">
                          <td colSpan={8} className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 text-xs text-[#B0B0B0]">
                              {/* Left details pane */}
                              <div className="space-y-4 border-r border-[#303030] pr-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-1.5 font-sans">
                                  <Database size={12} className="text-[#FFE600]" /> Entity Metadata
                                </h4>
                                <div className="grid grid-cols-[100px_1fr] gap-y-3 leading-relaxed">
                                  <div className="font-bold text-[#666]">Audit Log ID:</div>
                                  <div className="font-mono text-xs">{log.id}</div>

                                  <div className="font-bold text-[#666]">Action Type:</div>
                                  <div>{log.action_type}</div>

                                  <div className="font-bold text-[#666]">Entity Type:</div>
                                  <div>{log.entity_type || "N/A"}</div>

                                  <div className="font-bold text-[#666]">Entity Name:</div>
                                  <div className="text-[#F5F5F5] font-medium">{log.entity_name || "N/A"}</div>

                                  <div className="font-bold text-[#666]">Client ID:</div>
                                  <div>{log.client_id || "N/A"}</div>

                                  <div className="font-bold text-[#666]">Engagement ID:</div>
                                  <div>{log.engagement_id || "N/A"}</div>
                                </div>
                                <div className="pt-2 border-t border-[#303030]/60 flex items-center gap-1.5 text-[10px] text-[#666]">
                                  <UserCheck size={12} className="text-[#FFE600]" />
                                  <span>Logged by user: {log.user_name} ({log.user_email || "N/A"})</span>
                                </div>
                              </div>

                              {/* Right diff pane */}
                              <div className="space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-1.5 font-sans">
                                  <ExternalLink size={12} className="text-[#FFE600]" /> Change Diff & Payload Values
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Previous Value (Before)</div>
                                    {formatJSONValue(log.previous_value)}
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#666]">New Value (After)</div>
                                    {formatJSONValue(log.new_value)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-[#111111] px-6 py-4 border-t border-[#303030] flex items-center justify-between text-[11px] text-[#666] font-semibold select-none">
          <span>Displaying {logs.length} governance events</span>
          <span>Compliance tracking active</span>
        </div>
      </div>
    </div>
  );
}
