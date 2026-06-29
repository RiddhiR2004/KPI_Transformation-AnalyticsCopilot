import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  Briefcase,
  ChevronRight,
  Calendar,
  Activity,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  Globe,
  Users,
  Eye,
  Server,
  Edit3,
} from "lucide-react";
import { api } from "../lib/api";
import type {
  ClientProfileWithCount,
  ClientInsightItem,
  EngagementRecord,
  EngagementCreate,
} from "../types/api";

/* ──────────────────────────── Client Profile Drawer ──────────────────────────── */
function ClientProfileDrawer({
  client,
  onClose,
}: {
  client: ClientProfileWithCount;
  onClose: () => void;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-[#303030] bg-[#1B1B1B] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#303030] bg-[#1B1B1B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFE600]/10 border border-[#FFE600]/30">
              <Building2 className="text-[#FFE600]" size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5]">
                Client Profile
              </h3>
              <p className="text-[11px] text-[#888]">{client.client_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#F5F5F5] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">
          {/* Client Information */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#FFE600]">
              Client Information
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Client Name", client.client_name],
                ["Industry", client.industry],
                ["Sub-Industry", client.sub_industry],
                ["Country", client.country],
                ["Region", client.region],
                ["Company Size", client.company_size],
              ].map(
                ([label, value]) =>
                  value && (
                    <div
                      key={label}
                      className="border border-[#252525] bg-[#111] rounded-sm p-3 space-y-0.5"
                    >
                      <span className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">
                        {label}
                      </span>
                      <p className="text-xs text-[#F5F5F5] font-medium">{value}</p>
                    </div>
                  )
              )}
            </div>
            {client.organization_description && (
              <div className="border border-[#252525] bg-[#111] rounded-sm p-3 space-y-1">
                <span className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">
                  Organization Description
                </span>
                <p className="text-xs text-[#B0B0B0] leading-relaxed">
                  {client.organization_description}
                </p>
              </div>
            )}
          </section>

          {/* Technology Landscape */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#FFE600]">
              Technology Landscape
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["ERP Platform", client.erp_platform],
                ["CRM Platform", client.crm_platform],
                ["MES Platform", client.mes_platform],
                ["BI Tool", client.bi_tool],
                ["Data Warehouse", client.data_warehouse],
                ["Cloud Platform", client.cloud_platform],
              ].map(
                ([label, value]) =>
                  value && (
                    <div
                      key={label}
                      className="border border-[#252525] bg-[#111] rounded-sm p-3 space-y-0.5"
                    >
                      <span className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">
                        {label}
                      </span>
                      <p className="text-xs text-[#F5F5F5] font-medium flex items-center gap-1.5">
                        <Server size={10} className="text-[#FFE600] shrink-0" />
                        {value}
                      </p>
                    </div>
                  )
              )}
            </div>
          </section>


        </div>
      </aside>
    </>
  );
}


/* ─────────────────────────── Engagement Cards Grid ─────────────────────────── */
function EngagementGrid({
  clientId,
  clientName,
  engagements,
  onRefresh,
  onOpenEngagement,
}: {
  clientId: number;
  clientName: string;
  engagements: EngagementRecord[];
  onRefresh: () => void;
  onOpenEngagement: (eng: EngagementRecord) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editEngagementId, setEditEngagementId] = useState<number | null>(null);
  const [engName, setEngName] = useState("");
  const [engIdField, setEngIdField] = useState("");
  const [engDesc, setEngDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!engName.trim()) {
      setError("Engagement name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editEngagementId) {
        await api.updateEngagement(editEngagementId, {
          client_profile_id: clientId,
          name: engName.trim(),
          engagement_id: engIdField.trim(),
          description: engDesc.trim(),
        });
      } else {
        await api.createEngagement({
          client_profile_id: clientId,
          name: engName.trim(),
          engagement_id: engIdField.trim(),
          description: engDesc.trim(),
        });
      }
      setShowModal(false);
      setEditEngagementId(null);
      setEngName("");
      setEngIdField("");
      setEngDesc("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editEngagementId ? "update" : "create"} engagement.`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (eng: EngagementRecord) => {
    setEditEngagementId(eng.id);
    setEngName(eng.name);
    setEngIdField(eng.engagement_id);
    setEngDesc(eng.description);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this engagement? This cannot be undone.")) return;
    try {
      await api.deleteEngagement(id);
      onRefresh();
    } catch { /* ignore */ }
  };

  const getStepInfo = (eng: EngagementRecord) => {
    const ws = eng.workflow_status;
    if (!ws) return { label: "Not started", color: "text-[#555] border-[#333] bg-[#1a1a1a]", pct: 0 };
    if (ws.technical_mapping)
      return { label: "Step 5 — Technical Mapping", color: "text-cyan-400 border-cyan-800 bg-cyan-950/30", pct: 100 };
    if (ws.functional_specification)
      return { label: "Step 4 — Functional Spec", color: "text-emerald-400 border-emerald-800 bg-emerald-950/30", pct: 80 };
    if (ws.kpi_tree)
      return { label: "Step 3 — KPI Driver Tree", color: "text-amber-400 border-amber-800 bg-amber-950/30", pct: 60 };
    if (ws.kpi_library)
      return { label: "Step 2 — KPI Library", color: "text-[#FFE600] border-[#FFE600]/30 bg-[#FFE600]/5", pct: 40 };
    if (ws.business_context)
      return { label: "Step 1 — Business Context", color: "text-[#FFE600] border-[#FFE600]/30 bg-[#FFE600]/5", pct: 20 };
    return { label: "Not started", color: "text-[#555] border-[#333] bg-[#1a1a1a]", pct: 0 };
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Briefcase className="text-[#FFE600]" size={16} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
            Engagements
          </h4>
          <span className="text-[10px] bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20 px-2 py-0.5 rounded-full font-semibold">
            {engagements.length}
          </span>
        </div>
        <button
          onClick={() => {
            setEditEngagementId(null);
            setEngName("");
            setEngIdField("");
            setEngDesc("");
            setShowModal(true);
          }}
          className="button-secondary flex items-center gap-1.5 text-xs py-2 px-4"
        >
          <Plus size={14} />
          New Engagement
        </button>
      </div>

      {/* Grid */}
      {engagements.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[#252525] border border-[#303030] flex items-center justify-center">
            <Briefcase className="text-[#555]" size={22} />
          </div>
          <p className="text-xs text-[#666] leading-relaxed max-w-sm">
            No engagements yet. Click{" "}
            <strong className="text-[#FFE600]">New Engagement</strong> to create
            your first project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engagements.map((eng) => {
            const step = getStepInfo(eng);

            return (
              <div
                key={eng.id}
                className="group border border-[#303030] hover:border-[#FFE600]/40 bg-[#111] rounded-sm p-5 space-y-3 transition-all duration-200 hover:bg-[#161616] relative"
              >
                <button
                  onClick={() => handleDelete(eng.id)}
                  title="Delete engagement"
                  className="absolute top-3 right-3 text-[#444] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>

                <div className="space-y-1.5 pr-6">
                  <h5 className="text-sm font-bold text-[#F5F5F5] leading-tight">
                    {eng.name}
                  </h5>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block text-[10px] font-mono text-[#FFE600] bg-[#FFE600]/10 border border-[#FFE600]/20 px-2 py-0.5 rounded-sm">
                      {eng.engagement_id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-sm ${step.color}`}
                    >
                      <Activity size={9} />
                      {step.label}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#252525]">
                  <div
                    className="h-full bg-[#FFE600] transition-all duration-500 rounded-full"
                    style={{ width: `${step.pct}%` }}
                  />
                </div>

                {eng.description && (
                  <p className="text-[11px] text-[#888] leading-relaxed line-clamp-2">
                    {eng.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[#222]">
                  <span className="flex items-center gap-1.5 text-[10px] text-[#555]">
                    <Calendar size={11} />
                    Last Updated: {new Date(eng.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })} {new Date(eng.updated_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }).toLowerCase()}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(eng)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B0B0B0] hover:text-[#FFE600] px-2 py-1.5 transition-all"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => onOpenEngagement(eng)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-[#FFE600] hover:bg-[#FFE600]/90 px-3 py-1.5 rounded-sm transition-all hover:translate-x-0.5"
                    >
                      Open <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Engagement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1B1B1B] border border-[#303030] rounded-sm p-8 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#303030] pb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="text-[#FFE600]" size={18} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5]">
                  {editEngagementId ? "Edit Engagement" : "New Engagement"} — {clientName}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#666] hover:text-[#F5F5F5] transition-colors">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900 p-3 rounded-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Engagement Name *</label>
                <input
                  type="text"
                  className="field"
                  placeholder="e.g. Phase 1 KPI Rollout"
                  value={engName}
                  onChange={(e) => setEngName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">
                  Description <span className="text-[#666] font-normal">(optional)</span>
                </label>
                <textarea
                  className="field min-h-[80px]"
                  placeholder="Brief description of this engagement's scope or objectives..."
                  value={engDesc}
                  onChange={(e) => setEngDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="button-yellow flex items-center gap-2 flex-1 justify-center"
              >
                {saving ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving...</>
                ) : (
                  <><Save size={15} /> Save Engagement</>
                )}
              </button>
              <button onClick={() => setShowModal(false)} className="button-secondary px-5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ──────────────────────────── Main Dashboard Page ─────────────────────────── */
export function ClientsDashboard() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientProfileWithCount | null>(null);
  const [engagements, setEngagements] = useState<EngagementRecord[]>([]);
  const [drawerClient, setDrawerClient] = useState<ClientProfileWithCount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activeId = localStorage.getItem("active_client_id");
    if (!activeId) {
      navigate("/");
      return;
    }
    
    // Clear any previously active engagement
    localStorage.removeItem("active_engagement_id");
    localStorage.removeItem("active_engagement_name");

    const loadData = async () => {
      try {
        const clients = await api.getClients();
        const activeClient = clients.find(c => c.id === Number(activeId));
        if (!activeClient) {
          localStorage.removeItem("active_client_id");
          localStorage.removeItem("active_client_name");
          navigate("/");
          return;
        }
        setClient(activeClient);
        const engs = await api.getEngagements(activeClient.id!);
        setEngagements(engs);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [navigate]);

  const loadEngagements = async () => {
    if (!client?.id) return;
    try {
      const engs = await api.getEngagements(client.id);
      setEngagements(engs);
    } catch (e) {
      console.error("Failed to load engagements:", e);
    }
  };

  const openEngagement = (eng: EngagementRecord) => {
    if (!client) return;
    localStorage.setItem("active_engagement_id", String(eng.id));
    localStorage.setItem("active_engagement_name", eng.name);
    localStorage.setItem("active_client_id", String(eng.client_profile_id));
    localStorage.setItem("active_client_name", client.client_name);
    navigate("/step-1");
  };

  if (loading || !client) {
    return (
      <div className="flex h-64 items-center justify-center text-[#FFE600]">
        <Loader2 size={28} className="animate-spin" />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-8 rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE600]">
              Engagement Hub
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5] flex items-center gap-3">
              <Building2 className="text-[#FFE600]" size={28} />
              {client.client_name}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#B0B0B0]">
              {client.industry && (
                <span className="flex items-center gap-1 bg-[#111] border border-[#333] px-2 py-1 rounded-sm">
                  <Globe size={12} className="text-[#888]" />
                  {client.industry}
                </span>
              )}
              {client.country && (
                <span className="bg-[#111] border border-[#333] px-2 py-1 rounded-sm">
                  {client.country}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerClient(client)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B0B0B0] hover:text-[#FFE600] border border-[#303030] hover:border-[#FFE600]/40 px-4 py-2 rounded-sm transition-all bg-[#111]"
            >
              <Eye size={14} />
              View Profile
            </button>
            <button
              onClick={() => navigate(`/onboarding/${client.id}`)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111] bg-[#FFE600] hover:bg-[#FFE600]/90 px-4 py-2 rounded-sm transition-all"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </section>

      {/* Engagement Grid */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-5 rounded-sm">
        <EngagementGrid
          clientId={client.id!}
          clientName={client.client_name}
          engagements={engagements}
          onRefresh={loadEngagements}
          onOpenEngagement={openEngagement}
        />
      </section>

      {/* Client Profile Drawer */}
      {drawerClient && (
        <ClientProfileDrawer
          client={drawerClient}
          onClose={() => setDrawerClient(null)}
        />
      )}
    </div>
  );
}
