import { ChevronRight, Clock, MessageSquare } from "lucide-react";
import { type ReferendaRow } from "../../../api/referenda";
import { StatusBadge, TrackBadge, VoteBar } from "../../gov";
import AddressUser from "../../user/AddressUser";
import { DOT_PINK } from "../../../theme";
import { REFERENDA_GRID_COLUMNS } from "./columns";

const DETAIL_BASE = "https://polkadot.subsquare.io/referenda";

function ReferendaId({ id }: { id: number }) {
  return (
    <span className="text-[11px] font-mono text-muted-foreground">#{id}</span>
  );
}

function ReferendaTitle({
  title,
  track,
  trackColor,
  author,
  comments,
}: {
  title: string;
  track: string;
  trackColor: string;
  author: string;
  comments: number;
}) {
  return (
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
        {title}
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        <TrackBadge track={track} color={trackColor} />
        <AddressUser
          add={author}
          showAvatar
          avatarSize="14px"
          maxWidth={140}
          needHref={false}
          className="text-[10px] text-muted-foreground"
        />
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MessageSquare size={9} /> {comments}
        </span>
      </div>
    </div>
  );
}

function ReferendaVote({
  aye,
  nay,
  threshold,
  ayePct,
  nayPct,
}: {
  aye: number;
  nay: number;
  threshold: number;
  ayePct: number;
  nayPct: number;
}) {
  return (
    <div className="space-y-1">
      <VoteBar aye={aye} nay={nay} threshold={threshold} />
      <div className="flex justify-between text-[9px] font-mono">
        <span style={{ color: "#00d395" }}>{ayePct}%</span>
        <span style={{ color: "#ff4444" }}>{nayPct}%</span>
      </div>
    </div>
  );
}

function ReferendaStatus({ status, color }: { status: string; color: string }) {
  return <StatusBadge status={status} color={color} />;
}

function ReferendaUpdated({ updated }: { updated: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
      <Clock size={9} />
      {updated}
    </div>
  );
}

function ReferendaChevron() {
  return (
    <div className="flex justify-end">
      <ChevronRight
        size={12}
        className="text-muted-foreground group-hover:text-foreground transition-colors"
      />
    </div>
  );
}

export function ReferendaListItem({ item }: { item: ReferendaRow }) {
  return (
    <a
      href={`${DETAIL_BASE}/${item.id}`}
      target="_blank"
      rel="noreferrer"
      className="group grid items-center gap-3 px-4 py-3 rounded border border-border bg-card hover:border-foreground/15 transition-all"
      style={{ gridTemplateColumns: REFERENDA_GRID_COLUMNS }}
    >
      <ReferendaId id={item.id} />

      <ReferendaTitle
        title={item.title}
        track={item.track}
        trackColor={item.trackColor}
        author={item.author}
        comments={item.comments}
      />

      <ReferendaVote
        aye={item.aye}
        nay={item.nay}
        threshold={item.threshold}
        ayePct={item.ayePct}
        nayPct={item.nayPct}
      />

      <ReferendaStatus status={item.status} color={item.statusColor} />

      <ReferendaUpdated updated={item.updated} />

      <ReferendaChevron />
    </a>
  );
}
