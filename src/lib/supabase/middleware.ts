/**
 * Edge-middleware Supabase helper — uses @supabase/ssr.
 *
 * NOT WIRED INTO src/middleware.ts BY DEFAULT.
 *
 * The active middleware at src/middleware.ts is a pure pass-through so the
 * app never gets stuck in an auth-redirect loop while Supabase environment
 * variables and the users table are still being provisioned. When you're
 * ready to gate the dashboard behind a real session, replace the body of
 * src/middleware.ts with a call to `updateSession()` below.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  "";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Env not configured — skip auth refresh and let the request through.
    return response;
  }

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Refresh the access token if a session exists. Errors are swallowed —
  // auth gating belongs in the page/route handler, not the middleware.
  await supabase.auth.getUser().catch(() => undefined);

  return response;
}
