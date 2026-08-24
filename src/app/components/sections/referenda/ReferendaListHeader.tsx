import { REFERENDA_GRID_COLUMNS } from "./columns";

/** Column header row for the referenda list. */
export function ReferendaListHeader() {
  return (
    <div
      className="grid text-[10px] text-muted-foreground uppercase tracking-widest font-mono px-4 pb-1 border-b border-border"
      style={{ gridTemplateColumns: REFERENDA_GRID_COLUMNS }}
    >
      <span>#</span>
      <span>Proposal</span>
      <span>Vote</span>
      <span>Status</span>
      <span>Updated</span>
      <span />
    </div>
  );
}
