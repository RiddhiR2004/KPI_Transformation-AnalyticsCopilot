import React, { useState, useEffect } from "react";
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

  // Helper to safely parse JSON for printing
  const formatJSONValue = (val: string | null) => {
    if (!val) return "N/A";
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
      <section className="border border-[#303030] bg-[#1B1B1B] p-8 rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <Shield size={24} className="text-[#FFE600]" />
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5]">
                Audit Log & Governance
              </h2>
            </div>
            <p className="max-w-2xl text-xs text-[#B0B0B0] leading-relaxed">
              Provides real-time activity tracking, entity state diffing, and complete traceability of who performed what action, when, and where.
            </p>
          </div>
          <button 
            onClick={fetchLogs} 
            className="button-yellow inline-flex items-center gap-2 px-5 py-2.5 self-center"
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
              Governance Filter Console
            </h3>
          </div>
          <button 
            onClick={handleResetFilters}
            className="text-[11px] font-semibold text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-1.5 transition-colors"
          >
            <X size={12} /> Clear Filter Parameters
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Global Search */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Keyword Search</label>
            <div className="relative">
              <input 
                type="text" 
                className="field pl-9 w-full" 
                placeholder="Search values, actions, users..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-[#555]" size={14} />
            </div>
          </div>

          {/* Client Select */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Filter by Client</label>
            <select 
              className="field w-full"
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
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Filter by Engagement</label>
            <select 
              className="field w-full"
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
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Filter by Module</label>
            <select 
              className="field w-full"
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
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Filter by User</label>
            <div className="relative">
              <input 
                type="text" 
                className="field pl-9 w-full" 
                placeholder="User name or email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <User className="absolute left-3 top-2.5 text-[#555]" size={14} />
            </div>
          </div>

          {/* Search Trigger Button */}
          <div className="flex items-end">
            <button 
              type="submit" 
              className="button-yellow w-full py-2.5 flex items-center justify-center gap-2"
            >
              <Search size={14} />
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
              <tr className="bg-[#111111] border-b border-[#303030] text-[10px] font-bold uppercase tracking-wider text-[#888]">
                <th className="py-4 px-6 w-[20px]"></th>
                <th className="py-4 px-4">Timestamp</th>
                <th className="py-4 px-4">User</th>
                <th className="py-4 px-4">Client</th>
                <th className="py-4 px-4">Engagement</th>
                <th className="py-4 px-4">Module</th>
                <th className="py-4 px-4">Action</th>
                <th className="py-4 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303030]/40 text-xs text-[#E0E0E0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#888]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-[#FFE600]" />
                      <span>Loading governance logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#888]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Shield size={28} className="text-[#303030] mb-1" />
                      <span className="font-semibold text-sm">No audit records found</span>
                      <span className="text-[11px]">Modify your governance filter criteria and try again.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`hover:bg-[#111]/40 cursor-pointer border-l-4 transition-all duration-150 ${
                          isExpanded ? "bg-[#111]/30 border-l-[#FFE600]" : "border-l-transparent"
                        }`}
                      >
                        <td className="py-4 px-6 text-center text-[#555]">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
                        <td className="py-4 px-4 font-semibold text-[#FFE600] whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(log.status)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#111111]/50 border-t border-[#303030]">
                          <td colSpan={8} className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 text-xs text-[#B0B0B0]">
                              {/* Left details pane */}
                              <div className="space-y-4 border-r border-[#303030] pr-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-1.5">
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
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-1.5">
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
        <div className="bg-[#111111] px-6 py-4 border-t border-[#303030] flex items-center justify-between text-[11px] text-[#666] font-semibold">
          <span>Displaying {logs.length} governance events</span>
          <span>Compliance tracking active</span>
        </div>
      </div>
    </div>
  );
}
