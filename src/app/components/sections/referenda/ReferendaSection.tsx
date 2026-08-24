import { useSearchParams } from "react-router";
import { type ReferendaRow } from "../../../api/referenda";
import { ReferendaFilterBar } from "./ReferendaFilterBar";
import { ReferendaList } from "./ReferendaList";
import { FILTER_PARAM, readFilter, statusMatches } from "./filters";

/** Referenda section layout: status filter bar + list block. */
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
      <ReferendaFilterBar
        activeFilter={activeFilter}
        onChange={setActiveFilter}
        total={total}
      />
      <ReferendaList items={filtered} loading={loading} />
    </div>
  );
}
