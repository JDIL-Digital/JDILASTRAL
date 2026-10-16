"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerRealtimeChannel } from "@/hooks/useRealtimeStatus";
import type { Database, DbLineItem, DbPurchaseOrder, DbRig } from "@/types/database";

type POInsert = Database["public"]["Tables"]["purchase_orders"]["Insert"];
type POUpdate = Database["public"]["Tables"]["purchase_orders"]["Update"];

export type PurchaseOrderWithJoins = DbPurchaseOrder & {
  line_items: Pick<DbLineItem, "description" | "material_code"> | null;
  projects: {
    name: string;
    rigs: Pick<DbRig, "name" | "photo_url"> | null;
  } | null;
};

interface UsePOsResult {
  pos: PurchaseOrderWithJoins[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createPO: (po: POInsert) => Promise<DbPurchaseOrder | null>;
  updatePO: (id: string, patch: POUpdate) => Promise<DbPurchaseOrder | null>;
}

/**
 * Purchase-order feed with joined line-item + project + rig data.
 * Optional `projectId` filter.
 */
export function usePOs(projectId?: string | null): UsePOsResult {
  const [pos, setPos] = useState<PurchaseOrderWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPOs = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    try {
      let q = client
        .from("purchase_orders")
        .select(
          "*, line_items(description, material_code), projects(name, rigs(name, photo_url))",
        )
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error: err } = await q;
      if (err) throw err;
      setPos((data ?? []) as PurchaseOrderWithJoins[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchPOs();
  }, [fetchPOs]);

  // Refetch once the auth session is established.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void fetchPOs();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [fetchPOs]);

  // Realtime — PO status often changes via approval flows
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    // Per-mount nonce — see useLineItems for the full rationale.
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()).slice(2);

    const channel = client
      .channel(`purchase-orders-${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_orders" },
        () => void fetchPOs(),
      )
      .subscribe();
    const unregister = registerRealtimeChannel("purchase_orders");
    return () => {
      unregister();
      void client.removeChannel(channel);
    };
  }, [fetchPOs]);

  const createPO = useCallback<UsePOsResult["createPO"]>(async (po) => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    const { data, error: err } = await (
      client.from("purchase_orders") as unknown as {
        insert: (v: POInsert) => {
          select: () => { single: () => Promise<{ data: DbPurchaseOrder | null; error: unknown }> };
        };
      }
    )
      .insert(po)
      .select()
      .single();
    if (err) throw err;
    return data;
  }, []);

  const updatePO = useCallback<UsePOsResult["updatePO"]>(async (id, patch) => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    const { data, error: err } = await (
      client.from("purchase_orders") as unknown as {
        update: (v: POUpdate) => {
          eq: (col: string, val: string) => {
            select: () => { single: () => Promise<{ data: DbPurchaseOrder | null; error: unknown }> };
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
  }, []);

  return { pos, loading, error, refresh: fetchPOs, createPO, updatePO };
}
