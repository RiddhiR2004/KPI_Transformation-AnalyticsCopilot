import { Save, Sparkles, RefreshCw, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { metadataService } from "../lib/metadataService";
import type { BusinessContext } from "../types/api";
import { MultiSelect } from "./MultiSelect";

function CustomValueInput({
  label,
  value = [],
  predefinedSelected = [],
  onChange,
  placeholder = "Enter custom value..."
}: {
  label: string;
  value: string[];
  predefinedSelected: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    // 1. Trim whitespace and limit to 100 characters
    const trimmed = newValue.trim().substring(0, 100);
    
    // 2. Ignore empty submissions
    if (!trimmed) return;

    // 3. Case-insensitive duplicate checks
    const lowerNew = trimmed.toLowerCase();
    const isDupInPredefined = predefinedSelected.some(item => item.toLowerCase() === lowerNew);
    const isDupInCustom = value.some(item => item.toLowerCase() === lowerNew);

    if (!isDupInPredefined && !isDupInCustom) {
      onChange([...value, trimmed]);
    }
    setNewValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (itemToRemove: string) => {
    onChange(value.filter(item => item !== itemToRemove));
  };

  return (
    <div className="mt-3 border-t border-[#303030]/60 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">{label}</span>
        <span className="text-[9px] text-[#808080] italic">Add custom values not available in the predefined list.</span>
      </div>
      
      {/* List of current custom values */}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-w-full">
          {value.map((item, index) => (
            <div 
              key={index} 
              className="flex items-center max-w-full gap-1.5 bg-[#1B1B1B]/80 text-[#FFE600]/90 border border-[#FFE600]/20 px-2 py-0.5 text-xs font-semibold rounded-sm"
            >
              <span className="truncate min-w-0" title={item}>{item}</span>
              <button
                type="button"
                className="text-[#808080] hover:text-[#FFE600] transition shrink-0"
                onClick={() => handleRemove(item)}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row to add new custom value with max length 100 */}
      <div className="mt-2 flex gap-1.5">
        <input
          type="text"
          className="field text-xs font-semibold py-1 px-2.5 h-8 flex-1"
          placeholder={placeholder}
          maxLength={100}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="button-yellow py-1 px-2.5 h-8 text-xs flex items-center justify-center gap-1 bg-[#FFE600] text-[#111111]"
          onClick={handleAdd}
        >
          <Plus size={12} />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}

export function BusinessContextStep({ onChange }: { onChange: () => void }) {
  const [form, setForm] = useState<BusinessContext>({
    industry: "",
    organization_level: "",
    kpi_count: 8,
    business_priorities: [],
    business_challenges: [],
    top_kras: [],
    functional_areas: [],
    additional_business_priorities: [],
    additional_business_challenges: [],
    additional_kras: [],
    additional_functional_areas: []
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const [industries, setIndustries] = useState<string[]>([]);
  const [organizationLevels, setOrganizationLevels] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [kras, setKras] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      metadataService.getMetadataNames("industries"),
      metadataService.getMetadataNames("org-levels"),
      metadataService.getMetadataNames("priorities"),
      metadataService.getMetadataNames("challenges"),
      metadataService.getMetadataNames("kras"),
      metadataService.getMetadataNames("functional-areas")
    ]).then(([ind, org, prio, chal, kra, ar]) => {
      setIndustries(ind);
      setOrganizationLevels(org);
      setPriorities(prio);
      setChallenges(chal);
      setKras(kra);
      setAreas(ar);

      const defaultIndustry = ind.find(x => x === "Manufacturing") || ind[0] || "";
      const defaultOrgLevel = org.find(x => x === "CXO") || org[0] || "";
      const defaultPriorities = prio.filter(x => x === "Improve Gross Margin" || x === "Improve Cash Flow");
      const defaultChallenges = chal.filter(x => x === "Supply Chain Delays" || x === "Margin Leakage from Discounting");
      const defaultKras = kra.filter(x => x === "Profitability" || x === "Operational Excellence");
      const defaultAreas = ar.filter(x => x === "Sales" || x === "Production" || x === "Supply Chain" || x === "Finance");

      const dynamicDefaults: BusinessContext = {
        industry: defaultIndustry,
        organization_level: defaultOrgLevel,
        kpi_count: 8,
        business_priorities: defaultPriorities,
        business_challenges: defaultChallenges,
        top_kras: defaultKras,
        functional_areas: defaultAreas,
        additional_business_priorities: [],
        additional_business_challenges: [],
        additional_kras: [],
        additional_functional_areas: []
      };

      api.getContext().then((data) => {
        if (data.industry) {
          setForm({ ...dynamicDefaults, ...data } as BusinessContext);
        } else {
          setForm(dynamicDefaults);
        }
        setLoading(false);
      });
    }).catch((err) => {
      console.error("Failed to load metadata lists", err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const handle = window.setTimeout(() => {
      void save(false);
    }, 700);
    return () => window.clearTimeout(handle);
  }, [form, loading]);

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

  if (loading) {
    return (
      <section className="panel p-7 flex h-64 items-center justify-center text-[#FFE600]">
        <RefreshCw size={28} className="animate-spin" />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Strategic Context Schema...</span>
      </section>
    );
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
        <div className="flex flex-col justify-between border border-[#303030] bg-[#111111]/30 p-4 rounded-sm">
          <MultiSelect label="Business Priorities" options={priorities} value={form.business_priorities} onChange={(value) => setForm({ ...form, business_priorities: value })} />
          <CustomValueInput label="Additional Priorities" predefinedSelected={form.business_priorities} value={form.additional_business_priorities || []} onChange={(value) => setForm({ ...form, additional_business_priorities: value })} />
        </div>
        <div className="flex flex-col justify-between border border-[#303030] bg-[#111111]/30 p-4 rounded-sm">
          <MultiSelect label="Current Business Challenges" options={challenges} value={form.business_challenges} onChange={(value) => setForm({ ...form, business_challenges: value })} />
          <CustomValueInput label="Additional Challenges" predefinedSelected={form.business_challenges} value={form.additional_business_challenges || []} onChange={(value) => setForm({ ...form, additional_business_challenges: value })} />
        </div>
        <div className="flex flex-col justify-between border border-[#303030] bg-[#111111]/30 p-4 rounded-sm">
          <MultiSelect label="Top KRAs" options={kras} value={form.top_kras} onChange={(value) => setForm({ ...form, top_kras: value })} />
          <CustomValueInput label="Additional KRAs" predefinedSelected={form.top_kras} value={form.additional_kras || []} onChange={(value) => setForm({ ...form, additional_kras: value })} />
        </div>
        <div className="flex flex-col justify-between border border-[#303030] bg-[#111111]/30 p-4 rounded-sm">
          <MultiSelect label="Functional Areas" options={areas} value={form.functional_areas} onChange={(value) => setForm({ ...form, functional_areas: value })} />
          <CustomValueInput label="Additional Functional Areas" predefinedSelected={form.functional_areas} value={form.additional_functional_areas || []} onChange={(value) => setForm({ ...form, additional_functional_areas: value })} />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#303030] pt-4 text-xs text-[#B0B0B0]">
        <span>{saving ? "Saving..." : message || "Changes are saved automatically."}</span>
      </div>
    </section>
  );
}
