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
import { SUBSQUARE_API_URL } from "../api/subsquare";
import {
  HYDRATION_TREASURY_ACCOUNTS,
  POLKADOT_FELLOWSHIP_ACCOUNTS,
  POLKADOT_TREASURY_ACCOUNTS,
} from "./chain/accounts";
import { DOT, USDC, USDT } from "./chain/assets";
import {
  HYDRATION,
  POLKADOT_ASSET_HUB,
  POLKADOT_RELAY,
} from "./chain/networks";

const OUTSTANDING_TREASURY_LOANS = {
  bifrostDot: 10_000_000_000_000_000n,
  pendulumDot: 500_000_000_000_000n,
  hydrationDot: 10_000_000_000_000_000n,
} as const;
const HYDRATION_ADOT_ID = 1001;

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
    relayClient = createClient(getWsProvider(POLKADOT_RELAY.rpcUrl));
  return relayClient.getUnsafeApi() as unknown as SystemApi;
}

function assetHubApi(): SystemApi {
  if (!assetHubClient)
    assetHubClient = createClient(getWsProvider(POLKADOT_ASSET_HUB.rpcUrl));
  return assetHubClient.getUnsafeApi() as unknown as SystemApi;
}

function hydrationApi(): SystemApi {
  if (!hydrationClient)
    hydrationClient = createClient(getWsProvider(HYDRATION.rpcUrl));
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
  for (const account of HYDRATION_TREASURY_ACCOUNTS) {
    const [dotRaw, adot, usdtRaw, usdcRaw] = await Promise.all([
      tokenBalance(api, account, DOT.hydrationId),
      tokenBalance(api, account, HYDRATION_ADOT_ID),
      tokenBalance(api, account, USDT.hydrationId),
      tokenBalance(api, account, USDC.hydrationId),
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
      const res = await fetch(
        `${SUBSQUARE_API_URL}/treasury/bounties/${index}`,
      );
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
    systemFree(relay, POLKADOT_TREASURY_ACCOUNTS.relay),
    systemFree(assetHub, POLKADOT_TREASURY_ACCOUNTS.assetHub),
    assetBalance(
      assetHub,
      USDT.assetHubId,
      POLKADOT_TREASURY_ACCOUNTS.assetHub,
    ),
    assetBalance(
      assetHub,
      USDC.assetHubId,
      POLKADOT_TREASURY_ACCOUNTS.assetHub,
    ),
    assetBalance(
      assetHub,
      USDT.assetHubId,
      POLKADOT_TREASURY_ACCOUNTS.legacyAssetHub,
    ),
    assetBalance(
      assetHub,
      USDC.assetHubId,
      POLKADOT_TREASURY_ACCOUNTS.legacyAssetHub,
    ),
    systemFree(assetHub, POLKADOT_FELLOWSHIP_ACCOUNTS.treasury),
    assetBalance(
      assetHub,
      USDT.assetHubId,
      POLKADOT_FELLOWSHIP_ACCOUNTS.salary,
    ),
    hydrationBalances(),
    bountiesBalance(),
  ]);

  const treasuryDot = relayNative + ahNative;
  const treasuryUsdt = ahUsdt + statemintUsdt;
  const treasuryUsdc = ahUsdc + statemintUsdc;
  const loansDot =
    OUTSTANDING_TREASURY_LOANS.bifrostDot +
    OUTSTANDING_TREASURY_LOANS.pendulumDot +
    OUTSTANDING_TREASURY_LOANS.hydrationDot;

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
  return Number(totals.totalNativeFree) / 10 ** DOT.decimals;
}

/** USDT total as a decimal number (6 decimals → USDT). */
export function totalUsdt(totals: TreasuryTotals): number {
  return Number(totals.totalUsdt) / 10 ** USDT.decimals;
}

/** USDC total as a decimal number (6 decimals → USDC). */
export function totalUsdc(totals: TreasuryTotals): number {
  return Number(totals.totalUsdc) / 10 ** USDC.decimals;
}

/** Current DOT/USD price (CoinGecko), or null when unavailable. */
export async function fetchDotUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd",
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const price = (data as { polkadot?: { usd?: number } })?.polkadot?.usd;
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}
