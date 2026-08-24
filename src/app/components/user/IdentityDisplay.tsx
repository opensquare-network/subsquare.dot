import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { cn } from "../ui/utils";
import { type IdentityInfo } from "../../services/identity";
import Tooltip from "./Tooltip";

/** Port of subsquare's getIdentityDisplay: displayParent/display. */
export function getIdentityDisplay(identity: IdentityInfo): string | undefined {
  const info = identity.info;
  if (info?.displayParent) {
    return `${info.displayParent}/${info.display}`;
  }
  return info?.display;
}

const STATUS_ICON: Record<
  string,
  { icon: typeof BadgeCheck; className: string }
> = {
  VERIFIED: { icon: BadgeCheck, className: "text-[#00d395]" },
  VERIFIED_LINKED: { icon: BadgeCheck, className: "text-[#00d395]" },
  ERRONEOUS: { icon: ShieldAlert, className: "text-[#ff4444]" },
  ERRONEOUS_LINKED: { icon: ShieldAlert, className: "text-[#ff4444]" },
  NOT_VERIFIED: { icon: ShieldQuestion, className: "text-muted-foreground/60" },
  LINKED: { icon: ShieldQuestion, className: "text-muted-foreground/60" },
};

/**
 * Port of subsquare's UnStyledIdentity logic:
 * show the identity display name with a status badge
 * when the account has a (non NO_ID) identity.
 */
export function IdentityDisplay({
  identity,
  maxWidth,
  ellipsis = false,
  noTooltip = false,
  iconClassName = "",
}: {
  identity?: IdentityInfo | null;
  maxWidth?: number;
  ellipsis?: boolean;
  noTooltip?: boolean;
  iconClassName?: string;
}) {
  if (!identity || identity.info?.status === "NO_ID") return null;

  const displayName = getIdentityDisplay(identity);
  if (!displayName) return null;

  const status = identity.info?.status ?? "";
  const badge = STATUS_ICON[status] ?? STATUS_ICON.NOT_VERIFIED;
  const BadgeIcon = badge.icon;
  const shouldShowTooltip = Boolean(maxWidth) || ellipsis;
  const tooltipContent = identity.info?.tooltip || displayName;

  return (
    <span className="inline-flex min-w-0 items-center">
      <BadgeIcon
        className={cn("mr-1 h-3 w-3 shrink-0", badge.className, iconClassName)}
      />
      <Tooltip
        content={noTooltip || !shouldShowTooltip ? null : tooltipContent}
      >
        <span
          className={cn(
            "min-w-0 text-inherit",
            shouldShowTooltip && "line-clamp-1 break-all overflow-hidden",
          )}
          style={maxWidth ? { maxWidth } : undefined}
        >
          {displayName}
        </span>
      </Tooltip>
    </span>
  );
}
