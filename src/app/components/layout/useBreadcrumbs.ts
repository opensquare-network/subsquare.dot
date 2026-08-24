import { matchPath, useLocation } from "react-router";
import type { Crumb } from "./Breadcrumb";

interface BreadcrumbRule {
  /** Route pattern, e.g. "/referenda/:id". */
  path: string;
  /** Build the crumb trail from the matched route params. */
  build: (params: Record<string, string | undefined>) => Crumb[];
}

/**
 * Route → breadcrumb rules.
 * Order matters: more specific patterns must come first.
 * Each page owns its entry here, so adding a page is just one rule.
 */
const BREADCRUMB_RULES: BreadcrumbRule[] = [
  {
    path: "/referenda",
    build: () => [{ label: "OpenGov" }, { label: "Referenda" }],
  },
];

/**
 * Derives the breadcrumb trail by matching the active route against the
 * rule table. Unknown routes fall back to the referenda crumb.
 */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();

  for (const rule of BREADCRUMB_RULES) {
    const match = matchPath(rule.path, pathname);
    if (match) {
      return rule.build(match.params);
    }
  }

  return [{ label: "Referenda" }];
}
