import { useEffect, useState } from "react";
import {
  API_STATUS_BY_TAB,
  fetchReferendums,
  toRow,
  type ReferendaRow,
} from "../api/referenda";

const PAGE_SIZE = 20;

interface UseReferendaResult {
  items: ReferendaRow[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches paginated referenda lists (SubSquare API) with loading / error state.
 * `status` is the filter tab value; the API filters server-side when it maps to a concrete status name.
 */
export function useReferenda(status: string): UseReferendaResult {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReferendaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serverStatus = API_STATUS_BY_TAB[status];

  // Clear the list and reset to page 1 on filter change; keep old rows while paging and replace them once the request completes.
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(1);
  }, [serverStatus]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchReferendums({ page, pageSize: PAGE_SIZE, status: serverStatus })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items.map(toRow));
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, serverStatus]);

  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    setPage,
    loading,
    error,
  };
}
