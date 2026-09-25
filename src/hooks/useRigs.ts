"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerRealtimeChannel } from "@/hooks/useRealtimeStatus";
import type { DbRig } from "@/types/database";

interface UseRigsResult {
  rigs: DbRig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches all rigs from public.rigs and subscribes to postgres_changes
 * so the fleet grid updates instantly when a rig row is inserted,
 * updated, or deleted.
 */
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
    try {
      const { data, error: err } = await client
        .from("rigs")
        .select("*")
        .order("name");
      if (err) throw err;
      setRigs(data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rigs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRigs();
  }, [fetchRigs]);

  // Realtime subscription
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const channel = client
      .channel("rigs-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rigs" },
        () => {
          void fetchRigs();
        },
      )
      .subscribe();

    const unregister = registerRealtimeChannel("rigs");

    return () => {
      unregister();
      void client.removeChannel(channel);
    };
  }, [fetchRigs]);

  return { rigs, loading, error, refresh: fetchRigs };
}
