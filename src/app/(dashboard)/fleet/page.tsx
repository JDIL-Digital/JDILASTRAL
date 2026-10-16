"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Ship,
  TrendingUp,
} from "lucide-react";
import { KPICard, kpiFormatters } from "@/components/cards/KPICard";
import { RigCard } from "@/components/cards/RigCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartSkeleton,
  DonutSkeleton,
  CardSkeleton,
  RigCardSkeleton,
} from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useRigs } from "@/hooks/useRigs";
import { useFleetStats } from "@/hooks/useFleetStats";
import { APP, BRAND } from "@/lib/constants";
import { cn, formatCompact, formatCurrency } from "@/lib/utils";
import type { DbRig } from "@/types/database";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
const SpendTrendLine = dynamic(
  () => import("@/components/charts/SpendTrendLine").then((m) => m.SpendTrendLine),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const DONUT_PALETTE = [
  BRAND.primary,
  "#22C55E",
  BRAND.warning,
  "#7C5CFF",
  "#22B8CF",
  BRAND.danger,
  "#F97316",
  "#06B6D4",
  "#A855F7",
  "#EAB308",
  "#EC4899",
];

function timeAgo(then: Date | null): string {
  if (!then) return "never";
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  return `${diffH} hour${diffH === 1 ? "" : "s"} ago`;
}

export default function FleetPage() {
  const { rigs, loading: rigsLoading, error: rigsError, refresh: refreshRigs } = useRigs();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    lastUpdated,
    refresh: refreshStats,
  } = useFleetStats();

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const donutData = useMemo(() => {
    if (!stats) return [];
    return stats.budgetByAnnexure.slice(0, 11).map((a, i) => ({
      name: a.name,
      value: a.value,
      color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }));
  }, [stats]);

  const burnPct =
    stats && stats.totalFleetBudget
      ? (stats.totalActualSpend / stats.totalFleetBudget) * 100
      : 0;

  // Hydrate each rig card with its real per-rig aggregate so the burn bar
  // and dollar amounts aren't zero.
  const rigsWithTotals = useMemo(() => {
    const empty = { budget: 0, actual: 0, remaining: 0, pctSpent: 0 };
    return rigs.map((rig) => {
      const agg = stats?.rigAggregates?.[rig.id] ?? empty;
      return { rig, agg };
    });
  }, [rigs, stats]);

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
        <HeroBackground />
        <div className="relative z-10 flex flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-label text-brand-green-bright">{APP.name}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-brand-text md:text-4xl">
                Fleet Operations Overview
              </h1>
              <p className="mt-1 max-w-xl text-sm text-brand-muted">
                Real-time governance across all 6 offshore jackup rigs · live cost,
                utilization, and procurement signals.
              </p>
            </div>
            <div className="rounded-lg border border-brand-border bg-brand-bg/40 px-4 py-3 text-right backdrop-blur-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                Live · auto-refresh every 30s
              </div>
              <div className="text-kpi mt-0.5 text-xl text-brand-text tabular-nums">
                {now
                  ? now.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })
                  : "--:--:--"}
              </div>
              <div className="text-xs text-brand-muted">
                Last updated: {timeAgo(lastUpdated)}
              </div>
            </div>
          </div>

          {statsError && (
            <QueryError message={statsError} onRetry={() => void refreshStats()} />
          )}

          {statsLoading || !stats ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label="Total Fleet Budget"
                value={`$${formatCurrency(stats.totalFleetBudget, "USD").replace("$", "")}`}
                numericValue={stats.totalFleetBudget}
                format={kpiFormatters.currencyCompact}
                icon={<DollarSign className="h-5 w-5" />}
                index={0}
              />
              <KPICard
                label="YTD Spend"
                value={`$${stats.totalActualSpend}`}
                numericValue={stats.totalActualSpend}
                format={kpiFormatters.currencyCompact}
                trend="up"
                delta={burnPct}
                intent={burnPct > 85 ? "negative" : "positive"}
                deltaLabel={`${burnPct.toFixed(1)}% of budget`}
                icon={
                  <TrendingUp
                    className={`h-5 w-5 ${burnPct > 85 ? "text-brand-warning" : ""}`}
                  />
                }
                index={1}
              />
              <KPICard
                label="Fleet Utilization"
                value={`${stats.fleetUtilization.toFixed(1)}%`}
                numericValue={stats.fleetUtilization}
                format={kpiFormatters.percent}
                decimals={1}
                trend="up"
                intent="positive"
                deltaLabel={`${stats.activeRigs}/${stats.totalRigs} active`}
                icon={<Activity className="h-5 w-5" />}
                index={2}
              />
              <KPICard
                label="Active Rigs"
                value={`${stats.activeRigs} / ${stats.totalRigs}`}
                numericValue={stats.activeRigs}
                format={(n) => `${Math.round(n)} / ${stats.totalRigs}`}
                intent="neutral"
                hint={`${stats.maintenanceRigs} maint · ${stats.standbyRigs} standby`}
                icon={<Ship className="h-5 w-5" />}
                index={3}
              />
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------- OVERRUN ALERTS ----------------------------- */}
      {stats && stats.overrunCount > 0 && (
        <section>
          <Card className="border-brand-danger/40">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-brand-danger">
                    <AlertTriangle className="h-5 w-5" />
                    Overrun Alerts
                    <Badge variant="destructive" className="ml-1">
                      {stats.overrunCount}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Line items whose actual spend exceeds their budget — top 5 by
                    absolute overshoot
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-brand-border">
                {stats.overruns.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-text">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-muted">
                        Budget {formatCurrency(item.budget_usd, "USD")} · Actual{" "}
                        {formatCurrency(item.actual_usd, "USD")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-brand-danger">
                        +{formatCurrency(item.overrun_amount, "USD")}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-muted">
                        {item.overrun_pct.toFixed(0)}% over
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ----------------------------- CHARTS ----------------------------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2 animate-fade-in-up delay-step-2">
          <CardHeader>
            <CardTitle>Capital Allocation by Annexure</CardTitle>
            <CardDescription>Fleet-wide budget breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading || !stats ? (
              <DonutSkeleton />
            ) : donutData.length === 0 ? (
              <EmptyState
                title="No annexures yet"
                message="Seed the annexures table to see the allocation breakdown."
              />
            ) : (
              <BudgetDonutChart
                data={donutData}
                centerLabel="Budget"
                centerValue={formatCurrency(stats.totalFleetBudget, "USD")}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 animate-fade-in-up delay-step-3">
          <CardHeader>
            <CardTitle>Monthly Spend Trend</CardTitle>
            <CardDescription>Cumulative YTD burn across the fleet</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading || !stats ? (
              <ChartSkeleton />
            ) : (
              <SpendTrendLine data={stats.monthlySpendTrend} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----------------------------- RIG GRID ----------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-brand-text">
              Fleet Composition
            </h2>
            <p className="text-sm text-brand-muted">
              {rigs.length} jackup rig{rigs.length === 1 ? "" : "s"} · click any unit
              to drill in
            </p>
          </div>
          {stats && (
            <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
              {stats.activeRigs} Active · {stats.maintenanceRigs} Maint. ·{" "}
              {stats.standbyRigs} Standby
            </span>
          )}
        </div>

        {rigsError && (
          <QueryError message={rigsError} onRetry={() => void refreshRigs()} />
        )}

        {rigsLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RigCardSkeleton key={i} />
            ))}
          </div>
        ) : rigs.length === 0 ? (
          <EmptyState
            title="No rigs configured"
            message="Run supabase/migrations/001_initial_schema.sql to seed the fleet."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rigsWithTotals.map(({ rig, agg }, i) => (
              <RigCard
                key={rig.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rig={dbRigToUiRig(rig, agg) as any}
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------- COMPOSITION SUMMARY ----------------------------- */}
      {stats && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fleet Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2 text-sm">
                <StatusRow
                  dotClass="bg-brand-success"
                  label="Active"
                  value={stats.activeRigs}
                  total={stats.totalRigs}
                />
                <StatusRow
                  dotClass="bg-brand-warning"
                  label="Maintenance"
                  value={stats.maintenanceRigs}
                  total={stats.totalRigs}
                />
                <StatusRow
                  dotClass="bg-slate-400"
                  label="Standby"
                  value={stats.standbyRigs}
                  total={stats.totalRigs}
                />
              </ul>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Budget Utilization</CardTitle>
              <CardDescription>
                Committed ${formatCompact(stats.totalCommitted)} ·
                Remaining ${formatCompact(stats.totalRemaining)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-brand-muted">YTD Spend</span>
                <span className="font-mono text-brand-text">
                  ${formatCompact(stats.totalActualSpend)} / $
                  {formatCompact(stats.totalFleetBudget)}
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-brand-border/50">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    burnPct > 100
                      ? "bg-brand-danger"
                      : burnPct > 85
                        ? "bg-brand-warning"
                        : "bg-brand-green",
                  )}
                  style={{ width: `${Math.min(burnPct, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-brand-muted">
                <span>{burnPct.toFixed(1)}% consumed</span>
                <span>
                  Remaining ${formatCompact(stats.totalRemaining)} (
                  {(100 - burnPct).toFixed(1)}%)
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

/* --------------------------------- helpers --------------------------------- */

function StatusRow({
  dotClass,
  label,
  value,
  total,
}: {
  dotClass: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2 text-brand-text">
          <span className={cn("inline-block h-2 w-2 rounded-full", dotClass)} />
          {label}
        </span>
        <span className="font-mono text-brand-muted">
          {value} / {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-border/50">
        <div className={cn("h-full rounded-full", dotClass)} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/**
 * Map a DbRig row + its real aggregated spend into the shape RigCard
 * expects. Keeps the strict `operational/maintenance/stacked` enum
 * expected by rigMetaFor's status fallback.
 */
function dbRigToUiRig(
  rig: DbRig,
  agg: { budget: number; actual: number },
) {
  return {
    id: rig.id,
    name: rig.name,
    type: rig.type ?? "Jackup",
    location: "Mumbai High",
    operator: "ONGC",
    status:
      rig.status === "active"
        ? ("operational" as const)
        : rig.status === "maintenance"
          ? ("maintenance" as const)
          : ("stacked" as const),
    daily_rate_usd: 85_000,
    contract_start: rig.created_at,
    contract_end: rig.created_at,
    total_budget_usd: agg.budget,
    spent_usd: agg.actual,
    committed_usd: 0,
    utilization_pct: rig.status === "active" ? 88 : rig.status === "maintenance" ? 42 : 12,
    created_at: rig.created_at,
    updated_at: rig.created_at,
  };
}

/* --------------------------------- hero bg --------------------------------- */

function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-hero-mesh" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-green/15 blur-3xl animate-blob-a" />
      <div className="absolute right-[-80px] top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-brand-danger/10 blur-3xl animate-blob-b" />
      <div className="absolute bottom-[-80px] left-1/3 h-72 w-72 rounded-full bg-brand-green-bright/10 blur-3xl animate-blob-c" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </div>
  );
}
