import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../ui/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

type PageItem = number | "gap";

/** Page window: 1 … page±1 … last page; collapses the middle with an ellipsis beyond 7 pages. */
function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);
  return items;
}

/** Page-numbered pagination (SubSquare style): ‹ · 1 … n … last page · ›. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  const base =
    "px-2.5 py-1 rounded border border-border text-[11px] font-mono transition-colors";

  const buttonClass = (isActive = false, isDisabled = false) =>
    cn(
      base,
      isActive
        ? "text-foreground border-foreground/30 bg-foreground/5"
        : "text-muted-foreground hover:text-foreground hover:border-foreground/20",
      isDisabled
        ? "opacity-40 cursor-not-allowed hover:text-muted-foreground hover:border-border"
        : "cursor-pointer",
    );

  return (
    <nav className="flex items-center gap-1.5" aria-label="pagination">
      <button
        type="button"
        aria-label="First page"
        title="First page"
        className={cn(buttonClass(false, disabled || page <= 1), "px-1.5")}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(1)}
      >
        <ChevronsLeft size={12} />
      </button>

      <button
        type="button"
        aria-label="Previous page"
        title="Previous page"
        className={cn(buttonClass(false, disabled || page <= 1), "px-1.5")}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={12} />
      </button>

      {getPageItems(page, totalPages).map((item, i) =>
        item === "gap" ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-[10px] font-mono text-muted-foreground select-none"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={buttonClass(item === page, disabled)}
            disabled={disabled}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Next page"
        title="Next page"
        className={cn(
          buttonClass(false, disabled || page >= totalPages),
          "px-1.5",
        )}
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={12} />
      </button>

      <button
        type="button"
        aria-label="Last page"
        title="Last page"
        className={cn(
          buttonClass(false, disabled || page >= totalPages),
          "px-1.5",
        )}
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(totalPages)}
      >
        <ChevronsRight size={12} />
      </button>
    </nav>
  );
}
