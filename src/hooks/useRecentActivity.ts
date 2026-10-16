"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbAnnexure, DbLineItem } from "@/types/database";

export interface RecentActivityItem {
  id: string;
  description: string;
  annexure_number: number;
  annexure_name: string;
  actual_usd_computed: number;
  budget_usd: number;
  updated_at: string;
  status: DbLineItem["status"];
}

interface UseRecentActivityResult {
  activity: RecentActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Returns the 10 most-recently-updated line items across every annexure
 * of every project tied to `rigId`.
 *
 * Done in three sequential queries instead of a single PostgREST embed
 * because filtering on two-level embedded columns (`annexures.projects.rig_id`)
 * is fragile across @supabase/ssr versions and sometimes falls back to
 * `never` typing. Three cheap round trips are both easier to reason
 * about and robust under RLS.
 */
export function useRecentActivity(rigId: string | null | undefined): UseRecentActivityResult {
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!rigId) {
      setActivity([]);
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
      // 1. Projects under this rig.
      const { data: projRows, error: projErr } = await client
        .from("projects")
        .select("id")
        .eq("rig_id", rigId);
      if (projErr) throw projErr;
      const projectIds = ((projRows ?? []) as unknown as Array<{ id: string }>).map(
        (p) => p.id,
      );
      if (projectIds.length === 0) {
        setActivity([]);
        setLoading(false);
        return;
      }

      // 2. Annexures for those projects.
      const { data: annRows, error: annErr } = await client
        .from("annexures")
        .select("id, number, name")
        .in("project_id", projectIds);
      if (annErr) throw annErr;
      type AnnexureLite = Pick<DbAnnexure, "id" | "number" | "name">;
      const annexures = (annRows ?? []) as unknown as AnnexureLite[];
      const annexureById = new Map(annexures.map((a) => [a.id, a]));
      if (annexures.length === 0) {
        setActivity([]);
        setLoading(false);
        return;
      }

      // 3. Last 10 updated line items in those annexures.
      const { data: liRows, error: liErr } = await client
        .from("line_items")
        .select(
          "id, description, annexure_id, budget_usd, actual_usd_computed, updated_at, status",
        )
        .in(
          "annexure_id",
          annexures.map((a) => a.id),
        )
        .order("updated_at", { ascending: false })
        .limit(10);
      if (liErr) throw liErr;

      type LineItemLite = Pick<
        DbLineItem,
        | "id"
        | "description"
        | "annexure_id"
        | "budget_usd"
        | "actual_usd_computed"
        | "updated_at"
        | "status"
      >;
      const items = ((liRows ?? []) as unknown as LineItemLite[]).map<RecentActivityItem>(
        (li) => {
          const ann = li.annexure_id ? annexureById.get(li.annexure_id) : undefined;
          return {
            id: li.id,
            description: li.description ?? "",
            annexure_number: ann?.number ?? 0,
            annexure_name: ann?.name ?? "—",
            budget_usd: Number(li.budget_usd ?? 0),
            actual_usd_computed: Number(li.actual_usd_computed ?? 0),
            updated_at: li.updated_at,
            status: li.status,
          };
        },
      );

      console.log("[useRecentActivity] loaded:", items.length);
      setActivity(items);
      setError(null);
    } catch (e) {
      console.error("[useRecentActivity] error:", e);
      setError(e instanceof Error ? e.message : "Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Refetch when auth lands.
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

  return { activity, loading, error, refresh: fetch };
}
