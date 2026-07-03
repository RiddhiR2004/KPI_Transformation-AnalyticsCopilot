import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Globe, Briefcase, ChevronRight, Loader2, Search, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { ClientProfileWithCount } from "../types/api";

export function ClientSelectionPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientProfileWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    // Clear any previously active engagement on landing
    localStorage.removeItem("active_engagement_id");
    localStorage.removeItem("active_engagement_name");
    localStorage.removeItem("active_client_id");
    localStorage.removeItem("active_client_name");

    const loadClients = async (retries = 3) => {
      setLoading(true);
      setError(null);
      for (let i = 0; i < retries; i++) {
        try {
          const data = await api.getClients();
          setClients(data);
          setLoading(false);
          return;
        } catch (e: any) {
          console.warn(`Attempt ${i + 1} failed to load clients:`, e);
          if (i === retries - 1) {
            setError(e.message || "Failed to load clients.");
            setLoading(false);
          } else {
            // Wait 1 second before retrying
            await new Promise(res => setTimeout(res, 1000));
          }
        }
      }
    };
    void loadClients();
  }, []);

  const selectClient = (client: ClientProfileWithCount) => {
    localStorage.setItem("active_client_id", String(client.id));
    localStorage.setItem("active_client_name", client.client_name);
    navigate("/dashboard");
  };

  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the client "${name}" and all their engagements? This cannot be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await api.deleteClient(id);
      // Clear local storage if the deleted client is currently active
      if (localStorage.getItem("active_client_id") === String(id)) {
        localStorage.removeItem("active_client_id");
        localStorage.removeItem("active_client_name");
        localStorage.removeItem("active_engagement_id");
        localStorage.removeItem("active_engagement_name");
      }
      setClients(clients.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete client:", err);
      alert("Failed to delete client.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredClients = clients.filter(c => 
    c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.industry && c.industry.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#FFE600]">
        <Loader2 size={28} className="animate-spin" />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Clients...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8">
      {/* Header */}
      <section className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-[#FFE600]/10 border border-[#FFE600]/30 flex items-center justify-center mb-6">
          <Building2 className="text-[#FFE600]" size={28} />
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5]">
          Select a Client
        </h1>
        <p className="max-w-xl mx-auto text-sm text-[#B0B0B0] leading-relaxed">
          Choose an existing client organization below to manage their engagements, or onboard a new client to get started.
        </p>
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1B1B1B] p-4 border border-[#303030] rounded-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" size={16} />
          <input 
            type="text" 
            placeholder="Search clients by name or industry..." 
            className="w-full bg-[#111] border border-[#333] rounded-sm py-2 pl-9 pr-4 text-sm text-[#F5F5F5] focus:border-[#FFE600]/50 focus:outline-none transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => navigate("/onboarding")}
          className="inline-flex items-center gap-2 bg-[#FFE600] hover:bg-[#FFE600]/90 text-black text-xs font-bold py-2.5 px-5 rounded-sm transition-all shadow-lg"
        >
          <Plus size={15} />
          New Client
        </button>
      </div>

      {/* Client Grid */}
      {error ? (
        <section className="border border-red-500/30 bg-red-500/10 p-12 rounded-sm text-center space-y-4">
          <h3 className="text-lg font-semibold text-red-400">Connection Error</h3>
          <p className="text-sm text-red-300 max-w-md mx-auto leading-relaxed">
            Could not connect to the server. The backend might still be starting up.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-sm text-sm font-semibold transition-colors"
          >
            Try Again
          </button>
        </section>
      ) : clients.length === 0 ? (
        <section className="border border-[#303030] bg-[#1B1B1B] p-12 rounded-sm text-center space-y-4">
          <h3 className="text-lg font-semibold text-[#F5F5F5]">No Clients Found</h3>
          <p className="text-xs text-[#888] max-w-md mx-auto leading-relaxed">
            Start by onboarding your first client. Click <strong className="text-[#FFE600]">+ New Client</strong> above to set up a profile.
          </p>
        </section>
      ) : filteredClients.length === 0 ? (
        <section className="border border-[#303030] bg-[#1B1B1B] p-12 rounded-sm text-center space-y-4">
          <p className="text-sm text-[#888]">No clients match your search.</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => selectClient(client)}
              className="group border border-[#303030] hover:border-[#FFE600]/50 bg-[#1B1B1B] rounded-sm p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden"
            >
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFE600]/0 via-[#FFE600]/0 to-[#FFE600]/0 group-hover:from-[#FFE600]/20 group-hover:via-[#FFE600] group-hover:to-[#FFE600]/20 transition-all duration-500" />
              
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111] border border-[#333] group-hover:border-[#FFE600]/30 group-hover:bg-[#FFE600]/10 transition-colors">
                    <Building2 className="text-[#888] group-hover:text-[#FFE600] transition-colors" size={20} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => client.id !== undefined && handleDelete(e, client.id, client.client_name)}
                      disabled={deletingId === client.id}
                      className="text-[#666] hover:text-red-400 p-1.5 rounded-full hover:bg-red-400/10 transition-colors"
                      title="Delete Client"
                    >
                      {deletingId === client.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                    <ChevronRight size={18} className="text-[#444] group-hover:text-[#FFE600] transition-colors" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#F5F5F5] group-hover:text-white transition-colors line-clamp-1">
                    {client.client_name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#888]">
                    {client.industry && (
                      <span className="flex items-center gap-1">
                        <Globe size={12} />
                        {client.industry}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#303030] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-[#FFE600] font-medium">
                    <Briefcase size={14} />
                    {client.engagement_count || 0} Engagements
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#666] group-hover:text-[#FFE600]/80 transition-colors">
                    Select Client
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
