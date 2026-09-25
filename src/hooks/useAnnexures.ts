"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbAnnexure, DbLineItem } from "@/types/database";

export interface AnnexureWithTotals extends DbAnnexure {
  total_budget: number;   // sum of line_items.budget_usd
  total_actual: number;   // sum of line_items.actual_usd_computed
  variance: number;       // total_budget - total_actual
  line_count: number;
}

interface UseAnnexuresResult {
  annexures: AnnexureWithTotals[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches annexures for a project AND rolls up line-item totals.
 *
 * We fetch annexures + line_items in a single embedded query, then
 * aggregate client-side — for ≤ 11 annexures × ~30 line items each,
 * this beats round-tripping to a database RPC and keeps the data
 * shape predictable.
 */
export function useAnnexures(projectId: string | null | undefined): UseAnnexuresResult {
  const [annexures, setAnnexures] = useState<AnnexureWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnexures = useCallback(async () => {
    if (!projectId) {
      setAnnexures([]);
      setLoading(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await client
        .from("annexures")
        .select("*, line_items(budget_usd, actual_usd_computed)")
        .eq("project_id", projectId)
        .order("number");
      if (err) throw err;
      type AnnexureRowWithLines = DbAnnexure & {
        line_items?: Pick<DbLineItem, "budget_usd" | "actual_usd_computed">[];
      };
      const rows = (data ?? []) as unknown as AnnexureRowWithLines[];
      const rolled: AnnexureWithTotals[] = rows.map((row) => {
        const lines = row.line_items ?? [];
        const total_budget = lines.reduce((s, l) => s + Number(l.budget_usd ?? 0), 0);
        const total_actual = lines.reduce(
          (s, l) => s + Number(l.actual_usd_computed ?? 0),
          0,
        );
        return {
          id: row.id,
          project_id: row.project_id,
          number: row.number,
          name: row.name,
          budget_usd: row.budget_usd,
          created_at: row.created_at,
          total_budget,
          total_actual,
          variance: total_budget - total_actual,
          line_count: lines.length,
        };
      });
      setAnnexures(rolled);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load annexures");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchAnnexures();
  }, [fetchAnnexures]);

  return useMemo(
    () => ({ annexures, loading, error, refresh: fetchAnnexures }),
    [annexures, loading, error, fetchAnnexures],
  );
}

/**
 * Single-annexure lookup — used by the annexure detail page.
 * Accepts either uuid, slugified code (e.g. "anx-a"), or slugified name.
 */
export function useAnnexure(
  projectId: string,
  annexureIdOrSlug: string,
): {
  annexure: AnnexureWithTotals | null;
  loading: boolean;
  error: string | null;
} {
  const { annexures, loading, error } = useAnnexures(projectId);
  const annexure = useMemo(() => {
    if (!annexureIdOrSlug) return null;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        annexureIdOrSlug,
      );
    if (isUuid) return annexures.find((a) => a.id === annexureIdOrSlug) ?? null;
    const wanted = annexureIdOrSlug.toLowerCase().replace(/-/g, " ");
    return (
      annexures.find((a) => a.name.toLowerCase() === wanted) ??
      annexures.find((a) => `annexure ${a.number}` === wanted) ??
      annexures.find((a) => String(a.number) === annexureIdOrSlug) ??
      null
    );
  }, [annexures, annexureIdOrSlug]);
  return { annexure, loading, error };
}
