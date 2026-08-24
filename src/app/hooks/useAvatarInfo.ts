import { useEffect, useState } from "react";
import { fetchAvatar } from "../services/avatar";

/** Port of subsquare's useAvatarInfo: [avatarCid, hasAvatar]. */
export function useAvatarInfo(
  address?: string | null,
): [string | null, boolean] {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setAvatar(null);
      return;
    }

    let cancelled = false;

    fetchAvatar(address)
      .then((result) => {
        if (!cancelled) setAvatar(result);
      })
      .catch(() => {
        if (!cancelled) setAvatar(null);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return [avatar, Boolean(avatar)];
}
