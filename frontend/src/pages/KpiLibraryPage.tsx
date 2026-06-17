import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { KpiLibrary } from "../components/KpiLibrary";
import { PromptStudio } from "../components/PromptStudio";
import type { ExportItem, ClientProfile } from "../types/api";
import { api } from "../lib/api";

export function KpiLibraryPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);

  useEffect(() => {
    api.getClientProfile().then((p) => setClientProfile(p)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 02</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">KPI Library Generation</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Generate KPIs from the saved prompt, review data quality, edit definitions and approve records for leadership review.
        </p>
        {/* Client Context Banner */}
        {clientProfile?.client_name && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border border-[#FFE600]/20 bg-[#FFE600]/5 px-4 py-3 rounded-sm">
            <div className="flex items-center gap-2 shrink-0">
              <Building2 size={14} className="text-[#FFE600]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFE600]">Client Context</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#B0B0B0]">
              <span><span className="text-[#F5F5F5] font-semibold">{clientProfile.client_name}</span></span>
              {clientProfile.industry && <span>Industry: <span className="text-[#F5F5F5]">{clientProfile.industry}</span></span>}
              {clientProfile.country && <span>Country: <span className="text-[#F5F5F5]">{clientProfile.country}</span></span>}
              {clientProfile.erp_platform && <span>ERP: <span className="text-[#F5F5F5]">{clientProfile.erp_platform}</span></span>}
              {clientProfile.crm_platform && <span>CRM: <span className="text-[#F5F5F5]">{clientProfile.crm_platform}</span></span>}
            </div>
          </div>
        )}
      </section>
      
      <PromptStudio onChange={onChange} />
      
      <KpiLibrary onChange={onChange} exports={exports} />
    </div>
  );
}
