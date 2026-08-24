/**
 * Address utilities ported from subsquare's next-common:
 * - base58 / SS58 decoding (known-account matchers)
 * - address validation and ellipsis
 */

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const SS58_BODY = 32 + 2; // public key (32) + checksum (2)

function ascii(str: string): number[] {
  return Array.from(str).map((c) => c.charCodeAt(0));
}

/** Decode a base58 string into a byte array (big-endian). */
function base58ToBytes(input: string): number[] {
  const bytes: number[] = [0];
  for (const char of input) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) return [];
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return bytes.reverse();
}

/** Decode an SS58 address to its public key bytes (skips checksum verification). */
export function decodeSs58(address: string): Uint8Array | null {
  if (!address) return null;
  const bytes = base58ToBytes(address);
  // SS58 format: network prefix (1-byte for Polkadot) + public key + checksum
  if (bytes.length !== 1 + SS58_BODY) return null;
  return new Uint8Array(bytes.slice(1, 1 + 32));
}

const isBase58 = (value: string) => /^[A-HJ-NP-Za-km-z1-9]*$/.test(value);

/** Same rule as subsquare's isPolkadotAddress (without checksum validation). */
export function isPolkadotAddress(address: string): boolean {
  return (
    typeof address === "string" &&
    address.length >= 46 &&
    address.length <= 49 &&
    isBase58(address)
  );
}

export function isEthereumAddress(address: string): boolean {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Port of subsquare's addressEllipsis: EVM 6/4, SS58 4/4. */
export function addressEllipsis(
  address: string,
  start?: number,
  end?: number,
): string {
  if (typeof address !== "string") return address;
  const head = isEthereumAddress(address) ? start || 6 : start || 4;
  const tail = isEthereumAddress(address) ? end || 4 : end || 4;
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

type Matcher = { prefix: number[]; name: string; numeric?: boolean };

const MATCHERS: Matcher[] = [
  { prefix: ascii("modlpy/socie".padEnd(32, "\0")), name: "Society" },
  { prefix: ascii("modlpy/trsry".padEnd(32, "\0")), name: "Treasury" },
  { prefix: ascii("modlpy/xcmch".padEnd(32, "\0")), name: "XCM" },
  { prefix: ascii("modlpy/cfund"), name: "Crowdloan", numeric: true },
  { prefix: ascii("modlpy/npols\u0000"), name: "Pool Stash", numeric: true },
  { prefix: ascii("modlpy/npols\u0001"), name: "Pool Reward", numeric: true },
  { prefix: ascii("modlpy/nopls\u0000"), name: "Pool Stash", numeric: true },
  { prefix: ascii("modlpy/nopls\u0001"), name: "Pool Reward", numeric: true },
  { prefix: ascii("para"), name: "Parachain", numeric: true },
  { prefix: ascii("sibl"), name: "Sibling", numeric: true },
];

const matcherLabel = (matcher: Matcher, key: Uint8Array): string | null => {
  const { prefix, name, numeric } = matcher;
  if (!numeric) {
    const matches = key.length === 32 && prefix.every((b, i) => key[i] === b);
    return matches ? name : null;
  }
  const minLength = prefix.length + 4;
  if (key.length < minLength) return null;
  const prefixMatches = prefix.every((b, i) => key[i] === b);
  const tailEmpty = Array.from(key.slice(minLength)).every((b) => b === 0);
  if (!prefixMatches || !tailEmpty) return null;
  const u32 =
    key[prefix.length]! |
    (key[prefix.length + 1]! << 8) |
    (key[prefix.length + 2]! << 16) |
    (key[prefix.length + 3]! << 24);
  return `${name} ${u32.toLocaleString("en-US")}`;
};

/** Port of subsquare's KNOWN_ADDR_MATCHERS (Treasury, Society, ..., Parachain). */
export function knownAddressName(address: string): string | null {
  const key = decodeSs58(address);
  if (!key) return null;
  for (const matcher of MATCHERS) {
    const label = matcherLabel(matcher, key);
    if (label) return label;
  }
  return null;
}
