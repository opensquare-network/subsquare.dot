import { isInsideContainerSync } from "@parity/product-sdk/host";

export type HostConnectionStatus = { state: "host" } | { state: "outside" };

/**
 * Detect whether we run inside a Host container for the top-bar status
 * indicator. This deliberately avoids opening a chain connection: the app does
 * not need one merely to distinguish Host from standalone mode.
 */
export function useHostConnection(): HostConnectionStatus {
  return { state: isInsideContainerSync() ? "host" : "outside" };
}
