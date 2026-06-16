import { BusinessContextStep } from "../components/BusinessContextStep";
import { TranscriptUploadSection } from "../components/TranscriptUploadSection";

export function BusinessContextPage({ onChange }: { onChange: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 01"
        title="Business Context"
        text="Capture the business scope and upload meeting transcripts to generate a deterministic KPI prompt for Gemini-backed KPI creation."
      />
      <BusinessContextStep onChange={onChange} />
      <TranscriptUploadSection onApprovedChange={onChange} />
    </div>
  );
}

function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="border-l-8 border-[#ffe600] bg-white p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50">{eyebrow}</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight text-black">{title}</h2>
      <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">{text}</p>
    </section>
  );
}
