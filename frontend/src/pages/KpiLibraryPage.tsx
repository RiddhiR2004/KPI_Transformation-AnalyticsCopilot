import { KpiLibrary } from "../components/KpiLibrary";
import { PromptStudio } from "../components/PromptStudio";
import type { ExportItem } from "../types/api";

export function KpiLibraryPage({ onChange, exports }: { onChange: () => void; exports: ExportItem[] }) {
  return (
    <div className="space-y-6">
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 02</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">KPI Library Generation</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Generate KPIs from the saved prompt, review data quality, edit definitions and approve records for leadership review.
        </p>
      </section>
      <PromptStudio onChange={onChange} />
      <KpiLibrary onChange={onChange} exports={exports} />
    </div>
  );
}
