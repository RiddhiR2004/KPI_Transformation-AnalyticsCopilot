import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Building2, 
  Database, 
  Save, 
  CheckCircle, 
  AlertCircle,
  X,
  ArrowLeft
} from "lucide-react";
import { api } from "../lib/api";
import type { ClientProfile, ClientInsightItem } from "../types/api";

const industryOptions = ["Manufacturing", "Retail", "Financial Services", "Energy", "Healthcare", "Technology", "Other"];
const companySizeOptions = ["< 100", "100 - 1000", "1000 - 5000", "5000 - 10000", "> 10000"];

const erpOptions = ["SAP S/4HANA", "SAP ECC", "Oracle Fusion", "Microsoft Dynamics 365", "NetSuite", "Other"];
const crmOptions = ["Salesforce", "Hubspot", "Microsoft Dynamics CRM", "Zoho", "Other"];
const mesOptions = ["Siemens Opcenter", "Rockwell FactoryTalk", "Aveva", "Tulip", "Other"];
const biOptions = ["Microsoft Power BI", "Tableau", "Qlik Sense", "Looker", "Other"];
const dwOptions = ["Snowflake", "Databricks", "Google BigQuery", "Amazon Redshift", "Microsoft Azure Synapse", "Other"];
const cloudOptions = ["Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "Private Cloud", "Other"];

export function LandingPage() {
  const { clientId: clientIdParam } = useParams<{ clientId?: string }>();
  const editingClientId = clientIdParam ? parseInt(clientIdParam, 10) : null;
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate(-1); // Go back to the previous page (Dashboard or Selection Page)
  };

  // Client Info State
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [subIndustry, setSubIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [orgDescription, setOrgDescription] = useState("");

  // Tech Landscape State
  const [erpVal, setErpVal] = useState("");
  const [customErp, setCustomErp] = useState("");
  const [crmVal, setCrmVal] = useState("");
  const [customCrm, setCustomCrm] = useState("");
  const [mesVal, setMesVal] = useState("");
  const [customMes, setCustomMes] = useState("");
  const [biVal, setBiVal] = useState("");
  const [customBi, setCustomBi] = useState("");
  const [dwVal, setDwVal] = useState("");
  const [customDw, setCustomDw] = useState("");
  const [cloudVal, setCloudVal] = useState("");
  const [customCloud, setCustomCloud] = useState("");

  // Existing Insights State (loaded to prevent data loss on edit)
  const [existingInsights, setExistingInsights] = useState<ClientInsightItem[]>([]);
  
  // Status and Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Load Saved Profile on Mount (only when editing an existing client)
  useEffect(() => {
    if (!editingClientId) return; // New client — nothing to load

    async function loadProfile() {
      try {
        const data = await api.getClientById(editingClientId!);
        if (data && data.client_name) {
          setClientName(data.client_name);
          
          if (industryOptions.includes(data.industry)) {
            setIndustry(data.industry);
            setCustomIndustry("");
          } else if (data.industry) {
            setIndustry("Other");
            setCustomIndustry(data.industry);
          }
          
          setSubIndustry(data.sub_industry || "");
          setCountry(data.country || "");
          setRegion(data.region || "");
          setCompanySize(data.company_size || "");
          setOrgDescription(data.organization_description || "");
          
          const erp = data.erp_platform || "";
          if (erpOptions.includes(erp)) {
            setErpVal(erp);
            setCustomErp("");
          } else if (erp) {
            setErpVal("Other");
            setCustomErp(erp);
          }
          
          const crm = data.crm_platform || "";
          if (crmOptions.includes(crm)) {
            setCrmVal(crm);
            setCustomCrm("");
          } else if (crm) {
            setCrmVal("Other");
            setCustomCrm(crm);
          }
          
          const mes = data.mes_platform || "";
          if (mesOptions.includes(mes)) {
            setMesVal(mes);
            setCustomMes("");
          } else if (mes) {
            setMesVal("Other");
            setCustomMes(mes);
          }
          
          const bi = data.bi_tool || "";
          if (biOptions.includes(bi)) {
            setBiVal(bi);
            setCustomBi("");
          } else if (bi) {
            setBiVal("Other");
            setCustomBi(bi);
          }
          
          const dw = data.data_warehouse || "";
          if (dwOptions.includes(dw)) {
            setDwVal(dw);
            setCustomDw("");
          } else if (dw) {
            setDwVal("Other");
            setCustomDw(dw);
          }
          
          const cloud = data.cloud_platform || "";
          if (cloudOptions.includes(cloud)) {
            setCloudVal(cloud);
            setCustomCloud("");
          } else if (cloud) {
            setCloudVal("Other");
            setCustomCloud(cloud);
          }
          
          if (data.insights) {
            setExistingInsights(data.insights);
          }
          setIsSaved(true);
        }
      } catch (e) {
        console.error("Failed to load client profile:", e);
      }
    }
    void loadProfile();
  }, [editingClientId]);

  // Compute Onboarding Progress
  const getProgress = () => {
    let stepsComplete = 0;
    
    // Step 1: Client Info (Client Name, Industry, Country)
    const activeIndustry = industry === "Other" ? customIndustry : industry;
    if (clientName.trim() && activeIndustry.trim() && country.trim()) {
      stepsComplete += 1;
    }
    
    // Step 2: Tech Landscape (At least one platform selected)
    const activeErp = erpVal === "Other" ? customErp : erpVal;
    const activeCrm = crmVal === "Other" ? customCrm : crmVal;
    const activeMes = mesVal === "Other" ? customMes : mesVal;
    const activeBi = biVal === "Other" ? customBi : biVal;
    const activeDw = dwVal === "Other" ? customDw : dwVal;
    const activeCloud = cloudVal === "Other" ? customCloud : cloudVal;
    if (activeErp || activeCrm || activeMes || activeBi || activeDw || activeCloud) {
      stepsComplete += 1;
    }
    
    return Math.round((stepsComplete / 2) * 100);
  };

  // Save Client Profile & Insights
  const handleSaveProfile = async () => {
    setError("");
    setSuccess("");
    
    const activeIndustry = industry === "Other" ? customIndustry : industry;
    if (!clientName.trim()) {
      setError("Client Name is a required field.");
      return;
    }
    if (!activeIndustry.trim()) {
      setError("Industry is a required field.");
      return;
    }
    if (!country.trim()) {
      setError("Country is a required field.");
      return;
    }

    const payloadProfile: ClientProfile = {
      id: editingClientId || undefined,
      client_name: clientName.trim(),
      industry: activeIndustry.trim(),
      sub_industry: subIndustry.trim(),
      country: country.trim(),
      region: region.trim(),
      company_size: companySize,
      organization_description: orgDescription.trim(),
      erp_platform: erpVal === "Other" ? customErp.trim() : erpVal,
      crm_platform: crmVal === "Other" ? customCrm.trim() : crmVal,
      mes_platform: mesVal === "Other" ? customMes.trim() : mesVal,
      bi_tool: biVal === "Other" ? customBi.trim() : biVal,
      data_warehouse: dwVal === "Other" ? customDw.trim() : dwVal,
      cloud_platform: cloudVal === "Other" ? customCloud.trim() : cloudVal
    };

    try {
      await api.saveClientProfile({
        profile: payloadProfile,
        insights: existingInsights
      });
      setSuccess("Client profile saved successfully!");
      setIsSaved(true);
      // Navigate back to the dashboard after a brief delay
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    }
  };

  const progressVal = getProgress();

  return (
    <div className="space-y-6">
      {/* Onboarding Header */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-8 rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B0B0B0] hover:text-[#FFE600] border border-[#303030] hover:border-[#FFE600]/40 px-3 py-1.5 rounded-sm transition-all"
              >
                <ArrowLeft size={12} />
                Back to Clients
              </button>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE600]">
              {editingClientId ? "Edit Client Profile" : "New Client Setup"}
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5]">
              {editingClientId ? "Update Enterprise Profile" : "Establish Enterprise Profile"}
            </h2>
            <p className="max-w-2xl text-xs text-[#B0B0B0] leading-relaxed">
              Capture organization profile and technology platform landscape context to initialize the client setup.
            </p>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs font-bold text-[#F5F5F5]">Onboarding Progress: {progressVal}%</span>
            <div className="w-56 h-2.5 bg-[#111] rounded-full overflow-hidden border border-[#303030]">
              <div 
                className="h-full bg-[#FFE600] transition-all duration-500" 
                style={{ width: `${progressVal}%` }}
              />
            </div>
            <div className="flex gap-2.5 text-[10px] text-[#888] font-semibold mt-1">
              <span className={clientName && country && (industry || customIndustry) ? "text-[#FFE600]" : ""}>Profile</span>
              <span>•</span>
              <span className={erpVal || crmVal || mesVal || biVal || dwVal || cloudVal ? "text-[#FFE600]" : ""}>Landscape</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Save Success Banner */}
      {isSaved && (
        <div className="border border-[#FFE600]/20 bg-[#FFE600]/5 p-5 rounded-sm flex items-center gap-4 transition-all duration-300">
          <div className="h-10 w-10 bg-[#FFE600]/10 rounded-full flex items-center justify-center border border-[#FFE600]/30 shrink-0">
            <CheckCircle className="text-[#FFE600]" size={22} />
          </div>
          <div className="space-y-0.5 flex-1">
            <h4 className="text-sm font-bold text-[#F5F5F5] uppercase tracking-wider">
              {editingClientId ? "Client Profile Updated" : "Client Profile Saved"}
            </h4>
            <p className="text-xs text-[#B0B0B0] leading-relaxed">
              Redirecting to the Clients & Engagements dashboard...
            </p>
          </div>
        </div>
      )}



      {/* Notifications */}
      {error && (
        <div className="border border-red-950 bg-red-950/20 p-4 text-xs text-red-400 border-l-2 border-red-500 rounded-sm flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="border border-emerald-950 bg-emerald-950/20 p-4 text-xs text-emerald-400 border-l-2 border-emerald-500 rounded-sm flex items-center gap-3 animate-pulse">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Form Cards — Side by Side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Left Column: Client Info */}
        <div className="border border-[#303030] bg-[#1B1B1B] p-6 rounded-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-2 border-b border-[#303030] pb-3">
            <Building2 size={16} className="text-[#FFE600]" />
            Client Profile Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Client Name *</label>
              <input
                type="text"
                className="field"
                placeholder="Acme Corporation"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="label">Industry *</label>
              <select
                className={`field ${!industry ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  if (e.target.value !== "Other") setCustomIndustry("");
                }}
              >
                <option value="">Select Industry...</option>
                {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {industry === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify custom industry..."
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">Sub-Industry</label>
              <input
                type="text"
                className="field"
                placeholder="Automotive Assembly"
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="label">Country *</label>
              <input
                type="text"
                className="field"
                placeholder="United States"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="label">Region</label>
              <input
                type="text"
                className="field"
                placeholder="North America"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="label">Company Size</label>
              <select
                className={`field ${!companySize ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
              >
                <option value="">Select Size...</option>
                {companySizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Organization Description</label>
            <textarea
              className="field min-h-[90px]"
              placeholder="Briefly describe the client's core operations, business units, or value propositions..."
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Right Column: Technology Landscape */}
        <div className="border border-[#303030] bg-[#1B1B1B] p-6 rounded-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] flex items-center gap-2 border-b border-[#303030] pb-3">
            <Database size={16} className="text-[#FFE600]" />
            Technology Landscape
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">ERP Platform</label>
              <select
                className={`field ${!erpVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={erpVal}
                onChange={(e) => {
                  setErpVal(e.target.value);
                  if (e.target.value !== "Other") setCustomErp("");
                }}
              >
                <option value="">Select ERP...</option>
                {erpOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {erpVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify ERP..."
                  value={customErp}
                  onChange={(e) => setCustomErp(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">CRM Platform</label>
              <select
                className={`field ${!crmVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={crmVal}
                onChange={(e) => {
                  setCrmVal(e.target.value);
                  if (e.target.value !== "Other") setCustomCrm("");
                }}
              >
                <option value="">Select CRM...</option>
                {crmOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {crmVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify CRM..."
                  value={customCrm}
                  onChange={(e) => setCustomCrm(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">MES Platform</label>
              <select
                className={`field ${!mesVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={mesVal}
                onChange={(e) => {
                  setMesVal(e.target.value);
                  if (e.target.value !== "Other") setCustomMes("");
                }}
              >
                <option value="">Select MES...</option>
                {mesOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {mesVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify MES..."
                  value={customMes}
                  onChange={(e) => setCustomMes(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">BI / Analytics Tool</label>
              <select
                className={`field ${!biVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={biVal}
                onChange={(e) => {
                  setBiVal(e.target.value);
                  if (e.target.value !== "Other") setCustomBi("");
                }}
              >
                <option value="">Select BI...</option>
                {biOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {biVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify BI..."
                  value={customBi}
                  onChange={(e) => setCustomBi(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">Data Warehouse</label>
              <select
                className={`field ${!dwVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={dwVal}
                onChange={(e) => {
                  setDwVal(e.target.value);
                  if (e.target.value !== "Other") setCustomDw("");
                }}
              >
                <option value="">Select Warehouse...</option>
                {dwOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {dwVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify Warehouse..."
                  value={customDw}
                  onChange={(e) => setCustomDw(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>

            <div>
              <label className="label">Cloud Platform</label>
              <select
                className={`field ${!cloudVal ? "text-[#666666]" : "text-[#F5F5F5]"}`}
                value={cloudVal}
                onChange={(e) => {
                  setCloudVal(e.target.value);
                  if (e.target.value !== "Other") setCustomCloud("");
                }}
              >
                <option value="">Select Cloud...</option>
                {cloudOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {cloudVal === "Other" && (
                <input
                  type="text"
                  className="field mt-2"
                  placeholder="Specify Cloud..."
                  value={customCloud}
                  onChange={(e) => setCustomCloud(e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save / Cancel — Centered Below Both Cards */}
      <div className="flex flex-col items-center gap-3 pt-2 pb-4">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            className="button-yellow flex items-center gap-2 px-8 py-3 text-sm"
            onClick={handleSaveProfile}
          >
            <Save size={16} />
            Save Client Profile
          </button>

          <button
            type="button"
            className="button-secondary flex items-center gap-2 px-6 py-3 text-sm"
            onClick={handleCancel}
          >
            <X size={16} />
            Cancel
          </button>
        </div>
        {isSaved ? (
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFE600] uppercase tracking-wider mt-1">
            <CheckCircle size={14} />
            Profile saved. Redirecting to the dashboard...
          </div>
        ) : (
          <p className="text-[11px] text-[#666] italic mt-1">
            * Please save your client profile before proceeding to Step 1.
          </p>
        )}
      </div>

    </div>
  );
}
