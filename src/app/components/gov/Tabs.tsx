import type { ReactNode } from "react";

interface TabItem<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (value: T) => void;
  color?: string;
  /** Extra content rendered on the right edge of the tab row. */
  right?: ReactNode;
}

/** Underline-style tab bar shared by the detail page and the main content area. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  color = "#E6007A",
  right,
}: TabsProps<T>) {
  return (
    <div className="flex items-center gap-0 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className="px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px"
          style={
            active === tab.value
              ? { borderColor: color, color }
              : { borderColor: "transparent", color: "var(--muted-foreground)" }
          }
        >
          {tab.label}
          {tab.badge != null && (
            <span className="ml-1.5 font-mono text-[9px]">{tab.badge}</span>
          )}
        </button>
      ))}
      {right && (
        <div className="ml-auto flex items-center gap-2 pb-1.5">{right}</div>
      )}
    </div>
  );
}
