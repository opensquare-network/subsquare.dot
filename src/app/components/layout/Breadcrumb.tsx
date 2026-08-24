import { Fragment } from "react";
import { Link } from "react-router";
import {
  Breadcrumb as BreadcrumbPrimitive,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

export interface Crumb {
  label: string;
  /** Route to link to; omit for the current page or plain sections. */
  to?: string;
}

/** Data-driven breadcrumb trail: each crumb renders as a link when `to` is set. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <BreadcrumbPrimitive>
      <BreadcrumbList className="text-xs font-mono">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <span>{item.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbPrimitive>
  );
}
