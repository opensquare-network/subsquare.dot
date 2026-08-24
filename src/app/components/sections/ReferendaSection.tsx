import { useSearchParams } from "react-router";
import {
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Users,
} from "lucide-react";
import { DOT_PINK } from "../../theme";
import { filterTabs } from "../../data";
import { type ReferendaRow } from "../../api/referenda";
import { EmptyState, StatusBadge, TrackBadge, VoteBar } from "../gov";
import AddressUser from "../user/AddressUser";
import { formatNumber } from "../../lib/format";

const FILTER_PARAM = "status";
const DETAIL_BASE = "https://polkadot.subsquare.io/referenda";

/** Reads the status filter from the URL, falling back to "All". */
export function readFilter(searchParams: URLSearchParams): string {
  const value = searchParams.get(FILTER_PARAM);
  return value && filterTabs.includes(value) ? value : "All";
}

const PASSED_STATES = ["Confirmed", "Approved", "Executed"];
const REJECTED_STATES = [
  "Rejected",
  "Cancelled",
  "Killed",
  "TimedOut",
  "ConfirmAborted",
];

/** Map the API's raw status names to filter groups. */
function statusMatches(filter: string, status: string): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Deciding":
      return status === "Deciding" || status === "Ongoing";
    case "Confirming":
      return status === "Confirming" || status === "Confirmed";
    case "Queueing":
      return (
        status === "Queueing" ||
        status === "Preparing" ||
        status === "Submitted"
      );
    case "Passed":
      return PASSED_STATES.includes(status);
    case "Rejected":
      return REJECTED_STATES.includes(status);
    default:
      return status === filter;
  }
}

/** Referenda list with status filter chips (synced to the URL) and rows. */
export function ReferendaSection({
  items,
  total,
  loading = false,
}: {
  items: ReferendaRow[];
  total: number;
  loading?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = readFilter(searchParams);

  const setActiveFilter = (filter: string) => {
    const next = new URLSearchParams(searchParams);
    if (filter === "All") {
      next.delete(FILTER_PARAM);
    } else {
      next.set(FILTER_PARAM, filter);
    }
    setSearchParams(next);
  };

  const filtered = items.filter((r) => statusMatches(activeFilter, r.status));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {filterTabs.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className="px-3 py-1 rounded-full text-[11px] font-mono transition-colors"
            style={
              activeFilter === f
                ? {
                    background: `${DOT_PINK}18`,
                    border: `1px solid ${DOT_PINK}50`,
                    color: DOT_PINK,
                  }
                : {
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }
            }
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {formatNumber(total)} referenda
        </span>
      </div>

      <div className="grid gap-2">
        <div
          className="grid text-[10px] text-muted-foreground uppercase tracking-widest font-mono px-4 pb-1 border-b border-border"
          style={{
            gridTemplateColumns: "2.5rem 1fr 7rem 6rem 5rem 3rem",
          }}
        >
          <span>#</span>
          <span>Proposal</span>
          <span>Vote</span>
          <span>Status</span>
          <span>Updated</span>
          <span />
        </div>

        {items.length > 0 &&
          filtered.map((ref) => (
            <a
              key={ref.id}
              href={`${DETAIL_BASE}/${ref.id}`}
              target="_blank"
              rel="noreferrer"
              className="group grid items-center gap-3 px-4 py-3 rounded border border-border bg-card hover:border-foreground/15 transition-all"
              style={{
                gridTemplateColumns: "2.5rem 1fr 7rem 6rem 5rem 3rem",
              }}
            >
              <span className="text-[11px] font-mono text-muted-foreground">
                #{ref.id}
              </span>

              {/* Title + meta */}
              <div className="min-w-0">
                <div
                  className="text-[12px] font-medium leading-snug mb-1.5 transition-colors"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = DOT_PINK;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--foreground)";
                  }}
                >
                  {ref.title}
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <TrackBadge track={ref.track} color={ref.trackColor} />
                  <AddressUser
                    add={ref.author}
                    showAvatar
                    avatarSize="14px"
                    maxWidth={140}
                    needHref={false}
                    className="text-[10px] text-muted-foreground"
                  />
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageSquare size={9} /> {ref.comments}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users size={9} /> {ref.votes}
                  </span>
                </div>
              </div>

              {/* Vote bar */}
              <div className="space-y-1">
                <VoteBar
                  aye={ref.aye}
                  nay={ref.nay}
                  threshold={ref.threshold}
                />
                <div className="flex justify-between text-[9px] font-mono">
                  <span style={{ color: "#00d395" }}>{ref.ayePct}%</span>
                  <span style={{ color: "#ff4444" }}>{ref.nayPct}%</span>
                </div>
              </div>

              <StatusBadge status={ref.status} color={ref.statusColor} />

              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <Clock size={9} />
                {ref.updated}
              </div>

              <div className="flex justify-end">
                <ChevronRight
                  size={12}
                  className="text-muted-foreground group-hover:text-foreground transition-colors"
                />
              </div>
            </a>
          ))}
        {loading && items.length === 0 && (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <EmptyState message="No referenda found" />
        )}
      </div>
    </div>
  );
}
