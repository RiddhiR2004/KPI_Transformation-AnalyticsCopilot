import { AlertTriangle, Check, Download, Play, Save, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PromptRecord } from "../types/api";

export function PromptStudio({ onChange }: { onChange: () => void }) {
  const [record, setRecord] = useState<PromptRecord>({ prompt: "", ai_summary: {}, is_approved: false });
  const [userInstructions, setUserInstructions] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [refiningPrompt, setRefiningPrompt] = useState(false);
  const [generatingLibrary, setGeneratingLibrary] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getPrompt().then((data) => {
      if (data.prompt) {
        setRecord(data as PromptRecord);
        setUserInstructions(data.user_instructions || "");
      }
    });
  }, []);

  async function generatePrompt() {
    setGeneratingPrompt(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await api.generatePrompt(userInstructions);
      setRecord(data);
      setSuccessMsg("AI prompt successfully generated!");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setGeneratingPrompt(false);
    }
  }

  async function refinePrompt() {
    if (!userInstructions.trim()) return;
    setRefiningPrompt(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await api.refinePrompt(record.prompt, userInstructions);
      setRecord(data);
      setUserInstructions(""); // Clear input on success
      setSuccessMsg("Prompt successfully refined and updated by AI!");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine prompt");
    } finally {
      setRefiningPrompt(false);
    }
  }

  async function saveDraft() {
    setSavingDraft(true);
    setError("");
    setSuccessMsg("");
    try {
      await api.savePrompt(record);
      setSuccessMsg("Draft saved successfully!");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function approvePrompt() {
    setError("");
    setSuccessMsg("");
    try {
      const updated = { ...record, is_approved: !record.is_approved };
      await api.savePrompt(updated);
      setRecord(updated);
      setSuccessMsg(updated.is_approved ? "Prompt approved and locked successfully!" : "Prompt unlocked!");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve prompt");
    }
  }

  async function generateKpis() {
    setGeneratingLibrary(true);
    setError("");
    setSuccessMsg("");
    try {
      // Auto-save the current state first
      await api.savePrompt(record);
      await api.generateKpis();
      setSuccessMsg("KPI library generation triggered successfully!");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "KPI generation failed");
    } finally {
      setGeneratingLibrary(false);
    }
  }

  const downloadPrompt = async () => {
    if (!record.prompt) return;
    try {
      await api.savePrompt(record);
      const element = document.createElement("a");
      element.href = "/api/exports/prompt/docx";
      element.download = "kpi_advisory_prompt.docx";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download prompt");
    }
  };

  const handlePromptChange = (text: string) => {
    const schemaMarker = "**JSON Schema Compliance:**";
    const schemaIndex = record.prompt.indexOf(schemaMarker);
    const schemaBlock = schemaIndex !== -1 ? record.prompt.substring(schemaIndex) : "";

    const fullPrompt = schemaBlock ? `${text.trim()}\n\n${schemaBlock}` : text;

    setRecord((prev) => ({
      ...prev,
      prompt: fullPrompt,
      is_approved: false
    }));
    if (successMsg) setSuccessMsg("");
  };

  return (
    <section className="panel p-7 space-y-6">
      {/* Title block */}
      <div>
        <h3 className="text-2xl font-semibold text-[#F5F5F5]">KPI Prompt Studio</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Synthesize customized, consulting-grade KPI prompts using generative AI. Refine with instructions, download the assets, and approve to drive metric library creation.
        </p>
      </div>

      {error ? (
        <div className="border border-red-950 bg-red-950/20 p-3 text-xs text-red-400 border-l-2 border-red-500 rounded-sm">
          {error}
        </div>
      ) : null}

      {successMsg ? (
        <div className="border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 border-l-2 border-emerald-500 rounded-sm animate-pulse">
          {successMsg}
        </div>
      ) : null}

      {/* Inputs Section */}
      <div className="border border-[#303030] border-l-2 border-l-[#FFE600] bg-[#111111] p-6 rounded-sm space-y-4">
        <div className="space-y-1">
          <label htmlFor="advisory-instructions" className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5] block">
            Additional Business Guidance (Optional)
          </label>
          <span className="text-[11px] text-[#B0B0B0] block leading-relaxed">
            Provide optional constraints, target frameworks, or guidance for the AI consultant to tailor the generated prompt.
          </span>
        </div>
        <textarea
          id="advisory-instructions"
          className="field min-h-[110px] p-4 text-xs leading-relaxed focus:border-[#FFE600] transition-colors"
          placeholder={"Specify guidance or refinement instructions here, e.g.:\n- Focus on profitability and margin improvement\n- Include ESG and sustainability metrics\n- Prioritize operational KPIs\n- Emphasize warehouse safety and compliance"}
          value={userInstructions}
          onChange={(e) => {
            setUserInstructions(e.target.value);
            if (successMsg) setSuccessMsg("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              if (record.prompt) {
                void refinePrompt();
              } else {
                void generatePrompt();
              }
            }
          }}
        />
        <div className="flex justify-end">
          {record.prompt ? (
            <button
              className="button-yellow flex items-center gap-2"
              disabled={refiningPrompt || !userInstructions.trim()}
              onClick={refinePrompt}
              title="Refine the current prompt using your instructions above"
            >
              <Sparkles size={15} />
              {refiningPrompt ? "Refining..." : "Refine Prompt"}
            </button>
          ) : (
            <button
              className="button-yellow flex items-center gap-2"
              disabled={generatingPrompt}
              onClick={generatePrompt}
              title="Generate initial prompt using instructions"
            >
              <Sparkles size={15} />
              {generatingPrompt ? "Generating..." : "Generate AI Prompt"}
            </button>
          )}
        </div>
      </div>

      {/* Prompt Editor and Sidebar Column layout */}
      {record.prompt && (
        <div className="space-y-4">
          {/* Prompt Editor area */}
          <div className="flex flex-col space-y-2">
            <label htmlFor="prompt-workspace" className="text-xs font-bold uppercase tracking-wider text-[#F5F5F5] block">
              Prompt Editor
            </label>
            <span className="text-[11px] text-[#B0B0B0] block">
              Review the prompt generated from your business context and guidance. You may edit it manually or ask AI to improve it before KPI generation.
            </span>
            <textarea
              id="prompt-workspace"
              className={`field min-h-[380px] resize-y font-mono text-xs leading-relaxed p-4 ${record.is_approved ? 'opacity-85 bg-[#161616] cursor-not-allowed border-emerald-500/25' : ''}`}
              value={record.prompt.split("**JSON Schema Compliance:**")[0].trim()}
              onChange={(e) => handlePromptChange(e.target.value)}
              aria-label="Editable generated prompt content"
              readOnly={record.is_approved}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" onClick={downloadPrompt} title="Download prompt as Word file">
                <Download size={15} />
                Download Prompt
              </button>
              <button className="button-secondary" disabled={savingDraft} onClick={saveDraft} title="Save current progress as draft">
                <Save size={15} />
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>
              <button
                className={`button-secondary flex items-center gap-2 ${record.is_approved ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20 font-semibold' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/20'}`}
                onClick={approvePrompt}
                title={record.is_approved ? "Click to unlock prompt for editing" : "Lock this prompt as approved"}
              >
                <Check size={15} />
                {record.is_approved ? "Approved" : "Approve Prompt"}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {!record.is_approved && (
                <span className="text-xs text-[#FFE600] font-semibold flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle size={14} className="shrink-0" />
                  Approve prompt to generate KPI library
                </span>
              )}
              <button
                className="button-yellow flex items-center gap-2"
                disabled={generatingLibrary || !record.is_approved}
                onClick={generateKpis}
                title={!record.is_approved ? "Please approve prompt before generating library" : "Generate KPI Library"}
              >
                <Play size={15} />
                {generatingLibrary ? "Generating KPI Library..." : "Generate KPI Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
