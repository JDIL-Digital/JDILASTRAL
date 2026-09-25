"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbProject, DbRig } from "@/types/database";

export type ProjectWithRig = DbProject & {
  rigs: Pick<DbRig, "name" | "status" | "photo_url"> | null;
};

interface UseProjectsResult {
  projects: ProjectWithRig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches all projects with rig data joined via PostgREST embedding.
 * Optional `rigId` filter — when supplied, only returns projects for
 * that rig.
 */
export function useProjects(rigId?: string | null): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectWithRig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      let q = client
        .from("projects")
        .select("*, rigs(name, status, photo_url)")
        .order("created_at", { ascending: false });
      if (rigId) q = q.eq("rig_id", rigId);
      const { data, error: err } = await q;
      if (err) throw err;
      setProjects((data ?? []) as ProjectWithRig[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [rigId]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return useMemo(
    () => ({ projects, loading, error, refresh: fetchProjects }),
    [projects, loading, error, fetchProjects],
  );
}
