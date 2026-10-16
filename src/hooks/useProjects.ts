"use client";

import { useCallback, useEffect, useState } from "react";
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

    let query = client
      .from("projects")
      .select("*, rigs(name, status, photo_url)")
      .order("created_at", { ascending: false });
    if (rigId) query = query.eq("rig_id", rigId);

    const { data, error: err } = await query;
    if (err) {
      console.error("[useProjects] error:", err);
      setError(err.message);
    } else {
      console.log("[useProjects] loaded:", data?.length ?? 0);
      setProjects(((data ?? []) as unknown) as ProjectWithRig[]);
      setError(null);
    }
    setLoading(false);
  }, [rigId]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Re-fetch when auth lands so RLS-blocked initial reads get replaced.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void fetchProjects();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [fetchProjects]);

  return { projects, loading, error, refresh: fetchProjects };
}
