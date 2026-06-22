import { AlertCircle, ArrowLeft, CheckCircle, Download, Edit3, FileText, Play, Save, RefreshCw, ChevronDown, ChevronRight, Check, Printer, Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, exportUrl } from "../lib/api";
import type { ExportItem, FunctionalSpecification, FunctionalSpecItem, KPILibrary, BusinessContext, ClientProfile } from "../types/api";

const sectionConfigs = [
  {
    id: "section-A",
    title: "Section A: KPI Overview",
    fields: [
      { key: "kpi_category", label: "KPI Category", type: "input" },
      { key: "functional_area", label: "Functional Area", type: "input" },
      { key: "related_kra", label: "Related KRA", type: "input" },
      { key: "strategic_objective_supported", label: "Strategic Objective Supported", type: "input" },
      { key: "business_challenge_addressed", label: "Business Challenge Addressed", type: "input" },
      { key: "business_owner", label: "Business Owner", type: "input" },
      { key: "data_owner", label: "Data Owner", type: "input" },
    ]
  },
  {
    id: "section-B",
    title: "Section B: Business Purpose & Strategic Relevance",
    fields: [
      { key: "business_purpose_relevance", label: "Business Purpose & Strategic Relevance", type: "textarea" }
    ]
  },
  {
    id: "section-C",
    title: "Section C: KPI Definition",
    fields: [
      { key: "kpi_definition", label: "KPI Definition", type: "textarea" }
    ]
  },
  {
    id: "section-D",
    title: "Section D: Calculation Methodology",
    fields: [
      { key: "formula", label: "Formula Logic", type: "input" },
      { key: "numerator", label: "Numerator Detail", type: "input" },
      { key: "denominator", label: "Denominator Detail", type: "input" },
      { key: "calculation_methodology", label: "Calculation Methodology", type: "textarea" },
      { key: "inclusion_rules", label: "Inclusion Rules", type: "textarea" },
      { key: "exclusion_rules", label: "Exclusion Rules", type: "textarea" },
      { key: "sample_calculation", label: "Sample Calculation", type: "textarea" },
    ]
  },
  {
    id: "section-E",
    title: "Section E: Business Rules & Validation",
    fields: [
      { key: "business_rules", label: "Business Rules", type: "textarea" },
      { key: "data_validation_rules", label: "Data Validation Rules", type: "textarea" },
      { key: "exception_handling_rules", label: "Exception Handling", type: "textarea" },
      { key: "data_quality_expectations", label: "Data Quality Expectations", type: "textarea" },
    ]
  },
  {
    id: "section-F",
    title: "Section F: Source Systems & Data Lineage",
    fields: [
      { key: "source_systems_lineage", label: "Source Systems & Lineage", type: "textarea" }
    ]
  },
  {
    id: "section-G",
    title: "Section G: Ownership & Governance",
    fields: [
      { key: "ownership_governance", label: "Ownership & Governance Details", type: "textarea" }
    ]
  },
  {
    id: "section-H",
    title: "Section H: Assumptions & Constraints",
    fields: [
      { key: "assumptions_constraints", label: "Assumptions & Constraints", type: "textarea" }
    ]
  },
  {
    id: "section-I",
    title: "Section I: Reporting Requirements & Thresholds",
    fields: [
      { key: "reporting_requirements", label: "Reporting Requirements", type: "textarea" },
      { key: "dashboard_recommendations", label: "Dashboard Recommendations", type: "textarea" },
      { key: "threshold_guidance", label: "Threshold Guidance", type: "textarea" },
    ]
  },
  {
    id: "section-J",
    title: "Section J: Implementation & Adoption Guidance",
    fields: [
      { key: "implementation_guidance", label: "Implementation Guidance", type: "textarea" }
    ]
  }
] as const;

interface KpiLandscapeTreeProps {
  categoriesMap: Record<string, FunctionalSpecItem[]>;
  specItems: FunctionalSpecItem[];
  theme: 'dark' | 'light';
}

export function KpiLandscapeTree({ categoriesMap, specItems, theme }: KpiLandscapeTreeProps) {
  const [hoveredKpiId, setHoveredKpiId] = useState<string | null>(null);
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Object.entries(categoriesMap).filter(([_, items]) => items.length > 0);
  }, [categoriesMap]);

  const layout = useMemo(() => {
    if (categories.length === 0) {
      return { root: { x: 30, y: 150 }, categories: {}, kpis: {}, height: 300 };
    }

    const kpiGap = 68; // vertical gap between KPI cards
    const topPadding = 60;
    const bottomPadding = 60;
    
    let totalKpiCount = 0;
    categories.forEach(([_, items]) => {
      totalKpiCount += items.length;
    });

    const height = Math.max(380, totalKpiCount * kpiGap + topPadding + bottomPadding);

    const kpisLayout: Record<string, { x: number; y: number; index: number; category: string }> = {};
    const catsLayout: Record<string, { x: number; y: number; count: number }> = {};

    let currentKpiIndex = 0;
    categories.forEach(([category, items]) => {
      const startY = topPadding + currentKpiIndex * kpiGap;
      const endY = topPadding + (currentKpiIndex + items.length - 1) * kpiGap;
      const catY = (startY + endY) / 2;

      catsLayout[category] = {
        x: 320,
        y: catY,
        count: items.length
      };

      items.forEach((item, idx) => {
        const overallIndex = specItems.findIndex(x => x.id === item.id) + 1;
        kpisLayout[item.id] = {
          x: 660,
          y: topPadding + (currentKpiIndex + idx) * kpiGap,
          index: overallIndex,
          category
        };
      });

      currentKpiIndex += items.length;
    });

    const catYs = Object.values(catsLayout).map(c => c.y);
    const rootY = catYs.length > 0 ? catYs.reduce((a, b) => a + b, 0) / catYs.length : height / 2;

    const rootLayout = {
      x: 30,
      y: rootY
    };

    return {
      root: rootLayout,
      categories: catsLayout,
      kpis: kpisLayout,
      height
    };
  }, [categories, specItems]);

  const isKpiHighlighted = (kpiId: string) => {
    if (hoveredKpiId === kpiId) return true;
    if (hoveredCatId) {
      const layoutKpi = layout.kpis[kpiId];
      if (layoutKpi && layoutKpi.category === hoveredCatId) return true;
    }
    return false;
  };

  const isCatHighlighted = (catName: string) => {
    if (hoveredCatId === catName) return true;
    if (hoveredKpiId) {
      const layoutKpi = layout.kpis[hoveredKpiId];
      if (layoutKpi && layoutKpi.category === catName) return true;
    }
    return false;
  };

  const isAnyHovered = hoveredKpiId !== null || hoveredCatId !== null;

  return (
    <div 
      className={`relative w-full overflow-x-auto rounded-sm border ${
        theme === 'dark' 
          ? 'bg-[#111111]/85 border-[#303030] shadow-2xl' 
          : 'bg-white border-gray-200 shadow-sm print:shadow-none print:border-gray-300'
      }`}
    >
      <div 
        className="relative min-w-[1080px] select-none transition-all duration-300 print:bg-white"
        style={{ height: `${layout.height}px` }}
      >
        {/* SVG Background for connection curves */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {theme === 'dark' ? (
              <>
                <filter id="shadow-glow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feColorMatrix type="matrix" values="1 0 0 0 1  0 1 0 0 0.9  0 0 1 0 0  0 0 0 0.5 0" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </>
            ) : null}
          </defs>

          {/* Grid pattern (dark mode only) */}
          {theme === 'dark' && (
            <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#FFE600" fillOpacity="0.04" />
            </pattern>
          )}
          {theme === 'dark' && (
            <rect width="100%" height="100%" fill="url(#dotGrid)" />
          )}

          {/* 1. Connections from Root to Categories */}
          {categories.map(([category, _]) => {
            const catPos = layout.categories[category];
            if (!catPos) return null;

            const isHigh = !isAnyHovered || isCatHighlighted(category);
            
            // Draw connection line
            const x1 = layout.root.x + 100; // right of root circle
            const y1 = layout.root.y;
            const x2 = catPos.x;
            const y2 = catPos.y;
            const cX = (x1 + x2) / 2;

            return (
              <path
                key={`root-to-${category}`}
                d={`M ${x1} ${y1} C ${cX} ${y1}, ${cX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={
                  theme === 'dark'
                    ? isHigh ? '#FFE600' : 'rgba(255, 230, 0, 0.12)'
                    : isHigh ? '#CA8A04' : '#E5E7EB'
                }
                strokeWidth={isHigh ? 2.5 : 1.5}
                filter={theme === 'dark' && isHigh ? 'url(#shadow-glow)' : undefined}
                className="transition-all duration-300"
              />
            );
          })}

          {/* 2. Connections from Categories to KPIs */}
          {categories.map(([category, items]) => {
            const catPos = layout.categories[category];
            if (!catPos) return null;

            return items.map((item) => {
              const kpiPos = layout.kpis[item.id];
              if (!kpiPos) return null;

              const isHigh = !isAnyHovered || isKpiHighlighted(item.id);

              const x1 = catPos.x + 200; // right of category card
              const y1 = catPos.y;
              const x2 = kpiPos.x;
              const y2 = kpiPos.y;
              const cX = (x1 + x2) / 2;

              return (
                <path
                  key={`cat-to-${item.id}`}
                  d={`M ${x1} ${y1} C ${cX} ${y1}, ${cX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={
                    theme === 'dark'
                      ? isHigh ? '#FFE600' : 'rgba(255, 230, 0, 0.12)'
                      : isHigh ? '#CA8A04' : '#E5E7EB'
                  }
                  strokeWidth={isHigh ? 2.0 : 1.0}
                  filter={theme === 'dark' && isHigh ? 'url(#shadow-glow)' : undefined}
                  className="transition-all duration-300"
                />
              );
            });
          })}
        </svg>

        {/* HTML Cards Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* A. Root Node (KPI Library) */}
          <div 
            className="absolute flex items-center justify-center pointer-events-auto"
            style={{ 
              left: `${layout.root.x}px`, 
              top: `${layout.root.y - 45}px`,
              width: '100px',
              height: '90px'
            }}
          >
            <div 
              className={`w-full h-full rounded-full flex flex-col items-center justify-center text-center p-3 font-black text-[10px] uppercase tracking-wider select-none transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-[#FFE600] text-black shadow-[0_0_20px_rgba(255,230,0,0.25)] border-4 border-black/10'
                  : 'bg-yellow-500 text-white shadow-md border-4 border-white'
              }`}
            >
              <FileText className="w-4 h-4 mb-0.5" />
              <span>KPI Library</span>
            </div>
          </div>

          {/* B. Category Nodes */}
          {categories.map(([category, items]) => {
            const catPos = layout.categories[category];
            if (!catPos) return null;

            const isHigh = !isAnyHovered || isCatHighlighted(category);

            return (
              <div
                key={category}
                className="absolute pointer-events-auto transition-all duration-300"
                style={{ 
                  left: `${catPos.x}px`, 
                  top: `${catPos.y - 30}px`,
                  width: '200px',
                  height: '60px'
                }}
                onMouseEnter={() => setHoveredCatId(category)}
                onMouseLeave={() => setHoveredCatId(null)}
              >
                <div 
                  className={`w-full h-full border rounded-md p-3 flex flex-col justify-center text-center shadow-md transition-all duration-300 ${
                    theme === 'dark'
                      ? isHigh 
                        ? 'bg-[#1B1B1B] border-[#FFE600] text-[#FFE600] shadow-[0_0_12px_rgba(255,230,0,0.15)]' 
                        : 'bg-[#151515] border-[#303030]/60 text-gray-500 opacity-60'
                      : isHigh
                        ? 'bg-white border-yellow-500 text-yellow-800 shadow-sm'
                        : 'bg-gray-100 border-gray-200 text-gray-400 opacity-60'
                  }`}
                >
                  <span className="text-[10px] font-bold tracking-wide uppercase truncate">
                    {category}
                  </span>
                  <span className={`text-[8px] font-medium uppercase mt-0.5 ${
                    theme === 'dark' 
                      ? isHigh ? 'text-[#B0B0B0]' : 'text-gray-600'
                      : isHigh ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    {items.length} {items.length === 1 ? 'KPI' : 'KPIs'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* C. KPI Nodes */}
          {categories.map(([category, items]) => {
            return items.map((item) => {
              const kpiPos = layout.kpis[item.id];
              if (!kpiPos) return null;

              const isHigh = !isAnyHovered || isKpiHighlighted(item.id);
              const label = `KPI-${String(kpiPos.index).padStart(3, '0')}`;

              return (
                <div
                  key={item.id}
                  className="absolute pointer-events-auto transition-all duration-300"
                  style={{ 
                    left: `${kpiPos.x}px`, 
                    top: `${kpiPos.y - 22}px`,
                    width: '340px',
                    height: '44px'
                  }}
                  onMouseEnter={() => setHoveredKpiId(item.id)}
                  onMouseLeave={() => setHoveredKpiId(null)}
                >
                  <a
                    href={`#kpi-${item.id}`}
                    className={`w-full h-full border rounded-sm px-3 flex items-center gap-2.5 shadow-sm transition-all duration-300 ${
                      theme === 'dark'
                        ? isHigh 
                          ? 'bg-[#111111] border-[#FFE600] text-[#FFE600] shadow-[0_0_8px_rgba(255,230,0,0.1)]' 
                          : 'bg-[#0A0A0A] border-[#303030]/60 text-gray-500 opacity-60'
                        : isHigh
                          ? 'bg-white border-yellow-500 hover:border-yellow-600 text-gray-800'
                          : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                    }`}
                  >
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 border ${
                      theme === 'dark'
                        ? isHigh 
                          ? 'bg-yellow-950/40 border-yellow-800 text-yellow-400' 
                          : 'bg-[#1F1F1F] border-transparent text-gray-600'
                        : isHigh
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          : 'bg-gray-100 border-transparent text-gray-400'
                    }`}>
                      {label}
                    </span>
                    <span 
                      className="text-[10px] font-semibold truncate flex-1 font-sans text-left"
                      title={item.kpi_name}
                    >
                      {item.kpi_name}
                    </span>
                  </a>
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

export function FunctionalSpecificationPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  const [library, setLibrary] = useState<KPILibrary>({ items: [], quality: {}, recommendations: {} });
  const [spec, setSpec] = useState<FunctionalSpecification>({ items: [] });
  const [context, setContext] = useState<Partial<BusinessContext>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  
  // Navigation & expanded states
  const [expandedKpis, setExpandedKpis] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Editing states
  const [editingItem, setEditingItem] = useState<FunctionalSpecItem | null>(null);
  const [isEditingExec, setIsEditingExec] = useState(false);
  const [execSummaryValue, setExecSummaryValue] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [docName, setDocName] = useState("");
  const [previewPageNum, setPreviewPageNum] = useState(1);
  const totalPages = useMemo(() => 10 + spec.items.length, [spec.items.length]);

  useEffect(() => {
    if (previewPageNum > totalPages) {
      setPreviewPageNum(Math.max(1, totalPages));
    }
  }, [totalPages, previewPageNum]);

  const handleFieldChange = (key: keyof FunctionalSpecItem, value: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      [key]: value
    });
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (clientProfile && clientProfile.client_name && (docName === "" || docName === "KPI_Functional_Specification")) {
      const clientPart = clientProfile.client_name.trim().replace(/\s+/g, "_");
      const industryPart = (clientProfile.industry || "").trim().replace(/\s+/g, "_");
      const parts = [];
      if (clientPart) parts.push(clientPart);
      if (industryPart) parts.push(industryPart);
      parts.push("KPI_Functional_Specification");
      setDocName(parts.join("_"));
    } else if (!docName) {
      setDocName("KPI_Functional_Specification");
    }
  }, [clientProfile]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kpiData, specData, contextData] = await Promise.all([
        api.getKpis(),
        api.getWorkflowStatus().then((status) => 
          status.functional_specification ? api.getFunctionalSpec() : { items: [] }
        ),
        api.getContext()
      ]);
      
      if (kpiData.items) {
        setLibrary(kpiData as KPILibrary);
      }
      if (specData.items) {
        setSpec(specData as FunctionalSpecification);
        setExecSummaryValue(specData.executive_summary || "");
        
        // Auto expand all KPIs by default
        const initialExpanded: Record<string, boolean> = {};
        specData.items.forEach((item: FunctionalSpecItem) => {
          initialExpanded[item.id] = true;
        });
        setExpandedKpis(initialExpanded);

        // Auto expand all categories by default
        const initialCategories: Record<string, boolean> = {};
        specData.items.forEach((item: FunctionalSpecItem) => {
          const cat = item.kpi_category || "Operational";
          initialCategories[cat] = true;
        });
        setExpandedCategories(initialCategories);
      }
      if (contextData) {
        setContext(contextData);
      }
      // Load client profile for context banner
      try {
        const prof = await api.getClientProfile();
        setClientProfile(prof);
      } catch { /* ignore if not set */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function generateSpec() {
    setGenerating(true);
    setError("");
    try {
      const data = await api.generatePrompt().then(() => api.generateSpec());
      setSpec(data);
      setExecSummaryValue(data.executive_summary || "");
      
      // Auto expand all KPIs by default
      const initialExpanded: Record<string, boolean> = {};
      data.items.forEach((item: FunctionalSpecItem) => {
        initialExpanded[item.id] = true;
      });
      setExpandedKpis(initialExpanded);

      setSaveStatus("Specification document generated");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSpecItem() {
    if (!editingItem) return;
    
    // Sync backward compatibility fields
    const updatedItem = {
      ...editingItem,
      business_purpose: editingItem.business_purpose_relevance || editingItem.business_purpose || "",
      business_logic: `Formula: ${editingItem.formula}\nNumerator: ${editingItem.numerator}\nDenominator: ${editingItem.denominator}`,
      source_system: editingItem.source_systems_lineage || editingItem.source_system || "",
      refresh_frequency: editingItem.kpi_definition || editingItem.refresh_frequency || "",
      assumptions: editingItem.assumptions_constraints || editingItem.assumptions || ""
    };

    const updatedItems = spec.items.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    const updatedSpec = { ...spec, items: updatedItems, status: "draft" };
    
    setSaveStatus("Saving Draft...");
    try {
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setEditingItem(null);
      setSaveStatus("Changes saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to save specification updates");
    }
  }

  async function saveExecutiveSummary() {
    const updatedSpec = { ...spec, executive_summary: execSummaryValue, status: "draft" };
    setSaveStatus("Saving Draft...");
    try {
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setIsEditingExec(false);
      setSaveStatus("Executive summary saved to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to save executive summary updates");
    }
  }

  async function approveSpecification() {
    setSaveStatus("Approving Document...");
    try {
      await api.approveSpec();
      setSpec((prev) => ({ ...prev, status: "approved" }));
      setSaveStatus("Specification Document Approved!");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve specification document");
    }
  }

  async function reopenSpec() {
    setSaveStatus("Reopening Specification...");
    try {
      const updatedSpec = { ...spec, status: "draft" };
      await api.saveFunctionalSpec(updatedSpec);
      setSpec(updatedSpec);
      setSaveStatus("Document status set to Draft");
      setTimeout(() => setSaveStatus(""), 3000);
      onChange();
    } catch (err) {
      setError("Failed to reopen specification");
    }
  }

  const approvedKpis = library.items.filter((kpi) => kpi.status === "approved");
  const specExport = exports.find((item) => item.id === "functional_document");

  const isOutOfSync = useMemo(() => {
    if (approvedKpis.length === 0 || spec.items.length === 0) return false;
    if (approvedKpis.length !== spec.items.length) return true;
    const specIds = new Set(spec.items.map((item) => item.id));
    for (const kpi of approvedKpis) {
      if (!specIds.has(kpi.id)) return true;
    }
    return false;
  }, [approvedKpis, spec.items]);

  const categoriesMap = useMemo(() => {
    const map: Record<string, FunctionalSpecItem[]> = {};
    spec.items.forEach((item) => {
      const cat = item.kpi_category || "Operational";
      if (!map[cat]) {
        map[cat] = [];
      }
      map[cat].push(item);
    });
    return map;
  }, [spec.items]);

  const driverTree = useMemo(() => {
    const treeMap: Record<string, Record<string, Record<string, FunctionalSpecItem[]>>> = {};

    spec.items.forEach((item) => {
      // Find matching KPI in library to get driver fields
      const kpi = library.items.find((k) => k.id === item.id);
      const sfa = kpi?.strategic_focus_area || item.kpi_category || "Strategic Focus Area";
      const sd = kpi?.standard_driver || "Standard Driver";
      const secD = kpi?.sector_driver || item.functional_area || "Sector Specific Driver";

      if (!treeMap[sfa]) {
        treeMap[sfa] = {};
      }
      if (!treeMap[sfa][sd]) {
        treeMap[sfa][sd] = {};
      }
      if (!treeMap[sfa][sd][secD]) {
        treeMap[sfa][sd][secD] = [];
      }
      treeMap[sfa][sd][secD].push(item);
    });

    return treeMap;
  }, [spec.items, library.items]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const toggleKpi = (kpiId: string) => {
    setExpandedKpis((prev) => ({
      ...prev,
      [kpiId]: !prev[kpiId],
    }));
  };

  const expandAllKpis = () => {
    const next: Record<string, boolean> = {};
    spec.items.forEach((item) => {
      next[item.id] = true;
    });
    setExpandedKpis(next);
  };

  const collapseAllKpis = () => {
    setExpandedKpis({});
  };

  const isApproved = spec.status === "approved";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[#FFE600]">
        <RefreshCw size={28} className="animate-spin" />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Enterprise Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 03</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">Functional Specification Studio</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Enrich and formalize approved KPI definitions into comprehensive consulting-grade functional specifications. Manage drafts, edit sections, approve deliverables, and export client-ready documentation.
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

      {/* Error Alert */}
      {error ? (
        <div className="border border-red-900 bg-red-950/30 p-4 text-xs text-red-400 flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Out of Sync Notice */}
      {spec.items.length > 0 && isOutOfSync && (
        <div className="border border-[#FFE600]/30 bg-[#FFE600]/5 p-4 rounded-sm flex items-start gap-3 justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5 text-[#FFE600]" size={16} />
            <div>
              <p className="text-xs font-bold text-[#FFE600] uppercase tracking-wider">Specification Out of Sync</p>
              <p className="text-[11px] text-[#B0B0B0] mt-1">
                The approved KPI library has changed. Re-synthesize the functional specification to align it with the currently approved metrics.
              </p>
            </div>
          </div>
          <button 
            className="button-yellow !py-1.5 !px-3 !text-[11px] shrink-0 border border-black/10 flex items-center gap-1.5" 
            disabled={generating} 
            onClick={generateSpec}
          >
            <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
            Re-synthesize Spec
          </button>
        </div>
      )}

      {/* Check State: No Approved KPIs */}
      {approvedKpis.length === 0 ? (
        <section className="panel p-10 text-center space-y-4">
          <AlertCircle className="mx-auto text-[#FFE600]" size={40} />
          <h3 className="text-lg font-semibold text-[#F5F5F5]">No Approved Metrics Available</h3>
          <p className="max-w-md mx-auto text-xs text-[#B0B0B0] leading-relaxed">
            Functional specifications are constructed only for KPIs that have undergone strategic review. Please navigate to Step 2 (KPI Library) to approve candidate metrics first.
          </p>
          <div className="pt-2">
            <Link to="/step-2" className="button-yellow">
              <ArrowLeft size={16} />
              Return to KPI Library
            </Link>
          </div>
        </section>
      ) : spec.items.length === 0 ? (
        /* State: Approved KPIs exist but spec is not generated yet */
        <section className="panel p-10 text-center space-y-6">
          <FileText className="mx-auto text-[#FFE600]/80" size={48} />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#F5F5F5]">Ready for AI Document Enrichment</h3>
            <p className="max-w-lg mx-auto text-xs text-[#B0B0B0] leading-relaxed">
              We detected <span className="text-[#FFE600] font-semibold">{approvedKpis.length} approved metrics</span>. 
              The system will enrich these metrics with business purpose statements, detailed calculation rules, metadata assumptions, and visual design requirements.
            </p>
          </div>
          <div>
            <button className="button-yellow" disabled={generating} onClick={generateSpec}>
              {generating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              {generating ? "Synthesizing Specification..." : "Generate Functional Specification"}
            </button>
          </div>
        </section>
      ) : (
        /* State: Specifications generated and ready to view in a unified layout */
        <div className="space-y-8 max-w-6xl mx-auto">
          
          {/* Top Sticky/Control Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1B1B1B] border border-[#303030] p-4 rounded-sm gap-4 sticky top-0 z-40 shadow-lg">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold tracking-widest text-[#FFE600] uppercase">Document Status</span>
              {isApproved ? (
                <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <Check size={10} />
                  Approved Specification Document
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Draft Specification Document
                </span>
              )}
              {saveStatus && <span className="text-xs text-[#FFE600] animate-pulse">{saveStatus}</span>}

              {/* Tab Swapper */}
              <div className="flex bg-[#111111] p-1 rounded-sm border border-[#303030] sm:ml-4 shrink-0">
                <button
                  type="button"
                  className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${
                    activeTab === "editor"
                      ? "bg-[#FFE600] text-black"
                      : "text-[#B0B0B0] hover:text-[#F5F5F5]"
                  }`}
                  onClick={() => setActiveTab("editor")}
                >
                  Specification Editor
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-[11px] font-bold rounded-sm transition-all ${
                    activeTab === "preview"
                      ? "bg-[#FFE600] text-black"
                      : "text-[#B0B0B0] hover:text-[#F5F5F5]"
                  }`}
                  onClick={() => setActiveTab("preview")}
                >
                  Document Preview
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
              {/* Document Name Customization */}
              <div className="flex items-center gap-2 bg-[#111111] px-2 py-1.5 rounded-sm border border-[#303030]">
                <span className="text-[10px] font-bold tracking-widest text-[#B0B0B0] uppercase whitespace-nowrap">Doc Name:</span>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Enter document name..."
                  className="bg-transparent text-xs text-[#F5F5F5] placeholder-gray-600 focus:outline-none w-48 sm:w-64"
                />
              </div>

              {/* Export buttons */}
              <div className="flex items-center gap-2">
                {specExport?.available ? (
                  specExport.formats.map((format) => (
                    <a
                      key={format}
                      href={`${exportUrl("functional_document", format)}${exportUrl("functional_document", format).includes('?') ? '&' : '?'}doc_name=${encodeURIComponent(docName)}`}
                      download={`${docName || "KPI_Functional_Specification"}.${format.toLowerCase()}`}
                      className="button-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                      id={`export-${format.toLowerCase()}`}
                    >
                      <Download size={12} />
                      Download {format}
                    </a>
                  ))
                ) : (
                  <span className="text-[11px] text-[#B0B0B0]/40">Compiling exports...</span>
                )}
              </div>

              {/* Approve / Reopen triggers */}
              {!isApproved ? (
                <button 
                  className="button-secondary !py-1.5 !px-3 !text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-1.5" 
                  onClick={approveSpecification}
                  id="approve-spec-btn"
                >
                  <CheckCircle size={14} />
                  Approve Document
                </button>
              ) : (
                <button 
                  className="button-secondary !py-1.5 !px-3 !text-xs border border-[#303030] text-[#B0B0B0] hover:border-yellow-500/30 hover:text-yellow-400 flex items-center gap-1.5" 
                  onClick={reopenSpec}
                  id="reopen-spec-btn"
                >
                  <RefreshCw size={14} />
                  Reopen to Edit
                </button>
              )}

              {/* Print Button (only shown in preview tab) */}
              {activeTab === "preview" && (
                <button
                  type="button"
                  className="button-secondary !py-1.5 !px-3 !text-xs border border-gray-500 text-gray-300 hover:bg-gray-500/10 flex items-center gap-1.5"
                  onClick={() => window.print()}
                  id="print-spec-btn"
                >
                  <Printer size={12} />
                  Print / PDF
                </button>
              )}

              {/* Re-synthesize button */}
              <button 
                className="button-yellow border border-black/10 !py-1.5 !px-3 !text-xs flex items-center gap-1.5" 
                onClick={generateSpec} 
                disabled={generating}
                id="re-synthesize-spec-btn"
              >
                <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
                Re-synthesize Spec
              </button>
            </div>
          </div>

          {/* SINGLE CONSOLIDATED DOCUMENT PANEL */}
          {activeTab === "editor" ? (
            <div className="space-y-12 bg-[#1B1B1B]/40 border border-[#303030] p-8 md:p-12 rounded-sm shadow-xl relative">
            
            {/* Title / Cover Section */}
            <div id="section-metadata" className="border-b border-[#303030] pb-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#FFE600]">KPI Advisory & Analytics</p>
                <h1 className="text-4xl font-extrabold tracking-tight text-[#F5F5F5]">Functional Specification Document</h1>
                <p className="text-sm text-[#B0B0B0] italic max-w-2xl">
                  A unified blueprint translating business strategy into governed, measurable performance metrics.
                </p>
              </div>

              {/* Metadata Control Table */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-[#303030]/60">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Document Version</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">1.0</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Generated Date</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">
                    {spec.updated_at ? new Date(spec.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft Date'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Number of KPIs</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{spec.items.length} Approved Performance Metrics</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Industry</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{context.industry || "Not Specified"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Organizational Level</p>
                  <p className="text-sm text-[#F5F5F5] mt-1 font-semibold">{context.organization_level || "Not Specified"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">Approval Status</p>
                  <div className="mt-1">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 border border-green-500/30 bg-green-500/10 text-green-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Approved Spec
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Draft Spec
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Table of Contents */}
            <div className="bg-[#111111]/60 border border-[#303030] p-6 rounded-sm space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">Table of Contents</p>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <a href="#section-metadata" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  Document Control & Metadata
                </a>
                <a href="#section-exec-summary" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  1. Executive Summary
                </a>
                <a href="#section-kpi-landscape" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  2. KPI Landscape Overview
                </a>
                <a href="#section-traceability" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  3. Strategic Traceability Matrix
                </a>
                <a href="#section-kpi-specs" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  4. Individual KPI Specifications ({spec.items.length})
                </a>
                <a href="#section-governance" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  5. Governance Framework
                </a>
                <a href="#section-reporting" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  6. Reporting & Dashboard Requirements
                </a>
                <a href="#section-assumptions" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  7. Assumptions & Constraints
                </a>
                <a href="#section-implementation" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  8. Implementation Considerations
                </a>
                <a href="#section-appendix" className="text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-2 transition">
                  <span className="w-1.5 h-1.5 bg-[#FFE600] rounded-full" />
                  9. Appendix
                </a>
              </div>
            </div>

            {/* 1. Executive Summary */}
            <div id="section-exec-summary" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#F5F5F5]">1. Executive Summary</h3>
                {!isEditingExec ? (
                  <button 
                    className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1.5" 
                    onClick={() => {
                      setExecSummaryValue(spec.executive_summary || "");
                      setIsEditingExec(true);
                    }}
                    disabled={isApproved}
                    title={isApproved ? "Reopen document to edit contents" : ""}
                    id="edit-exec-summary-btn"
                  >
                    <Edit3 size={12} />
                    Edit Summary
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button className="button-secondary !py-1 !px-2.5 !text-xs" onClick={() => setIsEditingExec(false)}>Cancel</button>
                    <button className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1.5" onClick={saveExecutiveSummary} id="save-exec-summary-btn">
                      <Save size={12} />
                      Save Summary
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                This document-wide Executive Summary establishes the strategic and financial context, downstream alignment goals, and engagement scope for performance measurement governance.
              </p>

              {!isEditingExec ? (
                <div className="border border-[#303030] bg-[#111111] p-6 rounded-sm whitespace-pre-wrap text-sm leading-7 text-[#D5D5D5] border-l-4 border-l-[#FFE600]">
                  {spec.executive_summary || "No executive summary available. Please click 'Edit Summary' or regenerate to establish one."}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">Executive Summary Text</label>
                  <textarea
                    className="field min-h-[250px] leading-6 text-xs w-full"
                    value={execSummaryValue}
                    onChange={(e) => setExecSummaryValue(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* 2. KPI Landscape Overview */}
            <div id="section-kpi-landscape" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">2. KPI Landscape Overview</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                The visual mind-map below displays the KPI Landscape as a branching tree structure, routing from the core KPI Library through strategic Category nodes down to individual approved metrics.
              </p>

              <KpiLandscapeTree 
                categoriesMap={categoriesMap} 
                specItems={spec.items} 
                theme="dark" 
              />
            </div>

            {/* 3. Strategic Traceability Matrix */}
            <div id="section-traceability" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">3. Strategic Traceability Matrix</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                This matrix illustrates the strategic alignment from executive objectives down to specific key performance indicators, providing visibility into strategic translation.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                      <th className="p-3 border-r border-[#303030] w-1/5">Strategic Objective</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">Business Challenge</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">KRA</th>
                      <th className="p-3 border-r border-[#303030] w-1/5">Functional Area</th>
                      <th className="p-3 w-1/5">KPI Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303030]">
                    {spec.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                        <td className="p-3 border-r border-[#303030] text-xs">{item.strategic_objective_supported || "Optimize Strategy"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.business_challenge_addressed || "Inefficient Processes"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.related_kra || "Operational Excellence"}</td>
                        <td className="p-3 border-r border-[#303030] text-xs">{item.functional_area || "Operations"}</td>
                        <td className="p-3 font-semibold text-[#FFE600] text-xs">
                          <a href={`#kpi-${item.id}`} className="hover:underline">
                            {item.kpi_name}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Individual KPI Specifications */}
            <div id="section-kpi-specs" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[#F5F5F5]">4. Individual KPI Specifications</h3>
                  <p className="text-xs text-[#B0B0B0] leading-relaxed mt-1">
                    Detailed functional blueprints for each approved metric, outlining definitions, lineage, calculations, and rules.
                  </p>
                </div>

                <div className="flex gap-3 text-xs shrink-0 bg-[#111111] border border-[#303030] px-3 py-1.5 rounded-sm">
                  <button className="text-[#B0B0B0] hover:text-[#FFE600] font-semibold transition" onClick={expandAllKpis}>Expand All</button>
                  <span className="text-[#303030]">|</span>
                  <button className="text-[#B0B0B0] hover:text-[#FFE600] font-semibold transition" onClick={collapseAllKpis}>Collapse All</button>
                </div>
              </div>

              {/* Loop over spec items */}
              <div className="space-y-8">
                {spec.items.map((item, index) => {
                  const isKpiExpanded = !!expandedKpis[item.id];
                  const isKpiEditing = editingItem?.id === item.id;
                  
                  return (
                    <div 
                      key={item.id} 
                      id={`kpi-${item.id}`} 
                      className="border border-[#303030] bg-[#1c1c1e]/40 rounded-sm overflow-hidden space-y-4 relative scroll-mt-24"
                    >
                      {/* Left accent border to indicate status/category */}
                      <div className="absolute left-0 top-0 h-full w-1 bg-[#FFE600]" />
                      
                      {/* Card Header */}
                      <div className="flex justify-between items-center bg-[#1B1B1B] px-6 py-4 border-b border-[#303030]/60">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#FFE600] bg-[#FFE600]/10 px-2.5 py-1 border border-[#FFE600]/30 rounded-sm font-mono">
                            Metric {index + 1}
                          </span>
                          <h4 className="text-base font-bold text-[#F5F5F5]">{item.kpi_name}</h4>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {isKpiEditing ? (
                            <div className="flex gap-2">
                              <button 
                                className="button-secondary !py-1 !px-2.5 !text-xs" 
                                onClick={() => setEditingItem(null)}
                              >
                                Cancel
                              </button>
                              <button 
                                className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1" 
                                onClick={saveSpecItem}
                                id={`save-spec-${item.id}`}
                              >
                                <Save size={12} />
                                Save Updates
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                className="text-xs font-semibold text-[#B0B0B0] hover:text-[#FFE600] flex items-center gap-1 px-2.5 py-1 bg-[#111111] border border-[#303030] rounded-sm transition"
                                onClick={() => toggleKpi(item.id)}
                              >
                                {isKpiExpanded ? "Hide Details" : "Show Details"}
                              </button>
                              <button 
                                className="button-yellow !py-1 !px-2.5 !text-xs flex items-center gap-1" 
                                onClick={() => {
                                  setEditingItem(item);
                                  setExpandedKpis(prev => ({ ...prev, [item.id]: true }));
                                }}
                                disabled={isApproved}
                                title={isApproved ? "Reopen document to edit contents" : ""}
                                id={`edit-spec-${item.id}`}
                              >
                                <Edit3 size={12} />
                                Edit Spec
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="px-6 pb-6 pt-2 space-y-6">
                        {/* Quality Validation Warnings */}
                        {item.validation_warnings && item.validation_warnings.length > 0 && (
                          <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-sm text-xs space-y-1">
                            <div className="font-bold text-[#FF3B30] flex items-center gap-1.5">
                              <AlertCircle size={14} /> Quality Validation Warnings ({item.validation_warnings.length})
                            </div>
                            <ul className="list-disc pl-4 text-[#E5E5EA] space-y-1">
                              {item.validation_warnings.map((w, wIdx) => (
                                <li key={wIdx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Quick Reference Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#111111]/60 p-4 border border-[#303030]/50 rounded-sm text-xs">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">KPI Category</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.kpi_category || "Operational"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Functional Area</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.functional_area || "Operations"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Business Owner</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.business_owner || "TBD"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Data Owner</p>
                            <p className="text-[#F5F5F5] mt-0.5 font-medium">{item.data_owner || "TBD"}</p>
                          </div>
                        </div>

                        {/* Expanded details block */}
                        {isKpiExpanded && (
                          <div className="space-y-6 border-t border-[#303030]/40 pt-4">
                            {/* Strategic Traceability mapping banner inside card */}
                            {(() => {
                              let parts = [
                                item.strategic_objective_supported || "Strategic Objective",
                                item.business_challenge_addressed || "Business Challenge",
                                item.related_kra || "KRA",
                                item.functional_area || "Functional Area",
                                item.kpi_name
                              ];
                              const traceStr = item.strategic_objective_supported || "";
                              if (traceStr.includes(" &rarr; ") || traceStr.includes(" → ")) {
                                const separator = traceStr.includes(" &rarr; ") ? " &rarr; " : " → ";
                                const parsed = traceStr.split(separator).map(s => s.trim());
                                if (parsed.length > 0) {
                                  parts = parsed;
                                  if (parts[parts.length - 1] !== item.kpi_name) {
                                    parts.push(item.kpi_name);
                                  }
                                }
                              }
                              
                              return (
                                <div className="bg-[#111111]/40 border border-[#303030]/50 p-3 rounded-sm">
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#FFE600]">Strategic Alignment Traceability</div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#F5F5F5] pt-1 font-semibold">
                                    {parts.map((part, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        <span className={idx === parts.length - 1 ? "text-[#FFE600] font-bold" : "text-[#B0B0B0]"}>
                                          {part}
                                        </span>
                                        {idx < parts.length - 1 && (
                                          <span className="text-[#FFE600]/60">&rarr;</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {isKpiEditing ? (
                              /* Editing Mode Form */
                              <div className="space-y-6">
                                {sectionConfigs.map((sect) => (
                                  <div key={sect.id} className="space-y-3 bg-[#111111]/30 p-4 border border-[#303030]/60 rounded-sm">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#FFE600] border-b border-[#303030]/60 pb-1">
                                      {sect.title}
                                    </h5>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {sect.fields.map((field) => {
                                        const val = (editingItem[field.key as keyof FunctionalSpecItem] as string) || "";
                                        const isSpan = sect.fields.length === 1 || field.key === "strategic_objective_supported" || field.key === "business_challenge_addressed" || field.key === "calculation_methodology" || field.key === "inclusion_rules" || field.key === "exclusion_rules";
                                        return (
                                          <div key={field.key} className={`space-y-1.5 ${isSpan ? "md:col-span-2" : ""}`}>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#B0B0B0]">{field.label}</label>
                                            {field.type === "input" ? (
                                              <input
                                                type="text"
                                                className="field w-full text-xs"
                                                value={val}
                                                onChange={(e) => handleFieldChange(field.key as keyof FunctionalSpecItem, e.target.value)}
                                              />
                                            ) : (
                                              <textarea
                                                className="field w-full min-h-20 leading-relaxed text-xs"
                                                value={val}
                                                onChange={(e) => handleFieldChange(field.key as keyof FunctionalSpecItem, e.target.value)}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Read Only Subsections Display */
                              <div className="space-y-6">
                                {sectionConfigs.map((sect) => (
                                  <div key={sect.id} className="space-y-3">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#FFE600] border-b border-[#303030]/40 pb-1">
                                      {sect.title}
                                    </h5>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {sect.fields.map((field) => {
                                        const val = item[field.key as keyof FunctionalSpecItem] || "";
                                        const isSpan = sect.fields.length === 1 || field.key === "strategic_objective_supported" || field.key === "business_challenge_addressed" || field.key === "calculation_methodology" || field.key === "inclusion_rules" || field.key === "exclusion_rules";
                                        return (
                                          <div key={field.key} className={`space-y-1 ${isSpan ? "md:col-span-2" : ""}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B0B0B0]">{field.label}</p>
                                            <p className="text-xs leading-relaxed text-[#F5F5F5] whitespace-pre-wrap bg-[#111111]/30 p-3 border border-[#303030]/40 rounded-sm">
                                              {val || <span className="text-[#B0B0B0]/30 italic">Not specified</span>}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Governance Framework */}
            <div id="section-governance" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">5. Governance Framework</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                To ensure metric consistency, accountability, and ongoing relevance, a formal governance framework is established for all approved KPIs. This structure assigns clear responsibilities and defines escalation paths.
              </p>

              {/* Roles & Responsibilities */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">Roles and Responsibilities</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Business Owner: </strong>
                    Responsible for defining the business logic, validating calculation results, approving target thresholds, and driving operational performance based on metric insights.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Data Owner: </strong>
                    Accountable for technical lineage, data completeness, source-to-target mapping, ETL data quality checks, and resolving data ingestion or availability issues.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Escalation Path: </strong>
                    In case of data quality discrepancies or alignment disputes, issues are escalated to the Data Governance Committee and KPI Advisory Board for review and reconciliation.
                  </li>
                </ul>
              </div>

              {/* Ownership and Governance Matrix Table */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Ownership & Governance Matrix</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                    <thead>
                      <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                        <th className="p-3 border-r border-[#303030] w-1/4">Metric Name</th>
                        <th className="p-3 border-r border-[#303030] w-1/5">Business Owner</th>
                        <th className="p-3 border-r border-[#303030] w-1/5">Data Owner</th>
                        <th className="p-3">Governance Policy Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#303030]">
                      {spec.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                          <td className="p-3 border-r border-[#303030] font-semibold text-[#FFE600]">
                            <a href={`#kpi-${item.id}`} className="hover:underline">{item.kpi_name}</a>
                          </td>
                          <td className="p-3 border-r border-[#303030] text-xs">{item.business_owner || "Business Sponsor"}</td>
                          <td className="p-3 border-r border-[#303030] text-xs">{item.data_owner || "Data Custodian"}</td>
                          <td className="p-3 text-xs leading-relaxed">{item.ownership_governance || "Subject to standard quarterly advisory audits and performance reviews."}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 6. Reporting & Dashboard Requirements */}
            <div id="section-reporting" className="space-y-4 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">6. Reporting & Dashboard Requirements</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                Visualization layout and threshold criteria dictate how data is displayed to support decision-making. The matrix below outlines reporting recommendations and performance thresholds for each metric.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-[#303030]">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[#FFE600] font-bold border-b border-[#303030]">
                      <th className="p-3 border-r border-[#303030] w-1/4">Metric Name</th>
                      <th className="p-3 border-r border-[#303030] w-1/4">Reporting Guidelines</th>
                      <th className="p-3 border-r border-[#303030] w-1/4">Dashboard Placement</th>
                      <th className="p-3">Threshold Guidance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#303030]">
                    {spec.items.map((item) => {
                      const get_default_reporting = (category: string) => {
                        const cat = (category || "").toLowerCase();
                        if (cat.includes("financial")) return "Monthly trended charts, quarterly variance reporting, and margin analysis. Drill down capability by cost center and profit center.";
                        if (cat.includes("operational")) return "Weekly performance run-charts, daily process monitor scorecards. Comparative tracking against prior 30-day rolling averages.";
                        if (cat.includes("strategic")) return "C-Suite quarterly scorecards, progress bars against annual target milestones, and executive summaries.";
                        return "Standard monthly performance dashboard, with trailing 12-month trend charts and period-over-period variance metrics.";
                      };

                      const get_default_threshold = (category: string) => {
                        const cat = (category || "").toLowerCase();
                        if (cat.includes("financial")) return "Green: Within +/- 2% of budget target. Amber: 2% to 5% variance. Red: > 5% variance or actual spend exceeding budget.";
                        if (cat.includes("operational")) return "Green: Meets or exceeds 95% operating efficiency. Amber: 90% to 94% efficiency. Red: < 90% operating efficiency.";
                        if (cat.includes("strategic")) return "Green: Project milestone achieved on time. Amber: 1-2 weeks delay in milestone. Red: > 2 weeks delay in critical path.";
                        return "Green: Target achieved or exceeded. Amber: 5% to 10% negative variance from target. Red: > 10% negative variance.";
                      };

                      const defRep = get_default_reporting(item.kpi_category || "");
                      const defThresh = get_default_threshold(item.kpi_category || "");
                      const repVal = item.reporting_requirements || defRep;
                      const dashVal = item.dashboard_recommendations || "Standard Performance Dashboard.";
                      const threshVal = item.threshold_guidance || defThresh;

                      return (
                        <tr key={item.id} className="hover:bg-[#1c1c1e] transition-colors text-[#B0B0B0]">
                          <td className="p-3 border-r border-[#303030] font-semibold text-[#FFE600]">
                            <a href={`#kpi-${item.id}`} className="hover:underline">{item.kpi_name}</a>
                          </td>
                          <td className="p-3 border-r border-[#303030] text-xs leading-relaxed">{repVal}</td>
                          <td className="p-3 border-r border-[#303030] text-xs leading-relaxed">{dashVal}</td>
                          <td className="p-3 text-xs leading-relaxed">{threshVal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. Assumptions & Constraints */}
            <div id="section-assumptions" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">7. Assumptions & Constraints</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                A clear understanding of business and technical assumptions is critical for successful implementation. The following list represents consolidated baseline assumptions and constraints.
              </p>

              {/* General Architectural Assumptions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">General Architectural Assumptions</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Data Availability: </strong>
                    Source transactional tables are assumed to be loaded into the central reporting repository on a standard nightly batch cadence.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Fiscal Calendar: </strong>
                    Standard calendar year rules are assumed unless otherwise explicitly documented in specific financial indicators.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">System Uptime: </strong>
                    Target source ERP ledgers are assumed to maintain 99.5% uptime during standard reporting extraction windows.
                  </li>
                </ul>
              </div>

              {/* Metric-Specific Assumptions */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Metric-Specific Assumptions and Limitations</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  {spec.items.map((item) => {
                    const cleanedAsm = (item.assumptions_constraints || "").trim();
                    if (!cleanedAsm || cleanedAsm.toLowerCase() === "not specified") return null;
                    return (
                      <li key={item.id}>
                        <strong className="text-[#F5F5F5]">{item.kpi_name}: </strong>
                        {cleanedAsm}
                      </li>
                    );
                  })}
                  {spec.items.every(item => !(item.assumptions_constraints || "").trim() || (item.assumptions_constraints || "").trim().toLowerCase() === "not specified") && (
                    <li className="italic text-gray-500">No custom metric-specific assumptions defined.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* 8. Implementation Considerations */}
            <div id="section-implementation" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">8. Implementation Considerations</h3>
              <p className="text-xs text-[#B0B0B0] leading-relaxed">
                Transitioning these specifications into functional BI tools requires rigorous testing, change management, and data reconciliation. Standard implementation considerations are outlined below.
              </p>

              {/* Standard Implementation Guidelines */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">Standard Implementation Guidelines</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li>
                    <strong className="text-[#F5F5F5]">Data Reconciliation: </strong>
                    All KPI calculation outcomes must be audited and reconciled against official books of record or audited financial statements.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">User Acceptance Testing (UAT): </strong>
                    Business owners must perform visual and numeric validation of dashboard mockups prior to production sign-off.
                  </li>
                  <li>
                    <strong className="text-[#F5F5F5]">Change Management: </strong>
                    Training sessions and clear system documentation are required to support user onboarding and ensure high organizational adoption.
                  </li>
                </ul>
              </div>

              {/* Metric-Specific Technical Considerations */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Metric-Specific Technical Considerations</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  {spec.items.map((item) => {
                    const cleanedImp = (item.implementation_guidance || "").trim();
                    if (!cleanedImp || cleanedImp.toLowerCase() === "not specified") return null;
                    return (
                      <li key={item.id}>
                        <strong className="text-[#F5F5F5]">{item.kpi_name}: </strong>
                        {cleanedImp}
                      </li>
                    );
                  })}
                  {spec.items.every(item => !(item.implementation_guidance || "").trim() || (item.implementation_guidance || "").trim().toLowerCase() === "not specified") && (
                    <li className="italic text-gray-500">No custom metric-specific considerations defined.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* 9. Appendix */}
            <div id="section-appendix" className="space-y-6 border-t border-[#303030]/60 pt-8 scroll-mt-24">
              <h3 className="text-xl font-bold text-[#F5F5F5]">9. Appendix</h3>
              
              {/* KPI Glossary */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#FFE600]">KPI Glossary</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">KPI (Key Performance Indicator): </strong>A quantifiable measure used to evaluate the success of an organization or activity in meeting performance objectives.</li>
                  <li><strong className="text-[#F5F5F5]">KRA (Key Result Area): </strong>Primary focus areas of outcomes or outputs for which an organizational unit or role is responsible.</li>
                  <li><strong className="text-[#F5F5F5]">Numerator: </strong>The upper portion of a division representing the measured subset of occurrences.</li>
                  <li><strong className="text-[#F5F5F5]">Denominator: </strong>The lower portion of a division representing the total base population.</li>
                </ul>
              </div>

              {/* Data Quality Principles */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Data Quality Principles</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">Accuracy: </strong>Data correctly represents the real-world operational event it records.</li>
                  <li><strong className="text-[#F5F5F5]">Completeness: </strong>All necessary dataset components are present without omission.</li>
                  <li><strong className="text-[#F5F5F5]">Consistency: </strong>Metrics align across various systems, business units, and report interfaces.</li>
                  <li><strong className="text-[#F5F5F5]">Timeliness: </strong>Updates occur within the required reporting cadence and operational windows.</li>
                </ul>
              </div>

              {/* Acronym Reference */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-[#FFE600]">Acronym Reference</h4>
                <ul className="list-disc pl-5 text-xs text-[#B0B0B0] space-y-2">
                  <li><strong className="text-[#F5F5F5]">ERP: </strong>Enterprise Resource Planning</li>
                  <li><strong className="text-[#F5F5F5]">SAP FI-CO: </strong>Financial Accounting & Controlling</li>
                  <li><strong className="text-[#F5F5F5]">SAP SD: </strong>Sales & Distribution</li>
                  <li><strong className="text-[#F5F5F5]">SAP MM: </strong>Materials Management</li>
                  <li><strong className="text-[#F5F5F5]">BI / DWH: </strong>Business Intelligence / Data Warehouse</li>
                  <li><strong className="text-[#F5F5F5]">UAT: </strong>User Acceptance Testing</li>
                </ul>
              </div>
            </div>

          </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Pagination controls for screen */}
              <div className="flex justify-between items-center bg-[#1B1B1B] border border-[#303030] p-3 rounded-sm print:hidden shadow-lg">
                <div className="text-xs text-[#B0B0B0] font-sans flex items-center gap-2">
                  <span>Viewing Page</span>
                  <select
                    value={previewPageNum}
                    onChange={(e) => setPreviewPageNum(Number(e.target.value))}
                    className="bg-[#111] text-[#FFE600] border border-[#303030] rounded px-2 py-0.5 text-xs font-bold focus:border-[#FFE600] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num} className="bg-[#1B1B1B] text-[#F5F5F5]">
                        {num}
                      </option>
                    ))}
                  </select>
                  <span>of <span className="font-bold text-[#F5F5F5]">{totalPages}</span></span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewPageNum(p => Math.max(1, p - 1))}
                    disabled={previewPageNum === 1}
                    className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs"
                  >
                    &larr; Prev
                  </button>
                  <button
                    onClick={() => setPreviewPageNum(p => Math.min(totalPages, p + 1))}
                    disabled={previewPageNum === totalPages}
                    className="button-secondary !py-1 !px-2 disabled:opacity-40 disabled:pointer-events-none text-xs"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>

              {/* The Pages Container */}
              <div className="space-y-8 print:space-y-0 print:bg-white">
                         {/* PAGE 1: COVER PAGE */}
              <div className={`${previewPageNum === 1 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                {/* Gold/Yellow Top Header line (consulting accent) */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFE600] print:hidden" />
                
                <div className="h-6" />

                {/* Cover Body */}
                <div className="flex-grow flex flex-col justify-center space-y-8 py-10">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFE600] drop-shadow-sm">KPI Advisory & Analytics</p>
                    <h1 className="text-3.5xl font-extrabold tracking-tight text-gray-900 font-sans">Functional Specification Document</h1>
                    <p className="text-sm text-gray-500 italic max-w-xl font-serif">
                      A unified blueprint translating business strategy into governed, measurable performance metrics.
                    </p>
                  </div>

                  {/* Accent yellow bar */}
                  <div className="h-1 bg-[#FFE600] w-full" />
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page 1 of {totalPages}</div>
                </div>
              </div>

              {/* PAGE 2: DOCUMENT CONTROL & METADATA */}
              <div className={`${previewPageNum === 2 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div>Document Control & Metadata</div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-6 flex flex-col justify-center">
                  <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">Document Control & Metadata</h3>
                  
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 text-xs bg-gray-50 border border-gray-200 p-6 rounded-sm">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Document Version</p>
                      <p className="text-xs text-gray-900 font-semibold mt-1">1.0</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Generated Date</p>
                      <p className="text-xs text-gray-900 font-semibold mt-1">
                        {spec.updated_at ? new Date(spec.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Draft Date'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Number of KPIs</p>
                      <p className="text-xs text-gray-900 font-semibold mt-1">{spec.items.length} Approved Performance Metrics</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Industry</p>
                      <p className="text-xs text-gray-900 font-semibold mt-1">{context.industry || "Not Specified"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Organizational Level</p>
                      <p className="text-xs text-gray-900 font-semibold mt-1">{context.organization_level || "Not Specified"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Approval Status</p>
                      <div className="mt-1">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 border border-green-600 bg-green-50 text-green-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                            Approved Spec
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 border border-yellow-600 bg-yellow-50 text-yellow-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                            Draft Spec
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page 2 of {totalPages}</div>
                </div>
              </div>

              {/* PAGE 3: TABLE OF CONTENTS */}
              <div className={`${previewPageNum === 3 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div>Table of Contents</div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-6 flex flex-col justify-center">
                  {/* Table of Contents */}
                  <div className="bg-gray-50 border border-gray-200 p-6 rounded-sm space-y-4 font-sans">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Table of Contents</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] text-gray-600">
                      <div>Document Control & Metadata</div>
                      <div>1. Executive Summary</div>
                      <div>2. KPI Landscape Overview</div>
                      <div>3. Strategic Traceability Matrix</div>
                      <div>4. Individual KPI Specifications</div>
                      <div>5. Governance Framework</div>
                      <div>6. Reporting & Dashboard Requirements</div>
                      <div>7. Assumptions & Constraints</div>
                      <div>8. Implementation Considerations</div>
                      <div>9. Appendix</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page 3 of {totalPages}</div>
                </div>
              </div>

              {/* PAGE 4: EXECUTIVE SUMMARY & LANDSCAPE OVERVIEW */}
              <div className={`${previewPageNum === 4 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-8">
                  {/* 1. Executive Summary */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">1. Executive Summary</h3>
                    <div className="text-xs text-gray-700 leading-relaxed font-serif whitespace-pre-wrap">
                      {execSummaryValue || "This document outlines the functional specifications for the approved performance metrics of the organization. Each metric is mapped to strategic objectives and key result areas to ensure operational alignment and governance."}
                    </div>
                  </div>

                  {/* 2. KPI Landscape Overview */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">2. KPI Landscape Overview</h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-serif">
                      The visual mind-map below displays the KPI Landscape as a branching tree structure, routing from the core KPI Library through strategic Category nodes down to individual approved metrics.
                    </p>

                    <KpiLandscapeTree 
                      categoriesMap={categoriesMap} 
                      specItems={spec.items} 
                      theme="light" 
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page 4 of {totalPages}</div>
                </div>
              </div>


              {/* PAGE 5: LANDSCAPE TABLE & STRATEGIC TRACEABILITY MATRIX */}
              <div className={`${previewPageNum === 5 ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-8">
                  {/* KPI Catalog Table */}
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 leading-relaxed font-serif">
                      Below is the corresponding catalog view of all approved performance indicators with their respective category mapping.
                    </p>
                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left text-xs border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-150 text-gray-800 font-bold border-b border-gray-300">
                            <th className="p-2.5 border-r border-gray-300 w-[12%]">KPI ID</th>
                            <th className="p-2.5 border-r border-gray-300 w-[38%]">KPI Name</th>
                            <th className="p-2.5 border-r border-gray-300 w-[25%]">Category</th>
                            <th className="p-2.5 w-[25%]">Functional Area</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                          {spec.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-2.5 border-r border-gray-300 font-mono text-[11px]">KPI-{String(idx + 1).padStart(3, '0')}</td>
                              <td className="p-2.5 border-r border-gray-300 font-semibold text-gray-900">{item.kpi_name}</td>
                              <td className="p-2.5 border-r border-gray-300">{item.kpi_category || "Operational"}</td>
                              <td className="p-2.5">{item.functional_area || "Operations"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. Strategic Traceability Matrix */}
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">3. Strategic Traceability Matrix</h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-serif">
                      This matrix illustrates the strategic alignment from executive objectives down to specific key performance indicators, providing visibility into strategic translation.
                    </p>

                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left text-xs border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-150 text-gray-800 font-bold border-b border-gray-300">
                            <th className="p-2.5 border-r border-gray-300 w-1/5">Strategic Objective</th>
                            <th className="p-2.5 border-r border-gray-300 w-1/5">Business Challenge</th>
                            <th className="p-2.5 border-r border-gray-300 w-1/5">KRA</th>
                            <th className="p-2.5 border-r border-gray-300 w-1/5">Functional Area</th>
                            <th className="p-2.5 w-1/5">KPI Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                          {spec.items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-2.5 border-r border-gray-300 text-xs">{item.strategic_objective_supported || "Optimize Strategy"}</td>
                              <td className="p-2.5 border-r border-gray-300 text-xs">{item.business_challenge_addressed || "Inefficient Processes"}</td>
                              <td className="p-2.5 border-r border-gray-300 text-xs">{item.related_kra || "Operational Excellence"}</td>
                              <td className="p-2.5 border-r border-gray-300 text-xs">{item.functional_area || "Operations"}</td>
                              <td className="p-2.5 font-semibold text-gray-900 text-xs">{item.kpi_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page 5 of {totalPages}</div>
                </div>
              </div>

              {/* INDIVIDUAL KPI SPECIFICATIONS (PAGES 6 TO 6 + N - 1) */}
              {spec.items.map((item, index) => {
                const pageNum = 6 + index;
                return (
                  <div key={item.id} className={`${previewPageNum === pageNum ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                    <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                      <div></div>
                      <div>KPI Functional Specification Document</div>
                    </div>

                    <div className="flex-grow space-y-6">
                      {index === 0 ? (
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">4. Individual KPI Specifications</h3>
                          <p className="text-xs text-gray-500 leading-relaxed font-serif">
                            Detailed functional blueprints for each approved metric, outlining definitions, lineage, calculations, and rules.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">4. Individual KPI Specifications (Continued)</h3>
                        </div>
                      )}

                      <div className="space-y-6">
                        <div 
                          className="border border-gray-200 bg-white rounded-sm overflow-hidden space-y-4 relative p-6 shadow-sm"
                        >
                          {/* Left accent border */}
                          <div className="absolute left-0 top-0 h-full w-1 bg-[#FFE600]" />
                          
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-yellow-800 bg-yellow-50 px-2 py-0.5 border border-yellow-200 rounded-sm font-mono">
                                Metric {index + 1}
                              </span>
                              <h4 className="text-sm font-bold text-gray-900 font-sans">{item.kpi_name}</h4>
                            </div>
                          </div>

                          {/* Quick Reference */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-sm text-xs font-sans">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">KPI Category</p>
                              <p className="text-gray-900 mt-0.5 font-medium">{item.kpi_category || "Operational"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Functional Area</p>
                              <p className="text-gray-900 mt-0.5 font-medium">{item.functional_area || "Operations"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Business Owner</p>
                              <p className="text-gray-900 mt-0.5 font-medium">{item.business_owner || "TBD"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Data Owner</p>
                              <p className="text-gray-900 mt-0.5 font-medium">{item.data_owner || "TBD"}</p>
                            </div>
                          </div>

                          {/* Details Block */}
                          <div className="space-y-4 pt-2">
                            {(() => {
                              let parts = [
                                item.strategic_objective_supported || "Strategic Objective",
                                item.business_challenge_addressed || "Business Challenge",
                                item.related_kra || "KRA",
                                item.functional_area || "Functional Area",
                                item.kpi_name
                              ];
                              const traceStr = item.strategic_objective_supported || "";
                              if (traceStr.includes(" &rarr; ") || traceStr.includes(" → ")) {
                                const separator = traceStr.includes(" &rarr; ") ? " &rarr; " : " → ";
                                const parsed = traceStr.split(separator).map(s => s.trim());
                                if (parsed.length > 0) {
                                  parts = parsed;
                                  if (parts[parts.length - 1] !== item.kpi_name) {
                                    parts.push(item.kpi_name);
                                  }
                                }
                              }
                              
                              return (
                                <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm font-sans">
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Strategic Alignment Traceability</div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-800 pt-1 font-semibold">
                                    {parts.map((part, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        <span className={idx === parts.length - 1 ? "text-yellow-600 font-bold" : "text-gray-500"}>
                                          {part}
                                        </span>
                                        {idx < parts.length - 1 && (
                                          <span className="text-gray-400">&rarr;</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="space-y-4">
                              {sectionConfigs.map((sect) => {
                                const hasVal = sect.fields.some(field => {
                                  const rawVal = item[field.key as keyof FunctionalSpecItem];
                                  const val = typeof rawVal === "string" ? rawVal : Array.isArray(rawVal) ? rawVal.join(", ") : "";
                                  return val.trim() !== "" && val.trim().toLowerCase() !== "not specified";
                                });
                                if (!hasVal) return null;

                                return (
                                  <div key={sect.id} className="space-y-2">
                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-800 border-b border-gray-100 pb-0.5 font-sans">
                                      {sect.title}
                                    </h5>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {sect.fields.map((field) => {
                                        const rawVal = item[field.key as keyof FunctionalSpecItem];
                                        const val = typeof rawVal === "string" ? rawVal : Array.isArray(rawVal) ? rawVal.join(", ") : "";
                                        if (!val || val.trim().toLowerCase() === "not specified") return null;
                                        
                                        const isSpan = sect.fields.length === 1 || field.key === "strategic_objective_supported" || field.key === "business_challenge_addressed" || field.key === "calculation_methodology" || field.key === "inclusion_rules" || field.key === "exclusion_rules";
                                        return (
                                          <div key={field.key} className={`space-y-1 ${isSpan ? "md:col-span-2" : ""}`}>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 font-sans">{field.label}</p>
                                            <p className="text-xs leading-relaxed text-gray-800 whitespace-pre-wrap bg-gray-50 p-2.5 border border-gray-150 rounded-sm font-serif">
                                              {val}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                      <div>Confidential - Advisory Work Product</div>
                      <div>Page {pageNum} of {totalPages}</div>
                    </div>
                  </div>
                );
              })}


              {/* PAGE 5: GOVERNANCE (PAGE INDEX: 6 + N) */}
              <div className={`${previewPageNum === 6 + spec.items.length ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-8">
                  {/* 5. Governance Framework */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">5. Governance Framework</h3>
                    <p className="text-xs text-gray-755 leading-relaxed font-serif">
                      To ensure metric consistency, accountability, and ongoing relevance, a formal governance framework is established for all approved KPIs. This structure assigns clear responsibilities and defines escalation paths.
                    </p>

                    <div className="space-y-2 font-sans">
                      <h4 className="text-xs font-bold uppercase text-gray-800 tracking-wider">Roles and Responsibilities</h4>
                      <ul className="list-disc pl-5 text-xs text-gray-600 space-y-2 font-serif">
                        <li>
                          <strong className="text-gray-900 font-sans">Business Owner: </strong>
                          Responsible for defining logic, validating calculation results, approving targets, and driving performance.
                        </li>
                        <li>
                          <strong className="text-gray-900 font-sans">Data Owner: </strong>
                          Accountable for technical lineage, data completeness, ETL quality checks, and resolving availability issues.
                        </li>
                        <li>
                          <strong className="text-gray-900 font-sans">Escalation Path: </strong>
                          Discrepancies are escalated to the Data Governance Committee and KPI Advisory Board for review and reconciliation.
                        </li>
                      </ul>
                    </div>

                    {/* Matrix Table */}
                    <div className="space-y-2 pt-2 font-sans">
                      <h4 className="text-xs font-bold uppercase text-gray-800 tracking-wider">Ownership & Governance Matrix</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-150 text-gray-800 font-bold border-b border-gray-300">
                              <th className="p-2.5 border-r border-gray-300 w-1/4">Metric Name</th>
                              <th className="p-2.5 border-r border-gray-300 w-1/5">Business Owner</th>
                              <th className="p-2.5 border-r border-gray-300 w-1/5">Data Owner</th>
                              <th className="p-2.5">Governance Policy Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-700">
                            {spec.items.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-2.5 border-r border-gray-300 font-semibold text-gray-900">{item.kpi_name}</td>
                                <td className="p-2.5 border-r border-gray-300 text-xs">{item.business_owner || "Business Sponsor"}</td>
                                <td className="p-2.5 border-r border-gray-300 text-xs">{item.data_owner || "Data Custodian"}</td>
                                <td className="p-2.5 text-xs leading-relaxed font-serif">{item.ownership_governance || "Subject to standard quarterly audits."}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page {6 + spec.items.length} of {totalPages}</div>
                </div>
              </div>


              {/* PAGE 6: REPORTING & DASHBOARD (PAGE INDEX: 7 + N) */}
              <div className={`${previewPageNum === 7 + spec.items.length ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-8">
                  {/* 6. Reporting & Dashboard Requirements */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">6. Reporting & Dashboard Requirements</h3>
                    <p className="text-xs text-gray-755 leading-relaxed font-serif">
                      Visualization layout and threshold criteria dictate how data is displayed. The matrix below outlines reporting recommendations and performance thresholds.
                    </p>

                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left text-xs border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-150 text-gray-800 font-bold border-b border-gray-300">
                            <th className="p-2.5 border-r border-gray-300 w-1/4">Metric Name</th>
                            <th className="p-2.5 border-r border-gray-300 w-1/4">Reporting Guidelines</th>
                            <th className="p-2.5 border-r border-gray-300 w-1/4">Dashboard Placement</th>
                            <th className="p-2.5">Threshold Guidance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                          {spec.items.map((item) => {
                            const get_default_reporting = (category: string) => {
                              const cat = (category || "").toLowerCase();
                              if (cat.includes("financial")) return "Monthly trended charts, quarterly variance reporting, and margin analysis.";
                              if (cat.includes("operational")) return "Weekly performance run-charts, daily process monitor scorecards.";
                              if (cat.includes("strategic")) return "C-Suite quarterly scorecards, progress bars against annual target milestones.";
                              return "Standard monthly performance dashboard, with trailing 12-month trend charts.";
                            };

                            const get_default_threshold = (category: string) => {
                              const cat = (category || "").toLowerCase();
                              if (cat.includes("financial")) return "Green: Within +/- 2% of budget. Amber: 2% to 5% variance. Red: > 5% variance.";
                              if (cat.includes("operational")) return "Green: Meets or exceeds 95% operating efficiency. Amber: 90% to 94%. Red: < 90%.";
                              if (cat.includes("strategic")) return "Green: Milestone achieved on time. Amber: 1-2 weeks delay. Red: > 2 weeks delay.";
                              return "Green: Target achieved or exceeded. Amber: 5% to 10% variance. Red: > 10% variance.";
                            };

                            const defRep = get_default_reporting(item.kpi_category || "");
                            const defThresh = get_default_threshold(item.kpi_category || "");
                            const repVal = item.reporting_requirements || defRep;
                            const dashVal = item.dashboard_recommendations || "Standard Performance Dashboard.";
                            const threshVal = item.threshold_guidance || defThresh;

                            return (
                              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-2.5 border-r border-gray-300 font-semibold text-gray-900">{item.kpi_name}</td>
                                <td className="p-2.5 border-r border-gray-300 text-xs leading-relaxed font-serif">{repVal}</td>
                                <td className="p-2.5 border-r border-gray-300 text-xs leading-relaxed font-serif">{dashVal}</td>
                                <td className="p-2.5 text-xs leading-relaxed font-serif">{threshVal}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page {7 + spec.items.length} of {totalPages}</div>
                </div>
              </div>


              {/* PAGE 7: ASSUMPTIONS & CONSTRAINTS (PAGE INDEX: 8 + N) */}
              <div className={`${previewPageNum === 8 + spec.items.length ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-6">
                  {/* 7. Assumptions & Constraints */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">7. Assumptions & Constraints</h3>
                    <p className="text-xs text-gray-550 leading-relaxed font-serif">
                      A clear understanding of business and technical assumptions is critical for successful implementation.
                      The following list represents consolidated baseline assumptions and constraints.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5 font-sans">
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">General Architectural Assumptions</h4>
                        <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1 font-serif">
                          <li>Source transactional tables are loaded nightly into the central reporting repository.</li>
                          <li>Standard calendar year rules are assumed unless otherwise explicitly documented.</li>
                          <li>Target source ledgers maintain 99.5% uptime during extraction windows.</li>
                        </ul>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Metric-Specific Assumptions</h4>
                        <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1 font-serif">
                          {spec.items.map((item) => {
                            const cleanedAsm = (item.assumptions_constraints || "").trim();
                            if (!cleanedAsm || cleanedAsm.toLowerCase() === "not specified") return null;
                            return (
                              <li key={item.id}>
                                <strong className="text-gray-900 font-sans">{item.kpi_name}: </strong>
                                {cleanedAsm}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page {8 + spec.items.length} of {totalPages}</div>
                </div>
              </div>


              {/* PAGE 8: IMPLEMENTATION CONSIDERATIONS (PAGE INDEX: 9 + N) */}
              <div className={`${previewPageNum === 9 + spec.items.length ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-6">
                  {/* 8. Implementation Considerations */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">8. Implementation Considerations</h3>
                    <p className="text-xs text-gray-550 leading-relaxed font-serif">
                      Transitioning these specifications into functional BI tools requires rigorous testing, change management,
                      and data reconciliation. Standard implementation considerations are outlined below.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5 font-sans">
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Standard Guidelines</h4>
                        <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1 font-serif">
                          <li>Audit all calculation outcomes and reconcile against official books or audited financial statements.</li>
                          <li>UAT validation by business owners prior to production deployment.</li>
                          <li>Training sessions and clear documentation to support onboarding and drive adoption.</li>
                        </ul>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        <h4 className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Metric-Specific Considerations</h4>
                        <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1 font-serif">
                          {spec.items.map((item) => {
                            const cleanedImp = (item.implementation_guidance || "").trim();
                            if (!cleanedImp || cleanedImp.toLowerCase() === "not specified") return null;
                            return (
                              <li key={item.id}>
                                <strong className="text-gray-900 font-sans">{item.kpi_name}: </strong>
                                {cleanedImp}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page {9 + spec.items.length} of {totalPages}</div>
                </div>
              </div>


              {/* PAGE 9: APPENDIX (PAGE INDEX: 10 + N) */}
              <div className={`${previewPageNum === 10 + spec.items.length ? 'block' : 'hidden print:block'} bg-white text-gray-900 border border-gray-200 p-12 md:p-16 rounded-sm shadow-2xl relative font-sans w-full min-h-[10.5in] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 page-break-after-always`}>
                <div className="border-b-2 border-gray-900 pb-2 flex justify-between items-center text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-6">
                  <div></div>
                  <div>KPI Functional Specification Document</div>
                </div>

                <div className="flex-grow space-y-6">
                  {/* 9. Appendix */}
                  <div className="space-y-3 pt-3">
                    <h3 className="text-lg font-bold text-gray-900 font-sans border-b border-gray-250 pb-1">9. Appendix</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-sans text-gray-655 leading-relaxed">
                      <div>
                        <h4 className="font-bold uppercase text-gray-800 mb-1">Glossary</h4>
                        <p><strong className="text-gray-900">KPI: </strong>Quantifiable measure to evaluate success.</p>
                        <p><strong className="text-gray-900">KRA: </strong>Primary focus areas of business outcomes.</p>
                        <p><strong className="text-gray-900">Numerator/Denominator: </strong>Formula components.</p>
                      </div>
                      <div>
                        <h4 className="font-bold uppercase text-gray-800 mb-1">Data Quality</h4>
                        <p><strong className="text-gray-900">Accuracy: </strong>Correct operational representation.</p>
                        <p><strong className="text-gray-900">Completeness: </strong>No data omission.</p>
                        <p><strong className="text-gray-900">Consistency: </strong>Metrics align across tools.</p>
                      </div>
                      <div>
                        <h4 className="font-bold uppercase text-gray-800 mb-1">Acronyms</h4>
                        <p><strong className="text-gray-900">ERP: </strong>Enterprise Resource Planning</p>
                        <p><strong className="text-gray-900">SAP SD/MM: </strong>Sales/Materials modules</p>
                        <p><strong className="text-gray-900">UAT/BI: </strong>Acceptance testing / BI systems</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase mt-8">
                  <div>Confidential - Advisory Work Product</div>
                  <div>Page {10 + spec.items.length} of {totalPages}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
