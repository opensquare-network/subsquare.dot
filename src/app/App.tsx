import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Sidebar } from "./components/layout/Sidebar";
import { AppLayout } from "./pages/AppLayout";
import { ReferendaPage } from "./pages/ReferendaPage";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { dark, toggle: toggleDark } = useTheme();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Governance",
  ]);

  // Normalize the URL to the canonical hash route on first load.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/");
    }
  }, []);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );
  };

  return (
    <div
      className="flex h-screen w-full bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Sidebar
        dark={dark}
        onToggleDark={toggleDark}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      />

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
  );
}
