"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@/types";
import type { Role, RigName } from "@/lib/constants";

const SIGNIN_TIMEOUT_MS = 2500;

const DEMO_USER: User = {
  id: "demo-user",
  email: "ops.lead@jindaldrilling.com",
  full_name: "Akshay Manjramkar",
  role: "manager",
  rig_access: null,
  avatar_url: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/**
 * Race a promise against a timeout — used to keep sign-in snappy even
 * when the Supabase endpoint is unreachable or the auth table is
 * unprovisioned. Both outcomes resolve in ≤ SIGNIN_TIMEOUT_MS so the
 * login button never spins for 8 + seconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "__timeout__"> {
  return Promise.race([
    promise,
    new Promise<"__timeout__">((resolve) => setTimeout(() => resolve("__timeout__"), ms)),
  ]);
}

export function useAuth(): AuthState {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the cached demo user synchronously to avoid an auth flash.
  useEffect(() => {
    let mounted = true;

    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("jsil:demo-user");
        if (stored) setUser(JSON.parse(stored) as User);
      } catch {
        /* ignore */
      }
    }

    // Probe Supabase for an existing session in the background. If it
    // times out we leave the demo user (or null) in place — the UI is
    // already interactive.
    (async () => {
      try {
        const client = getSupabaseBrowserClient();
        if (!client) return;
        const result = await withTimeout(client.auth.getUser(), SIGNIN_TIMEOUT_MS);
        if (!mounted) return;
        if (result !== "__timeout__" && result.data.user) {
          const u = result.data.user;
          const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
          setUser({
            id: u.id,
            email: u.email ?? "",
            full_name: (meta.full_name as string | undefined) ?? u.email ?? "User",
            role: ((meta.role as Role | undefined) ?? "manager") as Role,
            rig_access: (meta.rig_access as RigName[] | null | undefined) ?? null,
            avatar_url: (meta.avatar_url as string | undefined) ?? null,
            created_at: u.created_at ?? new Date().toISOString(),
            updated_at: u.updated_at ?? new Date().toISOString(),
          });
        }
      } catch {
        /* env not configured — fine */
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Optimistic — store the demo user immediately so the navigation
      // we kick off next has someone to render.
      const fallback: User = { ...DEMO_USER, email };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jsil:demo-user", JSON.stringify(fallback));
      }
      setUser(fallback);

      // Kick off prefetched navigation immediately. router.push is
      // non-blocking — it returns before the new route paints.
      router.push("/fleet");

      // Try Supabase in the background. If it succeeds within the
      // timeout window we upgrade the cached user; otherwise we stay
      // on the demo profile. Either way the user sees the dashboard
      // within a few hundred ms.
      try {
        const client = getSupabaseBrowserClient();
        if (!client) return { error: null }; // stay on demo — env not configured
        const result = await withTimeout(
          client.auth.signInWithPassword({ email, password }),
          SIGNIN_TIMEOUT_MS,
        );
        if (result === "__timeout__") return { error: null };
        const { data, error } = result;
        if (error || !data.user) return { error: null }; // stay on demo
        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        setUser({
          id: data.user.id,
          email: data.user.email ?? email,
          full_name: (meta.full_name as string | undefined) ?? email,
          role: ((meta.role as Role | undefined) ?? "manager") as Role,
          rig_access: (meta.rig_access as RigName[] | null | undefined) ?? null,
          avatar_url: (meta.avatar_url as string | undefined) ?? null,
          created_at: data.user.created_at ?? new Date().toISOString(),
          updated_at: data.user.updated_at ?? new Date().toISOString(),
        });
        return { error: null };
      } catch {
        return { error: null }; // already on demo
      }
    },
    [router],
  );

  const signOut = useCallback(async () => {
    try {
      const client = getSupabaseBrowserClient();
      if (client) {
        await withTimeout(client.auth.signOut(), 1500);
      }
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("jsil:demo-user");
    }
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, loading, signIn, signOut };
}
