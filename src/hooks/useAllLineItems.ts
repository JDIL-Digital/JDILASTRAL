"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbAnnexure, DbLineItem } from "@/types/database";

export interface LineItemsByAnnexure {
  annexureId: string;
  number: number;
  name: string;
  budget_usd: number;
  items: DbLineItem[];
  total_budget: number;
  total_actual: number;
}

interface UseAllLineItemsResult {
  grouped: LineItemsByAnnexure[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches every line_item under every annexure of a given project and
 * groups them by annexure. Used by the project summary page for the
 * top-3 breakdown cards and the Excel export's per-annexure sheets.
 *
 * Two queries, not three:
 *   1. annexures where project_id = …                (schema order)
 *   2. line_items where annexure_id in (…)
 *
 * The client-side group is cheap for the ~200 line-item scale we see
 * on a single project.
 */
export function useAllLineItems(projectId: string | null | undefined): UseAllLineItemsResult {
  const [grouped, setGrouped] = useState<LineItemsByAnnexure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setGrouped([]);
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
      const { data: annRows, error: annErr } = await client
        .from("annexures")
        .select("id, number, name, budget_usd")
        .eq("project_id", projectId)
        .order("number");
      if (annErr) throw annErr;

      type AnnexureLite = Pick<DbAnnexure, "id" | "number" | "name" | "budget_usd">;
      const annexures = (annRows ?? []) as unknown as AnnexureLite[];
      if (annexures.length === 0) {
        setGrouped([]);
        setError(null);
        setLoading(false);
        return;
      }

      const { data: liRows, error: liErr } = await client
        .from("line_items")
        .select("*")
        .in(
          "annexure_id",
          annexures.map((a) => a.id),
        )
        .order("sr_no", { ascending: true, nullsFirst: false });
      if (liErr) throw liErr;

      const lineItems = ((liRows ?? []) as unknown) as DbLineItem[];
      const byAnnexure = new Map<string, DbLineItem[]>();
      lineItems.forEach((li) => {
        if (!li.annexure_id) return;
        const arr = byAnnexure.get(li.annexure_id) ?? [];
        arr.push(li);
        byAnnexure.set(li.annexure_id, arr);
      });

      const result: LineItemsByAnnexure[] = annexures.map((a) => {
        const items = byAnnexure.get(a.id) ?? [];
        const total_budget = items.reduce(
          (s, i) => s + Number(i.budget_usd ?? 0),
          0,
        );
        const total_actual = items.reduce(
          (s, i) => s + Number(i.actual_usd_computed ?? 0),
          0,
        );
        return {
          annexureId: a.id,
          number: a.number,
          name: a.name,
          budget_usd: Number(a.budget_usd ?? 0),
          items,
          total_budget,
          total_actual,
        };
      });

      console.log("[useAllLineItems] annexures:", result.length);
      setGrouped(result);
      setError(null);
    } catch (e) {
      console.error("[useAllLineItems] error:", e);
      setError(e instanceof Error ? e.message : "Failed to load line items");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void fetch();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [fetch]);

  return { grouped, loading, error, refresh: fetch };
}
