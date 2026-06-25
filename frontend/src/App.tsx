import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ClientsDashboard } from "./pages/ClientsDashboard";
import { LandingPage } from "./pages/LandingPage";
import { BusinessContextPage } from "./pages/BusinessContextPage";
import { KpiLibraryPage } from "./pages/KpiLibraryPage";
import { FunctionalSpecificationPage } from "./pages/FunctionalSpecificationPage";
import { RestrictedStepPage } from "./pages/RestrictedStepPage";
import { ClientSelectionPage } from "./pages/ClientSelectionPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { KpiDriverTreePage } from "./pages/KpiDriverTreePage";
import { TechnicalDataMappingPage } from "./pages/TechnicalDataMappingPage";
import { api } from "./lib/api";
import type { ActivityEvent, ExportItem, WorkflowStatus } from "./types/api";

import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [status, setStatus] = useState<WorkflowStatus>();
  const [timeline, setTimeline] = useState<ActivityEvent[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const location = useLocation();

  const refresh = useCallback(async () => {
    const [nextStatus, nextTimeline, nextExports] = await Promise.all([
      api.getWorkflowStatus(),
      api.getTimeline(),
      api.getExports()
    ]);
    setStatus(nextStatus);
    setTimeline(nextTimeline);
    setExports(nextExports);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Log user login audit event once per session
    const userName = localStorage.getItem("user_name") || "riddhi.r";
    if (!sessionStorage.getItem("login_event_logged")) {
      sessionStorage.setItem("login_event_logged", "true");
      void api.logAuditEvent({
        module: "User Management",
        action: "Login",
        status: "Success",
        entity_type: "User",
        entity_name: userName
      });
    }
  }, []);

  // Hide sidebar on the dashboard, onboarding, settings, and audit log pages
  const isFullWidthPage = location.pathname === "/" || location.pathname === "/dashboard" || location.pathname === "/select-client" || location.pathname === "/audit" || location.pathname === "/settings" || location.pathname.startsWith("/onboarding");

  return (
    <Shell status={status} timeline={timeline} exports={exports} hideSidebar={isFullWidthPage}>
      <Routes>
        {/* New: ClientSelectionPage is the default landing page */}
        <Route path="/" element={<ClientSelectionPage />} />
        <Route path="/select-client" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<ClientsDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />

        {/* Onboarding / Client Setup — for new or editing existing client profiles */}
        <Route path="/onboarding" element={<LandingPage />} />
        <Route path="/onboarding/:clientId" element={<LandingPage />} />

        {/* Workflow Steps */}
        <Route path="/step-1" element={<BusinessContextPage onChange={refresh} />} />
        <Route path="/step-2" element={<KpiLibraryPage onChange={refresh} exports={exports} />} />
        <Route path="/step-3" element={<FunctionalSpecificationPage onChange={refresh} exports={exports} />} />
        <Route path="/step-4" element={<TechnicalDataMappingPage onChange={refresh} exports={exports} />} />
        <Route path="/step-5" element={<RestrictedStepPage step="05" title="KPI Logic" />} />
        <Route path="/step-6" element={<KpiDriverTreePage onChange={refresh} />} />
        <Route path="/step-7" element={<RestrictedStepPage step="07" title="Dashboard" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
