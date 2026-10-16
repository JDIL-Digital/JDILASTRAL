"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableSkeleton, CardSkeleton } from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";
import { useProjects } from "@/hooks/useProjects";
import { useAllLineItems, type LineItemsByAnnexure } from "@/hooks/useAllLineItems";
import { exportProjectSummaryToXlsx } from "@/lib/excel/exportProjectSummary";
import { downloadProjectSummaryPdf } from "@/lib/pdf/generateProjectSummary";
import { cn, formatCompact, formatCurrency, formatDate } from "@/lib/utils";

const USD_TO_INR = 83.3;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

interface StatusMeta {
  label: string;
  variant: "default" | "warning" | "destructive" | "secondary";
  dot: string;
}

function statusFor(budget: number, actual: number): StatusMeta {
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  if (pct > 100) return { label: "Overrun", variant: "destructive", dot: "bg-brand-danger" };
  if (pct > 85) return { label: "Watch", variant: "warning", dot: "bg-brand-warning" };
  if (actual === 0) return { label: "Pending", variant: "secondary", dot: "bg-slate-400" };
  return { label: "On Track", variant: "default", dot: "bg-brand-success" };
}

export default function ProjectSummaryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const { projects, loading: projectsLoading } = useProjects();
  const project = projects.find((p) => p.id === projectId) ?? null;
  const rigName = project?.rigs?.name ?? "—";

  const {
    grouped,
    loading: itemsLoading,
    error: itemsError,
    refresh: refreshItems,
  } = useAllLineItems(projectId);

  const toast = useToast();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const totals = useMemo(() => {
    const budgetUsd = grouped.reduce(
      (s, g) => s + (g.total_budget || g.budget_usd),
      0,
    );
    const actualUsd = grouped.reduce((s, g) => s + g.total_actual, 0);
    const remainingUsd = budgetUsd - actualUsd;
    const pct = budgetUsd > 0 ? (actualUsd / budgetUsd) * 100 : 0;
    return { budgetUsd, actualUsd, remainingUsd, pct };
  }, [grouped]);

  async function onExportExcel() {
    if (!project) return;
    setExporting("xlsx");
    try {
      const file = exportProjectSummaryToXlsx({
        projectName: project.name,
        rigName,
        startDate: project.start_date ?? null,
        grouped,
      });
      toast.success("Excel exported", file);
    } catch (e) {
      toast.error("Excel export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(null);
    }
  }

  async function onExportPdf() {
    if (!project) return;
    setExporting("pdf");
    try {
      const file = downloadProjectSummaryPdf({
        projectName: project.name,
        rigName,
        startDate: project.start_date ?? null,
        endDate: project.end_date ?? null,
        grouped,
      });
      toast.success("PDF exported", file);
    } catch (e) {
      toast.error("PDF export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(null);
    }
  }

  if (projectsLoading && !project) {
    return (
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <TableSkeleton rows={6} columns={10} />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex-1 p-6">
        <EmptyState title="Project not found" message="Check the URL or pick another project." />
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-1 text-xs text-brand-muted">
            <Link href="/projects" className="hover:text-brand-text">Projects</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-text">{rigName}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-text">{project.name}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-brand-green">Summary</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            {project.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-brand-muted">
            <Badge
              variant={
                project.status === "active"
                  ? "default"
                  : project.status === "completed"
                    ? "secondary"
                    : "warning"
              }
              className="capitalize"
            >
              {project.status}
            </Badge>
            <span>{rigName}</span>
            {project.start_date && <span>Started {formatDate(project.start_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={exporting !== null || grouped.length === 0}
            className="border-brand-green text-brand-green hover:bg-brand-green/10"
          >
            {exporting === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Excel
          </Button>
          <Button
            size="sm"
            onClick={onExportPdf}
            disabled={exporting !== null || grouped.length === 0}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>
      </header>

      {/* ---------- Summary Table ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Project Summary</CardTitle>
          <CardDescription>
            {grouped.length} annexure{grouped.length === 1 ? "" : "s"} · 1 USD = {USD_TO_INR} INR
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsError ? (
            <QueryError message={itemsError} onRetry={() => void refreshItems()} />
          ) : itemsLoading ? (
            <TableSkeleton rows={11} columns={10} />
          ) : grouped.length === 0 ? (
            <EmptyState
              title="No annexures yet"
              message="Insert annexure rows for this project to populate the summary."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-brand-border text-left text-xs uppercase tracking-wider text-brand-muted">
                  <tr>
                    <th className="py-2 pr-3">Ann No</th>
                    <th className="py-2 pr-3">Annexure Name</th>
                    <th className="py-2 pr-3 text-right">Budget USD</th>
                    <th className="py-2 pr-3 text-right">Budget INR</th>
                    <th className="py-2 pr-3 text-right">Actual USD</th>
                    <th className="py-2 pr-3 text-right">Actual INR</th>
                    <th className="py-2 pr-3 text-right">Remaining USD</th>
                    <th className="py-2 pr-3 text-right">Remaining INR</th>
                    <th className="py-2 pr-3">% Used</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g) => {
                    const budget = g.total_budget || g.budget_usd;
                    const actual = g.total_actual;
                    const remaining = budget - actual;
                    const pct = budget > 0 ? (actual / budget) * 100 : 0;
                    const barColor =
                      pct > 100
                        ? "bg-brand-danger"
                        : pct > 85
                          ? "bg-brand-warning"
                          : "bg-brand-green";
                    const status = statusFor(budget, actual);
                    return (
                      <tr
                        key={g.annexureId}
                        className="border-b border-brand-border/60 transition-colors hover:bg-brand-border/20"
                      >
                        <td className="py-3 pr-3">
                          <span className="rounded border border-brand-border bg-brand-bg/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-brand-muted">
                            {roman(g.number)}
                          </span>
                        </td>
                        <td className="py-3 pr-3 font-medium text-brand-text">{g.name}</td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          {formatCurrency(budget, "USD")}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-brand-muted">
                          {formatCurrency(budget * USD_TO_INR, "INR")}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          {formatCurrency(actual, "USD")}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-brand-muted">
                          {formatCurrency(actual * USD_TO_INR, "INR")}
                        </td>
                        <td
                          className={cn(
                            "py-3 pr-3 text-right font-mono tabular-nums",
                            remaining < 0 ? "text-brand-danger" : "text-brand-text",
                          )}
                        >
                          {formatCurrency(remaining, "USD")}
                        </td>
                        <td
                          className={cn(
                            "py-3 pr-3 text-right font-mono tabular-nums",
                            remaining < 0 ? "text-brand-danger" : "text-brand-muted",
                          )}
                        >
                          {formatCurrency(remaining * USD_TO_INR, "INR")}
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
                      </tr>
                    );
                  })}
                </tbody>
                {/* ---------- Totals row ---------- */}
                <tfoot>
                  <tr className="border-t-2 border-brand-green/40 bg-brand-bg/70 font-semibold">
                    <td className="py-3 pr-3 font-mono text-xs uppercase text-brand-muted">Σ</td>
                    <td className="py-3 pr-3 text-brand-text">
                      TOTAL ({grouped.length} annexures)
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-brand-green">
                      {formatCurrency(totals.budgetUsd, "USD")}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-brand-muted">
                      {formatCurrency(totals.budgetUsd * USD_TO_INR, "INR")}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-brand-green">
                      {formatCurrency(totals.actualUsd, "USD")}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-brand-muted">
                      {formatCurrency(totals.actualUsd * USD_TO_INR, "INR")}
                    </td>
                    <td
                      className={cn(
                        "py-3 pr-3 text-right font-mono font-bold tabular-nums",
                        totals.remainingUsd < 0 ? "text-brand-danger" : "text-brand-text",
                      )}
                    >
                      {formatCurrency(totals.remainingUsd, "USD")}
                    </td>
                    <td
                      className={cn(
                        "py-3 pr-3 text-right font-mono tabular-nums text-brand-muted",
                        totals.remainingUsd < 0 && "text-brand-danger",
                      )}
                    >
                      {formatCurrency(totals.remainingUsd * USD_TO_INR, "INR")}
                    </td>
                    <td className="py-3 pr-3 font-mono font-bold text-brand-green">
                      {totals.pct.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- 11 annexure breakdown cards ---------- */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-brand-text">
              Annexure Breakdown
            </h2>
            <p className="text-sm text-brand-muted">
              Top-3 line items per annexure by actual spend
            </p>
          </div>
        </div>
        {itemsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState title="No annexures" message="Nothing to break down yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {grouped.map((g) => (
              <AnnexureBreakdownCard
                key={g.annexureId}
                group={g}
                projectId={projectId}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* --------------------------------- Card --------------------------------- */

function AnnexureBreakdownCard({
  group,
  projectId,
}: {
  group: LineItemsByAnnexure;
  projectId: string;
}) {
  const budget = group.total_budget || group.budget_usd;
  const actual = group.total_actual;
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  const barColor =
    pct > 100 ? "bg-brand-danger" : pct > 85 ? "bg-brand-warning" : "bg-brand-green";
  const barWidth = Math.min(pct, 100);
  const actualPct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;

  // Top 3 line items by actual spend
  const topThree = useMemo(
    () =>
      [...group.items]
        .sort(
          (a, b) =>
            Number(b.actual_usd_computed ?? 0) - Number(a.actual_usd_computed ?? 0),
        )
        .slice(0, 3),
    [group.items],
  );

  const status = statusFor(budget, actual);

  return (
    <Card className="transition-colors hover:border-brand-green/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase text-brand-muted">
              Annexure {roman(group.number)}
            </p>
            <CardTitle className="text-base leading-tight">{group.name}</CardTitle>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Budget vs Actual mini-chart (horizontal paired bars) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-brand-muted">
            <span>Budget</span>
            <span className="font-mono text-brand-text">
              ${formatCompact(budget)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-border/40">
            <div className="h-full rounded-full bg-brand-info/70" style={{ width: "100%" }} />
          </div>
          <div className="flex items-center justify-between text-xs text-brand-muted">
            <span>Actual</span>
            <span className="font-mono text-brand-text">
              ${formatCompact(actual)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-border/40">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${actualPct}%` }}
            />
          </div>
        </div>

        {/* Top 3 line items */}
        {topThree.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
              Top 3 by spend
            </p>
            <ul className="space-y-1 text-xs">
              {topThree.map((li) => (
                <li
                  key={li.id}
                  className="flex items-start justify-between gap-2 border-l-2 border-brand-green/40 pl-2"
                >
                  <span className="min-w-0 truncate text-brand-text">
                    {li.description}
                  </span>
                  <span className="shrink-0 font-mono text-brand-muted">
                    ${formatCompact(Number(li.actual_usd_computed ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* % complete progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-brand-muted">
            <span>% Used</span>
            <span className={cn("font-mono", pct > 100 && "text-brand-danger")}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-border/50">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-brand-muted">
            {group.items.length} line item{group.items.length === 1 ? "" : "s"}
          </span>
          <Link
            href={`/projects/${projectId}/annexures/${group.annexureId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
          >
            View Details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
