import { memo, useMemo, type ReactNode } from "react";
import { cn } from "../ui/utils";
import { isEthereumAddress, isPolkadotAddress } from "../../lib/address";
import { useIdentityInfo } from "../../hooks/useIdentityInfo";
import { useAvatarInfo } from "../../hooks/useAvatarInfo";
import { AvatarDisplay } from "./AvatarDisplay";
import { AddressDisplay } from "./AddressDisplay";
import { IdentityDisplay } from "./IdentityDisplay";
import UserDisplay from "./UserDisplay";
import Tooltip from "./Tooltip";

const USER_PAGE_BASE = "https://polkadot.subsquare.io/user";

/**
 * Port of subsquare's UserAddressLink logic:
 * no href when needHref is false, external http links pass through,
 * otherwise link to the on-chain user page (SubSquare here).
 */
export function UserAddressLink({
  address,
  link = "",
  needHref = true,
  children,
}: {
  address?: string | null;
  link?: string;
  needHref?: boolean;
  children: ReactNode;
}) {
  if (!needHref) return <>{children}</>;

  if (link.startsWith("http")) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      href={`${USER_PAGE_BASE}/${address}${link}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

/** Same width accounting as subsquare's useWidth (avatar 28, identity icon 16). */
function useUserWidth(
  showAvatar: boolean,
  hasIdentity: boolean,
  maxWidth?: number,
): number | undefined {
  return useMemo(() => {
    if (!maxWidth) return maxWidth;
    let res = maxWidth;
    if (showAvatar) res -= 28;
    if (hasIdentity) res -= 16;
    return res;
  }, [showAvatar, hasIdentity, maxWidth]);
}

export function AddressUserWrapper({
  className,
  noEvent = false,
  children,
}: {
  className?: string;
  noEvent?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center",
        noEvent && "pointer-events-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Port of subsquare's AddressUserImpl (identity / username / address resolution). */
export function AddressUserImpl({
  address,
  identity,
  hasIdentity,
  avatar,
  maxWidth,
  showAvatar = true,
  avatarSize = "",
  noEvent = false,
  noTooltip = false,
  ellipsis = true,
  link = "",
  needHref = true,
  username = "",
  showBountyIdentity = true,
  identityIconClassName = "",
  className = "",
}: {
  address?: string | null;
  identity?: Parameters<typeof IdentityDisplay>[0]["identity"];
  hasIdentity?: boolean;
  avatar?: string | null;
  maxWidth?: number;
  showAvatar?: boolean;
  avatarSize?: string;
  noEvent?: boolean;
  noTooltip?: boolean;
  ellipsis?: boolean;
  link?: string;
  needHref?: boolean;
  username?: string;
  showBountyIdentity?: boolean;
  identityIconClassName?: string;
  className?: string;
}) {
  const showIdentity =
    Boolean(hasIdentity) &&
    (showBountyIdentity || !identity?.info?.isBountyIdentity);

  const inner = showIdentity ? (
    <IdentityDisplay
      identity={identity}
      maxWidth={maxWidth}
      ellipsis={ellipsis}
      noTooltip={noTooltip}
      iconClassName={identityIconClassName}
    />
  ) : username ? (
    <UserDisplay
      user={{ username, address }}
      maxWidth={maxWidth}
      noTooltip={noTooltip}
      ellipsis={ellipsis}
    />
  ) : (
    <AddressDisplay
      address={address}
      maxWidth={maxWidth}
      noTooltip={noTooltip}
      ellipsis={ellipsis}
    />
  );

  return (
    <AddressUserWrapper className={className} noEvent={noEvent}>
      {showAvatar && (
        <span className="mr-1.5 flex shrink-0 items-center">
          <AvatarDisplay
            address={address}
            avatarCid={avatar}
            size={avatarSize || "1.43em"}
          />
        </span>
      )}
      <UserAddressLink address={address} link={link} needHref={needHref}>
        {inner}
      </UserAddressLink>
    </AddressUserWrapper>
  );
}

/** Port of subsquare's AddressUserComp: hooks + width + invalid-address fallback. */
function AddressUserComp({
  className = "",
  add,
  showAvatar = true,
  noEvent = false,
  maxWidth: propMaxWidth,
  noTooltip = false,
  ellipsis = true,
  needHref = true,
  link = "",
  identityIconClassName = "",
  avatarSize = "",
  username = "",
  showBountyIdentity = true,
}: {
  className?: string;
  add?: string | null;
  showAvatar?: boolean;
  noEvent?: boolean;
  maxWidth?: number;
  noTooltip?: boolean;
  ellipsis?: boolean;
  needHref?: boolean;
  link?: string;
  identityIconClassName?: string;
  avatarSize?: string;
  username?: string;
  showBountyIdentity?: boolean;
}) {
  const address = add;
  const { identity, hasIdentity } = useIdentityInfo(address);
  const [avatar] = useAvatarInfo(address);
  const maxWidth = useUserWidth(showAvatar, hasIdentity, propMaxWidth);

  if (
    !address ||
    (!isPolkadotAddress(address) && !isEthereumAddress(address))
  ) {
    return (
      <AddressUserWrapper className={className} noEvent={noEvent}>
        <Tooltip content={noTooltip ? null : (address ?? null)}>
          <span className="font-mono text-muted-foreground">
            {address || "[Deleted Account]"}
          </span>
        </Tooltip>
      </AddressUserWrapper>
    );
  }

  return (
    <AddressUserImpl
      address={address}
      identity={identity}
      hasIdentity={hasIdentity}
      avatar={avatar}
      maxWidth={maxWidth}
      showAvatar={showAvatar}
      avatarSize={avatarSize}
      noEvent={noEvent}
      noTooltip={noTooltip}
      ellipsis={ellipsis}
      link={link}
      needHref={needHref}
      identityIconClassName={identityIconClassName}
      className={cn("text-[14px] font-medium", className)}
      username={username}
      showBountyIdentity={showBountyIdentity}
    />
  );
}

const AddressUser = memo(AddressUserComp);
export default AddressUser;
