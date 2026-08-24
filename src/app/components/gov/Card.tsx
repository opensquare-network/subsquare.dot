import type { ReactNode } from "react";
import { cn } from "../ui/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("rounded border border-border bg-card", className)}>
      {children}
    </div>
  );
}
