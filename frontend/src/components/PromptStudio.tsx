import { Play, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BusinessContext, PromptRecord } from "../types/api";

export function PromptStudio({ onChange }: { onChange: () => void }) {
  const [record, setRecord] = useState<PromptRecord>({ prompt: "", ai_summary: {} });
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getPrompt().then((data) => {
      if (data.prompt) setRecord(data as PromptRecord);
    });
    api.getContext().then((data) => {
      if (data.industry) setContext(data as BusinessContext);
    });
  }, []);

  async function savePrompt() {
    if (!record.prompt) return;
    await api.savePrompt(record);
    onChange();
  }

  async function generateKpis() {
    setBusy(true);
    setError("");
    try {
      await savePrompt();
      await api.generateKpis();
      onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : "KPI generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-7">
      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFE600]">Prompt Studio</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#F5F5F5]">KPI Generation Prompt</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
            Review and adjust the generated business-readable KPI prompt draft before launching the Advisory AI engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" disabled={!record.prompt} onClick={savePrompt}>
            <Save size={16} />
            Save Draft
          </button>
          <button className="button-yellow" disabled={!record.prompt || busy} onClick={generateKpis}>
            <Play size={16} />
            {busy ? "Generating..." : "Generate KPI Library"}
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* User-facing visible prompt workpaper */}
        <div className="flex flex-col space-y-2">
          <textarea
            className="field min-h-[400px] resize-y font-mono text-xs leading-relaxed p-4"
            value={record.prompt}
            onChange={(event) => setRecord({ ...record, prompt: event.target.value })}
            aria-label="KPI Generation Prompt Content"
          />
        </div>

        {/* Business Context Summary Column */}
        <div className="border border-[#303030] bg-[#111111] p-5 rounded-sm space-y-4 self-start">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFE600]">Engagement Context Summary</p>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-[#303030]/30 pb-2">
              <span className="text-[#B0B0B0]">Industry Context:</span>
              <span className="font-bold text-[#F5F5F5]">{context?.industry || "—"}</span>
            </div>
            
            <div className="flex justify-between border-b border-[#303030]/30 pb-2">
              <span className="text-[#B0B0B0]">Org Level Target:</span>
              <span className="font-bold text-[#F5F5F5]">{context?.organization_level || "—"}</span>
            </div>
            
            <div className="flex justify-between border-b border-[#303030]/30 pb-2">
              <span className="text-[#B0B0B0]">Target KPI Count:</span>
              <span className="font-bold text-[#FFE600]">{context?.kpi_count || "—"} Metrics</span>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1.5">Functional Scope</span>
              <div className="flex flex-wrap gap-1">
                {context?.functional_areas.map(a => (
                  <span key={a} className="bg-[#1B1B1B] text-[#F5F5F5] border border-[#303030] px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#B0B0B0] block mb-1.5">Top KRAs Covered</span>
              <div className="flex flex-wrap gap-1">
                {context?.top_kras.map(k => (
                  <span key={k} className="bg-[#1B1B1B]/40 text-[#FFE600] border border-[#FFE600]/20 px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
