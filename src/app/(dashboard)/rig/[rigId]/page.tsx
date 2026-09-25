"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
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
import dynamic from "next/dynamic";
import { ChartSkeleton, DonutSkeleton } from "@/components/ui/Skeletons";

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
import { useRig } from "@/hooks/useRig";
import { useAnnexures } from "@/hooks/useAnnexure";
import { BRAND } from "@/lib/constants";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default function RigPage() {
  const params = useParams<{ rigId: string }>();
  const rigId = params.rigId;
  const { rig } = useRig(rigId);

  const projectId = `${rigId}-prj-1`;
  const { annexures } = useAnnexures(projectId);

  const annexureBarData = useMemo(
    () =>
      annexures.map((a) => ({
        name: a.code,
        budget: a.budget_usd,
        actual: a.spent_usd,
        committed: a.committed_usd,
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

  if (!rig) {
    return (
      <main className="flex-1 p-6">
        <Card>
          <CardContent className="p-6 text-brand-muted">
            Rig not found. <Link href="/fleet" className="text-brand-green">Return to fleet</Link>.
          </CardContent>
        </Card>
      </main>
    );
  }

  const donutData = [
    { name: "Spent", value: rig.spent_usd, color: BRAND.danger },
    { name: "Committed", value: rig.committed_usd, color: BRAND.warning },
    {
      name: "Available",
      value: Math.max(0, rig.total_budget_usd - rig.spent_usd - rig.committed_usd),
      color: BRAND.primary,
    },
  ];

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green">
              <Anchor className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-muted">
                {rig.type} · {rig.operator}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
                {rig.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-brand-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {rig.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDate(rig.contract_start)} →{" "}
                  {formatDate(rig.contract_end)}
                </span>
                <Badge
                  variant={
                    rig.status === "operational"
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
            value={`$${formatCompact(rig.total_budget_usd)}`}
            icon={<Wallet className="h-5 w-5" />}
          />
          <KPICard
            label="Spent (YTD)"
            value={`$${formatCompact(rig.spent_usd)}`}
            trend="up"
            delta={(rig.spent_usd / rig.total_budget_usd) * 100 - 50}
            intent={rig.spent_usd / rig.total_budget_usd > 0.7 ? "negative" : "positive"}
            deltaLabel="of budget"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <KPICard
            label="Committed"
            value={`$${formatCompact(rig.committed_usd)}`}
            hint="Open POs + Pending"
            icon={<Calendar className="h-5 w-5" />}
          />
          <KPICard
            label="Utilization"
            value={formatPercent(rig.utilization_pct, 0)}
            trend="up"
            delta={2.1}
            intent="positive"
            deltaLabel="vs. plan"
            icon={<Activity className="h-5 w-5" />}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Capital Allocation</CardTitle>
              <CardDescription>Budget breakdown for {rig.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetDonutChart
                data={donutData}
                centerLabel="Total"
                centerValue={formatCurrency(rig.total_budget_usd, "USD")}
              />
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
            <CardDescription>Budget vs. actual by annexure category</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetVsActualBar data={annexureBarData} />
          </CardContent>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand-text">Annexures</h2>
            <span className="text-xs text-brand-muted">{annexures.length} categories</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {annexures.map((a) => {
              const burn = (a.spent_usd / a.budget_usd) * 100;
              return (
                <Link
                  key={a.id}
                  href={`/projects/${projectId}/annexures/${a.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-brand-green/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono uppercase text-brand-muted">
                            {a.code}
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
                          ${formatCompact(a.budget_usd)}
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
                        <span>Spent ${formatCompact(a.spent_usd)}</span>
                        <span>{burn.toFixed(0)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
      </section>
    </main>
  );
}
