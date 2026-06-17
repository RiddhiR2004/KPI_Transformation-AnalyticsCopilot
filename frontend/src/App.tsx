import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { LandingPage } from "./pages/LandingPage";
import { BusinessContextPage } from "./pages/BusinessContextPage";
import { KpiLibraryPage } from "./pages/KpiLibraryPage";
import { FunctionalSpecificationPage } from "./pages/FunctionalSpecificationPage";
import { RestrictedStepPage } from "./pages/RestrictedStepPage";
import { api } from "./lib/api";
import type { ActivityEvent, ExportItem, WorkflowStatus } from "./types/api";

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

  const isLandingPage = location.pathname === "/";

  return (
    <Shell status={status} timeline={timeline} exports={exports} hideSidebar={isLandingPage}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/step-1" element={<BusinessContextPage onChange={refresh} />} />
        <Route path="/step-2" element={<KpiLibraryPage onChange={refresh} exports={exports} />} />
        <Route path="/step-3" element={<FunctionalSpecificationPage onChange={refresh} exports={exports} />} />
        <Route path="/step-4" element={<RestrictedStepPage step="04" title="Technical Mapping" />} />
        <Route path="/step-5" element={<RestrictedStepPage step="05" title="KPI Logic" />} />
        <Route path="/step-6" element={<RestrictedStepPage step="06" title="KPI Driver Tree" />} />
        <Route path="/step-7" element={<RestrictedStepPage step="07" title="Dashboard" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
