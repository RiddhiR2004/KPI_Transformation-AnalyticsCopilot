import { Database } from "lucide-react";

export function RestrictedStepPage({ step, title }: { step: string; title: string }) {
  return (
    <section className="border border-[#303030] bg-[#1B1B1B] p-10">
      <div className="flex max-w-3xl items-start gap-5">
        <div className="flex h-12 w-12 items-center justify-center bg-[#111111] text-[#ffe600] border border-[#303030]">
          <Database size={22} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step {step}</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">{title}</h2>
          <p className="mt-4 text-sm leading-7 text-[#B0B0B0]">
            This downstream pipeline integrates governed KPIs with enterprise architecture schemas. Connecting this module requires an active cloud data platform connection (e.g., SAP Datasphere, Snowflake, or Microsoft Fabric) to run automatic metadata discovery and line-level mapping.
          </p>
        </div>
      </div>
    </section>
  );
}
