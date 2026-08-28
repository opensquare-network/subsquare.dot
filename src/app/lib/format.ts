const COMPACT_SUFFIXES = ["", "K", "M", "B", "T", "Q"];

/** Normalize API amounts (decimal string / 0x hex string / number) to bigint. */
export function toBigInt(
  value: string | number | bigint | undefined | null,
): bigint {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  const s = value.trim();
  if (s.startsWith("0x") || s.startsWith("-0x")) return BigInt(s);
  return BigInt(s);
}

/** snake_case / kebab-case → "Small Spender" */
export function startCase(str: string): string {
  return str.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compact number: 16717047719202036599 → "16.7Q". */
export function compact(value: number, digits = 1): string {
  if (value === 0) return "0";
  const neg = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  let tier = Math.floor(Math.log10(abs) / 3);
  tier = Math.min(tier, COMPACT_SUFFIXES.length - 1);
  const scaled = abs / 10 ** (tier * 3);
  const fixed = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(digits);
  return `${neg}${fixed.replace(/\.0+$/, "")}${COMPACT_SUFFIXES[tier]!}`;
}

/** Relative time: new Date(iso) → "3d ago" / "5h ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(month / 12)}y ago`;
}

/** Thousands-separated number. */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
