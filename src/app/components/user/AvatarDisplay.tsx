import { useMemo } from "react";
import Identicon from "@osn/polkadot-react-identicon";
import { getStorageLink } from "../../services/avatar";
import { isPolkadotAddress } from "../../lib/address";

/**
 * Port of subsquare's AvatarDisplay logic:
 * avatarCid → image; Polkadot address → identicon (same package
 * subsquare uses); otherwise a deterministic fallback.
 */
export function AvatarDisplay({
  address,
  avatarCid,
  size = "1.43em",
}: {
  address?: string | null;
  avatarCid?: string | null;
  size?: string;
}) {
  const hue = useMemo(() => {
    if (!address) return 0;
    let h = 0;
    for (const c of address) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }, [address]);

  if (avatarCid) {
    return (
      <img
        src={getStorageLink(avatarCid)}
        alt={address ?? ""}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  if (address && isPolkadotAddress(address)) {
    return (
      <span className="user-identicon inline-block shrink-0 leading-none">
        <Identicon value={address} size={size} />
      </span>
    );
  }

  if (address) {
    return (
      <span
        className="inline-block shrink-0 select-none rounded-full"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${hue} 65% 52%), hsl(${(hue + 60) % 360} 65% 38%))`,
        }}
      />
    );
  }

  return (
    <span
      className="inline-block shrink-0 rounded-full bg-muted"
      style={{ width: size, height: size }}
    />
  );
}
