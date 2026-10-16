"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbRig } from "@/types/database";

interface UseRigsResult {
  rigs: DbRig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRigs(): UseRigsResult {
  const [rigs, setRigs] = useState<DbRig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRigs = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    const { data, error: err } = await client
      .from("rigs")
      .select("*")
      .order("name");

    if (err) {
      console.error("[useRigs] error:", err);
      setError(err.message);
    } else {
      console.log("[useRigs] loaded:", data?.length ?? 0);
      setRigs(((data ?? []) as unknown) as DbRig[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRigs();
  }, [fetchRigs]);

  // Re-fetch when auth lands so RLS-blocked initial reads get replaced.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void fetchRigs();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [fetchRigs]);

  return { rigs, loading, error, refresh: fetchRigs };
}

interface UseRigResult {
  rig: DbRig | null;
  projectsCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches one rig by id OR by slugified name. Both are supported because
 * dashboard URLs use slugified names ("jindal-star"), not uuids.
 */
export function useRig(rigIdOrSlug: string): UseRigResult {
  const [rig, setRig] = useState<DbRig | null>(null);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!rigIdOrSlug) {
      setLoading(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rigIdOrSlug,
      );

    let query = client.from("rigs").select("*").limit(1);
    if (isUuid) query = query.eq("id", rigIdOrSlug);
    else query = query.ilike("name", rigIdOrSlug.replace(/-/g, " "));

    const { data, error: err } = await query;
    if (err) {
      console.error("[useRig] error:", err);
      setError(err.message);
      setLoading(false);
      return;
    }

    const row = (((data ?? []) as unknown) as DbRig[])[0] ?? null;
    console.log("[useRig] loaded:", row?.name ?? "(not found)");
    setRig(row);

    if (row) {
      const { count, error: countErr } = await client
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("rig_id", row.id);
      if (countErr) console.warn("[useRig] projects count error:", countErr);
      setProjectsCount(count ?? 0);
    } else {
      setProjectsCount(0);
    }
    setLoading(false);
  }, [rigIdOrSlug]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { rig, projectsCount, loading, error, refresh: fetch };
}
