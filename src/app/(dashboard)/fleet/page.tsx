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
import { useRigs } from "@/hooks/useRig";
import { APP, BRAND } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

/* ----- Dynamic chart imports — kept off the initial bundle for fast TTI ----- */
const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
const SpendTrendLine = dynamic(
  () => import("@/components/charts/SpendTrendLine").then((m) => m.SpendTrendLine),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export default function FleetPage() {
  const { rigs, loading } = useRigs();
  const [now, setNow] = useState<Date | null>(null);

  // Live clock — tick every second client-side, never run during SSR.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const aggregate = useMemo(() => {
    const budget = rigs.reduce((acc, r) => acc + r.total_budget_usd, 0);
    const spent = rigs.reduce((acc, r) => acc + r.spent_usd, 0);
    const committed = rigs.reduce((acc, r) => acc + r.committed_usd, 0);
    const utilization = rigs.length
      ? rigs.reduce((acc, r) => acc + r.utilization_pct, 0) / rigs.length
      : 0;
    return { budget, spent, committed, utilization, remaining: budget - spent - committed };
  }, [rigs]);

  const burnPct = aggregate.budget ? (aggregate.spent / aggregate.budget) * 100 : 0;
  const activeCount = rigs.filter((r) => r.status === "operational").length;

  const donutData = useMemo(
    () => [
      { name: "Drilling Ops", value: aggregate.budget * 0.32, color: BRAND.primary },
      { name: "Mud & Chemicals", value: aggregate.budget * 0.14, color: "#22C55E" },
      { name: "Casing & Tubing", value: aggregate.budget * 0.18, color: BRAND.warning },
      { name: "Logistics", value: aggregate.budget * 0.12, color: "#7C5CFF" },
      { name: "HSE & Catering", value: aggregate.budget * 0.08, color: "#22B8CF" },
      { name: "Other Annexures", value: aggregate.budget * 0.16, color: BRAND.danger },
    ],
    [aggregate.budget],
  );

  const trendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return months.map((m, i) => ({
      period: m,
      spend: 18_000_000 + i * 4_200_000 + (i % 2 ? 1_500_000 : -750_000),
      budget: 22_000_000 + i * 4_500_000,
    }));
  }, []);

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

          {/* KPI row — skeletons if data hasn't arrived (currently synchronous, but the
              fallback keeps the layout from flashing once we re-introduce async fetch). */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label="Total Fleet Budget"
                value={`$${formatCurrency(aggregate.budget, "USD").replace("$", "")}`}
                numericValue={aggregate.budget}
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
                value={`$${aggregate.spent}`}
                numericValue={aggregate.spent}
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
                value={`${aggregate.utilization.toFixed(1)}%`}
                numericValue={aggregate.utilization}
                format={kpiFormatters.percent}
                decimals={1}
                trend="up"
                delta={1.4}
                intent="positive"
                deltaLabel="this month"
                icon={<Activity className="h-5 w-5" />}
                index={2}
              />
              <KPICard
                label="Active Rigs"
                value={`${activeCount} / ${rigs.length}`}
                numericValue={activeCount}
                format={(n) => `${Math.round(n)} / ${rigs.length}`}
                trend="neutral"
                intent="neutral"
                hint={`${rigs.filter((r) => r.status === "maintenance").length} in maintenance`}
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
            <BudgetDonutChart
              data={donutData}
              centerLabel="Budget"
              centerValue={formatCurrency(aggregate.budget, "USD")}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 animate-fade-in-up delay-step-3">
          <CardHeader>
            <CardTitle>Monthly Spend Trend</CardTitle>
            <CardDescription>YTD burn vs. plan across the fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendTrendLine data={trendData} />
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
              {rigs.length} jackup rigs · click any unit to drill in
            </p>
          </div>
          <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
            {activeCount} Active · {rigs.filter((r) => r.status === "maintenance").length} Maint.
          </span>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RigCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rigs.map((rig, i) => (
              <RigCard key={rig.id} rig={rig} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------------------------------------------------------------------------
   Hero background — three slow-drifting blurred blobs + radial mesh
--------------------------------------------------------------------------- */
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
