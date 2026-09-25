/**
 * Server Supabase client — uses @supabase/ssr.
 *
 * Use this from Server Components, Route Handlers, and Server Actions.
 * The cookie adapter wires Supabase's auth tokens through Next.js's
 * cookies() API so SSR can read sessions established in the browser.
 *
 * NEVER import this file from a "use client" module — it depends on
 * `next/headers`, which is server-only.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  "";

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
}

/**
 * Use inside Server Components (RSC). The cookieStore is read-only here,
 * so set/remove are no-ops — Supabase will refresh tokens via the
 * middleware/route-handler clients instead.
 */
export function getSupabaseServerClient() {
  assertEnv();
  const cookieStore = cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {
        // RSC has no write access to cookies — intentional no-op.
      },
      remove(_name: string, _options: CookieOptions) {
        // RSC has no write access to cookies — intentional no-op.
      },
    },
  });
}

/**
 * Use inside Route Handlers and Server Actions. Cookies are writable
 * here, so Supabase can refresh and persist new auth tokens.
 */
export function getSupabaseRouteClient() {
  assertEnv();
  const cookieStore = cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component context — skip silently.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Called from a Server Component context — skip silently.
        }
      },
    },
  });
}
