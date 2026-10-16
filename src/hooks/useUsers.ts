"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbProfile } from "@/types/database";
import type { Role } from "@/lib/constants";

interface UseUsersResult {
  users: DbProfile[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateRole: (userId: string, role: Role) => Promise<DbProfile | null>;
  toggleActive: (userId: string, active: boolean) => Promise<DbProfile | null>;
}

/**
 * Lists every profile row in public.profiles for the Admin dashboard.
 * RLS caps who can read / write — only admin + csuite users will see
 * other users' rows and have the mutations succeed.
 */
export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<DbProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await client
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      console.log("[useUsers] loaded:", data?.length ?? 0);
      setUsers(((data ?? []) as unknown) as DbProfile[]);
      setError(null);
    } catch (e) {
      console.error("[useUsers] error:", e);
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const updateRole = useCallback<UseUsersResult["updateRole"]>(
    async (userId, role) => {
      const client = getSupabaseBrowserClient();
      if (!client) return null;
      const { data, error: err } = await (
        client.from("profiles") as unknown as {
          update: (v: { role: Role }) => {
            eq: (col: string, val: string) => {
              select: () => { single: () => Promise<{ data: DbProfile | null; error: unknown }> };
            };
          };
        }
      )
        .update({ role })
        .eq("id", userId)
        .select()
        .single();
      if (err) throw err;
      await fetch();
      return data;
    },
    [fetch],
  );

  const toggleActive = useCallback<UseUsersResult["toggleActive"]>(
    async (userId, active) => {
      const client = getSupabaseBrowserClient();
      if (!client) return null;
      const { data, error: err } = await (
        client.from("profiles") as unknown as {
          update: (v: { active: boolean }) => {
            eq: (col: string, val: string) => {
              select: () => { single: () => Promise<{ data: DbProfile | null; error: unknown }> };
            };
          };
        }
      )
        .update({ active })
        .eq("id", userId)
        .select()
        .single();
      if (err) throw err;
      await fetch();
      return data;
    },
    [fetch],
  );

  return { users, loading, error, refresh: fetch, updateRole, toggleActive };
}
