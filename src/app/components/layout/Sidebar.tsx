import { NavLink } from "react-router";
import { ChevronDown, Globe, Moon, Sun } from "lucide-react";
import { DOT_PINK } from "../../theme";
import { navSections } from "../../data";

interface SidebarProps {
  dark: boolean;
  onToggleDark: () => void;
  expandedSections: string[];
  onToggleSection: (label: string) => void;
}

/** Maps a sidebar nav item to its route. */
const itemRoutes: Record<string, string> = {
  Referenda: "/referenda",
};

/** Left navigation sidebar: brand, nav sections and footer toggles. */
export function Sidebar({
  dark,
  onToggleDark,
  expandedSections,
  onToggleSection,
}: SidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
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

      <div className="px-3 pb-3" aria-hidden="true"></div>

      <nav className="flex-1 px-2 space-y-0.5 pb-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <button
              onClick={() => onToggleSection(section.label)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {section.icon}
              <span className="flex-1 text-left">{section.label}</span>
              <ChevronDown
                size={11}
                className={`transition-transform ${expandedSections.includes(section.label) ? "rotate-0" : "-rotate-90"}`}
              />
            </button>
            {expandedSections.includes(section.label) && (
              <div className="ml-4 border-l border-border pl-3 space-y-0.5 mt-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item}
                    to={itemRoutes[item] ?? "/"}
                    className="w-full text-left px-2 py-1 rounded text-xs transition-colors text-muted-foreground hover:text-foreground"
                    style={({ isActive }) =>
                      isActive ? { color: DOT_PINK } : undefined
                    }
                  >
                    {item}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-2">
        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-2 px-2.5 py-2 bg-muted border border-border rounded text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
        >
          {dark ? <Sun size={12} /> : <Moon size={12} />}
          <span className="text-[11px]">
            {dark ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </aside>
  );
}
