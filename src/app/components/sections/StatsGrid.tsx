import { Info, Landmark, ReceiptText, Vote } from "lucide-react";
import { useTreasuryBalance } from "../../hooks/useTreasuryBalance";
import { useTreasuryYears } from "../../hooks/useTreasuryYears";
import { compact } from "../../lib/format";
import { StatCard } from "../gov";
import { useOverviewSummary } from "../layout/OverviewSummaryContext";
import { Tooltip } from "../user";

/** Row of KPI stat cards at the top of the overview. */
export function StatsGrid() {
  const { activeReferenda, totalReferenda, loading, error } =
    useOverviewSummary();
  const {
    totalSpent,
    currentYearSpent,
    loading: treasuryLoading,
    error: treasuryError,
  } = useTreasuryYears();
  const {
    dot: treasuryDot,
    usdt: treasuryUsdt,
    usdc: treasuryUsdc,
    usd: treasuryUsd,
    loading: treasuryBalanceLoading,
    error: treasuryBalanceError,
  } = useTreasuryBalance();

  const unavailable = loading || !!error;
  const treasuryUnavailable = treasuryLoading || !!treasuryError;
  const treasuryBalanceUnavailable =
    treasuryBalanceLoading || !!treasuryBalanceError;
  const treasuryBalanceReady =
    !treasuryBalanceUnavailable && treasuryUsd != null;
  const treasuryUsdValue = treasuryUsd ?? 0;
  const treasuryDetailTooltip = [
    `${compact(treasuryDot)} DOT`,
    `${compact(treasuryUsdt)} USDT`,
    `${compact(treasuryUsdc)} USDC`,
  ].join(" · ");
  const stats = [
    {
      label: "Active Referenda",
      loading,
      value: unavailable ? "—" : String(activeReferenda),
      sub: unavailable ? "" : `of ${totalReferenda} total`,
      icon: <Vote size={16} />,
      color: "var(--secondary-foreground)",
    },
    {
      label: "Treasury Balance",
      // Big font shows the fiat (USD) value; the small line holds an info
      // icon whose tooltip lists the DOT / USDT / USDC detail balances.
      loading: treasuryBalanceLoading,
      value: treasuryBalanceReady ? `$${compact(treasuryUsdValue)}` : "—",
      sub: treasuryBalanceReady ? (
        <Tooltip content={treasuryDetailTooltip}>
          <Info size={12} className="cursor-help" />
        </Tooltip>
      ) : (
        ""
      ),
      icon: <Landmark size={16} />,
      color: "#7b3fe4",
    },
    {
      label: "Total Spent",
      loading: treasuryLoading,
      value: treasuryUnavailable ? "—" : `$${compact(totalSpent)}`,
      sub: treasuryUnavailable ? "" : `$${compact(currentYearSpent)} this year`,
      icon: <ReceiptText size={16} />,
      color: "#00b2ff",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
