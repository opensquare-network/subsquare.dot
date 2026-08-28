import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { OverviewSummaryProvider } from "./components/layout/OverviewSummaryContext";
import { Sidebar } from "./components/layout/Sidebar";
import { AppLayout } from "./pages/AppLayout";
import { ReferendaPage } from "./pages/ReferendaPage";

export default function App() {
  // Normalize the URL to the canonical hash route on first load.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/");
    }
  }, []);

  return (
    <OverviewSummaryProvider>
      <div
        className="flex h-screen w-full bg-background text-foreground overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <Sidebar />

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/referenda" replace />} />
              <Route path="/referenda" element={<ReferendaPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/referenda" replace />} />
          </Routes>
        </div>
      </div>
    </OverviewSummaryProvider>
  );
}
