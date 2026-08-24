import { Loader2 } from "lucide-react";
import { type ReferendaRow } from "../../../api/referenda";
import { EmptyState } from "../../gov";
import { ReferendaListHeader } from "./ReferendaListHeader";
import { ReferendaListItem } from "./ReferendaListItem";

/** Referenda list container: header, rows, and loading / empty states. */
export function ReferendaList({
  items,
  loading = false,
}: {
  items: ReferendaRow[];
  loading?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <ReferendaListHeader />

      {items.length > 0 &&
        items.map((item) => <ReferendaListItem key={item.id} item={item} />)}

      {loading && items.length === 0 && (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState message="No referenda found" />
      )}
    </div>
  );
}
