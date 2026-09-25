"use client";

/**
 * Browser Supabase client.
 *
 * Uses the plain `@supabase/supabase-js` createClient — no auth-helpers and no
 * @supabase/ssr cookie wiring on this side. That keeps the bundle small,
 * avoids the historical "Cannot find module './vendor-chunks/@supabase.js'"
 * error that surfaced when auth-helpers tried to require a Next.js vendor
 * chunk path that did not exist at runtime, and gives us a single,
 * cacheable client instance for the whole tab.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  "";

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cached) return cached;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  cached = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window === "undefined" ? undefined : window.localStorage,
    },
  });
  return cached;
}
