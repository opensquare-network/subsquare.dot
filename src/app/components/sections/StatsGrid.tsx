import { Landmark, ReceiptText, Vote } from "lucide-react";
import { useTreasuryYears } from "../../hooks/useTreasuryYears";
import { compact } from "../../lib/format";
import { DOT_PINK } from "../../theme";
import { StatCard } from "../gov";
import { useOverviewSummary } from "../layout/OverviewSummaryContext";

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

  const unavailable = loading || !!error;
  const treasuryUnavailable = treasuryLoading || !!treasuryError;
  const stats = [
    {
      label: "Active Referenda",
      value: unavailable ? "—" : String(activeReferenda),
      sub: unavailable ? "" : `of ${totalReferenda} total`,
      icon: <Vote size={16} />,
      color: DOT_PINK,
    },
    {
      label: "Treasury Balance",
      value: "41.2M DOT",
      sub: "≈ $288M USD",
      icon: <Landmark size={16} />,
      color: "#7b3fe4",
    },
    {
      label: "Total Spent",
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
