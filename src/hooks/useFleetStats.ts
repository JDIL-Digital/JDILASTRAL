"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
  period: string;
  spend: number;
  budget?: number;
}

export interface FleetStats {
  totalFleetBudget: number;
  totalActualSpend: number;
  fleetUtilization: number;
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

/**
 * Fleet-wide KPIs. One straight-line path:
 *   1. fetch rigs → aggregate statuses
 *   2. fetch projects → unused today (kept for budget verification)
 *   3. fetch annexures → donut slices
 *   4. fetch line_items → sum budgets & actuals
 *
 * Every step console.log's its payload so a user staring at $0 can
 * open DevTools and see exactly which fetch returned empty.
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
      // 1. Rigs
      const { data: rigsData, error: rigsError } = await client
        .from("rigs")
        .select("id, status");
      if (rigsError) throw rigsError;
      const rigs = ((rigsData ?? []) as unknown) as Array<Pick<DbRig, "id" | "status">>;
      console.log("[useFleetStats] rigs:", rigs.length);

      // 2. Projects (kept for future per-rig analysis)
      const { data: projectsData, error: projError } = await client
        .from("projects")
        .select("id, total_budget_usd");
      if (projError) throw projError;
      const projects = ((projectsData ?? []) as unknown) as Array<
        Pick<DbProject, "id" | "total_budget_usd">
      >;
      console.log("[useFleetStats] projects:", projects.length);

      // 3. Annexures — donut slices
      const { data: annData, error: annError } = await client
        .from("annexures")
        .select("name, budget_usd");
      if (annError) throw annError;
      const annexures = ((annData ?? []) as unknown) as Array<Pick<DbAnnexure, "name" | "budget_usd">>;
      console.log("[useFleetStats] annexures:", annexures.length);

      // 4. Line items — sums
      const { data: liData, error: liError } = await client
        .from("line_items")
        .select("budget_usd, actual_usd_computed, actual_local_date");
      if (liError) throw liError;
      const lineItems = ((liData ?? []) as unknown) as Array<
        Pick<DbLineItem, "budget_usd" | "actual_usd_computed" | "actual_local_date">
      >;
      console.log("[useFleetStats] line_items:", lineItems.length);

      // Aggregate
      const activeRigs = rigs.filter((r) => r.status === "active").length;
      const maintenanceRigs = rigs.filter((r) => r.status === "maintenance").length;
      const standbyRigs = rigs.filter((r) => r.status === "standby").length;

      const totalFleetBudget = lineItems.reduce(
        (s, li) => s + (Number(li.budget_usd) || 0),
        0,
      );
      const totalActualSpend = lineItems.reduce(
        (s, li) => s + (Number(li.actual_usd_computed) || 0),
        0,
      );

      // Donut — collapse duplicate annexure names across projects.
      const annexureRollup = new Map<string, number>();
      annexures.forEach((a) => {
        annexureRollup.set(
          a.name,
          (annexureRollup.get(a.name) ?? 0) + (Number(a.budget_usd) || 0),
        );
      });
      const budgetByAnnexure: AnnexureBudgetSlice[] = Array.from(
        annexureRollup.entries(),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Monthly spend trend — last 9 months by actual_local_date.
      const monthLabels = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const buckets = new Map<string, number>();
      const now = new Date();
      for (let i = 8; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, 0);
      }
      lineItems.forEach((li) => {
        if (!li.actual_local_date || !li.actual_usd_computed) return;
        const d = new Date(li.actual_local_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (buckets.has(key)) {
          buckets.set(
            key,
            (buckets.get(key) ?? 0) + Number(li.actual_usd_computed),
          );
        }
      });
      const monthlySpendTrend: MonthlySpendPoint[] = Array.from(
        buckets.entries(),
      ).map(([key, spend]) => {
        const month = Number(key.split("-")[1]);
        return { period: monthLabels[month - 1] ?? key, spend };
      });

      const next: FleetStats = {
        totalFleetBudget,
        totalActualSpend,
        fleetUtilization: rigs.length ? (activeRigs / rigs.length) * 100 : 0,
        activeRigs,
        totalRigs: rigs.length,
        maintenanceRigs,
        standbyRigs,
        budgetByAnnexure,
        monthlySpendTrend,
      };
      console.log("[useFleetStats] stats:", next);

      setStats(next);
      setError(null);
    } catch (err) {
      console.error("[useFleetStats] error:", err);
      setError(err instanceof Error ? err.message : "Failed to compute fleet stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void compute();
  }, [compute]);

  // Re-fetch when auth lands.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void compute();
      }
    });
    return () => data.subscription?.unsubscribe();
  }, [compute]);

  return { stats, loading, error, refresh: compute };
}
