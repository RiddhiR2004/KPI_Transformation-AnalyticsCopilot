import React, { useEffect, useState } from "react";
import { 
  FolderOpen, 
  Upload, 
  Trash2, 
  Sparkles, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Loader2, 
  Plus, 
  X 
} from "lucide-react";
import { api } from "../lib/api";
import type { ClientProfile, ClientInsightItem } from "../types/api";

export function BusinessAssetsSection({ onApprovedChange }: { onApprovedChange: () => void }) {
  // Session ID for staging files
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));

  // Client and Insights states
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [extractedInsights, setExtractedInsights] = useState<ClientInsightItem[] | null>(null);
  const [stagedFiles, setStagedFiles] = useState<{ name: string; size: number; status: string }[]>([]);
  
  // Status and Messages
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Load client profile and existing insights on mount
  useEffect(() => {
    fetchClientProfile();
  }, []);

  async function fetchClientProfile() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getClientProfile();
      setClientProfile(data);
      if (data && data.insights) {
        setExtractedInsights(data.insights);
        if (data.insights.length > 0) {
          const activeClientId = parseInt(localStorage.getItem("active_client_id") || "0", 10);
          const activeEngagementId = parseInt(localStorage.getItem("active_engagement_id") || "0", 10);
          void api.logAuditEvent({
            module: "KPI Library",
            action: "AI Insight Viewed",
            status: "Success",
            entity_type: "Strategic Insights",
            entity_name: "Strategic Insights List",
            client_id: activeClientId || undefined,
            engagement_id: activeEngagementId || undefined
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client profile");
    } finally {
      setLoading(false);
    }
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      void processAndUploadFiles(Array.from(files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void processAndUploadFiles(Array.from(files));
    }
  };

  // Validate and Stage Upload Files
  const processAndUploadFiles = async (files: File[]) => {
    setError("");
    setSuccess("");
    
    // Limit to 5 files per session
    if (stagedFiles.length + files.length > 5) {
      setError("Maximum 5 files can be staged per session.");
      return;
    }

    // Check sizes
    let totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    const validatedFiles: File[] = [];

    for (const file of files) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      let limit = 0;
      
      if ([".xlsx", ".xls", ".csv"].includes(ext)) limit = 20 * 1024 * 1024; // 20MB
      else if (ext === ".pdf") limit = 25 * 1024 * 1024; // 25MB
      else if (ext === ".docx") limit = 20 * 1024 * 1024; // 20MB
      else if (ext === ".pptx") limit = 50 * 1024 * 1024; // 50MB
      else if ([".png", ".jpg", ".jpeg"].includes(ext)) limit = 10 * 1024 * 1024; // 10MB
      else {
        setError(`Unsupported file format '${ext}'. Please check list of supported files.`);
        return;
      }

      if (file.size > limit) {
        setError(`File '${file.name}' exceeds the individual size limit for its type.`);
        return;
      }

      totalSize += file.size;
      if (totalSize > 100 * 1024 * 1024) { // 100MB
        setError("Total staged assets size exceeds the session limit of 100MB.");
        return;
      }
      validatedFiles.push(file);
    }

    // Upload
    setUploading(true);
    try {
      for (const file of validatedFiles) {
        const resp = await api.uploadClientAsset(file, sessionId);
        setStagedFiles(prev => [...prev, { name: resp.filename, size: resp.size, status: "Staged" }]);
      }
      setSuccess("Assets staged successfully! Click 'Analyze Assets' to extract business intelligence.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stage files.");
    } finally {
      setUploading(false);
    }
  };

  const deleteStagedFile = (filename: string) => {
    setStagedFiles(prev => prev.filter(f => f.name !== filename));
    setError("");
  };

  // Run LLM Asset Analysis
  const handleAnalyzeAssets = async () => {
    setAnalyzing(true);
    setError("");
    setSuccess("");
    try {
      const insights = await api.analyzeClientAssets(sessionId);
      
      // Convert backend dictionary to list of Category items
      const items: ClientInsightItem[] = Object.entries(insights).map(([category, list]) => ({
        category,
        insights: Array.isArray(list) ? list : []
      }));
      
      setExtractedInsights(items);
      setStagedFiles([]); // Clear upload staging list since they are preprocessed
      setSuccess("Dynamic asset analysis complete! Extracted insights are loaded below for review.");
      
      const activeClientId = parseInt(localStorage.getItem("active_client_id") || "0", 10);
      const activeEngagementId = parseInt(localStorage.getItem("active_engagement_id") || "0", 10);
      void api.logAuditEvent({
        module: "KPI Library",
        action: "AI Insight Viewed",
        status: "Success",
        entity_type: "Strategic Insights",
        entity_name: "Strategic Insights List",
        client_id: activeClientId || undefined,
        engagement_id: activeEngagementId || undefined
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dynamic asset extraction failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Save approved insights back to client profile
  const handleSaveInsights = async () => {
    if (!clientProfile) {
      setError("No client profile context loaded.");
      return;
    }
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payloadInsights = extractedInsights || [];
      await api.saveClientProfile({
        profile: clientProfile,
        insights: payloadInsights
      });
      setSuccess("Business assets insights saved and approved successfully!");
      onApprovedChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save insights.");
    } finally {
      setSaving(false);
    }
  };

  // Categories Editor helpers
  const handleCategoryNameChange = (index: number, newName: string) => {
    if (!extractedInsights) return;
    const updated = [...extractedInsights];
    updated[index].category = newName;
    setExtractedInsights(updated);
  };

  const handleDeleteCategory = (index: number) => {
    if (!extractedInsights) return;
    setExtractedInsights(extractedInsights.filter((_, i) => i !== index));
  };

  const handleAddCategory = (name: string) => {
    if (!name.trim()) return;
    const items = extractedInsights || [];
    // Prevent duplicates
    if (items.some(c => c.category.toLowerCase() === name.trim().toLowerCase())) {
      setError("Category already exists.");
      return;
    }
    setExtractedInsights([...items, { category: name.trim(), insights: [] }]);
  };

  const handleUpdateInsights = (index: number, items: string[]) => {
    if (!extractedInsights) return;
    const updated = [...extractedInsights];
    updated[index].insights = items;
    setExtractedInsights(updated);
  };

  if (loading) {
    return (
      <section className="panel p-7 flex h-64 items-center justify-center text-[#FFE600]">
        <Loader2 className="animate-spin" size={28} />
        <span className="ml-3 text-sm font-semibold tracking-wide uppercase">Loading Business Assets Context...</span>
      </section>
    );
  }

  return (
    <section className="panel p-7 space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-[#F5F5F5] flex items-center gap-2">
          <FolderOpen size={20} className="text-[#FFE600]" />
          Business Assets & Knowledge Sources
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Enrich the KPI discovery context by staging and analyzing raw business documents (PDFs, Spreadsheets, PowerPoint slides, Word documents, or Dashboard Screenshots). 
          The backend will extract operational priorities, objectives, technologies, and challenges via LLM. 
          Approved insights are dynamically injected downstream into Prompts, KPI generation, and Functional Specifications.
        </p>
      </div>

      {error && (
        <div className="border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500 rounded-sm flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 border-l-2 border-emerald-500 rounded-sm flex items-center gap-3 animate-pulse">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="lg:col-span-2 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer relative ${
              isDragOver
                ? "border-[#FFE600] bg-[#FFE600]/5"
                : "border-[#303030] hover:border-[#555] bg-[#0d0d0d]"
            }`}
          >
            <input
              type="file"
              id="assets-file-input"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              accept=".txt,.docx,.pdf,.xlsx,.xls,.csv,.pptx,.png,.jpg,.jpeg"
              multiple
              disabled={uploading || analyzing}
            />
            {uploading ? (
              <>
                <Loader2 className="animate-spin text-[#FFE600]" size={32} />
                <p className="text-sm font-semibold text-[#F5F5F5]">Uploading & Staging File...</p>
              </>
            ) : (
              <>
                <Upload className="text-[#FFE600]" size={32} />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-[#F5F5F5]">
                    Drag and drop files here, or click to upload
                  </p>
                  <p className="text-xs text-[#B0B0B0]">
                    Max 5 files per session. Max 100MB total.<br />
                    PDF (25MB), Excel/CSV/Word (20MB), PPTX (50MB), Images (10MB).
                  </p>
                </div>
              </>
            )}
          </div>

          {/* List of Staged Files */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">
                Staged Assets ({stagedFiles.length} / 5)
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between border border-[#252525] bg-[#0d0d0d] p-3 rounded-sm text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={16} className="text-[#FFE600] shrink-0" />
                      <span className="truncate text-[#E0E0E0]">{file.name}</span>
                      <span className="text-[10px] text-[#777] shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteStagedFile(file.name)}
                      className="text-[#888] hover:text-red-400 p-0.5 transition-colors shrink-0"
                      title="Delete from session"
                      disabled={analyzing}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="border border-[#303030] bg-[#141414] p-5 rounded-sm flex flex-col justify-between h-fit space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
              Asset Extraction Controls
            </h4>
            <p className="text-xs text-[#B0B0B0] leading-relaxed">
              Once your files are staged, click <strong>Analyze Assets</strong> to run AI extraction. 
              Review the categories and click <strong>Save approved insights</strong> to inject them into the KPI prompt generation.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              className="button-yellow w-full flex items-center justify-center gap-2"
              onClick={handleAnalyzeAssets}
              disabled={stagedFiles.length === 0 || uploading || analyzing}
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin text-[#FFE600]" />
                  <span>Analyzing Assets...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Analyze Assets</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="button-secondary w-full flex items-center justify-center gap-2 border border-[#ffe600]/30 hover:border-[#ffe600] text-[#ffe600]"
              onClick={handleSaveInsights}
              disabled={uploading || analyzing || saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Insights...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Approved Insights</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Insights Review and Approval Section */}
      {extractedInsights && extractedInsights.length > 0 && (
        <div className="border-t border-[#252525] pt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-[#F5F5F5] flex items-center gap-2">
                <Sparkles className="text-[#FFE600]" size={18} />
                AI-Extracted Strategic Insights
              </h4>
              <p className="text-xs text-[#B0B0B0] mt-0.5">
                Review and approve the extracted details below. Edit existing points, delete irrelevant cards, or add new custom categories.
              </p>
            </div>
            
            <button
              type="button"
              className="button-yellow flex items-center gap-1.5"
              onClick={handleSaveInsights}
              disabled={uploading || analyzing || saving}
            >
              <Save size={14} />
              Save approved insights
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {extractedInsights.map((cat, catIdx) => (
              <CategoryEditor
                key={catIdx}
                index={catIdx}
                categoryName={cat.category}
                insights={cat.insights}
                onNameChange={handleCategoryNameChange}
                onDeleteCategory={handleDeleteCategory}
                onInsightsChange={handleUpdateInsights}
              />
            ))}
          </div>

          {/* Add Custom Category Form */}
          <AddCategoryForm onAddCategory={handleAddCategory} />
        </div>
      )}
    </section>
  );
}

// Subcomponent: Category Card Editor
interface CategoryEditorProps {
  index: number;
  categoryName: string;
  insights: string[];
  onNameChange: (index: number, newName: string) => void;
  onDeleteCategory: (index: number) => void;
  onInsightsChange: (index: number, newInsights: string[]) => void;
}

function CategoryEditor({
  index,
  categoryName,
  insights,
  onNameChange,
  onDeleteCategory,
  onInsightsChange
}: CategoryEditorProps) {
  const [newItemText, setNewItemText] = useState("");

  const handleAddItem = () => {
    if (newItemText.trim()) {
      onInsightsChange(index, [...insights, newItemText.trim()]);
      setNewItemText("");
    }
  };

  const handleEditInsight = (itemIdx: number, newText: string) => {
    const updated = [...insights];
    updated[itemIdx] = newText;
    onInsightsChange(index, updated);
  };

  const handleDeleteInsight = (itemIdx: number) => {
    onInsightsChange(index, insights.filter((_, i) => i !== itemIdx));
  };

  return (
    <div className="border border-[#252525] bg-[#0d0d0d] p-5 rounded-sm space-y-4 relative flex flex-col justify-between">
      <div className="space-y-4">
        {/* Category Header with Editable Title and Delete Button */}
        <div className="flex items-center justify-between gap-4 border-b border-[#222] pb-3">
          <input
            type="text"
            className="bg-transparent border-b border-transparent hover:border-[#444] focus:border-[#FFE600] focus:ring-0 text-sm font-semibold text-[#FFE600] py-0.5 px-1 outline-none w-full"
            value={categoryName}
            onChange={(e) => onNameChange(index, e.target.value)}
          />
          <button
            type="button"
            onClick={() => onDeleteCategory(index)}
            className="text-[#666] hover:text-red-400 p-1 transition-colors shrink-0"
            title="Delete entire category"
          >
            <X size={15} />
          </button>
        </div>

        {/* List of Insights */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {insights.length === 0 ? (
            <p className="text-xs text-[#555] italic p-1">No insights in this category.</p>
          ) : (
            insights.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 bg-[#141414] border border-[#222] p-2.5 rounded-sm">
                <textarea
                  className="bg-transparent border-none text-xs text-[#E0E0E0] p-0 outline-none w-full resize-none leading-relaxed focus:ring-0"
                  rows={Math.max(1, Math.ceil(item.length / 45))}
                  value={item}
                  onChange={(e) => handleEditInsight(idx, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteInsight(idx)}
                  className="text-[#666] hover:text-red-400 p-0.5 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Insight Row */}
      <div className="flex gap-2.5 pt-3 border-t border-[#222] mt-4">
        <input
          type="text"
          className="field py-1 px-2.5 text-xs bg-[#141414] min-h-0 focus:border-[#FFE600] focus:ring-0"
          placeholder="Add custom insight..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddItem();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAddItem}
          className="px-3 py-1 text-xs border border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600]/10 rounded-sm font-semibold transition-colors shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Subcomponent: Add Category Form
function AddCategoryForm({ onAddCategory }: { onAddCategory: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (name.trim()) {
      onAddCategory(name.trim());
      setName("");
    }
  };

  return (
    <div className="border border-[#252525] bg-[#0d0d0d] p-5 rounded-sm flex items-center justify-between gap-6">
      <div className="space-y-1 max-w-xl">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFE600]">
          Add Custom Insights Category
        </h4>
        <p className="text-[11px] text-[#888]">
          Create a new custom theme/category card to manually compile organization objectives or platform landscapes.
        </p>
      </div>

      <div className="flex items-center gap-3 w-80">
        <input
          type="text"
          className="field text-xs py-2 bg-[#141414]"
          placeholder="e.g. Critical Risks, Operating Procedures"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="button-secondary py-2 px-4 flex items-center gap-1 shrink-0"
        >
          <Plus size={14} />
          Create
        </button>
      </div>
    </div>
  );
}
