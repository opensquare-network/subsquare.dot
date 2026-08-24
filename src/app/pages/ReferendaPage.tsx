import { useState } from "react";
import { useSearchParams } from "react-router";
import { Card, Pagination, Tabs } from "../components/gov";
import { readFilter } from "../components/sections/referenda/filters";
import { ReferendaSection } from "../components/sections/referenda/ReferendaSection";
import { StatsGrid } from "../components/sections/StatsGrid";
import { useReferenda } from "../hooks/useReferenda";

/** Referenda list page backed by the SubSquare OpenGov API. */
export function ReferendaPage() {
  const [searchParams] = useSearchParams();
  const status = readFilter(searchParams);
  const [activeTab, setActiveTab] = useState<"referenda">("referenda");
  const { items, total, page, totalPages, setPage, loading, error } =
    useReferenda(status);

  return (
    <>
      <StatsGrid />
      <Tabs
        tabs={[{ value: "referenda", label: "Referenda" }]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {error ? (
        <Card className="p-8">
          <p className="text-center text-[12px] text-red-400 font-mono">
            Failed to load: {error}
          </p>
        </Card>
      ) : (
        <>
          <ReferendaSection items={items} total={total} loading={loading} />
          <div className="flex justify-center pt-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={loading}
            />
          </div>
        </>
      )}
    </>
  );
}
