import { Save, Sparkles, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { BusinessContext } from "../types/api";
import { MultiSelect } from "./MultiSelect";

const industries = [
  "Manufacturing",
  "Retail",
  "Technology",
  "Telecom",
  "Healthcare",
  "FMCG",
  "Automotive",
  "Energy",
  "Chemicals",
  "Banking",
  "Consumer Electronics",
  "Public Sector",
  "Logistics",
  "Financial Services"
];

const organizationLevels = [
  "Board",
  "CXO",
  "Business Unit",
  "Function Head",
  "Regional Leadership"
];

const priorities = [
  "Improve Gross Margin",
  "Improve Cash Flow",
  "Accelerate Revenue Growth",
  "Reduce Operating Cost",
  "Improve Customer Retention",
  "Increase Asset Productivity",
  "Strengthen Forecast Accuracy",
  "Improve Working Capital",
  "Enhance Process Automation",
  "Reduce Defect Rates",
  "Minimize ESG Carbon Intensity",
  "Improve Workplace Safety"
];

const challenges = [
  "High Operational Cost",
  "Supply Chain Delays",
  "Demand Volatility",
  "Manual Data Collection",
  "Low Inventory Turn Velocity",
  "Margin Leakage from Discounting",
  "Customer Churn and Complaints",
  "High Defect and Scrap Rates",
  "Safety Compliance Risks",
  "Excess Working Capital Lock-up"
];

const kras = [
  "Revenue Growth",
  "Profitability",
  "Customer Growth",
  "Operational Excellence",
  "Cost Reduction",
  "Asset Productivity",
  "Cash Flow",
  "Risk Management"
];

const areas = [
  "Sales",
  "Production",
  "Supply Chain",
  "Finance",
  "Quality",
  "Customer Service",
  "Procurement",
  "Operations"
];

const defaults: BusinessContext = {
  industry: "Manufacturing",
  organization_level: "CXO",
  kpi_count: 8,
  business_priorities: ["Improve Gross Margin", "Improve Cash Flow"],
  business_challenges: ["Supply Chain Delays", "Margin Leakage from Discounting"],
  top_kras: ["Profitability", "Operational Excellence"],
  functional_areas: ["Sales", "Production", "Supply Chain", "Finance"]
};

export function BusinessContextStep({ onChange }: { onChange: () => void }) {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.getContext().then((data) => {
      if (data.industry) setForm({ ...defaults, ...data } as BusinessContext);
    });
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void save(false);
    }, 700);
    return () => window.clearTimeout(handle);
  }, [form]);

  async function save(showMessage = true) {
    const kCount = Number(form.kpi_count);
    if (isNaN(kCount) || kCount < 1 || kCount > 50) {
      if (showMessage) {
        const clamped = Math.max(1, Math.min(50, isNaN(kCount) ? 8 : kCount));
        setForm(prev => ({ ...prev, kpi_count: clamped }));
        setSaving(true);
        await api.saveContext({ ...form, kpi_count: clamped }).catch(() => undefined);
        setSaving(false);
        setMessage("Context saved");
        onChange();
      }
      return;
    }
    setSaving(true);
    await api.saveContext({ ...form, kpi_count: Math.floor(kCount) }).catch(() => undefined);
    setSaving(false);
    if (showMessage) setMessage("Context saved");
    onChange();
  }

  async function generatePrompt() {
    setGenerating(true);
    try {
      await save(false);
      await api.generatePrompt();
      setMessage("Prompt generated");
      onChange();
      navigate("/step-2");
    } catch (err) {
      setMessage("Failed to generate prompt");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="panel p-7">
      <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFE600]">Context Intake</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#F5F5F5]">Executive KPI Scope</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
            Select the business context that will shape KPI coverage, ownership, and measurement design.
          </p>
        </div>
        <button className="button-yellow" onClick={generatePrompt} disabled={generating}>
          {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? "Generating..." : "Generate KPI Prompt"}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="label">Industry</label>
          <select className="field text-xs font-semibold" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}>
            {industries.map((item) => <option key={item} className="bg-[#1B1B1B] text-[#F5F5F5]">{item}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Organization Level</label>
          <select className="field text-xs font-semibold" value={form.organization_level} onChange={(event) => setForm({ ...form, organization_level: event.target.value })}>
            {organizationLevels.map((item) => <option key={item} className="bg-[#1B1B1B] text-[#F5F5F5]">{item}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Number of KPIs Required</label>
          <input
            type="number"
            className="field text-xs font-semibold"
            min={1}
            max={50}
            value={form.kpi_count === 0 || isNaN(form.kpi_count) ? "" : form.kpi_count}
            onChange={(event) => {
              const val = event.target.value;
              if (val === "") {
                setForm({ ...form, kpi_count: "" as any });
              } else {
                const parsed = parseInt(val, 10);
                setForm({ ...form, kpi_count: isNaN(parsed) ? ("" as any) : parsed });
              }
            }}
            onBlur={() => {
              const current = Number(form.kpi_count);
              const clamped = Math.max(1, Math.min(50, isNaN(current) ? 8 : current));
              setForm({ ...form, kpi_count: clamped });
            }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <MultiSelect label="Business Priorities" options={priorities} value={form.business_priorities} onChange={(value) => setForm({ ...form, business_priorities: value })} />
        <MultiSelect label="Current Business Challenges" options={challenges} value={form.business_challenges} onChange={(value) => setForm({ ...form, business_challenges: value })} />
        <MultiSelect label="Top KRAs" options={kras} value={form.top_kras} onChange={(value) => setForm({ ...form, top_kras: value })} />
        <MultiSelect label="Functional Areas" options={areas} value={form.functional_areas} onChange={(value) => setForm({ ...form, functional_areas: value })} />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#303030] pt-4 text-xs text-[#B0B0B0]">
        <span>{saving ? "Saving..." : message || "Changes are saved automatically."}</span>
      </div>
    </section>
  );
}
