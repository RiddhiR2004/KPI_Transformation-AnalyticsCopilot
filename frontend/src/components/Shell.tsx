import { BarChart3, ChevronRight, FileText, Network, Table2, Target, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { ActivityEvent, ExportItem, WorkflowStatus } from "../types/api";

const steps = [
  { to: "/step-1", label: "Business Context", icon: Target },
  { to: "/step-2", label: "KPI Library Generation", icon: Table2 },
  { to: "/step-3", label: "Functional Specification", icon: FileText },
  { to: "/step-4", label: "Technical Data Flow Mapping", icon: Network },
  { to: "/step-5", label: "KPI Logic Scripting", icon: Workflow },
  { to: "/step-6", label: "KPI Driver Tree", icon: Workflow },
  { to: "/step-7", label: "Dashboard Prep", icon: BarChart3 }
] as const;

export function Shell({
  children,
  hideSidebar = false
}: {
  children: ReactNode;
  status?: WorkflowStatus;
  timeline: ActivityEvent[];
  exports: ExportItem[];
  hideSidebar?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#111111] text-[#F5F5F5] font-sans antialiased">
      <header className="border-b border-[#303030] bg-[#1B1B1B]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-8 py-5">
          <NavLink to="/" className="flex items-center gap-4">
            <img src="/ey_logo.png" alt="EY Logo" className="h-16 w-auto object-contain" />
            <div className="h-8 w-px bg-[#303030] mx-1" />
            <h1 className="text-lg font-semibold tracking-tight text-[#F5F5F5]">KPI Transformation & Analytics Copilot</h1>
          </NavLink>
        </div>
      </header>

      <div className="mx-auto px-8 py-8 max-w-[1500px]">
        {hideSidebar ? (
          <main>{children}</main>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="space-y-5">
              <nav className="border border-[#303030] bg-[#1B1B1B]">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  
                  return (
                    <NavLink
                      key={step.to}
                      to={step.to}
                      className={({ isActive }) => `group flex items-center justify-between border-b-4 px-4 py-4 text-sm font-semibold transition-all ${isActive ? "bg-[#111111] text-[#FFE600] border-b-[#FFE600]" : "border-b-[#303030]/40 text-[#F5F5F5] hover:bg-[#111111] hover:text-[#FFE600] hover:border-b-[#FFE600]"}`}
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-center gap-3">
                            <Icon size={18} />
                            <span>{String(index + 1).padStart(2, "0")} {step.label}</span>
                          </span>
                          <ChevronRight size={16} className={`transition-colors ${isActive ? "text-[#FFE600]" : "text-[#B0B0B0]/40 group-hover:text-[#FFE600]"}`} />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
              <section className="border border-[#303030] bg-[#1B1B1B] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFE600]">ENGAGEMENT FLOW</p>
                <div className="mt-4 space-y-3 text-xs leading-5 text-[#B0B0B0]">
                  <p>1. Capture strategic business objectives & priorities.</p>
                  <p>2. Engineer context-rich prompt and run AI KPI synthesis.</p>
                  <p>3. Enrich generated definitions into professional Functional Specifications.</p>
                  <p>4. Export client-ready assets (PDF, Word, Excel, JSON).</p>
                </div>
              </section>
            </aside>

            <main>{children}</main>
          </div>
        )}
      </div>
    </div>
  );
}
