import { KpiLibrary } from "../components/KpiLibrary";
import { PromptStudio } from "../components/PromptStudio";
import type { ExportItem } from "../types/api";

export function Step2Page({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-white p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50">Step 02</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-black">KPI Library Generation</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
          Generate KPIs from the saved prompt, review data quality, edit definitions and approve records for leadership review.
        </p>
      </section>
      <PromptStudio onChange={onChange} />
      <KpiLibrary onChange={onChange} exports={exports} />
    </div>
  );
}
