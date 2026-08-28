import { SystemLoadingDots } from "@osn/icons/subsquare";

/**
 * Animated loading dots ("…") — the same icon subsquare's FieldLoading uses
 * (`@osn/icons/subsquare` `SystemLoadingDots`), colored with the muted token.
 */
export function FieldLoading({ size = 24 }: { size?: number }) {
  return (
    <SystemLoadingDots
      width={size}
      height={size}
      className="text-muted-foreground"
    />
  );
}
