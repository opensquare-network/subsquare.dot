import { filterTabs } from "../../../data";
import { formatNumber } from "../../../lib/format";
import { cn } from "../../ui/utils";

/** Status filter chips (synced to the URL) plus the total referenda count. */
export function ReferendaFilterBar({
  activeFilter,
  onChange,
  total,
}: {
  activeFilter: string;
  onChange: (filter: string) => void;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filterTabs.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            "px-3 py-1 rounded-full text-[11px] font-mono transition-colors cursor-pointer",
            activeFilter === f
              ? "bg-[#E6007A18] border border-[#E6007A50] text-[#E6007A]"
              : "bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
          )}
        >
          {f}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">
        {formatNumber(total)} referenda
      </span>
    </div>
  );
}
