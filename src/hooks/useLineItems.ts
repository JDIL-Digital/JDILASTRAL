"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerRealtimeChannel } from "@/hooks/useRealtimeStatus";
import type { Database, DbLineItem } from "@/types/database";

type LineItemInsert = Database["public"]["Tables"]["line_items"]["Insert"];
type LineItemUpdate = Database["public"]["Tables"]["line_items"]["Update"];

interface UseLineItemsResult {
  lineItems: DbLineItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addLineItem: (item: Omit<LineItemInsert, "annexure_id">) => Promise<DbLineItem | null>;
  updateLineItem: (id: string, patch: LineItemUpdate) => Promise<DbLineItem | null>;
  deleteLineItem: (id: string) => Promise<boolean>;
}

/**
 * Live line-item feed for a single annexure.
 *
 * Includes CRUD helpers that write to Supabase and return the affected
 * row so callers can drive toast notifications. All mutations trigger a
 * realtime broadcast which refreshes this hook (and any other consumer)
 * automatically.
 */
export function useLineItems(annexureId: string | null | undefined): UseLineItemsResult {
  const [lineItems, setLineItems] = useState<DbLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NOTE: no role gate — line items are readable to every authenticated
  // role. The only guard is the client existing.
  const fetchLineItems = useCallback(async () => {
    if (!annexureId) {
      setLineItems([]);
      setLoading(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await client
        .from("line_items")
        .select("*")
        .eq("annexure_id", annexureId)
        .order("sr_no", { ascending: true, nullsFirst: false });
      if (err) throw err;
      setLineItems(data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load line items");
    } finally {
      setLoading(false);
    }
  }, [annexureId]);

  useEffect(() => {
    void fetchLineItems();
  }, [fetchLineItems]);

  // Refetch when the auth session is established so RLS-blocked initial
  // reads get replaced with real data (fixes the "$0 after login" race).
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void fetchLineItems();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [fetchLineItems]);

  // Realtime — subscribe only to changes for this annexure.
  //
  // The channel name has a per-mount random suffix. Without it, React 19
  // strict-mode's double-mount would call .channel("line-items-X") twice,
  // and Supabase's channel registry returns the SAME singleton for a given
  // name — so the second .on() call fires on an already-subscribed instance
  // and throws "cannot add postgres_changes callbacks after subscribe()".
  // All .on() calls remain chained BEFORE .subscribe().
  useEffect(() => {
    if (!annexureId) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()).slice(2);

    const channel = client
      .channel(`line-items-${annexureId}-${nonce}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "line_items",
          filter: `annexure_id=eq.${annexureId}`,
        },
        () => {
          void fetchLineItems();
        },
      )
      .subscribe();

    const unregister = registerRealtimeChannel(`line-items:${annexureId}`);

    return () => {
      unregister();
      void client.removeChannel(channel);
    };
  }, [annexureId, fetchLineItems]);

  const addLineItem = useCallback<UseLineItemsResult["addLineItem"]>(
    async (item) => {
      if (!annexureId) return null;
      const client = getSupabaseBrowserClient();
      if (!client) return null;
      const payload = { ...item, annexure_id: annexureId } as LineItemInsert;
      const { data, error: err } = await (
        client.from("line_items") as unknown as {
          insert: (v: LineItemInsert) => {
            select: () => { single: () => Promise<{ data: DbLineItem | null; error: unknown }> };
          };
        }
      )
        .insert(payload)
        .select()
        .single();
      if (err) throw err;
      return data;
    },
    [annexureId],
  );

  const updateLineItem = useCallback<UseLineItemsResult["updateLineItem"]>(
    async (id, patch) => {
      const client = getSupabaseBrowserClient();
      if (!client) return null;
      const { data, error: err } = await (
        client.from("line_items") as unknown as {
          update: (v: LineItemUpdate) => {
            eq: (col: string, val: string) => {
              select: () => { single: () => Promise<{ data: DbLineItem | null; error: unknown }> };
            };
          };
        }
      )
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (err) throw err;
      return data;
    },
    [],
  );

  const deleteLineItem = useCallback<UseLineItemsResult["deleteLineItem"]>(
    async (id) => {
      const client = getSupabaseBrowserClient();
      if (!client) return false;
      const { error: err } = await client.from("line_items").delete().eq("id", id);
      if (err) throw err;
      return true;
    },
    [],
  );

  return {
    lineItems,
    loading,
    error,
    refresh: fetchLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  };
}
