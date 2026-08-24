import { cn } from "../ui/utils";

interface EmptyStateProps {
  message: string;
  className?: string;
}

/** Centered placeholder text for empty lists, e.g. "No votes yet". */
export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "px-4 py-8 text-center text-muted-foreground text-[12px]",
        className,
      )}
    >
      {message}
    </div>
  );
}
