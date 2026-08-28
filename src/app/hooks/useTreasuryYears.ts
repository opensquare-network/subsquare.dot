import { useEffect, useState } from "react";
import {
  fetchTreasuryYears,
  totalTreasurySpent,
  type TreasuryYearSummary,
} from "../api/referenda";

interface UseTreasuryYearsResult {
  years: TreasuryYearSummary[] | null;
  /** All-time treasury spend in USD (fiat, at final price). */
  totalSpent: number;
  /** Current calendar year's treasury spend in USD (fiat, at final price). */
  currentYearSpent: number;
  /** Year the current-year figure belongs to (falls back to the latest year in the data). */
  currentYear: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the per-year treasury spend summary (`/treasury/years`) once and
 * derives the all-time "Total Spent" figure — the sum of every year's
 * `totalFiatValueAtFinal`, i.e. exactly the Year Status "Total".
 */
export function useTreasuryYears(): UseTreasuryYearsResult {
  const [years, setYears] = useState<TreasuryYearSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTreasuryYears()
      .then((data) => {
        if (!cancelled) setYears(data);
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

  const currentYear = new Date().getUTCFullYear();
  const currentYearEntry =
    years?.find((year) => year.year === currentYear) ?? years?.at(-1) ?? null;

  return {
    years,
    totalSpent: years ? totalTreasurySpent(years) : 0,
    currentYearSpent: currentYearEntry?.totalFiatValueAtFinal ?? 0,
    currentYear: currentYearEntry?.year ?? null,
    loading,
    error,
  };
}
