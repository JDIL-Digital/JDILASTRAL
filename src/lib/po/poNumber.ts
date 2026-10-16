"use client";

/**
 * PO number allocator — thin wrapper around the `get_next_po_number()`
 * Postgres function (see supabase/migrations/002_po_sequence.sql).
 *
 * Format: JDIL/IPO/YYYY/NNNNN
 *   - YYYY = current year
 *   - NNNNN = zero-padded sequence that resets each year
 *
 * Server-side generation guarantees uniqueness even with concurrent
 * clients because the RPC runs in a single transaction. When Supabase
 * is unreachable we fall back to a client-side timestamp-suffixed id
 * so the UI can still render a draft — it's clearly not production,
 * and the DB's unique constraint on `po_number` will reject it if
 * someone tries to persist it without an RPC call.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface NextPoNumber {
  number: string;
  source: "rpc" | "fallback";
}

function offlineFallback(): string {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString().slice(-5);
  return `JDIL/IPO/${year}/${stamp}`;
}

export async function getNextPoNumber(): Promise<NextPoNumber> {
  const client = getSupabaseBrowserClient();
  if (!client) return { number: offlineFallback(), source: "fallback" };

  try {
    const { data, error } = await (
      client as unknown as {
        rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>;
      }
    ).rpc("get_next_po_number");
    if (error || !data) return { number: offlineFallback(), source: "fallback" };
    return { number: String(data), source: "rpc" };
  } catch {
    return { number: offlineFallback(), source: "fallback" };
  }
}

/** Peek the current year's prefix without allocating — handy for placeholders. */
export function poNumberPrefix(): string {
  return `JDIL/IPO/${new Date().getFullYear()}/`;
}
