import { useState } from "react";
import { NavLink } from "react-router";
import { ChevronDown, Globe, Moon, Sun } from "lucide-react";
import { navSections } from "../../data";
import { useTheme } from "../../hooks/useTheme";
import { DOT_PINK } from "../../theme";
import { useOverviewSummary } from "./OverviewSummaryContext";

/** Maps a sidebar nav item to its route. */
const itemRoutes: Record<string, string> = {
  Referenda: "/referenda",
};

type NavSectionData = (typeof navSections)[number];

/** Brand header: logo mark + wordmark. */
function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: DOT_PINK }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white" />
      </div>
      <div>
        <div className="font-['Unbounded'] text-xs font-bold tracking-tight leading-none text-foreground">
          SUBSQUARE
        </div>
        <div className="text-[9px] text-muted-foreground font-mono mt-0.5 tracking-widest">
          POLKADOT
        </div>
      </div>
    </div>
  );
}

/** One collapsible nav section: its toggle button plus the item links. */
function NavSection({
  section,
  expanded,
  onToggle,
  itemCounts = {},
}: {
  section: NavSectionData;
  expanded: boolean;
  onToggle: () => void;
  itemCounts?: Record<string, number>;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {section.icon}
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border pl-3 space-y-0.5 mt-0.5">
          {section.items.map((item) => {
            const count = itemCounts[item];
            return (
              <NavLink
                key={item}
                to={itemRoutes[item] ?? "/"}
                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-xs transition-colors text-muted-foreground hover:text-foreground"
                style={({ isActive }) =>
                  isActive ? { color: DOT_PINK } : undefined
                }
              >
                <span>{item}</span>
                {!!count && (
                  <span className="font-mono text-[10px] leading-none text-muted-foreground/70">
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Footer theme toggle button. */
function ThemeToggle({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-3 py-3 border-t border-border space-y-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 bg-muted border border-border rounded text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
      >
        {dark ? <Sun size={12} /> : <Moon size={12} />}
        <span className="text-[11px]">{dark ? "Light Mode" : "Dark Mode"}</span>
      </button>
    </div>
  );
}

/** Left navigation sidebar: brand, nav sections and footer toggles. */
export function Sidebar() {
  const { dark, toggle: toggleDark } = useTheme();
  const { activeReferenda } = useOverviewSummary();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Governance",
  ]);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );
  };

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
      <Brand />

      <div className="px-3 pb-3" aria-hidden="true"></div>

      <nav className="flex-1 px-2 space-y-0.5 pb-4">
        {navSections.map((section) => (
          <NavSection
            key={section.label}
            section={section}
            expanded={expandedSections.includes(section.label)}
            onToggle={() => toggleSection(section.label)}
            itemCounts={{ Referenda: activeReferenda }}
          />
        ))}
      </nav>

      <ThemeToggle dark={dark} onToggle={toggleDark} />
    </aside>
  );
}
