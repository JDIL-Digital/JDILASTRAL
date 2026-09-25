"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerRealtimeChannel } from "@/hooks/useRealtimeStatus";
import type {
  DbAnnexure,
  DbLineItem,
  DbProject,
  DbRig,
} from "@/types/database";

export interface AnnexureBudgetSlice {
  name: string;
  value: number;
}

export interface MonthlySpendPoint {
  period: string;   // "Jan", "Feb", …
  spend: number;
  budget?: number;
}

export interface FleetStats {
  totalFleetBudget: number;
  totalActualSpend: number;
  fleetUtilization: number;   // %
  activeRigs: number;
  totalRigs: number;
  maintenanceRigs: number;
  standbyRigs: number;
  budgetByAnnexure: AnnexureBudgetSlice[];
  monthlySpendTrend: MonthlySpendPoint[];
}

interface UseFleetStatsResult {
  stats: FleetStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: FleetStats = {
  totalFleetBudget: 0,
  totalActualSpend: 0,
  fleetUtilization: 0,
  activeRigs: 0,
  totalRigs: 0,
  maintenanceRigs: 0,
  standbyRigs: 0,
  budgetByAnnexure: [],
  monthlySpendTrend: [],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Fleet-wide KPIs. Fires four small queries in parallel and aggregates
 * client-side. Realtime subscription on `line_items` refreshes the whole
 * bundle when any project's spend changes.
 */
export function useFleetStats(): UseFleetStatsResult {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setStats(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const [rigsRes, projectsRes, annexuresRes, lineItemsRes] = await Promise.all([
        client.from("rigs").select("id, status"),
        client.from("projects").select("id, total_budget_usd"),
        client.from("annexures").select("name, budget_usd"),
        client
          .from("line_items")
          .select("actual_usd_computed, actual_local_date, budget_usd"),
      ]);

      const firstErr =
        rigsRes.error || projectsRes.error || annexuresRes.error || lineItemsRes.error;
      if (firstErr) throw firstErr;

      const rigs = (rigsRes.data ?? []) as Pick<DbRig, "id" | "status">[];
      const projects = (projectsRes.data ?? []) as Pick<DbProject, "id" | "total_budget_usd">[];
      const annexures = (annexuresRes.data ?? []) as Pick<DbAnnexure, "name" | "budget_usd">[];
      const lineItems = (lineItemsRes.data ?? []) as Pick<
        DbLineItem,
        "actual_usd_computed" | "actual_local_date" | "budget_usd"
      >[];

      const activeRigs = rigs.filter((r) => r.status === "active").length;
      const maintenanceRigs = rigs.filter((r) => r.status === "maintenance").length;
      const standbyRigs = rigs.filter((r) => r.status === "standby").length;

      const totalFleetBudget = projects.reduce(
        (s, p) => s + Number(p.total_budget_usd ?? 0),
        0,
      );
      const totalActualSpend = lineItems.reduce(
        (s, li) => s + Number(li.actual_usd_computed ?? 0),
        0,
      );

      // Roll up annexures by name (same annexure appears once per
      // project — collapse for the fleet-wide donut).
      const annexureRollup = new Map<string, number>();
      annexures.forEach((a) => {
        annexureRollup.set(
          a.name,
          (annexureRollup.get(a.name) ?? 0) + Number(a.budget_usd ?? 0),
        );
      });
      const budgetByAnnexure = Array.from(annexureRollup.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Monthly spend trend over the past 9 months
      const monthlyBuckets = new Map<string, number>();
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth() - 8, 1);
      for (let i = 0; i < 9; i += 1) {
        const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyBuckets.set(key, 0);
      }
      lineItems.forEach((li) => {
        if (!li.actual_local_date || !li.actual_usd_computed) return;
        const d = new Date(li.actual_local_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthlyBuckets.has(key)) {
          monthlyBuckets.set(key, (monthlyBuckets.get(key) ?? 0) + Number(li.actual_usd_computed));
        }
      });
      const monthlySpendTrend: MonthlySpendPoint[] = Array.from(monthlyBuckets.entries()).map(
        ([key, spend]) => {
          const [, m] = key.split("-");
          return { period: MONTH_LABELS[Number(m) - 1] ?? key, spend };
        },
      );

      setStats({
        totalFleetBudget,
        totalActualSpend,
        fleetUtilization: rigs.length ? (activeRigs / rigs.length) * 100 : 0,
        activeRigs,
        totalRigs: rigs.length,
        maintenanceRigs,
        standbyRigs,
        budgetByAnnexure,
        monthlySpendTrend,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to compute fleet stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void compute();
  }, [compute]);

  // Realtime — any line-item write invalidates the aggregate.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const channel = client
      .channel("fleet-stats-line-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "line_items" },
        () => void compute(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rigs" },
        () => void compute(),
      )
      .subscribe();
    const unregister = registerRealtimeChannel("fleet-stats");
    return () => {
      unregister();
      void client.removeChannel(channel);
    };
  }, [compute]);

  return useMemo(
    () => ({ stats, loading, error, refresh: compute }),
    [stats, loading, error, compute],
  );
}
