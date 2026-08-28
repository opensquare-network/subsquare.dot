import { useEffect, useState } from "react";
import {
  fetchDotUsdPrice,
  fetchTreasuryTotals,
  totalDot,
  totalUsdc,
  totalUsdt,
  type TreasuryTotals,
} from "../lib/treasury";

interface UseTreasuryBalanceResult {
  totals: TreasuryTotals | null;
  /** Total native DOT as a decimal number. */
  dot: number;
  /** Total USDT as a decimal number. */
  usdt: number;
  /** Total USDC as a decimal number. */
  usdc: number;
  /**
   * Total in USD = DOT × price + USDT + USDC (stablecoins ≈ 1 USD each),
   * or null when the DOT price is unavailable.
   */
  usd: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the real Polkadot Treasury total (every section: treasury, fellowship,
 * hydration, loans, bounties) and the current DOT price, feeding the
 * "Treasury Balance" KPI card.
 */
export function useTreasuryBalance(): UseTreasuryBalanceResult {
  const [totals, setTotals] = useState<TreasuryTotals | null>(null);
  const [dotPrice, setDotPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchTreasuryTotals(), fetchDotUsdPrice()])
      .then(([treasury, price]) => {
        if (cancelled) return;
        setTotals(treasury);
        setDotPrice(price);
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

  const dot = totals ? totalDot(totals) : 0;
  const usdt = totals ? totalUsdt(totals) : 0;
  const usdc = totals ? totalUsdc(totals) : 0;
  const usd = totals && dotPrice != null ? dot * dotPrice + usdt + usdc : null;

  return { totals, dot, usdt, usdc, usd, loading, error };
}
