"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Activity,
  Anchor,
  ArrowRight,
  Calendar,
  DollarSign,
  MapPin,
  Wallet,
} from "lucide-react";
import { KPICard } from "@/components/cards/KPICard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartSkeleton,
  DonutSkeleton,
  CardSkeleton,
} from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useRig } from "@/hooks/useRig";
import { useProjects } from "@/hooks/useProjects";
import { useAnnexures } from "@/hooks/useAnnexures";
import { BRAND } from "@/lib/constants";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@/lib/utils";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
const SpendTrendLine = dynamic(
  () => import("@/components/charts/SpendTrendLine").then((m) => m.SpendTrendLine),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const BudgetVsActualBar = dynamic(
  () => import("@/components/charts/BudgetVsActualBar").then((m) => m.BudgetVsActualBar),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export default function RigPage() {
  const params = useParams<{ rigId: string }>();
  const rigId = params.rigId;

  const { rig, loading: rigLoading, error: rigError, refresh: refreshRig } = useRig(rigId);
  const { projects, loading: projectsLoading } = useProjects(rig?.id);
  const activeProject = projects[0] ?? null;

  const {
    annexures,
    loading: annexuresLoading,
    error: annexuresError,
    refresh: refreshAnnexures,
  } = useAnnexures(activeProject?.id ?? null);

  const totals = useMemo(() => {
    const budget = annexures.reduce((s, a) => s + a.total_budget, 0);
    const actual = annexures.reduce((s, a) => s + a.total_actual, 0);
    const projectBudget = Number(activeProject?.total_budget_usd ?? 0);
    return {
      budget: budget || projectBudget,
      actual,
      committed: Math.max(0, projectBudget - budget - actual),
      remaining: Math.max(0, projectBudget - actual),
      utilization: budget ? (actual / budget) * 100 : 0,
    };
  }, [annexures, activeProject]);

  const donutData = useMemo(
    () => [
      { name: "Spent", value: totals.actual, color: BRAND.danger },
      { name: "Committed", value: totals.committed, color: BRAND.warning },
      { name: "Available", value: totals.remaining, color: BRAND.primary },
    ],
    [totals],
  );

  const annexureBarData = useMemo(
    () =>
      annexures.map((a) => ({
        name: `ANX-${a.number}`,
        budget: a.total_budget || a.budget_usd,
        actual: a.total_actual,
      })),
    [annexures],
  );

  const trendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return months.map((m, i) => ({
      period: m,
      spend: 2_400_000 + i * 380_000 + (i % 2 ? 200_000 : -120_000),
      budget: 3_000_000 + i * 400_000,
    }));
  }, []);

  if (rigError && !rig) {
    return (
      <main className="flex-1 p-6">
        <QueryError message={rigError} onRetry={() => void refreshRig()} />
      </main>
    );
  }

  if (rigLoading || !rig) {
    return (
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green">
            <Anchor className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-muted">
              {rig.type ?? "Jackup"} · ONGC
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
              {rig.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-brand-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Mumbai High
              </span>
              {activeProject?.start_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDate(activeProject.start_date)}
                  {activeProject.end_date ? ` → ${formatDate(activeProject.end_date)}` : ""}
                </span>
              )}
              <Badge
                variant={
                  rig.status === "active"
                    ? "default"
                    : rig.status === "maintenance"
                      ? "warning"
                      : "secondary"
                }
                className="capitalize"
              >
                {rig.status}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Budget"
          value={`$${formatCompact(totals.budget)}`}
          numericValue={totals.budget}
          format={(n) => `$${formatCompact(n)}`}
          icon={<Wallet className="h-5 w-5" />}
          index={0}
        />
        <KPICard
          label="Spent (YTD)"
          value={`$${formatCompact(totals.actual)}`}
          numericValue={totals.actual}
          format={(n) => `$${formatCompact(n)}`}
          trend="up"
          delta={totals.utilization - 50}
          intent={totals.utilization > 70 ? "negative" : "positive"}
          deltaLabel={`${totals.utilization.toFixed(1)}% of budget`}
          icon={<DollarSign className="h-5 w-5" />}
          index={1}
        />
        <KPICard
          label="Committed"
          value={`$${formatCompact(totals.committed)}`}
          hint="Open POs + pending"
          icon={<Calendar className="h-5 w-5" />}
          index={2}
        />
        <KPICard
          label="Utilization"
          value={formatPercent(totals.utilization, 1)}
          numericValue={totals.utilization}
          format={(n) => `${n.toFixed(1)}%`}
          decimals={1}
          trend="up"
          intent="positive"
          deltaLabel="active spend rate"
          icon={<Activity className="h-5 w-5" />}
          index={3}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Capital Allocation</CardTitle>
            <CardDescription>Budget breakdown for {rig.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {annexuresLoading ? (
              <DonutSkeleton />
            ) : (
              <BudgetDonutChart
                data={donutData}
                centerLabel="Total"
                centerValue={formatCurrency(totals.budget, "USD")}
              />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spend Trajectory</CardTitle>
            <CardDescription>Monthly actuals vs. plan</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendTrendLine data={trendData} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Annexure Performance</CardTitle>
          <CardDescription>Budget vs. actual per annexure — live from Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          {annexuresError ? (
            <QueryError message={annexuresError} onRetry={() => void refreshAnnexures()} />
          ) : annexuresLoading ? (
            <ChartSkeleton />
          ) : annexureBarData.length === 0 ? (
            <EmptyState
              title={activeProject ? "No annexures yet" : "No active project for this rig"}
              message={
                activeProject
                  ? "Insert annexure rows for this project to populate the chart."
                  : "Create a project row for this rig to start tracking budgets."
              }
            />
          ) : (
            <BudgetVsActualBar data={annexureBarData} />
          )}
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-text">Annexures</h2>
          <span className="text-xs text-brand-muted">
            {annexures.length} categor{annexures.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {projectsLoading || annexuresLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : annexures.length === 0 ? (
          <EmptyState
            title="No annexures yet"
            message="Once annexures are inserted for this rig's project, they'll appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {annexures.map((a) => {
              const burn = a.total_budget ? (a.total_actual / a.total_budget) * 100 : 0;
              return (
                <Link
                  key={a.id}
                  href={`/projects/${activeProject?.id}/annexures/${a.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-brand-green/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono uppercase text-brand-muted">
                            ANX-{a.number}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-brand-text">
                            {a.name}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-brand-muted transition-colors group-hover:text-brand-green" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-brand-muted">Budget</span>
                        <span className="font-medium text-brand-text">
                          ${formatCompact(a.total_budget || a.budget_usd)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-border/50">
                        <div
                          className={
                            burn > 90
                              ? "h-full bg-brand-danger"
                              : burn > 70
                                ? "h-full bg-brand-warning"
                                : "h-full bg-brand-green"
                          }
                          style={{ width: `${Math.min(burn, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-brand-muted">
                        <span>Spent ${formatCompact(a.total_actual)}</span>
                        <span>{burn.toFixed(0)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
