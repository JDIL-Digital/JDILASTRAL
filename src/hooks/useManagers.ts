"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbProfile } from "@/types/database";

export interface Manager {
  id: string;
  name: string;
  email: string | null;
  role: DbProfile["role"];
}

interface UseManagersResult {
  managers: Manager[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches profiles whose role gates them to approve purchase orders:
 * `manager` and `csuite`. Falls back to an empty list when Supabase is
 * unreachable so the UI always renders.
 */
export function useManagers(): UseManagersResult {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManagers = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await client
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["manager", "csuite"])
        .order("full_name");
      if (err) throw err;
      const rows = (data ?? []) as unknown as DbProfile[];
      setManagers(
        rows.map((r) => ({
          id: r.id,
          name: r.full_name ?? r.email ?? "Unknown",
          email: r.email ?? null,
          role: r.role,
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManagers();
  }, [fetchManagers]);

  return { managers, loading, error, refresh: fetchManagers };
}
