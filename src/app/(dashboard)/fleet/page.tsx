"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, DollarSign, Ship, TrendingUp } from "lucide-react";
import { KPICard, kpiFormatters } from "@/components/cards/KPICard";
import { RigCard } from "@/components/cards/RigCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency } from "@/lib/utils";
import type { DbRig } from "@/types/database";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
const SpendTrendLine = dynamic(
  () => import("@/components/charts/SpendTrendLine").then((m) => m.SpendTrendLine),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export default function FleetPage() {
  const { rigs, loading: rigsLoading, error: rigsError, refresh: refreshRigs } = useRigs();
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } =
    useFleetStats();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const donutData = useMemo(() => {
    if (!stats) return [];
    return stats.budgetByAnnexure.slice(0, 6).map((a, i) => ({
      name: a.name,
      value: a.value,
      color: [BRAND.primary, "#22C55E", BRAND.warning, "#7C5CFF", "#22B8CF", BRAND.danger][i % 6],
    }));
  }, [stats]);

  const burnPct =
    stats && stats.totalFleetBudget
      ? (stats.totalActualSpend / stats.totalFleetBudget) * 100
      : 0;

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
                Real-time governance across all {rigs.length || 6} offshore jackup rigs · live
                cost, utilization, and procurement signals.
              </p>
            </div>
            <div className="rounded-lg border border-brand-border bg-brand-bg/40 px-4 py-3 text-right backdrop-blur-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                Live · {APP.tagline}
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
                {now
                  ? now.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
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
                trend="up"
                delta={4.2}
                intent="positive"
                deltaLabel="vs. last quarter"
                icon={<DollarSign className="h-5 w-5" />}
                index={0}
              />
              <KPICard
                label="YTD Spend"
                value={`$${stats.totalActualSpend}`}
                numericValue={stats.totalActualSpend}
                format={kpiFormatters.currencyCompact}
                trend="up"
                delta={burnPct - 50}
                intent={burnPct > 80 ? "negative" : "positive"}
                deltaLabel={`${burnPct.toFixed(1)}% of budget`}
                icon={
                  <TrendingUp
                    className={`h-5 w-5 ${burnPct > 80 ? "text-brand-warning" : ""}`}
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
                delta={1.4}
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
                trend="neutral"
                intent="neutral"
                hint={`${stats.maintenanceRigs} maintenance · ${stats.standbyRigs} standby`}
                icon={<Ship className="h-5 w-5" />}
                index={3}
              />
            </div>
          )}
        </div>
      </section>

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
            <CardDescription>YTD burn across the fleet</CardDescription>
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
              {rigs.length} jackup rig{rigs.length === 1 ? "" : "s"} · click any unit to drill in
            </p>
          </div>
          {stats && (
            <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
              {stats.activeRigs} Active · {stats.maintenanceRigs} Maint. · {stats.standbyRigs} Standby
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
            {rigs.map((rig, i) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <RigCard key={rig.id} rig={dbRigToUiRig(rig) as any} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Bridge Supabase's `rigs` row into the shape the existing `RigCard`
 * component expects. Fills in the fields the card renders but the DB
 * doesn't carry (contract dates, day rate, utilization, budgets) with
 * neutral placeholders — those live in projects/line_items and will get
 * wired in a follow-up pass.
 */
function dbRigToUiRig(rig: DbRig) {
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
    total_budget_usd: 0,
    spent_usd: 0,
    committed_usd: 0,
    utilization_pct: rig.status === "active" ? 88 : rig.status === "maintenance" ? 42 : 12,
    created_at: rig.created_at,
    updated_at: rig.created_at,
  };
}

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
