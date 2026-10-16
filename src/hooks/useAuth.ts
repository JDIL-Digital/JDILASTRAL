"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "engineer" | "manager" | "csuite";
  assigned_rig_id: string | null;
  avatar_url?: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("[useAuth] profile fetch error:", error.message);
      return null;
    }
    console.log("[useAuth] profile:", data);
    return data as Profile;
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Get initial session
    client.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          loading: false,
          error: null,
        });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      console.log("[useAuth] event:", event);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          loading: false,
          error: null,
        });
      } else {
        setState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return { error: "Supabase not configured" };

    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[useAuth] signIn error:", error.message);
      setState((s) => ({ ...s, loading: false, error: error.message }));
      return { error: error.message };
    }

    console.log("[useAuth] signIn success:", data.user?.id);
    // onAuthStateChange will handle state update
    router.push("/fleet");
    return { error: null };
  };

  const signOut = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    router.push("/login");
  };

  return {
    user: state.user,
    profile: state.profile,
    role: state.profile?.role ?? ("engineer" as const),
    loading: state.loading,
    error: state.error,
    signIn,
    signOut,
    isAuthenticated: !!state.user,
  };
}
