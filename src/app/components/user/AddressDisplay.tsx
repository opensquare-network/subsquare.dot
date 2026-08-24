import { cn } from "../ui/utils";
import { addressEllipsis, knownAddressName } from "../../lib/address";
import Tooltip from "./Tooltip";

/**
 * Port of subsquare's AddressDisplay logic:
 * known account (Treasury / Society / ...) or ellipsized address,
 * with a tooltip showing the full address.
 */
export function AddressDisplay({
  address,
  maxWidth,
  ellipsis = true,
  noTooltip = false,
}: {
  address?: string | null;
  maxWidth?: number;
  ellipsis?: boolean;
  noTooltip?: boolean;
}) {
  const known = address ? knownAddressName(address) : null;
  const username =
    known || (ellipsis ? addressEllipsis(address ?? "") : address);

  return (
    <Tooltip content={noTooltip ? null : (address ?? null)}>
      <span className="inline-flex min-w-0 items-center gap-1">
        {known && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-foreground/40"
            aria-label="Special account"
          />
        )}
        <span
          className={cn(
            "font-mono text-inherit",
            maxWidth ? "truncate" : "break-all",
          )}
          style={maxWidth ? { maxWidth } : undefined}
        >
          {username}
        </span>
      </span>
    </Tooltip>
  );
}
