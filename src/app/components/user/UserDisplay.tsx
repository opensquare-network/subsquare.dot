import { cn } from "../ui/utils";
import { addressEllipsis } from "../../lib/address";
import Tooltip from "./Tooltip";

/**
 * Port of subsquare's UserDisplay logic:
 * a username (e.g. polkassembly-style), falling back to the address
 * for key-registered users like "polkadot-key-0x…".
 */
export function isKeyRegisteredUser(username?: string): boolean {
  return Boolean(
    username?.startsWith("polkadot-key-0x") ||
    username?.startsWith("ethereum-key-0x"),
  );
}

export default function UserDisplay({
  user,
  maxWidth,
  noTooltip = false,
  ellipsis = true,
}: {
  user: { username?: string | null; address?: string | null };
  maxWidth?: number;
  noTooltip?: boolean;
  ellipsis?: boolean;
}) {
  const keyRegistered = isKeyRegisteredUser(user.username ?? "");

  let username = user.username ?? "";
  let tip = username;

  if (keyRegistered) {
    const address = user.address ?? "";
    username = ellipsis ? addressEllipsis(address) : address;
    tip = address;
  }

  return (
    <Tooltip content={noTooltip ? null : tip}>
      <span
        className={cn(
          "inline-flex min-w-0 items-center text-inherit",
          maxWidth ? "truncate" : "break-all",
        )}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {username}
      </span>
    </Tooltip>
  );
}
