import { BarChart3, Landmark, TrendingUp, Vote } from "lucide-react";
import { DOT_PINK } from "../../theme";
import { StatCard } from "../gov";

const stats = [
  {
    label: "Active Referenda",
    value: "23",
    sub: "+4 this week",
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
    label: "Total Votes Cast",
    value: "892K",
    sub: "30-day avg",
    icon: <BarChart3 size={16} />,
    color: "#00b2ff",
  },
  {
    label: "Turnout",
    value: "14.7%",
    sub: "+2.1% vs prior",
    icon: <TrendingUp size={16} />,
    color: "#00d395",
  },
];

/** Row of KPI stat cards at the top of the overview. */
export function StatsGrid() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
