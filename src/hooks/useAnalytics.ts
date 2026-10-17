"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  DbAnnexure,
  DbLineItem,
  DbProject,
  DbRig,
} from "@/types/database";

/* ─────────────────────── types ─────────────────────── */

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type TrafficLight = "healthy" | "watch" | "critical";
export type Trend = "improving" | "deteriorating" | "stable";

export interface EvmMetrics {
  bac: number;      // Budget At Completion
  ac: number;       // Actual Cost
  ev: number;       // Earned Value
  pv: number;       // Planned Value
  cpi: number;      // EV / AC
  spi: number;      // EV / PV
  eac: number;      // BAC / CPI
  vac: number;      // BAC - EAC
  pctComplete: number; // 0–100 (capped)
  daysElapsed: number;
  totalDays: number;
}

export interface ExecutiveSummary extends EvmMetrics {
  healthScore: number;        // 0 – 100
  traffic: TrafficLight;
  summary: string;
  topDrivers: string[];       // annexure names driving overrun
}

export interface AnnexurePerformance {
  annexureId: string;
  number: number;
  name: string;
  budget: number;
  actual: number;
  cpi: number;
  forecast: number;           // budget / cpi, capped
  risk: RiskLevel;
  trend: Trend;
}

export interface OverrunItem {
  id: string;
  description: string;
  area: string | null;
  work_by: string | null;
  budget: number;
  actual: number;
  overrun: number;
}

export interface MonthlyBurnPoint {
  period: string;             // "Jan", "Feb" …
  /** Per-annexure name → USD spend for this month. */
  byAnnexure: Record<string, number>;
  total: number;
}

export interface VelocityPoint {
  date: string;               // yyyy-MM-dd
  spend: number;
  movingAvg: number;          // 7-day
}

export interface RadarPoint {
  annexure: string;
  budget: number;
  actual: number;
}

export interface AnalyticsData {
  projectCount: number;
  rigNamesById: Record<string, string>;
  activeAnnexureNames: string[];
  executive: ExecutiveSummary;
  annexurePerformance: AnnexurePerformance[];
  topOverruns: OverrunItem[];
  spendByArea: Array<{ category: string; value: number }>;
  spendByVendor: Array<{ category: string; value: number }>;
  monthlyBurn: MonthlyBurnPoint[];
  velocity: VelocityPoint[];
  radar: RadarPoint[];
  avgMonthlyBurn: number;
  projectedMonthsToCompletion: number;   // Infinity if burn = 0
}

export interface UseAnalyticsOptions {
  /** Scope the entire computation to one rig (uuid). */
  rigId?: string | null;
  /** Lower bound for the velocity / monthly windows (ISO date). */
  startDate?: string | null;
  /** Upper bound (ISO date). */
  endDate?: string | null;
}

interface UseAnalyticsResult {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

/* ─────────────────────── helpers ─────────────────────── */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Clamp a value to a numeric range. */
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** CPI → RiskLevel. */
function riskFromCpi(cpi: number): RiskLevel {
  if (!Number.isFinite(cpi) || cpi === 0) return "medium";
  if (cpi > 1.1) return "low";
  if (cpi >= 0.9) return "medium";
  if (cpi >= 0.7) return "high";
  return "critical";
}

/** Compute the first-half-vs-second-half trend of actual spend per annexure. */
function trendFromSpend(items: DbLineItem[]): Trend {
  const dated = items.filter((li) => li.actual_local_date && li.actual_usd_computed);
  if (dated.length < 2) return "stable";
  const sorted = [...dated].sort((a, b) =>
    (a.actual_local_date ?? "").localeCompare(b.actual_local_date ?? ""),
  );
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const last = sorted.slice(mid);
  const sum = (ls: DbLineItem[]) =>
    ls.reduce((s, li) => s + Number(li.actual_usd_computed ?? 0), 0);
  const firstAvg = sum(first) / Math.max(1, first.length);
  const lastAvg = sum(last) / Math.max(1, last.length);
  if (lastAvg < firstAvg * 0.9) return "improving";   // spend slowing = good
  if (lastAvg > firstAvg * 1.1) return "deteriorating";
  return "stable";
}

/** Health score aggregating CPI, SPI, and overrun count. */
function healthScore(metrics: EvmMetrics, overrunCount: number, totalItems: number): number {
  let score = 100;
  if (metrics.cpi < 1) score -= (1 - metrics.cpi) * 50;
  if (metrics.spi < 1) score -= (1 - metrics.spi) * 30;
  if (totalItems > 0) score -= (overrunCount / totalItems) * 20;
  return Math.round(clamp(score, 0, 100));
}

function trafficFromScore(score: number): TrafficLight {
  if (score >= 75) return "healthy";
  if (score >= 50) return "watch";
  return "critical";
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────────────── hook ─────────────────────── */

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsResult {
  const { rigId, startDate, endDate } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const compute = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      const [rigsRes, projectsRes, annexuresRes, lineItemsRes] = await Promise.all([
        client.from("rigs").select("id, name"),
        client
          .from("projects")
          .select("id, rig_id, name, total_budget_usd, start_date, end_date"),
        client.from("annexures").select("id, project_id, number, name, budget_usd"),
        client
          .from("line_items")
          .select(
            "id, annexure_id, description, area, work_by, budget_usd, actual_usd_computed, actual_local_date",
          ),
      ]);

      const firstErr =
        rigsRes.error ||
        projectsRes.error ||
        annexuresRes.error ||
        lineItemsRes.error;
      if (firstErr) throw firstErr;

      const rigs = ((rigsRes.data ?? []) as unknown) as Array<Pick<DbRig, "id" | "name">>;
      const allProjects = ((projectsRes.data ?? []) as unknown) as Array<
        Pick<DbProject, "id" | "rig_id" | "name" | "total_budget_usd" | "start_date" | "end_date">
      >;
      const allAnnexures = ((annexuresRes.data ?? []) as unknown) as Array<
        Pick<DbAnnexure, "id" | "project_id" | "number" | "name" | "budget_usd">
      >;
      const allLineItems = ((lineItemsRes.data ?? []) as unknown) as Array<
        Pick<
          DbLineItem,
          | "id"
          | "annexure_id"
          | "description"
          | "area"
          | "work_by"
          | "budget_usd"
          | "actual_usd_computed"
          | "actual_local_date"
        >
      >;

      const rigNamesById: Record<string, string> = {};
      rigs.forEach((r) => (rigNamesById[r.id] = r.name));

      /* ───── apply filters ───── */

      // Rig scope: cascade from rig → project → annexure → line_item
      const projects = rigId
        ? allProjects.filter((p) => p.rig_id === rigId)
        : allProjects;
      const projectIdSet = new Set(projects.map((p) => p.id));

      const annexures = allAnnexures.filter((a) =>
        a.project_id ? projectIdSet.has(a.project_id) : false,
      );
      const annexureIdSet = new Set(annexures.map((a) => a.id));

      // Date scope: filter line_items by actual_local_date within range
      const dateLo = startDate ?? null;
      const dateHi = endDate ?? null;
      const lineItems = allLineItems.filter((li) => {
        if (!li.annexure_id || !annexureIdSet.has(li.annexure_id)) return false;
        if (dateLo && li.actual_local_date && li.actual_local_date < dateLo) return false;
        if (dateHi && li.actual_local_date && li.actual_local_date > dateHi) return false;
        return true;
      });

      /* ───── per-annexure rollup ───── */

      const annexureById = new Map<string, (typeof annexures)[number]>();
      annexures.forEach((a) => annexureById.set(a.id, a));
      const lineItemsByAnnexure = new Map<string, DbLineItem[]>();
      lineItems.forEach((li) => {
        if (!li.annexure_id) return;
        const arr = lineItemsByAnnexure.get(li.annexure_id) ?? [];
        arr.push(li as DbLineItem);
        lineItemsByAnnexure.set(li.annexure_id, arr);
      });

      const activeAnnexureNames: string[] = [];
      const annexurePerformance: AnnexurePerformance[] = annexures.map((a) => {
        const items = lineItemsByAnnexure.get(a.id) ?? [];
        const budget = items.reduce(
          (s, i) => s + Number(i.budget_usd ?? 0),
          0,
        ) || Number(a.budget_usd ?? 0);
        const actual = items.reduce(
          (s, i) => s + Number(i.actual_usd_computed ?? 0),
          0,
        );
        const ev = Math.min(actual, budget);
        const cpi = actual > 0 ? ev / actual : 1;
        const forecast = cpi > 0 ? Math.min(budget * 10, budget / cpi) : budget;
        activeAnnexureNames.push(a.name);
        return {
          annexureId: a.id,
          number: a.number,
          name: a.name,
          budget,
          actual,
          cpi,
          forecast,
          risk: riskFromCpi(cpi),
          trend: trendFromSpend(items),
        };
      });

      /* ───── overall EVM across the filtered scope ───── */

      // BAC = sum of projects' total_budget_usd when available, otherwise
      // sum of annexure budgets (which fall back to line-item sums).
      const projectsBac = projects.reduce(
        (s, p) => s + Number(p.total_budget_usd ?? 0),
        0,
      );
      const annexBac = annexurePerformance.reduce((s, a) => s + a.budget, 0);
      const bac = projectsBac > 0 ? projectsBac : annexBac;
      const ac = annexurePerformance.reduce((s, a) => s + a.actual, 0);
      const pctComplete = bac > 0 ? clamp((ac / bac) * 100, 0, 100) : 0;
      const ev = (pctComplete / 100) * bac;
      const cpi = ac > 0 ? ev / ac : 1;

      // Planned value — linear across project duration.
      // Use the earliest start / latest end across the project set, or
      // fall back to a 365-day window ending today when no dates exist.
      const starts = projects
        .map((p) => (p.start_date ? new Date(p.start_date).getTime() : null))
        .filter((v): v is number => v !== null);
      const ends = projects
        .map((p) => (p.end_date ? new Date(p.end_date).getTime() : null))
        .filter((v): v is number => v !== null);
      const start = starts.length > 0 ? Math.min(...starts) : Date.now() - 365 * 86400000;
      const end = ends.length > 0 ? Math.max(...ends) : Date.now() + 365 * 86400000;
      const totalDays = Math.max(1, Math.round((end - start) / 86400000));
      const daysElapsed = Math.max(
        0,
        Math.min(totalDays, Math.round((Date.now() - start) / 86400000)),
      );
      const pv = bac * (daysElapsed / totalDays);
      const spi = pv > 0 ? ev / pv : 1;
      const eac = cpi > 0 ? bac / cpi : bac;
      const vac = bac - eac;

      const evm: EvmMetrics = {
        bac, ac, ev, pv, cpi, spi, eac, vac,
        pctComplete, daysElapsed, totalDays,
      };

      /* ───── overruns ───── */

      const overrunAll: OverrunItem[] = lineItems
        .filter(
          (li) =>
            Number(li.budget_usd ?? 0) > 0 &&
            Number(li.actual_usd_computed ?? 0) > Number(li.budget_usd ?? 0),
        )
        .map((li) => ({
          id: li.id,
          description: li.description ?? "(no description)",
          area: li.area ?? null,
          work_by: li.work_by ?? null,
          budget: Number(li.budget_usd ?? 0),
          actual: Number(li.actual_usd_computed ?? 0),
          overrun: Number(li.actual_usd_computed ?? 0) - Number(li.budget_usd ?? 0),
        }));
      overrunAll.sort((a, b) => b.overrun - a.overrun);
      const topOverruns = overrunAll.slice(0, 10);
      const overrunCount = overrunAll.length;

      /* ───── spend-by category rollups ───── */

      const bucket = (
        src: typeof overrunAll,
        key: "area" | "work_by",
      ): Array<{ category: string; value: number }> => {
        const map = new Map<string, number>();
        src.forEach((o) => {
          const k = o[key] ?? "Uncategorized";
          map.set(k, (map.get(k) ?? 0) + o.overrun);
        });
        return Array.from(map.entries())
          .map(([category, value]) => ({ category, value }))
          .sort((a, b) => b.value - a.value);
      };
      const spendByArea = bucket(overrunAll, "area");
      const spendByVendor = bucket(overrunAll, "work_by");

      /* ───── monthly burn (stacked by annexure) ───── */

      const monthKeys: string[] = [];
      const monthStart = new Date(start);
      monthStart.setDate(1);
      const monthEnd = new Date();
      for (
        let d = new Date(monthStart);
        d <= monthEnd;
        d.setMonth(d.getMonth() + 1)
      ) {
        monthKeys.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
      }
      // Cap at 12 trailing months for chart legibility
      const chartMonthKeys = monthKeys.slice(-12);
      const chartMonthSet = new Set(chartMonthKeys);

      const burnByMonth = new Map<
        string,
        Record<string, number>
      >();
      chartMonthKeys.forEach((k) => burnByMonth.set(k, {}));
      lineItems.forEach((li) => {
        if (!li.actual_local_date || !li.actual_usd_computed) return;
        const d = new Date(li.actual_local_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!chartMonthSet.has(key)) return;
        const annId = li.annexure_id;
        const annexure = annId ? annexureById.get(annId) : undefined;
        const name = annexure?.name ?? "Other";
        const month = burnByMonth.get(key)!;
        month[name] = (month[name] ?? 0) + Number(li.actual_usd_computed);
      });

      const monthlyBurn: MonthlyBurnPoint[] = chartMonthKeys.map((key) => {
        const byAnnexure = burnByMonth.get(key) ?? {};
        const total = Object.values(byAnnexure).reduce((s, v) => s + v, 0);
        const monthIdx = Number(key.split("-")[1]) - 1;
        return {
          period: MONTH_LABELS[monthIdx] ?? key,
          byAnnexure,
          total,
        };
      });

      const monthsWithSpend = monthlyBurn.filter((m) => m.total > 0);
      const avgMonthlyBurn =
        monthsWithSpend.length > 0
          ? monthsWithSpend.reduce((s, m) => s + m.total, 0) / monthsWithSpend.length
          : 0;
      const remaining = Math.max(0, bac - ac);
      const projectedMonthsToCompletion =
        avgMonthlyBurn > 0 ? remaining / avgMonthlyBurn : Infinity;

      /* ───── spend velocity (daily + 7-day MA) ───── */

      const daySums = new Map<string, number>();
      lineItems.forEach((li) => {
        if (!li.actual_local_date || !li.actual_usd_computed) return;
        const key = li.actual_local_date.slice(0, 10);
        daySums.set(key, (daySums.get(key) ?? 0) + Number(li.actual_usd_computed));
      });

      // Walk every day from first spend date to today (bounded at 180 days)
      const dayKeys = Array.from(daySums.keys()).sort();
      const velocity: VelocityPoint[] = [];
      if (dayKeys.length > 0) {
        const first = new Date(dayKeys[0]);
        const today = new Date();
        const maxWindow = 180;
        const windowStart = new Date(
          Math.max(first.getTime(), today.getTime() - maxWindow * 86400000),
        );
        const buffer: number[] = [];
        for (
          let d = new Date(windowStart);
          d <= today;
          d.setDate(d.getDate() + 1)
        ) {
          const key = toISODate(d);
          const spend = daySums.get(key) ?? 0;
          buffer.push(spend);
          if (buffer.length > 7) buffer.shift();
          const movingAvg = buffer.reduce((s, v) => s + v, 0) / buffer.length;
          velocity.push({ date: key, spend, movingAvg });
        }
      }

      /* ───── radar (annexure budget vs actual) ───── */

      const radar: RadarPoint[] = annexurePerformance.map((a) => ({
        annexure: a.name,
        budget: a.budget,
        actual: a.actual,
      }));

      /* ───── executive summary ───── */

      const score = healthScore(evm, overrunCount, lineItems.length);
      const traffic = trafficFromScore(score);
      const topDrivers = annexurePerformance
        .filter((a) => a.actual > a.budget)
        .sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))
        .slice(0, 2)
        .map((a) => a.name);

      const summary = (() => {
        const pct = evm.pctComplete.toFixed(0);
        const overBudgetPct = ((evm.ac / Math.max(1, evm.ev)) - 1) * 100;
        const direction =
          evm.cpi >= 1
            ? `tracking ${Math.abs(overBudgetPct).toFixed(0)}% under budget`
            : `tracking ${Math.abs(overBudgetPct).toFixed(0)}% over budget`;
        const driverPart =
          topDrivers.length > 0
            ? ` ${topDrivers.join(" and ")} ${topDrivers.length === 1 ? "is" : "are"} driving the overrun.`
            : "";
        return `Project${projects.length === 1 ? "" : "s"} ${pct}% complete, ${direction}.${driverPart}`;
      })();

      const executive: ExecutiveSummary = {
        ...evm,
        healthScore: score,
        traffic,
        summary,
        topDrivers,
      };

      const result: AnalyticsData = {
        projectCount: projects.length,
        rigNamesById,
        activeAnnexureNames,
        executive,
        annexurePerformance,
        topOverruns,
        spendByArea,
        spendByVendor,
        monthlyBurn,
        velocity,
        radar,
        avgMonthlyBurn,
        projectedMonthsToCompletion,
      };

      console.log("[useAnalytics] computed:", {
        bac: evm.bac,
        ac: evm.ac,
        cpi: evm.cpi,
        spi: evm.spi,
        overruns: overrunCount,
        monthlyPoints: monthlyBurn.length,
        velocityPoints: velocity.length,
      });

      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      console.error("[useAnalytics] error:", e);
      setError(e instanceof Error ? e.message : "Failed to compute analytics");
    } finally {
      setLoading(false);
    }
  }, [rigId, startDate, endDate]);

  useEffect(() => {
    void compute();
  }, [compute]);

  // Refetch when auth lands.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void compute();
      }
    });
    return () => sub.subscription?.unsubscribe();
  }, [compute]);

  return useMemo(
    () => ({ data, loading, error, lastUpdated, refresh: compute }),
    [data, loading, error, lastUpdated, compute],
  );
}
