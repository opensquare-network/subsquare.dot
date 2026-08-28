import { useHostConnection } from "../../hooks/useHostConnection";

const DOT: Record<string, string> = {
  checking: "bg-muted-foreground/50",
  outside: "bg-muted-foreground/50",
  connected: "bg-[#00d395]",
  error: "bg-[#ff4444]",
};

/**
 * Top-bar Host status indicator: shows the connected chain name inside a Host
 * container and "Standalone" outside one. Dev/demo only (mock host); it never
 * blocks app functionality.
 */
export function HostStatus() {
  const status = useHostConnection();

  const label =
    status.state === "checking"
      ? "Host…"
      : status.state === "outside"
        ? "Standalone"
        : status.state === "connected"
          ? `Host · ${status.chainName}`
          : "Host error";

  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
      title={status.state === "error" ? status.message : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status.state]}`} />
      {label}
    </span>
  );
}
