"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/constants";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  assigned_rig_id: string | null;
  avatar_url?: string | null;
  active?: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role: Role;
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

  /**
   * signUp — strict ordering:
   *   1. Validate inputs client-side (full name, email, password length,
   *      role within the allowed set).
   *   2. Call supabase.auth.signUp with the role embedded in user_metadata
   *      so the handle_new_user() trigger can read it if ever extended.
   *   3. Wait for success.
   *   4. UPDATE the profiles row the trigger just inserted with the
   *      chosen role + full_name (the trigger defaults role to 'engineer'
   *      and copies email as the name — we overwrite both).
   *   5. router.push('/fleet'). onAuthStateChange has already set state.
   */
  const signUp = async (
    input: SignUpInput,
  ): Promise<{ error: string | null }> => {
    const client = getSupabaseBrowserClient();
    if (!client) return { error: "Supabase not configured" };

    const { email, password, fullName, role } = input;

    // 1. Client-side validation
    if (!fullName.trim()) return { error: "Full name is required" };
    if (!email.trim()) return { error: "Email is required" };
    if (password.length < 8)
      return { error: "Password must be at least 8 characters" };
    const validRoles: Role[] = ["engineer", "manager", "csuite", "admin"];
    if (!validRoles.includes(role)) return { error: "Invalid role" };

    setState((s) => ({ ...s, loading: true, error: null }));

    // 2 + 3. Supabase sign-up
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (error) {
      console.error("[useAuth] signUp error:", error.message);
      setState((s) => ({ ...s, loading: false, error: error.message }));
      // Normalize the most common error so the UI can display it cleanly.
      const msg = /already registered|exists|duplicate/i.test(error.message)
        ? "An account with this email already exists."
        : error.message;
      return { error: msg };
    }

    if (!data.user) {
      setState((s) => ({ ...s, loading: false }));
      return { error: "Sign-up succeeded but no user returned" };
    }

    console.log("[useAuth] signUp success:", data.user.id);

    // 4. Overwrite the profile row created by the trigger with the
    // chosen role + name. Not required for session to land, but needed
    // for the UI to immediately reflect the choice.
    const { error: profErr } = await client
      .from("profiles")
      .update({ full_name: fullName, role })
      .eq("id", data.user.id);
    if (profErr) {
      // Non-fatal — the user is in and the trigger left a usable row.
      console.warn("[useAuth] profile upsert warning:", profErr.message);
    }

    // 5. Redirect — onAuthStateChange will refresh profile state.
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
    signUp,
    signOut,
    isAuthenticated: !!state.user,
  };
}
