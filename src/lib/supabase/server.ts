/**
 * Server Supabase client — @supabase/ssr for Next 16.
 *
 * Use this from Server Components, Route Handlers, and Server Actions.
 * In Next 16, `cookies()` from `next/headers` is asynchronous — every
 * factory below is `async` accordingly.
 *
 * NEVER import from a "use client" module — depends on `next/headers`,
 * which is server-only.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

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
 * For use inside Server Components (RSC). In RSC the cookieStore is
 * read-only — `setAll` swallows write errors so Supabase can still
 * attempt token refresh without crashing the render.
 */
export async function getSupabaseServerClient() {
  assertEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component render — writes not allowed. */
        }
      },
    },
  });
}

/**
 * For use inside Route Handlers and Server Actions — where cookies are
 * writable and Supabase can refresh & persist new auth tokens.
 */
export async function getSupabaseRouteClient() {
  assertEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });
}
