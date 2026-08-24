import { ChevronRight, Clock, MessageSquare, Users } from "lucide-react";
import { type ReferendaRow } from "../../../api/referenda";
import { StatusBadge, TrackBadge, VoteBar } from "../../gov";
import AddressUser from "../../user/AddressUser";
import { DOT_PINK } from "../../../theme";
import { REFERENDA_GRID_COLUMNS } from "./columns";

const DETAIL_BASE = "https://polkadot.subsquare.io/referenda";

/** A single referenda list row linking out to the SubSquare detail page. */
export function ReferendaListItem({ item }: { item: ReferendaRow }) {
  return (
    <a
      href={`${DETAIL_BASE}/${item.id}`}
      target="_blank"
      rel="noreferrer"
      className="group grid items-center gap-3 px-4 py-3 rounded border border-border bg-card hover:border-foreground/15 transition-all"
      style={{ gridTemplateColumns: REFERENDA_GRID_COLUMNS }}
    >
      <span className="text-[11px] font-mono text-muted-foreground">
        #{item.id}
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
            (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
          }}
        >
          {item.title}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <TrackBadge track={item.track} color={item.trackColor} />
          <AddressUser
            add={item.author}
            showAvatar
            avatarSize="14px"
            maxWidth={140}
            needHref={false}
            className="text-[10px] text-muted-foreground"
          />
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MessageSquare size={9} /> {item.comments}
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="space-y-1">
        <VoteBar aye={item.aye} nay={item.nay} threshold={item.threshold} />
        <div className="flex justify-between text-[9px] font-mono">
          <span style={{ color: "#00d395" }}>{item.ayePct}%</span>
          <span style={{ color: "#ff4444" }}>{item.nayPct}%</span>
        </div>
      </div>

      <StatusBadge status={item.status} color={item.statusColor} />

      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
        <Clock size={9} />
        {item.updated}
      </div>

      <div className="flex justify-end">
        <ChevronRight
          size={12}
          className="text-muted-foreground group-hover:text-foreground transition-colors"
        />
      </div>
    </a>
  );
}
