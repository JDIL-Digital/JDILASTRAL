"use client";

/**
 * Browser Supabase client — singleton, env-safe.
 *
 * Uses @supabase/ssr's createBrowserClient so the same cookie jar is
 * shared with the server helpers in ./server.ts and ./middleware.ts.
 *
 * If the env vars are missing (or blank) we return `null` instead of
 * throwing — every hook checks this and surfaces a friendly error so
 * the app never crashes on a misconfigured deploy.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Infer the concrete client type from the factory — @supabase/ssr's return
// type carries the PostgrestVersion generic that plain SupabaseClient<Database>
// no longer matches, so a bare alias breaks .from().select() inference.
export type ForgeSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let cached: ForgeSupabaseClient | null = null;
let missingReported = false;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient(): ForgeSupabaseClient | null {
  if (cached) return cached;

  if (!isSupabaseConfigured()) {
    if (!missingReported && typeof window !== "undefined") {
      missingReported = true;
      // eslint-disable-next-line no-console
      console.error(
        "[JSIL·ASTRAL] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing — the app will run in a degraded (no-data) state.",
      );
    }
    return null;
  }

  cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}

export function requireSupabaseBrowserClient(): ForgeSupabaseClient {
  const c = getSupabaseBrowserClient();
  if (!c) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return c;
}
