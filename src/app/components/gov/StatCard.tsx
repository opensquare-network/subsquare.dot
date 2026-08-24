import type { ReactNode } from "react";
import { cn } from "../ui/utils";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  color: string;
  valueClass?: string;
}

/** KPI card with a colored top hairline, used on the overview and treasury grids. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  valueClass = "text-lg",
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded border border-border bg-card px-4 py-3">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, ${color}60, transparent)`,
        }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
            {label}
          </div>
          <div
            className={cn(
              "font-['Unbounded'] font-bold text-foreground mt-1 leading-none",
              valueClass,
            )}
          >
            {value}
          </div>
          {sub && (
            <div className="text-[10px] mt-1.5 font-mono" style={{ color }}>
              {sub}
            </div>
          )}
        </div>
        {icon && (
          <div
            className="p-2 rounded"
            style={{ background: `${color}15`, color }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
