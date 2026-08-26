import { filterTabs } from "../../../data";
import { DOT_PINK } from "../../../theme";
import { formatNumber } from "../../../lib/format";

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
          className="px-3 py-1 rounded-full text-[11px] font-mono transition-colors cursor-pointer"
          style={
            activeFilter === f
              ? {
                  background: `${DOT_PINK}18`,
                  border: `1px solid ${DOT_PINK}50`,
                  color: DOT_PINK,
                }
              : {
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }
          }
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
