import { BusinessContextStep } from "../components/BusinessContextStep";
import { BusinessAssetsSection } from "../components/BusinessAssetsSection";

export function BusinessContextPage({ onChange }: { onChange: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 01"
        title="Business Context"
        text="Capture the business scope and upload strategic business assets to generate a deterministic KPI prompt for Gemini-backed KPI creation."
      />
      <BusinessContextStep onChange={onChange} />
      <BusinessAssetsSection onApprovedChange={onChange} />
    </div>
  );
}

function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">{eyebrow}</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">{text}</p>
    </section>
  );
}
