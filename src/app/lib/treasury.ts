/**
 * Polkadot Treasury total — ported from subsquare's Polkadot Treasury Stats
 * (`usePolkadotTreasuryTotal` + `TotalTreasury` aggregation).
 *
 * The dashboard "Total" sums several on-chain pots holding treasury funds:
 *
 * ┌─────────────────────────┬────────────────────────────────────────────────┐
 * │ Section                 │ Where / how it is read                           │
 * ├─────────────────────────┼────────────────────────────────────────────────┤
 * │ Treasury                │ relay System.Account(modlpy/trsry) + Asset Hub   │
 * │                         │ System.Account(modlpy/trsry derived) native;     │
 * │                         │ USDT/USDC (Assets 1984/1337) on both Asset Hub   │
 * │                         │ treasury accounts                                │
 * │ Fellowship              │ Asset Hub System.Account(fellowship) native +    │
 * │                         │ Assets(1984, fellowship salary) USDT             │
 * │ Hydration               │ Hydration Tokens.Accounts over 3 treasury        │
 * │                         │ accounts (DOT=5, USDT=10, USDC=22, aDOT=1001)    │
 * │ Loans                   │ hardcoded outstanding loans (Bifrost 1M,         │
 * │                         │ Pendulum 50K, Hydration 1M DOT) — same as        │
 * │                         │ subsquare                                        │
 * │ Bounties                │ Asset Hub Bounties.Bounties entries → per-bounty │
 * │                         │ account (via subsquare API address) balance      │
 * └─────────────────────────┴──────────────────────────────────────────────────┘
 *
 * NOTE: unlike subsquare (which reads the legacy Statemint treasury account and
 * gets ~0 native DOT), we read the derived `modlpy/trsry` account on Asset Hub,
 * where the treasury's DOT actually sits. Bounties live on Asset Hub (the relay
 * `Bounties` pallet is empty post-migration). Connections are direct mainnet
 * RPCs — treasury data is mainnet-only, regardless of the mock host's network.
 */
import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";

// Polkadot mainnet RPCs (reachable from inside the host or standalone).
const POLKADOT_RELAY_RPC = "wss://rpc.polkadot.io";
const POLKADOT_ASSETHUB_RPC = "wss://polkadot-asset-hub-rpc.polkadot.io";
const HYDRATION_RPC = "wss://rpc.hydradx.cloud";

// SubSquare API (same source as the referenda data) — used for per-bounty
// account addresses, exactly like subsquare's useBountiesTotalBalance.
const SUBSQUARE_API = "https://polkadot-api.subsquare.io";

// Treasury accounts (verified against the chain).
// modlpy/trsry derived account, SS58 prefix 0 (Polkadot relay).
export const RELAY_TREASURY_ACCOUNT =
  "13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB";
// modlpy/trsry derived account, SS58 prefix 42 (Asset Hub) — the main DOT pot.
export const ASSETHUB_TREASURY_ACCOUNT =
  "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z";
// Legacy Statemint-era treasury account on Asset Hub (holds USDT/USDC).
const STATEMINT_TREASURY_ACCOUNT =
  "14xmwinmCEz6oRrFdczHKqHgWNMiCysE2KrA4jXXAAM1Eogk";
// Fellowship treasury + salary accounts on Asset Hub.
const FELLOWSHIP_TREASURY_ACCOUNT =
  "16VcQSRcMFy6ZHVjBvosKmo7FKqTb8ZATChDYo8ibutzLnos";
const FELLOWSHIP_SALARY_ACCOUNT =
  "13w7NdvSR1Af8xsQTArDtZmVvjE8XhWNdL4yed3iFHrUNCnS";

export const USDT_ASSET_ID = 1984;
export const USDC_ASSET_ID = 1337;

export const DOT_DECIMALS = 10;
export const STABLECOIN_DECIMALS = 6;

// Hydration treasury accounts (3 pots) and token ids.
const HYDRATION_ACCOUNTS = [
  "7LcF8b5GSvajXkSChhoMFcGDxF9Yn9unRDceZj1Q6NYox8HY",
  "7KCp4eenFS4CowF9SpQE5BBCj5MtoBA3K811tNyRmhLfH1aV",
  "7N4oFqXKgeTXo6CMSY9BVZdHP5J3RhQXY77Fe7qmQwjcxa1w",
] as const;
const HYDRATION_DOT_TOKEN = 5;
const HYDRATION_USDT_TOKEN = 10;
const HYDRATION_USDC_TOKEN = 22;
const HYDRATION_ADOT_TOKEN = 1001;

// Outstanding treasury loans, hardcoded exactly as subsquare does.
const LOAN_BIFROST_DOT = 10_000_000_000_000_000n; // 1M DOT
const LOAN_PENDULUM_DOT = 500_000_000_000_000n; // 50K DOT
const LOAN_HYDRATION_DOT = 10_000_000_000_000_000n; // 1M DOT

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd";

/** Per-section raw balances (planck / 6-decimal units), for transparency. */
export interface TreasuryBreakdown {
  treasuryDot: bigint;
  treasuryUsdt: bigint;
  treasuryUsdc: bigint;
  fellowshipDot: bigint;
  fellowshipSalaryUsdt: bigint;
  hydrationDot: bigint;
  hydrationUsdt: bigint;
  hydrationUsdc: bigint;
  loansDot: bigint;
  bountiesDot: bigint;
}

/** Final treasury totals aggregated like subsquare's TotalTreasury. */
export interface TreasuryTotals extends TreasuryBreakdown {
  /** Native DOT across all sections, in planck (10 decimals). */
  totalNativeFree: bigint;
  /** USDT across all sections, 6 decimals. */
  totalUsdt: bigint;
  /** USDC across all sections, 6 decimals. */
  totalUsdc: bigint;
}

/** Minimal shape of the unsafe API surface we touch. */
interface SystemApi {
  query: {
    System: {
      Account: {
        getValue: (
          account: string,
        ) => Promise<{ data?: { free?: bigint } } | null>;
      };
    };
    Assets: {
      Account: {
        getValue: (
          assetId: number,
          account: string,
        ) => Promise<{ balance?: bigint } | null>;
      };
    };
    Tokens: {
      Accounts: {
        getValue: (
          account: string,
          tokenId: number,
        ) => Promise<{ free?: bigint; reserved?: bigint } | null>;
      };
    };
    Bounties: {
      Bounties: {
        getEntries: () => Promise<
          Array<{
            keyArgs?: (number | null)[];
            value?: { status?: { type?: string } };
          }>
        >;
      };
    };
  };
}

let relayClient: PolkadotClient | null = null;
let assetHubClient: PolkadotClient | null = null;
let hydrationClient: PolkadotClient | null = null;

function relayApi(): SystemApi {
  if (!relayClient)
    relayClient = createClient(getWsProvider(POLKADOT_RELAY_RPC));
  return relayClient.getUnsafeApi() as unknown as SystemApi;
}

function assetHubApi(): SystemApi {
  if (!assetHubClient)
    assetHubClient = createClient(getWsProvider(POLKADOT_ASSETHUB_RPC));
  return assetHubClient.getUnsafeApi() as unknown as SystemApi;
}

function hydrationApi(): SystemApi {
  if (!hydrationClient)
    hydrationClient = createClient(getWsProvider(HYDRATION_RPC));
  return hydrationClient.getUnsafeApi() as unknown as SystemApi;
}

/** System.Account.data.free for an account, or 0n. */
async function systemFree(api: SystemApi, account: string): Promise<bigint> {
  const acct = await api.query.System.Account.getValue(account);
  return acct?.data?.free ?? 0n;
}

/** Assets.Account.balance for (assetId, account), or 0n. */
async function assetBalance(
  api: SystemApi,
  assetId: number,
  account: string,
): Promise<bigint> {
  const acct = await api.query.Assets.Account.getValue(assetId, account);
  return acct?.balance ?? 0n;
}

/** Tokens.Accounts free + reserved for (account, tokenId), or 0n. */
async function tokenBalance(
  api: SystemApi,
  account: string,
  tokenId: number,
): Promise<bigint> {
  const acct = await api.query.Tokens.Accounts.getValue(account, tokenId);
  return (acct?.free ?? 0n) + (acct?.reserved ?? 0n);
}

/** Hydration DOT + aDOT across the three treasury accounts. */
async function hydrationBalances(): Promise<{
  dot: bigint;
  usdt: bigint;
  usdc: bigint;
}> {
  const api = hydrationApi();
  let dot = 0n;
  let usdt = 0n;
  let usdc = 0n;
  for (const account of HYDRATION_ACCOUNTS) {
    const [dotRaw, adot, usdtRaw, usdcRaw] = await Promise.all([
      tokenBalance(api, account, HYDRATION_DOT_TOKEN),
      tokenBalance(api, account, HYDRATION_ADOT_TOKEN),
      tokenBalance(api, account, HYDRATION_USDT_TOKEN),
      tokenBalance(api, account, HYDRATION_USDC_TOKEN),
    ]);
    dot += dotRaw + adot;
    usdt += usdtRaw;
    usdc += usdcRaw;
  }
  return { dot, usdt, usdc };
}

/** Total DOT held by active bounties on Asset Hub. */
async function bountiesBalance(): Promise<bigint> {
  const api = assetHubApi();
  const entries = await api.query.Bounties.Bounties.getEntries();
  const active = entries.filter(({ value }) =>
    ["Funded", "CuratorProposed", "Active"].includes(value?.status?.type ?? ""),
  );

  let total = 0n;
  for (const entry of active) {
    const index = entry.keyArgs?.[0];
    if (index === undefined || index === null) continue;
    // Same as subsquare's useBountiesTotalBalance: resolve the bounty's
    // account address from the backend, then read its on-chain free balance.
    let address: string | null = null;
    try {
      const res = await fetch(`${SUBSQUARE_API}/treasury/bounties/${index}`);
      if (res.ok) {
        const data: { onchainData?: { address?: string } } = await res.json();
        address = data.onchainData?.address ?? null;
      }
    } catch {
      address = null;
    }
    if (!address) continue;
    total += await systemFree(api, address);
  }
  return total;
}

/**
 * Fetch the real Polkadot Treasury totals across every section, mirroring
 * subsquare's `TotalTreasury` aggregation.
 */
export async function fetchTreasuryTotals(): Promise<TreasuryTotals> {
  const relay = relayApi();
  const assetHub = assetHubApi();

  const [
    relayNative,
    ahNative,
    ahUsdt,
    ahUsdc,
    statemintUsdt,
    statemintUsdc,
    fellowshipDot,
    fellowshipSalaryUsdt,
    hydration,
    bountiesDot,
  ] = await Promise.all([
    systemFree(relay, RELAY_TREASURY_ACCOUNT),
    systemFree(assetHub, ASSETHUB_TREASURY_ACCOUNT),
    assetBalance(assetHub, USDT_ASSET_ID, ASSETHUB_TREASURY_ACCOUNT),
    assetBalance(assetHub, USDC_ASSET_ID, ASSETHUB_TREASURY_ACCOUNT),
    assetBalance(assetHub, USDT_ASSET_ID, STATEMINT_TREASURY_ACCOUNT),
    assetBalance(assetHub, USDC_ASSET_ID, STATEMINT_TREASURY_ACCOUNT),
    systemFree(assetHub, FELLOWSHIP_TREASURY_ACCOUNT),
    assetBalance(assetHub, USDT_ASSET_ID, FELLOWSHIP_SALARY_ACCOUNT),
    hydrationBalances(),
    bountiesBalance(),
  ]);

  const treasuryDot = relayNative + ahNative;
  const treasuryUsdt = ahUsdt + statemintUsdt;
  const treasuryUsdc = ahUsdc + statemintUsdc;
  const loansDot = LOAN_BIFROST_DOT + LOAN_PENDULUM_DOT + LOAN_HYDRATION_DOT;

  return {
    treasuryDot,
    treasuryUsdt,
    treasuryUsdc,
    fellowshipDot,
    fellowshipSalaryUsdt,
    hydrationDot: hydration.dot,
    hydrationUsdt: hydration.usdt,
    hydrationUsdc: hydration.usdc,
    loansDot,
    bountiesDot,
    totalNativeFree:
      treasuryDot + fellowshipDot + hydration.dot + loansDot + bountiesDot,
    totalUsdt: treasuryUsdt + fellowshipSalaryUsdt + hydration.usdt,
    totalUsdc: treasuryUsdc + hydration.usdc,
  };
}

/** Native DOT total as a decimal number (planck → DOT). */
export function totalDot(totals: TreasuryTotals): number {
  return Number(totals.totalNativeFree) / 10 ** DOT_DECIMALS;
}

/** USDT total as a decimal number (6 decimals → USDT). */
export function totalUsdt(totals: TreasuryTotals): number {
  return Number(totals.totalUsdt) / 10 ** STABLECOIN_DECIMALS;
}

/** USDC total as a decimal number (6 decimals → USDC). */
export function totalUsdc(totals: TreasuryTotals): number {
  return Number(totals.totalUsdc) / 10 ** STABLECOIN_DECIMALS;
}

/** Current DOT/USD price (CoinGecko), or null when unavailable. */
export async function fetchDotUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const price = (data as { polkadot?: { usd?: number } })?.polkadot?.usd;
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}
