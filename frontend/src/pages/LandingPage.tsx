import { ArrowRight, BarChart3, FileText, Target } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { WorkflowStatus } from "../types/api";

export function LandingPage({ status }: { status?: WorkflowStatus }) {
  return (
    <div className="space-y-6">
      {/* Consulting Hero Banner */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-10 rounded-sm">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFE600]">
            Enterprise Performance Advisory
          </p>
          <h2 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-[#F5F5F5]">
            Convert Strategic Priorities into Governed KPI Definitions
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[#B0B0B0]">
            AI-powered KPI Transformation Platform for defining, governing, and operationalizing enterprise performance metrics across Finance, Sales, Supply Chain, Operations, and Executive Leadership.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <NavLink to="/step-1" className="button-yellow">
              Start KPI Transformation
              <ArrowRight size={16} />
            </NavLink>
            <NavLink to="/step-2" className="button-secondary">
              Review KPI Library
            </NavLink>
          </div>
        </div>
      </section>

      {/* Feature Pillar Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Business Context Definition",
            desc: "Capture industry context, priorities, challenges, KRAs, and functional scope.",
            icon: Target
          },
          {
            title: "KPI Library Engineering",
            desc: "Generate consulting-grade KPI definitions with formulas, ownership, thresholds, and governance controls.",
            icon: BarChart3
          },
          {
            title: "Delivery Assets",
            desc: "Produce functional specifications, technical mapping documents, KPI trees, and dashboard-ready outputs.",
            icon: FileText
          }
        ].map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.title} className="border border-[#303030] bg-[#1B1B1B] p-6 flex flex-col justify-between rounded-sm">
              <div>
                <Icon className="text-[#FFE600]" size={26} />
                <h3 className="mt-5 text-base font-semibold text-[#F5F5F5]">{pillar.title}</h3>
                <p className="mt-3 text-xs leading-5 text-[#B0B0B0]">{pillar.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Supported Domains Section */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-6 rounded-sm">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#FFE600] mb-4">Supported Domains</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Finance",
            "Sales",
            "Supply Chain",
            "Production",
            "Procurement",
            "Quality",
            "Customer Service",
            "Marketing",
            "Executive Management"
          ].map((domain) => (
            <span
              key={domain}
              className="border border-[#303030] bg-[#111111] text-[#F5F5F5] text-xs font-semibold px-3.5 py-1.5 rounded-sm select-none"
            >
              {domain}
            </span>
          ))}
        </div>
      </section>

      {/* KPI Transformation Lifecycle Timeline */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-6 rounded-sm">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#FFE600] mb-6">
          KPI Transformation Lifecycle
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
          {[
            "Define Business Context",
            "Generate KPI Library",
            "Approve KPI Definitions",
            "Create Functional Specifications",
            "Build Technical Mapping",
            "Construct KPI Driver Trees",
            "Prepare Executive Dashboards"
          ].map((stage, idx) => (
            <div key={stage} className="bg-[#111111] border border-[#303030] p-4 rounded-sm flex flex-col justify-between min-h-[110px]">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#FFE600]">STAGE 0{idx + 1}</span>
                <p className="text-xs text-[#F5F5F5] font-semibold mt-2 leading-relaxed">{stage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
