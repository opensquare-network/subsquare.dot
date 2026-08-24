import { type ReactNode } from "react";

/**
 * Lightweight CSS-only tooltip for the current site:
 * a dark pill shown above the trigger on hover/focus.
 */
export default function Tooltip({
  content,
  children,
}: {
  content?: string | null;
  children: ReactNode;
}) {
  if (!content) return <>{children}</>;

  return (
    <span className="group/tip relative inline-flex min-w-0">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">
        {content}
      </span>
    </span>
  );
}
