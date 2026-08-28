import type { ReactNode } from "react";
import { cn } from "../ui/utils";
import { FieldLoading } from "../ui/FieldLoading";

interface StatCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: ReactNode;
  color: string;
  valueClass?: string;
  /** While true, show an animated loading indicator instead of the value. */
  loading?: boolean;
}

/** KPI card with a colored top hairline, used on the overview and treasury grids. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  valueClass = "text-lg",
  loading = false,
}: StatCardProps) {
  return (
    // No overflow-hidden here: the sub tooltip floats above the card, and the
    // colored top hairline stays within bounds on its own.
    <div className="relative rounded border border-border bg-card px-4 py-3">
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
          {loading ? (
            <div className="mt-1">
              <FieldLoading size={20} />
            </div>
          ) : (
            <div
              className={cn(
                "font-['Unbounded'] font-bold text-foreground mt-1 leading-none",
                valueClass,
              )}
            >
              {value}
            </div>
          )}
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
