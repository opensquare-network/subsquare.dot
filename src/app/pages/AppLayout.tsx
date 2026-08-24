import { Outlet } from "react-router";
import { AppHeader } from "../components/layout/AppHeader";
import { HeaderActionsProvider } from "../components/layout/HeaderActionsContext";

/** Layout for list-style pages: app header on top, page content inside main. */
export function AppLayout() {
  return (
    <HeaderActionsProvider>
      <AppHeader />
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <Outlet />
      </main>
    </HeaderActionsProvider>
  );
}
