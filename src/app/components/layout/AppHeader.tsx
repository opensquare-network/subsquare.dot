import { Breadcrumb } from "./Breadcrumb";
import { useBreadcrumbs } from "./useBreadcrumbs";
import { useHeaderActions } from "./HeaderActionsContext";

/**
 * Top bar with the breadcrumb, the page-provided actions slot and the
 * connect-wallet button. It is fully route-agnostic: pages inject their
 * own header actions through the header-actions slot.
 */
export function AppHeader() {
  const crumbs = useBreadcrumbs();
  const { actions } = useHeaderActions();

  return (
    <header className="flex h-14 items-center justify-between px-6 border-b border-border bg-card flex-shrink-0">
      <Breadcrumb items={crumbs} />
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
