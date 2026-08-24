import { useEffect, useState } from "react";
import { fetchIdentity, type IdentityInfo } from "../services/identity";

/** Port of subsquare's useIdentityInfo (no context / redux in this app). */
export function useIdentityInfo(address?: string | null): {
  identity: IdentityInfo | null;
  hasIdentity: boolean;
  isLoading: boolean;
} {
  const [identity, setIdentity] = useState<IdentityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setIdentity(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchIdentity(address)
      .then((result) => {
        if (!cancelled) setIdentity(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const status = identity?.info?.status;
  return {
    identity,
    hasIdentity: Boolean(status && status !== "NO_ID"),
    isLoading,
  };
}
