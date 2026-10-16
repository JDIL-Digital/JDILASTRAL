"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  Calendar,
  DollarSign,
  Percent,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/cards/KPICard";
import {
  CardSkeleton,
  ChartSkeleton,
  DonutSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useRig } from "@/hooks/useRigs";
import { useProjects } from "@/hooks/useProjects";
import { useAnnexures } from "@/hooks/useAnnexures";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { BLUR_DATA_URL, BRAND } from "@/lib/constants";
import { cn, formatCompact, formatCurrency, formatDate, slugify } from "@/lib/utils";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
const BudgetVsActualBar = dynamic(
  () => import("@/components/charts/BudgetVsActualBar").then((m) => m.BudgetVsActualBar),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

// Donut palette — one color per annexure, repeats after 11
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

const STATUS_VARIANT: Record<
  "active" | "maintenance" | "standby",
  { label: string; variant: "default" | "warning" | "secondary" }
> = {
  active: { label: "ACTIVE", variant: "default" },
  maintenance: { label: "MAINTENANCE", variant: "warning" },
  standby: { label: "STANDBY", variant: "secondary" },
};

/** Rig name → photo slug. The DB stores names; files live at /rigs/<slug>.jpg. */
function rigPhotoPath(name: string): string {
  return `/rigs/${slugify(name)}.jpg`;
}

/** Human-readable "updated X ago" without a date-fns import. */
function timeAgo(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH === 1 ? "" : "s"} ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD} day${diffD === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

export default function RigPage() {
  const params = useParams<{ rigId: string }>();
  const rigId = params.rigId;

  const { rig, loading: rigLoading, error: rigError, refresh: refreshRig } = useRig(rigId);
  const { projects, loading: projectsLoading } = useProjects(rig?.id ?? null);
  const activeProject = projects[0] ?? null;

  const {
    annexures,
    loading: annexuresLoading,
    error: annexuresError,
    refresh: refreshAnnexures,
  } = useAnnexures(activeProject?.id ?? null);

  const { activity, loading: activityLoading } = useRecentActivity(rig?.id ?? null);

  const totals = useMemo(() => {
    const budget = annexures.reduce(
      (s, a) => s + (a.total_budget || Number(a.budget_usd ?? 0)),
      0,
    );
    const actual = annexures.reduce((s, a) => s + a.total_actual, 0);
    const remaining = budget - actual;
    const pctSpent = budget > 0 ? (actual / budget) * 100 : 0;
    return { budget, actual, remaining, pctSpent };
  }, [annexures]);

  const donutData = useMemo(
    () =>
      annexures.map((a, i) => ({
        name: `Ann ${roman(a.number)} — ${a.name}`,
        value: a.total_budget || Number(a.budget_usd ?? 0),
        color: DONUT_PALETTE[i % DONUT_PALETTE.length],
      })),
    [annexures],
  );

  const barData = useMemo(
    () =>
      annexures.map((a) => ({
        name: `Ann ${roman(a.number)}`,
        budget: a.total_budget || Number(a.budget_usd ?? 0),
        actual: a.total_actual,
      })),
    [annexures],
  );

  const pctSpentIntent =
    totals.pctSpent > 100
      ? "negative"
      : totals.pctSpent > 85
        ? "neutral"
        : "positive";
  const pctSpentColor =
    totals.pctSpent > 100
      ? "text-brand-danger"
      : totals.pctSpent > 85
        ? "text-brand-warning"
        : "text-brand-success";

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
        <div className="h-72 w-full animate-pulse rounded-2xl bg-brand-border/40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  const statusMeta =
    STATUS_VARIANT[rig.status as "active" | "maintenance" | "standby"] ?? STATUS_VARIANT.active;

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* -------------------- HERO -------------------- */}
      <section className="relative h-72 w-full overflow-hidden rounded-2xl border border-brand-border md:h-80">
        {/* Background photo + gradient underlay fallback */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-brand-green/35 via-brand-bg to-brand-bg"
        />
        <Image
          src={rigPhotoPath(rig.name)}
          alt={`${rig.name} rig`}
          fill
          sizes="100vw"
          priority
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        {/* Dark gradient overlay from bottom to top (keeps text legible). */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.1) 80%, transparent 100%)",
          }}
        />
        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-8">
          <div className="flex items-start justify-between gap-2">
            <Link
              href="/fleet"
              className="text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white"
            >
              ← Fleet
            </Link>
            <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
              Updated{" "}
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={statusMeta.variant}
                className={cn(
                  "inline-flex items-center gap-1.5 border-0 px-2.5 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur-md",
                  rig.status === "active" && "bg-brand-success/25 text-white",
                  rig.status === "maintenance" && "bg-brand-warning/25 text-white",
                  rig.status === "standby" && "bg-slate-400/30 text-white",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    rig.status === "active" && "bg-brand-success animate-pulse-dot",
                    rig.status === "maintenance" && "bg-brand-warning",
                    rig.status === "standby" && "bg-slate-300",
                  )}
                />
                {statusMeta.label}
              </Badge>
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-lg md:text-5xl">
              {rig.name}
            </h1>
            <p className="mt-1 text-sm font-medium uppercase tracking-wider text-white/80">
              {rig.type ?? "Jackup"} Drilling Rig
            </p>
            {activeProject?.start_date && (
              <p className="mt-2 flex items-center gap-2 text-xs text-white/70">
                <Calendar className="h-3 w-3" />
                Project: {activeProject.name} · started {formatDate(activeProject.start_date)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* -------------------- KPI CARDS -------------------- */}
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
          label="Total Actual"
          value={`$${formatCompact(totals.actual)}`}
          numericValue={totals.actual}
          format={(n) => `$${formatCompact(n)}`}
          icon={<DollarSign className="h-5 w-5" />}
          index={1}
          intent={totals.pctSpent > 85 ? "negative" : "positive"}
          trend="up"
          delta={totals.pctSpent}
          deltaLabel="of budget"
        />
        <KPICard
          label="Remaining"
          value={`${totals.remaining < 0 ? "-" : ""}$${formatCompact(Math.abs(totals.remaining))}`}
          numericValue={Math.abs(totals.remaining)}
          format={(n) => `${totals.remaining < 0 ? "-" : ""}$${formatCompact(n)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          index={2}
          intent={totals.remaining < 0 ? "negative" : "positive"}
          hint={totals.remaining < 0 ? "Over budget" : "Available"}
        />
        <KPICard
          label="% Spent"
          value={`${totals.pctSpent.toFixed(1)}%`}
          numericValue={totals.pctSpent}
          format={(n) => `${n.toFixed(1)}%`}
          decimals={1}
          icon={<Percent className={cn("h-5 w-5", pctSpentColor)} />}
          index={3}
          intent={pctSpentIntent}
          hint={
            totals.pctSpent > 100
              ? "Over budget"
              : totals.pctSpent > 85
                ? "Watch"
                : "On track"
          }
        />
      </section>

      {/* -------------------- CHARTS -------------------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Budget by Annexure</CardTitle>
            <CardDescription>Share of the rig&apos;s total budget</CardDescription>
          </CardHeader>
          <CardContent>
            {annexuresLoading ? (
              <DonutSkeleton />
            ) : donutData.length === 0 ? (
              <EmptyState
                title="No annexures yet"
                message="Seed the annexures table for this project to populate the chart."
              />
            ) : (
              <BudgetDonutChart
                data={donutData}
                centerLabel="Total"
                centerValue={formatCurrency(totals.budget, "USD")}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Budget vs Actual</CardTitle>
            <CardDescription>
              Grouped per annexure · overruns highlight red
            </CardDescription>
          </CardHeader>
          <CardContent>
            {annexuresLoading ? (
              <ChartSkeleton />
            ) : barData.length === 0 ? (
              <EmptyState
                title="No annexure data"
                message="Once line items roll up, this chart will light up."
              />
            ) : (
              <BudgetVsActualBar data={barData} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* -------------------- ANNEXURE SUMMARY TABLE -------------------- */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Annexure Summary</CardTitle>
            <CardDescription>
              {annexures.length} annexure{annexures.length === 1 ? "" : "s"} ·{" "}
              {activeProject?.name ?? "No active project"}
            </CardDescription>
          </div>
          {activeProject && annexures.length > 0 && (
            <Link href={`/projects/${activeProject.id}/annexures/${annexures[0].id}`}>
              <Button variant="outline" size="sm">
                Open annexures <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {annexuresError ? (
            <QueryError message={annexuresError} onRetry={() => void refreshAnnexures()} />
          ) : annexuresLoading || projectsLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : annexures.length === 0 ? (
            <EmptyState
              title={activeProject ? "No annexures yet" : "No active project"}
              message={
                activeProject
                  ? "Insert annexure rows for this project to populate the table."
                  : "Create a project row for this rig to track budgets."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
                  <tr>
                    <th className="py-2 pr-3">Annexure</th>
                    <th className="py-2 pr-3 text-right">Budget USD</th>
                    <th className="py-2 pr-3 text-right">Actual USD</th>
                    <th className="py-2 pr-3 text-right">Remaining</th>
                    <th className="py-2 pr-3">% Used</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {annexures.map((a) => {
                    const budget = a.total_budget || Number(a.budget_usd ?? 0);
                    const actual = a.total_actual;
                    const remaining = budget - actual;
                    const pct = budget > 0 ? (actual / budget) * 100 : 0;
                    const barColor =
                      pct > 100
                        ? "bg-brand-danger"
                        : pct > 85
                          ? "bg-brand-warning"
                          : "bg-brand-green";
                    const status =
                      pct > 100
                        ? { label: "Overrun", variant: "destructive" as const }
                        : pct > 85
                          ? { label: "Watch", variant: "warning" as const }
                          : actual === 0
                            ? { label: "Pending", variant: "secondary" as const }
                            : { label: "On Track", variant: "default" as const };
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-brand-border/60 transition-colors hover:bg-brand-border/20"
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-brand-border bg-brand-bg/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-brand-muted">
                              {roman(a.number)}
                            </span>
                            <span className="font-medium text-brand-text">{a.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          ${formatCompact(budget)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          ${formatCompact(actual)}
                        </td>
                        <td
                          className={cn(
                            "py-3 pr-3 text-right font-mono tabular-nums",
                            remaining < 0 ? "text-brand-danger" : "text-brand-text",
                          )}
                        >
                          {remaining < 0 ? "-" : ""}${formatCompact(Math.abs(remaining))}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-border/50">
                              <div
                                className={cn("h-full rounded-full transition-all", barColor)}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-brand-muted">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <Link
                            href={`/projects/${activeProject?.id}/annexures/${a.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
                          >
                            View Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------------------- RECENT ACTIVITY -------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-green" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Last {activity.length || 10} line items touched across this rig&apos;s annexures
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : activity.length === 0 ? (
            <EmptyState
              title="No recent activity"
              message="Edits to any line item on this rig will stream in here."
            />
          ) : (
            <ul className="divide-y divide-brand-border">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-text">
                      {item.description || "(no description)"}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      Ann {roman(item.annexure_number)} · {item.annexure_name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-brand-text">
                      {formatCurrency(item.actual_usd_computed, "USD")}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">{timeAgo(item.updated_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
