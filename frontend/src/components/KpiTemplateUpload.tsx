import React, { useState } from "react";
import { FolderOpen, Upload, Loader2, CheckCircle, AlertCircle, FileText, Trash2, Play, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

export function KpiTemplateUpload({ onChange }: { onChange: () => void }) {
  const [stagedFiles, setStagedFiles] = useState<{ name: string; size: number }[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

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

  const processFiles = (files: File[]) => {
    setError("");
    setSuccess("");
    
    if (stagedFiles.length + files.length > 1) {
      setError("Please upload only one KPI template file at a time.");
      return;
    }

    const file = files[0];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      setError(`Unsupported file format '${ext}'. Please upload an Excel or CSV template.`);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError(`File '${file.name}' exceeds the 20MB limit.`);
      return;
    }

    // Simulate upload delay for staging
    setUploading(true);
    setTimeout(() => {
      setStagedFiles([{ name: file.name, size: file.size }]);
      setActiveFile(file);
      setUploading(false);
      setSuccess("KPI Template uploaded successfully. Click 'Process Template' to start the workflow.");
    }, 1500);
  };

  const deleteStagedFile = () => {
    setStagedFiles([]);
    setActiveFile(null);
    setError("");
    setSuccess("");
  };

  const handleProcessTemplate = async () => {
    if (!activeFile) return;
    
    setProcessing(true);
    setError("");
    setSuccess("");
    
    try {
      await api.uploadKpiTemplate(activeFile);
      setProcessing(false);
      setStagedFiles([]);
      setActiveFile(null);
      setSuccess("Template processed! KPI Library is now populated.");
      onChange();
    } catch (err: any) {
      setProcessing(false);
      setError(err.message || "Failed to process template");
    }
  };

  return (
    <section className="panel p-7 space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-[#F5F5F5] flex items-center gap-2">
          <FolderOpen size={20} className="text-[#FFE600]" />
          Upload KPI Library Template
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Optional: Have an existing KPI library? Upload your bulk KPI template to automatically kickstart the process. 
          The system will parse the Excel/CSV file and map it directly into the functional blueprint.
        </p>
      </div>

      {error && (
        <div className="border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500 rounded-sm flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 border-l-2 border-emerald-500 rounded-sm flex items-center gap-3">
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
                ? "border-[#FFE600] bg-[#FFE600]/5"
                : "border-[#303030] hover:border-[#555] bg-[#0d0d0d]"
            }`}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              disabled={uploading || processing || stagedFiles.length > 0}
            />
            {uploading ? (
              <>
                <Loader2 className="animate-spin text-[#FFE600]" size={32} />
                <p className="text-sm font-semibold text-[#F5F5F5]">Uploading Template...</p>
              </>
            ) : (
              <>
                <Upload className={stagedFiles.length > 0 ? "text-[#555]" : "text-[#FFE600]"} size={32} />
                <div className="text-center space-y-1">
                  <p className={`text-sm font-semibold ${stagedFiles.length > 0 ? "text-[#555]" : "text-[#F5F5F5]"}`}>
                    Drag and drop your KPI Template here, or click to upload
                  </p>
                  <p className="text-xs text-[#B0B0B0]">
                    Excel or CSV formats only. Max 20MB.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* List of Staged Files */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B0B0B0]">
                Staged Template
              </h4>
              <div className="flex items-center justify-between border border-[#252525] bg-[#0d0d0d] p-3 rounded-sm text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={16} className="text-[#FFE600] shrink-0" />
                  <span className="truncate text-[#E0E0E0]">{stagedFiles[0].name}</span>
                  <span className="text-[10px] text-[#777] shrink-0">({(stagedFiles[0].size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button
                  type="button"
                  onClick={deleteStagedFile}
                  className="text-[#888] hover:text-red-400 p-0.5 transition-colors shrink-0"
                  title="Remove template"
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
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5]">
              Bulk Upload Actions
            </h4>
            <p className="text-xs text-[#B0B0B0] leading-relaxed">
              Once your template is uploaded, click <strong>Process Template</strong> to initialize the KPI library and advance to the next step automatically.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              className="button-yellow w-full flex items-center justify-center gap-2"
              onClick={handleProcessTemplate}
              disabled={stagedFiles.length === 0 || uploading || processing}
            >
              {processing ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-[#FFE600]" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Process Template</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
