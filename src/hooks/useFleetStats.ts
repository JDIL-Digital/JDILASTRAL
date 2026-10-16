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

export interface RigAggregate {
  budget: number;
  actual: number;
  remaining: number;
  pctSpent: number;
}

export interface OverrunItem {
  id: string;
  description: string;
  rig_id: string | null;
  annexure_id: string | null;
  budget_usd: number;
  actual_usd: number;
  overrun_amount: number;
  overrun_pct: number;
}

export interface FleetStats {
  totalFleetBudget: number;
  totalActualSpend: number;
  totalCommitted: number;
  totalRemaining: number;
  fleetUtilization: number;
  activeRigs: number;
  totalRigs: number;
  maintenanceRigs: number;
  standbyRigs: number;
  budgetByAnnexure: AnnexureBudgetSlice[];
  monthlySpendTrend: MonthlySpendPoint[];
  /** Per-rig budget / actual rollup keyed by rig uuid. */
  rigAggregates: Record<string, RigAggregate>;
  /** Count of line items where actual exceeds budget. */
  overrunCount: number;
  /** Top 5 worst overruns, biggest absolute overshoot first. */
  overruns: OverrunItem[];
}

interface UseFleetStatsResult {
  stats: FleetStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const EMPTY: FleetStats = {
  totalFleetBudget: 0,
  totalActualSpend: 0,
  totalCommitted: 0,
  totalRemaining: 0,
  fleetUtilization: 0,
  activeRigs: 0,
  totalRigs: 0,
  maintenanceRigs: 0,
  standbyRigs: 0,
  budgetByAnnexure: [],
  monthlySpendTrend: [],
  rigAggregates: {},
  overrunCount: 0,
  overruns: [],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Fleet-wide KPIs + per-rig aggregates + overrun detection.
 *
 * Fetches 4 tables in parallel, then does a single pass to:
 *   • Join line_items → annexures → projects → rig_id for per-rig rollup
 *   • Flag items where actual > budget as overruns
 *   • Bucket actuals by yyyy-MM and emit a cumulative trend
 */
export function useFleetStats(): UseFleetStatsResult {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        client.from("rigs").select("id, status, name"),
        client.from("projects").select("id, rig_id, total_budget_usd"),
        client.from("annexures").select("id, project_id, name, budget_usd"),
        client
          .from("line_items")
          .select(
            "id, annexure_id, description, budget_usd, actual_usd_computed, actual_local_date",
          ),
      ]);

      const firstErr =
        rigsRes.error || projectsRes.error || annexuresRes.error || lineItemsRes.error;
      if (firstErr) throw firstErr;

      const rigs = ((rigsRes.data ?? []) as unknown) as Array<
        Pick<DbRig, "id" | "status" | "name">
      >;
      const projects = ((projectsRes.data ?? []) as unknown) as Array<
        Pick<DbProject, "id" | "rig_id" | "total_budget_usd">
      >;
      const annexures = ((annexuresRes.data ?? []) as unknown) as Array<
        Pick<DbAnnexure, "id" | "project_id" | "name" | "budget_usd">
      >;
      const lineItems = ((lineItemsRes.data ?? []) as unknown) as Array<
        Pick<
          DbLineItem,
          | "id"
          | "annexure_id"
          | "description"
          | "budget_usd"
          | "actual_usd_computed"
          | "actual_local_date"
        >
      >;

      console.log("[useFleetStats] rigs:", rigs.length);
      console.log("[useFleetStats] projects:", projects.length);
      console.log("[useFleetStats] annexures:", annexures.length);
      console.log("[useFleetStats] line_items:", lineItems.length);

      // Rig status breakdown
      const activeRigs = rigs.filter((r) => r.status === "active").length;
      const maintenanceRigs = rigs.filter((r) => r.status === "maintenance").length;
      const standbyRigs = rigs.filter((r) => r.status === "standby").length;

      // Join tables for per-rig / per-line-item traversal
      const rigByProjectId = new Map<string, string>();
      projects.forEach((p) => {
        if (p.rig_id) rigByProjectId.set(p.id, p.rig_id);
      });

      const rigByAnnexureId = new Map<string, string>();
      annexures.forEach((a) => {
        const rigId = a.project_id ? rigByProjectId.get(a.project_id) : undefined;
        if (rigId) rigByAnnexureId.set(a.id, rigId);
      });

      // Per-rig aggregates + fleet totals + overrun list in one pass
      const rigAggregates: Record<string, RigAggregate> = {};
      let totalFleetBudget = 0;
      let totalActualSpend = 0;
      const overruns: OverrunItem[] = [];

      lineItems.forEach((li) => {
        const budget = Number(li.budget_usd ?? 0);
        const actual = Number(li.actual_usd_computed ?? 0);
        totalFleetBudget += budget;
        totalActualSpend += actual;

        const rigId = li.annexure_id ? rigByAnnexureId.get(li.annexure_id) : undefined;
        if (rigId) {
          const prev = rigAggregates[rigId] ?? {
            budget: 0,
            actual: 0,
            remaining: 0,
            pctSpent: 0,
          };
          prev.budget += budget;
          prev.actual += actual;
          rigAggregates[rigId] = prev;
        }

        if (budget > 0 && actual > budget) {
          overruns.push({
            id: li.id,
            description: li.description ?? "(no description)",
            rig_id: rigId ?? null,
            annexure_id: li.annexure_id ?? null,
            budget_usd: budget,
            actual_usd: actual,
            overrun_amount: actual - budget,
            overrun_pct: ((actual - budget) / budget) * 100,
          });
        }
      });

      // Finalize per-rig derived fields
      Object.values(rigAggregates).forEach((agg) => {
        agg.remaining = agg.budget - agg.actual;
        agg.pctSpent = agg.budget > 0 ? (agg.actual / agg.budget) * 100 : 0;
      });

      // Sort overruns and keep top 5
      overruns.sort((a, b) => b.overrun_amount - a.overrun_amount);
      const topOverruns = overruns.slice(0, 5);

      // Committed = sum of project budgets not yet consumed
      const totalCommitted = projects.reduce(
        (s, p) => s + Number(p.total_budget_usd ?? 0),
        0,
      );
      const totalRemaining = Math.max(0, totalFleetBudget - totalActualSpend);

      // Annexure donut — collapse duplicates by name across projects
      const annexureRollup = new Map<string, number>();
      annexures.forEach((a) => {
        annexureRollup.set(
          a.name,
          (annexureRollup.get(a.name) ?? 0) + Number(a.budget_usd ?? 0),
        );
      });
      const budgetByAnnexure: AnnexureBudgetSlice[] = Array.from(
        annexureRollup.entries(),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Monthly trend — Jan to current month of current year, cumulative
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-based

      const buckets = new Map<string, number>();
      for (let m = 0; m <= currentMonth; m += 1) {
        const key = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
        buckets.set(key, 0);
      }
      lineItems.forEach((li) => {
        if (!li.actual_local_date || !li.actual_usd_computed) return;
        const d = new Date(li.actual_local_date);
        if (d.getFullYear() !== currentYear) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (buckets.has(key)) {
          buckets.set(key, (buckets.get(key) ?? 0) + Number(li.actual_usd_computed));
        }
      });

      // Convert to cumulative + emit with month labels
      let running = 0;
      const monthlySpendTrend: MonthlySpendPoint[] = Array.from(buckets.entries()).map(
        ([key, spend]) => {
          running += spend;
          const monthIndex = Number(key.split("-")[1]) - 1;
          return {
            period: MONTH_LABELS[monthIndex] ?? key,
            spend: running,
          };
        },
      );

      const next: FleetStats = {
        totalFleetBudget,
        totalActualSpend,
        totalCommitted,
        totalRemaining,
        fleetUtilization: rigs.length ? (activeRigs / rigs.length) * 100 : 0,
        activeRigs,
        totalRigs: rigs.length,
        maintenanceRigs,
        standbyRigs,
        budgetByAnnexure,
        monthlySpendTrend,
        rigAggregates,
        overrunCount: overruns.length,
        overruns: topOverruns,
      };

      console.log("[useFleetStats] stats:", next);
      setStats(next);
      setLastUpdated(new Date());
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

  // Re-fetch on auth landing.
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

  // Soft auto-refresh every 30s so the fleet overview stays current
  // without relying on realtime subscriptions when they're disabled.
  useEffect(() => {
    const id = setInterval(() => {
      void compute();
    }, 30_000);
    return () => clearInterval(id);
  }, [compute]);

  return { stats, loading, error, lastUpdated, refresh: compute };
}
