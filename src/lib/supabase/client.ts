"use client";

/**
 * Browser Supabase client — stored on globalThis.
 *
 * Why globalThis instead of a plain module-level `let`?
 *   Under Next 16 + Turbopack a module can be evaluated more than once
 *   per tab (HMR, strict-mode double-mount, server-component boundary
 *   crossings), and each evaluation creates a fresh `let` scope — so
 *   "module-level singleton" quietly becomes "two singletons" and
 *   whichever one holds the session wins. globalThis bypasses the
 *   module cache entirely: the first create wins forever.
 */

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

declare global {
  // eslint-disable-next-line no-var
  var __supabase_client:
    | ReturnType<typeof createBrowserClient>
    | undefined;
}

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  if (!globalThis.__supabase_client) {
    globalThis.__supabase_client = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    );
    console.log("[Supabase] singleton created");
  }

  return globalThis.__supabase_client;
}

export const isSupabaseConfigured = () =>
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
