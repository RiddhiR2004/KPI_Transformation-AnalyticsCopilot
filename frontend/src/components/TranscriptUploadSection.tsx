import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { TranscriptAnalysisRecord, TranscriptInsights } from "../types/api";

export function TranscriptUploadSection({ onApprovedChange }: { onApprovedChange: () => void }) {
  const [transcripts, setTranscripts] = useState<TranscriptAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editInsights, setEditInsights] = useState<TranscriptInsights | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  async function fetchTranscripts() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getTranscripts();
      setTranscripts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcripts");
    } finally {
      setLoading(false);
    }
  }

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
      void uploadFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      setError(`File '${file.name}' exceeds the maximum size limit of 5MB.`);
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".txt", ".docx", ".pdf"].includes(ext)) {
      setError("Unsupported file format. Please upload a .txt, .docx, or .pdf transcript.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const record = await api.uploadTranscript(file);
      setTranscripts((prev) => [record, ...prev]);
      setSuccess(`Transcript '${file.name}' successfully parsed and analyzed!`);
      setExpandedId(record.id);
      setEditInsights(record.extracted_insights);
      onApprovedChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleExpand = (record: TranscriptAnalysisRecord) => {
    if (expandedId === record.id) {
      setExpandedId(null);
      setEditInsights(null);
    } else {
      setExpandedId(record.id);
      setEditInsights(JSON.parse(JSON.stringify(record.extracted_insights))); // Deep clone
    }
  };

  const saveEdits = async (recordId: number) => {
    if (!editInsights) return;
    setError("");
    setSuccess("");
    try {
      const updated = await api.updateTranscriptInsights(recordId, editInsights);
      setTranscripts((prev) => prev.map((t) => (t.id === recordId ? updated : t)));
      setSuccess("Transcript insights saved successfully!");
      onApprovedChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save insights");
    }
  };

  const updateStatus = async (recordId: number, status: "draft" | "approved" | "rejected") => {
    setError("");
    setSuccess("");
    try {
      const updated = await api.updateTranscriptStatus(recordId, status);
      setTranscripts((prev) => prev.map((t) => (t.id === recordId ? updated : t)));
      setSuccess(`Transcript status updated to ${status}.`);
      onApprovedChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const deleteRecord = async (recordId: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete transcript '${filename}'?`)) return;
    setError("");
    setSuccess("");
    try {
      await api.deleteTranscript(recordId);
      setTranscripts((prev) => prev.filter((t) => t.id !== recordId));
      if (expandedId === recordId) {
        setExpandedId(null);
        setEditInsights(null);
      }
      setSuccess(`Transcript '${filename}' deleted.`);
      onApprovedChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete transcript");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-emerald-950/40 text-emerald-400 border-emerald-500/30";
      case "rejected":
        return "bg-red-950/40 text-red-400 border-red-500/30";
      default:
        return "bg-amber-950/40 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <section className="panel p-7 space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-[#F5F5F5] flex items-center gap-2">
          Meeting Transcript Intelligence
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Enrich the KPI discovery context by uploading strategic alignment meeting transcripts (.txt, .docx, .pdf). 
          The backend will extract decisions, action items, challenges, and metric candidates via LLM. 
          Approved transcript insights are injected downstream to Prompts, KPI generation, and Functional Specifications.
        </p>
      </div>

      {error && (
        <div className="border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500 rounded-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 border-l-2 border-emerald-500 rounded-sm animate-pulse">
          {success}
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
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
          id="transcript-file-input"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          accept=".txt,.docx,.pdf"
          disabled={uploading}
        />
        {uploading ? (
          <>
            <Loader2 className="animate-spin text-[#FFE600]" size={32} />
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-[#F5F5F5]">Extracting Strategic Insights...</p>
              <p className="text-xs text-[#B0B0B0]">
                Running transcript size protections, chunking, and AI summary extraction.
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="text-[#FFE600]" size={32} />
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-[#F5F5F5]">
                Drag and drop meeting transcript file here, or click to upload
              </p>
              <p className="text-xs text-[#B0B0B0]">
                Supports PDF, DOCX, and TXT files up to 5MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Transcripts List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
          Uploaded Transcripts ({transcripts.length})
        </h4>

        {loading && transcripts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-[#B0B0B0] py-4">
            <Loader2 className="animate-spin text-[#FFE600]" size={16} />
            Loading uploaded transcripts...
          </div>
        ) : transcripts.length === 0 ? (
          <div className="text-xs text-[#555] italic border border-[#252525] p-6 text-center rounded-sm bg-[#0d0d0d]">
            No transcripts uploaded yet. Upload alignment minutes or notes to begin.
          </div>
        ) : (
          <div className="space-y-3">
            {transcripts.map((t) => {
              const isExpanded = expandedId === t.id;
              return (
                <div
                  key={t.id}
                  className={`border rounded-sm transition-colors ${
                    isExpanded ? "border-[#444] bg-[#141414]" : "border-[#252525] bg-[#0d0d0d] hover:border-[#353535]"
                  }`}
                >
                  {/* Header Row */}
                  <div
                    onClick={() => toggleExpand(t)}
                    className="flex items-center justify-between gap-4 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="text-[#FFE600] shrink-0" size={18} />
                      <span className="text-sm font-medium text-[#E0E0E0] truncate">
                        {t.filename}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border shrink-0 ${getStatusBadgeClass(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#777]">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteRecord(t.id, t.filename);
                        }}
                        className="text-[#888] hover:text-red-400 p-1 transition-colors"
                        title="Delete transcript"
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="text-[#888]">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Insights Detail */}
                  {isExpanded && editInsights && (
                    <div className="border-t border-[#252525] p-5 space-y-6">
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`exec-summary-${t.id}`}
                          className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5] block"
                        >
                          Executive Summary
                        </label>
                        <textarea
                          id={`exec-summary-${t.id}`}
                          className="field min-h-[90px] p-3 text-xs leading-relaxed"
                          value={editInsights.executive_summary}
                          onChange={(e) =>
                            setEditInsights((prev) =>
                              prev ? { ...prev, executive_summary: e.target.value } : null
                            )
                          }
                        />
                      </div>

                      {/* Lists Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ListEditor
                          title="Strategic Priorities"
                          items={editInsights.strategic_priorities}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, strategic_priorities: items } : null))
                          }
                        />
                        <ListEditor
                          title="Business Challenges"
                          items={editInsights.business_challenges}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, business_challenges: items } : null))
                          }
                        />
                        <ListEditor
                          title="Key Decisions"
                          items={editInsights.key_decisions}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, key_decisions: items } : null))
                          }
                        />
                        <ListEditor
                          title="Action Items"
                          items={editInsights.action_items}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, action_items: items } : null))
                          }
                        />
                        <ListEditor
                          title="Risks & Dependencies"
                          items={editInsights.risks_dependencies}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, risks_dependencies: items } : null))
                          }
                        />
                        <ListEditor
                          title="Functional Areas"
                          items={editInsights.functional_areas}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, functional_areas: items } : null))
                          }
                        />
                        <ListEditor
                          title="Mentioned Metrics"
                          items={editInsights.mentioned_metrics}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, mentioned_metrics: items } : null))
                          }
                        />
                        <ListEditor
                          title="Stakeholders"
                          items={editInsights.stakeholders}
                          onChange={(items) =>
                            setEditInsights((prev) => (prev ? { ...prev, stakeholders: items } : null))
                          }
                        />
                      </div>

                      {/* Detail Section Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#252525]">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="button-yellow flex items-center gap-1.5"
                            onClick={() => saveEdits(t.id)}
                            title="Save edited fields to draft"
                          >
                            <Sparkles size={14} />
                            Save Edits
                          </button>
                        </div>

                        <div className="flex gap-2">
                          {t.status !== "approved" && (
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs border border-emerald-500 text-emerald-400 hover:bg-emerald-950/20 rounded-sm font-semibold flex items-center gap-1.5 transition-colors"
                              onClick={() => void updateStatus(t.id, "approved")}
                              title="Approve transcript to inject insights downstream"
                            >
                              <Check size={14} />
                              Approve
                            </button>
                          )}
                          {t.status !== "rejected" && (
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs border border-red-500 text-red-400 hover:bg-red-950/20 rounded-sm font-semibold flex items-center gap-1.5 transition-colors"
                              onClick={() => void updateStatus(t.id, "rejected")}
                              title="Reject transcript to exclude from downstream context"
                            >
                              <X size={14} />
                              Reject
                            </button>
                          )}
                          {t.status !== "draft" && (
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs border border-[#555] text-[#AAA] hover:bg-[#222] rounded-sm font-semibold flex items-center gap-1.5 transition-colors"
                              onClick={() => void updateStatus(t.id, "draft")}
                              title="Reset status back to draft"
                            >
                              Reset to Draft
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

interface ListEditorProps {
  title: string;
  items: string[];
  onChange: (newItems: string[]) => void;
}

function ListEditor({ title, items, onChange }: ListEditorProps) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold uppercase tracking-wider text-[#B0B0B0] block">
        {title}
      </label>
      <div className="space-y-1.5 max-h-[140px] overflow-y-auto border border-[#252525] p-2 bg-[#090909] rounded-sm">
        {items.length === 0 ? (
          <span className="text-[11px] text-[#555] italic block p-1">No items extracted</span>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 bg-[#121212] px-2 py-1 rounded-sm border border-[#1a1a1a]"
            >
              <span className="text-xs text-[#D5D5D5] truncate select-all">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="text-[#666] hover:text-red-400 p-0.5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="field py-1 px-2 text-xs focus:border-[#FFE600] min-h-0 bg-[#0d0d0d]"
          placeholder={`Add ${title.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <button
          type="button"
          onClick={addItem}
          className="px-2.5 py-1 text-xs border border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600]/10 rounded-sm font-semibold transition-colors shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
