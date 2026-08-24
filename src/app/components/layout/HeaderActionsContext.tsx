import { createContext, useContext, useState, type ReactNode } from "react";

interface HeaderActionsValue {
  /** Page-provided actions rendered on the right side of the app header. */
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
}

const HeaderActionsContext = createContext<HeaderActionsValue | null>(null);

/**
 * Slot for page-level header actions. Pages inject their own actions via
 * `useHeaderActions().setActions(...)`; the layout stays route-agnostic.
 */
export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);

  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions(): HeaderActionsValue {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    throw new Error(
      "useHeaderActions must be used within HeaderActionsProvider",
    );
  }
  return ctx;
}
