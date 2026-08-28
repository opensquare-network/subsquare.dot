import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  fetchOverviewSummary,
  type OverviewSummary,
} from "../../api/referenda";

interface OverviewSummaryValue {
  summary: OverviewSummary | null;
  /** Number of active OpenGov referenda (summary.gov2Referenda.active). */
  activeReferenda: number;
  /** Total OpenGov referenda ever submitted (summary.gov2Referenda.all). */
  totalReferenda: number;
  loading: boolean;
  error: string | null;
}

const OverviewSummaryContext = createContext<OverviewSummaryValue | null>(null);

/**
 * Fetches the chain overview summary once (the same `overview/summary`
 * endpoint that powers the SubSquare sidebar active counts, e.g. Referenda
 * active) and shares it with the sidebar and overview stat cards.
 */
export function OverviewSummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOverviewSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OverviewSummaryContext.Provider
      value={{
        summary,
        activeReferenda: summary?.gov2Referenda?.active ?? 0,
        totalReferenda: summary?.gov2Referenda?.all ?? 0,
        loading,
        error,
      }}
    >
      {children}
    </OverviewSummaryContext.Provider>
  );
}

export function useOverviewSummary(): OverviewSummaryValue {
  const ctx = useContext(OverviewSummaryContext);
  if (!ctx) {
    throw new Error(
      "useOverviewSummary must be used within OverviewSummaryProvider",
    );
  }
  return ctx;
}
