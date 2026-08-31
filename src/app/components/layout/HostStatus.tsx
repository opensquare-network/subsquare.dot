import { useHostConnection } from "../../hooks/useHostConnection";

const DOT: Record<string, string> = {
  host: "bg-[#00d395]",
  outside: "bg-muted-foreground/50",
};

/**
 * Top-bar Host status indicator. It only distinguishes Host from standalone
 * mode and never blocks app functionality.
 */
export function HostStatus() {
  const status = useHostConnection();

  const label = status.state === "host" ? "Host" : "Standalone";

  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status.state]}`} />
      {label}
    </span>
  );
}
