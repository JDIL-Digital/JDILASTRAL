"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbRig } from "@/types/database";

interface UseRigResult {
  rig: DbRig | null;
  projectsCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches a single rig by id OR by url-safe slug/name match — the
 * dashboard uses slugified names in URLs, so we fall back to a
 * case-insensitive name lookup when the parameter isn't a uuid.
 */
export function useRig(rigIdOrSlug: string): UseRigResult {
  const [rig, setRig] = useState<DbRig | null>(null);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRig = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          rigIdOrSlug,
        );
      let query = client.from("rigs").select("*").limit(1);

      if (isUuid) {
        query = query.eq("id", rigIdOrSlug);
      } else {
        // Rig names in URLs are slug form ("jindal-star"); DB stores
        // display form ("Jindal Star"). Match case-insensitively.
        const searchName = rigIdOrSlug.replace(/-/g, " ");
        query = query.ilike("name", searchName);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      const rows = (data ?? []) as unknown as DbRig[];
      const found = rows[0] ?? null;
      setRig(found);

      if (found) {
        const { count, error: countErr } = await client
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("rig_id", found.id);
        if (countErr) throw countErr;
        setProjectsCount(count ?? 0);
      } else {
        setProjectsCount(0);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rig");
    } finally {
      setLoading(false);
    }
  }, [rigIdOrSlug]);

  useEffect(() => {
    void fetchRig();
  }, [fetchRig]);

  return { rig, projectsCount, loading, error, refresh: fetchRig };
}
