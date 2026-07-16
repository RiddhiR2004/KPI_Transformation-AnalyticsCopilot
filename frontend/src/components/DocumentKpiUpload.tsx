import React, { useState } from "react";
import { FileSearch, Upload, Loader2, CheckCircle, AlertCircle, FileText, Trash2, Sparkles, RefreshCw, FileSpreadsheet, FileType } from "lucide-react";
import { api } from "../lib/api";

export function DocumentKpiUpload({ onChange }: { onChange: () => void }) {
  const [stagedFiles, setStagedFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [derivedCount, setDerivedCount] = useState(0);

  const acceptedFormats = [".xlsx", ".xls", ".csv", ".pdf", ".docx", ".doc", ".txt"];

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
      processFiles(Array.from(files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  const getFileType = (filename: string): string => {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    if ([".xlsx", ".xls"].includes(ext)) return "Excel";
    if (ext === ".csv") return "CSV";
    if (ext === ".pdf") return "PDF";
    if ([".docx", ".doc"].includes(ext)) return "Word";
    if (ext === ".txt") return "Text";
    return "Unknown";
  };

  const processFiles = (files: File[]) => {
    setError("");
    setSuccess("");
    setDerivedCount(0);

    if (stagedFiles.length + files.length > 1) {
      setError("Please upload only one document at a time.");
      return;
    }

    const file = files[0];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!acceptedFormats.includes(ext)) {
      setError(`Unsupported file format '${ext}'. Please upload Excel, CSV, PDF, Word, or Text files.`);
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError(`File '${file.name}' exceeds the 30MB limit.`);
      return;
    }

    setUploading(true);
    setTimeout(() => {
      setStagedFiles([{ name: file.name, size: file.size, type: getFileType(file.name) }]);
      setActiveFile(file);
      setUploading(false);
      setSuccess("Document staged. Click 'Derive KPIs' to analyze the document and extract KPI definitions.");
    }, 1200);
  };

  const deleteStagedFile = () => {
    setStagedFiles([]);
    setActiveFile(null);
    setError("");
    setSuccess("");
    setDerivedCount(0);
  };

  const handleDeriveKpis = async () => {
    if (!activeFile) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const result = await api.uploadKpiDocument(activeFile);
      const docKpis = (result.items || []).filter(
        (k) => k.source === "document_parsed" || k.source === "excel_import"
      );
      setDerivedCount(docKpis.length);
      setProcessing(false);
      setStagedFiles([]);
      setActiveFile(null);
      setSuccess(
        `Successfully derived ${docKpis.length} KPI(s) from the document. They appear in the "Document-Parsed KPIs" section below for your review.`
      );
      onChange();
    } catch (err: any) {
      setProcessing(false);
      setError(err.message || "Failed to derive KPIs from document");
    }
  };

  const FileIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "Excel":
      case "CSV":
        return <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" />;
      case "PDF":
        return <FileType size={16} className="text-rose-400 shrink-0" />;
      case "Word":
        return <FileText size={16} className="text-blue-400 shrink-0" />;
      default:
        return <FileText size={16} className="text-[#FFE600] shrink-0" />;
    }
  };

  return (
    <section className="panel p-7 space-y-6 border-l-4 border-cyan-500/60">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-cyan-500/10 border border-cyan-500/30 rounded-sm">
            <FileSearch size={18} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[#F5F5F5] flex items-center gap-2">
              Derive KPIs from Document
              <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-sm">
                AI Powered
              </span>
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
              Upload an Excel file with business data or a business report (PDF, Word, Text) — the AI will analyze the
              content and extract relevant KPI definitions for your review.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500 rounded-sm flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="border border-cyan-950 bg-cyan-950/20 p-3 text-xs text-cyan-400 border-l-2 border-cyan-500 rounded-sm flex items-center gap-3">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Upload Zone */}
        <div className="space-y-4 flex flex-col justify-between h-full">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer relative h-full min-h-[180px] ${
              isDragOver
                ? "border-cyan-400 bg-cyan-500/5"
                : "border-[#303030] hover:border-cyan-500/50 bg-[#0d0d0d]"
            }`}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt"
              disabled={uploading || processing || stagedFiles.length > 0}
            />
            {uploading ? (
              <>
                <Loader2 className="animate-spin text-cyan-400" size={32} />
                <p className="text-sm font-semibold text-[#F5F5F5]">Staging Document...</p>
              </>
            ) : (
              <>
                <Upload className={stagedFiles.length > 0 ? "text-[#555]" : "text-cyan-400"} size={32} />
                <div className="text-center space-y-1">
                  <p className={`text-sm font-semibold ${stagedFiles.length > 0 ? "text-[#555]" : "text-[#F5F5F5]"}`}>
                    Drag and drop your document here, or click to upload
                  </p>
                  <p className="text-xs text-[#B0B0B0]">
                    Excel, CSV, PDF, Word, or Text files. Max 30MB.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* List of Staged Files */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">Staged Document</h4>
              <div className="flex items-center justify-between border border-[#252525] bg-[#0d0d0d] p-3 rounded-sm text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileIcon type={stagedFiles[0].type} />
                  <span className="truncate text-[#E0E0E0]">{stagedFiles[0].name}</span>
                  <span className="text-[10px] text-cyan-400 font-bold shrink-0 border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 rounded-sm">
                    {stagedFiles[0].type}
                  </span>
                  <span className="text-[10px] text-[#777] shrink-0">
                    ({(stagedFiles[0].size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={deleteStagedFile}
                  className="text-[#888] hover:text-red-400 p-0.5 transition-colors shrink-0"
                  title="Remove document"
                  disabled={processing}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="border border-[#303030] bg-[#141414] p-5 rounded-sm flex flex-col justify-between h-full min-h-[180px] space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
              AI Document Analysis
            </h4>
            <p className="text-xs text-[#B0B0B0] leading-relaxed">
              The AI will scan your document for KPI definitions, metrics, performance indicators, and measurable
              business objectives. Derived KPIs will appear in a <strong className="text-cyan-400">separate section</strong> below the
              AI-generated KPIs for your review and approval.
            </p>
            <div className="border border-[#303030] bg-[#0d0d0d] p-3 rounded-sm space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#B0B0B0]">Supported Formats</p>
              <div className="flex flex-wrap gap-1.5">
                {["XLSX", "XLS", "CSV", "PDF", "DOCX", "TXT"].map((fmt) => (
                  <span
                    key={fmt}
                    className="text-[9px] font-bold border border-[#303030] bg-[#1B1B1B] text-[#B0B0B0] px-2 py-0.5 rounded-sm"
                  >
                    .{fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-[#111] px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleDeriveKpis}
              disabled={stagedFiles.length === 0 || uploading || processing}
            >
              {processing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Analyzing Document...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Derive KPIs from Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
