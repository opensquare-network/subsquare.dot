/**
 * SubSquare OpenGov API client.
 * Data source: https://polkadot-api.subsquare.io/gov2/referendums?simple=1
 * Field mapping follows polkadot-referenda's api.ts and the fields SubSquare consumes.
 */
import { compact, startCase, timeAgo, toBigInt } from "../lib/format";

export const API_BASE = "https://polkadot-api.subsquare.io";

export interface ReferendumIndexer {
  blockHeight: number;
  blockHash: string;
  /** Millisecond timestamp. */
  blockTime: number;
}

export interface Tally {
  ayes: string | number;
  nays: string | number;
  support?: string | number;
  electorate?: string | number;
}

export interface ReferendumState {
  name: string;
  indexer?: ReferendumIndexer;
  args?: { tally?: Tally; result?: { ok?: unknown; err?: unknown } };
}

export interface ReferendumListItem {
  _id: string;
  referendumIndex: number;
  title: string | null;
  proposer: string;
  track: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  state: ReferendumState;
  contentSummary: { summary?: string } | null;
  commentsCount: number | null;
  onchainData?: {
    track?: number;
    trackInfo?: { id: number; name: string };
    state?: ReferendumState;
    tally?: Tally;
    info?: { tally?: Tally };
    proposal?: { section?: string; method?: string };
  };
}

export interface ReferendumsResponse {
  items: ReferendumListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FetchReferendumsParams {
  page?: number;
  pageSize?: number;
  /** Concrete status name (e.g. "Deciding") for server-side filtering. */
  status?: string;
}

/** Filter tab → API status name mapping. Groups without a single status (e.g. Passed) are omitted and grouped on the client. */
export const API_STATUS_BY_TAB: Record<string, string | undefined> = {
  Deciding: "Deciding",
  Confirming: "Confirming",
  Queueing: "Queueing",
  Rejected: "Rejected",
};

export async function fetchReferendums({
  page = 1,
  pageSize = 20,
  status,
}: FetchReferendumsParams = {}): Promise<ReferendumsResponse> {
  const url = new URL(`${API_BASE}/gov2/referendums`);
  url.searchParams.set("simple", "1");
  url.searchParams.set("page", String(page));
  // The API expects snake_case page_size (camelCase pageSize is ignored).
  url.searchParams.set("page_size", String(pageSize));
  if (status) {
    url.searchParams.set("status", status);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return (await res.json()) as ReferendumsResponse;
}

/** List item status (prefers onchainData.state, falls back to top-level state). */
export function stateOf(item: ReferendumListItem): ReferendumState {
  return item.onchainData?.state ?? item.state;
}

/** List item tally: onchainData.tally → info.tally → state.args.tally. */
export function tallyOf(item: ReferendumListItem): Tally | undefined {
  return (
    item.onchainData?.tally ??
    item.onchainData?.info?.tally ??
    item.state.args?.tally
  );
}

/** Track display name: trackInfo.name (snake_case) → "Small Spender". */
export function trackNameOf(item: ReferendumListItem): string {
  const raw = item.onchainData?.trackInfo?.name;
  return raw ? startCase(raw) : `Track ${item.track}`;
}

/** List item title: uses title when present, otherwise "[TrackName] Referendum #N". */
export function titleOf(item: ReferendumListItem): string {
  return (
    item.title ?? `[${trackNameOf(item)}] Referendum #${item.referendumIndex}`
  );
}

type BadgeTone = "azure" | "blue" | "green" | "orange" | "red" | "neutral";

const TONE: Record<string, BadgeTone> = {
  Submitted: "azure",
  Preparing: "azure",
  Queueing: "orange",
  Deciding: "blue",
  Ongoing: "blue",
  Confirming: "green",
  Confirmed: "green",
  Approved: "green",
  Executed: "green",
  DecisionDepositPlaced: "green",
  DecisionStarted: "green",
  ConfirmStarted: "green",
  Cancelled: "red",
  Killed: "red",
  Rejected: "red",
  ConfirmAborted: "red",
  TimedOut: "neutral",
  Timeout: "neutral",
};

const TONE_COLOR: Record<BadgeTone, string> = {
  azure: "#00b2ff",
  blue: "#E6007A",
  green: "#00d395",
  orange: "#ff9500",
  red: "#ff4444",
  neutral: "#7a7a8a",
};

function toneForState(
  name: string,
  result?: { ok?: unknown; err?: unknown },
): BadgeTone {
  if (name === "Executed" && result && !("ok" in result)) return "red";
  return TONE[name] ?? "neutral";
}

export function statusColorOf(item: ReferendumListItem): string {
  const state = stateOf(item);
  return TONE_COLOR[toneForState(state.name, state.args?.result)];
}

const TRACK_PALETTE = ["#7b3fe4", "#E6007A", "#00b2ff", "#ff9500", "#00d395"];

function trackColorOf(item: ReferendumListItem): string {
  return TRACK_PALETTE[(item.track ?? 0) % TRACK_PALETTE.length]!;
}

/** Row UI model (aligned with the fields ReferendaSection consumes). */
export interface ReferendaRow {
  id: number;
  title: string;
  track: string;
  trackColor: string;
  status: string;
  statusColor: string;
  aye: number;
  nay: number;
  ayePct: number;
  nayPct: number;
  threshold: number;
  updated: string;
  author: string;
  comments: number;
  /** Support amount (compact DOT, e.g. "3.5M"). */
  votes: string;
}

export function toRow(item: ReferendumListItem): ReferendaRow {
  const state = stateOf(item);
  const tally = tallyOf(item);
  const ayes = Number(toBigInt(tally?.ayes) / 10n ** 10n);
  const nays = Number(toBigInt(tally?.nays) / 10n ** 10n);
  const total = ayes + nays;
  const ayePct = total > 0 ? Number(((ayes / total) * 100).toFixed(1)) : 0;
  const nayPct = total > 0 ? Number((100 - ayePct).toFixed(1)) : 0;

  return {
    id: item.referendumIndex,
    title: titleOf(item),
    track: trackNameOf(item),
    trackColor: trackColorOf(item),
    status: state.name,
    statusColor: statusColorOf(item),
    aye: ayePct,
    nay: nayPct,
    ayePct,
    nayPct,
    threshold: 50,
    updated: timeAgo(item.updatedAt ?? item.lastActivityAt ?? item.createdAt),
    author: item.proposer,
    comments: item.commentsCount ?? 0,
    votes: compact(total),
  };
}
