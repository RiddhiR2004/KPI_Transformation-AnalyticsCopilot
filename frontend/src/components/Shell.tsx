import { BarChart3, ChevronRight, FileText, Network, Table2, Target, Workflow, CheckCircle, Building2, Briefcase, Home, Bell, LogOut, User, Settings, Shield } from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import type { ActivityEvent, ExportItem, WorkflowStatus } from "../types/api";

const steps = [
  { to: "/step-1", label: "Business Context", icon: Target, statusKey: "business_context" as keyof WorkflowStatus },
  { to: "/step-2", label: "KPI Library Generation", icon: Table2, statusKey: "kpi_library" as keyof WorkflowStatus },
  { to: "/step-3", label: "Functional Specification", icon: FileText, statusKey: "functional_specification" as keyof WorkflowStatus },
  { to: "/step-4", label: "Technical Data Flow Mapping", icon: Network, statusKey: "technical_mapping" as keyof WorkflowStatus },
  { to: "/step-5", label: "KPI Logic Scripting", icon: Workflow, statusKey: "kpi_tree" as keyof WorkflowStatus },
  { to: "/step-6", label: "KPI Driver Tree", icon: Workflow, statusKey: "kpi_tree" as keyof WorkflowStatus },
  { to: "/step-7", label: "Dashboard Prep", icon: BarChart3, statusKey: "dashboard" as keyof WorkflowStatus }
];

export function Shell({
  children,
  status,
  timeline,
  exports,
  hideSidebar = false
}: {
  children: ReactNode;
  status?: WorkflowStatus;
  timeline: ActivityEvent[];
  exports: ExportItem[];
  hideSidebar?: boolean;
}) {
  const location = useLocation();
  const activeEngName = localStorage.getItem("active_engagement_name");
  const activeClientName = localStorage.getItem("active_client_name");
  
  const userName = localStorage.getItem("user_name") || "riddhi.r";
  const userEmail = localStorage.getItem("user_email") || "riddhi.r@example.com";
  
  const initials = userName
    .split(/[\s._]+/)
    .filter(Boolean)
    .map(p => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "RR";

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] text-[#F5F5F5] font-sans antialiased">
      <header className="border-b border-[#303030] bg-[#1B1B1B]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-8 py-3">
          <NavLink
            to="/"
            onClick={() => {
              localStorage.removeItem("active_engagement_id");
              localStorage.removeItem("active_engagement_name");
              localStorage.removeItem("active_client_id");
              localStorage.removeItem("active_client_name");
            }}
            className="flex items-center gap-4"
          >
            <img src="/ey_logo.png" alt="EY Logo" className="h-10 w-auto object-contain" />
            <div className="h-6 w-px bg-[#303030] mx-1" />
            <h1 className="text-lg font-semibold tracking-tight text-[#F5F5F5]">KPI Transformation & Analytics Copilot</h1>
          </NavLink>

          <div className="flex items-center gap-4">
            {/* Breadcrumb: Client → Engagement */}
            {(activeClientName || activeEngName) && location.pathname !== "/" && (
              <>
                <div className="flex items-center gap-2 text-xs text-[#B0B0B0] bg-[#111] border border-[#303030] px-3 py-1.5 rounded-sm font-semibold">
                  {activeClientName && (
                    <>
                      <Building2 size={12} className="text-[#FFE600]" />
                      <span className="text-[#F5F5F5]">{activeClientName}</span>
                    </>
                  )}
                  {activeClientName && activeEngName && (
                    <ChevronRight size={10} className="text-[#555]" />
                  )}
                  {activeEngName && (
                    <>
                      <Briefcase size={12} className="text-[#FFE600]" />
                      <span className="text-[#FFE600]">{activeEngName}</span>
                    </>
                  )}
                </div>
                {location.pathname !== "/dashboard" && location.pathname !== "/audit" && (
                  <NavLink
                    to="/dashboard"
                    className="flex items-center gap-1.5 text-xs font-bold text-[#B0B0B0] hover:text-[#FFE600] border border-[#303030] hover:border-[#FFE600]/40 px-3 py-1.5 rounded-sm transition-colors bg-[#111]"
                  >
                    <Home size={12} className="text-[#FFE600]" />
                    <span>Home</span>
                  </NavLink>
                )}
                <NavLink
                  to="/"
                  className="text-xs font-bold text-[#111] bg-[#FFE600] hover:bg-[#FFE600]/90 px-3 py-1.5 rounded-sm transition-colors"
                >
                  Switch Client
                </NavLink>
              </>
            )}

            {/* Home Link (Only visible when on the Audit page to allow returning to dashboard/landing) */}
            {location.pathname === "/audit" && (
              <NavLink
                to={activeClientName ? "/dashboard" : "/"}
                className="flex items-center gap-1.5 text-xs font-bold text-[#B0B0B0] hover:text-[#FFE600] border border-[#303030] hover:border-[#FFE600]/40 px-3 py-1.5 rounded-sm transition-colors bg-[#111]"
              >
                <Home size={12} className="text-[#FFE600]" />
                <span>Home</span>
              </NavLink>
            )}

            {/* Audit Log Link */}
            <NavLink
              to="/audit"
              className={({ isActive }) => `flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-sm transition-all ${
                isActive ? "text-[#FFE600] bg-[#111] border border-[#FFE600]/30" : "text-[#B0B0B0] hover:text-[#FFE600] border border-[#303030] bg-[#111] hover:border-[#FFE600]/40"
              }`}
            >
              <Shield size={12} className="text-[#FFE600]" />
              <span>Audit Log</span>
            </NavLink>

            {/* Notifications */}
            <button className="relative p-2 text-[#888] hover:text-[#FFE600] transition-colors" title="Notifications">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#FFE600] border border-[#1B1B1B]" />
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-[#303030]" />

            {/* User Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 p-1 rounded-sm hover:bg-[#111] transition-colors text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE600]/20 to-[#FFE600]/5 border border-[#FFE600]/30 text-[#FFE600] text-xs font-bold">
                  {initials}
                </div>
                <div className="hidden md:block pr-2">
                  <p className="text-xs font-semibold text-[#F5F5F5] leading-tight">{userName}</p>
                  <p className="text-[10px] text-[#888] leading-tight">Consultant</p>
                </div>
              </button>

              {/* Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-sm bg-[#1B1B1B] border border-[#303030] shadow-2xl py-1 z-50">
                  <div className="px-4 py-2 border-b border-[#303030] mb-1">
                    <p className="text-xs font-semibold text-[#F5F5F5] truncate">{userEmail}</p>
                  </div>
                  <NavLink
                    to="/settings" // Let it go to settings directly to show user profile
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[#B0B0B0] hover:text-[#FFE600] hover:bg-[#111] transition-colors"
                  >
                    <User size={14} /> Profile
                  </NavLink>
                  <NavLink
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[#B0B0B0] hover:text-[#FFE600] hover:bg-[#111] transition-colors"
                  >
                    <Settings size={14} /> Settings
                  </NavLink>
                  <div className="border-t border-[#303030] mt-1 pt-1">
                    <button
                      onClick={async () => {
                        setShowProfileMenu(false);
                        try {
                          await api.logAuditEvent({
                            module: "User Management",
                            action: "Logout",
                            status: "Success",
                            entity_type: "User",
                            entity_name: userName
                          });
                        } catch (err) {
                          console.error(err);
                        }
                        alert("Logged out successfully (Logged to Audit trail)");
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#B0B0B0] hover:text-[#FFE600] hover:bg-[#111] transition-colors text-left"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                  const isStepComplete = status ? !!status[step.statusKey] : false;
                  
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
                          {isStepComplete ? (
                            <CheckCircle size={16} className="text-[#FFE600]" />
                          ) : (
                            <ChevronRight size={16} className={`transition-colors ${isActive ? "text-[#FFE600]" : "text-[#B0B0B0]/40 group-hover:text-[#FFE600]"}`} />
                          )}
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

            <main className="min-w-0">{children}</main>
          </div>
        )}
      </div>
    </div>
  );
}
