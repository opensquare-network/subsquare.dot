import { useEffect, useState } from "react";
import { getHostClient } from "../lib/host";

export type HostConnectionStatus =
  | { state: "checking" }
  | { state: "outside" }
  | { state: "connected"; chainName: string }
  | { state: "error"; message: string };

/**
 * Detect whether we run inside a Host container and, when we do, open the chain
 * connection and read the chain name. Feeds the top-bar Host status indicator;
 * the app itself keeps working without a host.
 */
export function useHostConnection(): HostConnectionStatus {
  const [status, setStatus] = useState<HostConnectionStatus>({
    state: "checking",
  });

  useEffect(() => {
    let cancelled = false;

    getHostClient()
      .then(async (client) => {
        if (cancelled) return;
        if (!client) {
          setStatus({ state: "outside" });
          return;
        }
        const spec = await client.getChainSpecData();
        if (!cancelled) setStatus({ state: "connected", chainName: spec.name });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus({
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
