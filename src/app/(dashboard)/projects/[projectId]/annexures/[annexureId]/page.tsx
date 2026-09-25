"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/cards/KPICard";
import { LineItemsTable } from "@/components/tables/LineItemsTable";
import {
  ChartSkeleton,
  DonutSkeleton,
  TableSkeleton,
} from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { POGeneratorModal } from "@/components/po/POGeneratorModal";
import { useAnnexure } from "@/hooks/useAnnexures";
import { useLineItems } from "@/hooks/useLineItems";
import { useRig } from "@/hooks/useRig";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/lib/constants";
import { formatCompact, formatCurrency } from "@/lib/utils";
import type { LineItemStatus } from "@/types/database";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);

const STATUSES: LineItemStatus[] = ["pending", "on-track", "watch", "overrun"];

export default function AnnexurePage() {
  const params = useParams<{ projectId: string; annexureId: string }>();
  const projectId = params.projectId;
  const annexureId = params.annexureId;

  const { annexure, loading: annexureLoading, error: annexureError } = useAnnexure(
    projectId,
    annexureId,
  );
  const {
    lineItems,
    loading: lineItemsLoading,
    error: lineItemsError,
    refresh: refreshLineItems,
  } = useLineItems(annexure?.id ?? null);
  const { user } = useAuth();

  // Rig name is best-effort: we don't know the rig id from the URL, so
  // we hand off the project id and let useRig show a friendly title only
  // once the annexure loads. If your URL scheme includes the rig, wire
  // it in here.
  const { rig } = useRig(projectId);

  const [poOpen, setPoOpen] = useState(false);

  const totals = useMemo(() => {
    const byStatus: Record<LineItemStatus, { count: number; total: number }> = {
      pending: { count: 0, total: 0 },
      "on-track": { count: 0, total: 0 },
      watch: { count: 0, total: 0 },
      overrun: { count: 0, total: 0 },
    };

    let budget = 0;
    let actual = 0;

    lineItems.forEach((li) => {
      budget += Number(li.budget_usd ?? 0);
      const rowActual = Number(li.actual_usd_computed ?? 0);
      actual += rowActual;
      const bucket = byStatus[li.status];
      if (bucket) {
        bucket.count += 1;
        bucket.total += rowActual;
      }
    });

    const totalBudget = annexure?.total_budget || annexure?.budget_usd || budget;
    return {
      budget: totalBudget,
      actual,
      committed: byStatus["on-track"].total,
      remaining: Math.max(0, totalBudget - actual),
      byStatus,
    };
  }, [lineItems, annexure]);

  if (annexureError) {
    return (
      <main className="flex-1 p-6">
        <QueryError message={annexureError} />
      </main>
    );
  }

  if (annexureLoading || !annexure) {
    return (
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <TableSkeleton />
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-1 text-xs text-brand-muted">
            <Link href="/fleet" className="hover:text-brand-text">Fleet</Link>
            {rig && (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link href={`/rig/${rig.id}`} className="hover:text-brand-text">
                  {rig.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono font-medium text-brand-text">ANX-{annexure.number}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            {annexure.name}
          </h1>
          <p className="text-sm text-brand-muted">
            {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} · Budget{" "}
            {formatCurrency(totals.budget, "USD")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" /> Add Line Item
          </Button>
          <Button
            onClick={() => setPoOpen(true)}
            size="sm"
            disabled={lineItems.length === 0}
          >
            <FileText className="h-4 w-4" /> Generate PO
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Budget"
          value={`$${formatCompact(totals.budget)}`}
          numericValue={totals.budget}
          format={(n) => `$${formatCompact(n)}`}
          index={0}
        />
        <KPICard
          label="Actual"
          value={`$${formatCompact(totals.actual)}`}
          numericValue={totals.actual}
          format={(n) => `$${formatCompact(n)}`}
          intent={totals.actual / totals.budget > 0.8 ? "negative" : "positive"}
          trend="up"
          delta={totals.budget ? (totals.actual / totals.budget) * 100 : 0}
          deltaLabel="of budget"
          index={1}
        />
        <KPICard
          label="On Track"
          value={`$${formatCompact(totals.committed)}`}
          numericValue={totals.committed}
          format={(n) => `$${formatCompact(n)}`}
          hint={`${totals.byStatus["on-track"].count} lines`}
          index={2}
        />
        <KPICard
          label="Remaining"
          value={`$${formatCompact(totals.remaining)}`}
          numericValue={totals.remaining}
          format={(n) => `$${formatCompact(n)}`}
          intent={totals.remaining < totals.budget * 0.1 ? "negative" : "positive"}
          hint="Available to commit"
          index={3}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>Live annexure budget breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {lineItemsLoading ? (
              <DonutSkeleton />
            ) : (
              <BudgetDonutChart
                data={[
                  { name: "Actual", value: totals.actual, color: BRAND.danger },
                  { name: "On Track", value: totals.committed, color: BRAND.warning },
                  { name: "Available", value: totals.remaining, color: BRAND.primary },
                ]}
                centerLabel="Budget"
                centerValue={formatCurrency(totals.budget, "USD")}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Variance by Status</CardTitle>
            <CardDescription>Line-item spend rolled up by status bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STATUSES.map((status) => {
                const { count, total } = totals.byStatus[status];
                const pct = totals.budget ? (total / totals.budget) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-brand-muted">
                        {status} ({count})
                      </span>
                      <span className="font-mono text-brand-text">
                        ${formatCompact(total)} · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-border/40">
                      <div
                        className={
                          status === "overrun"
                            ? "h-full rounded-full bg-brand-danger"
                            : status === "watch"
                              ? "h-full rounded-full bg-brand-warning"
                              : "h-full rounded-full bg-brand-green"
                        }
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            {annexure.name} — procurement detail, live from Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lineItemsError ? (
            <QueryError message={lineItemsError} onRetry={() => void refreshLineItems()} />
          ) : lineItemsLoading ? (
            <TableSkeleton />
          ) : lineItems.length === 0 ? (
            <EmptyState
              title="No line items yet"
              message="Insert rows into public.line_items for this annexure to populate the table."
            />
          ) : (
            <LineItemsTable items={lineItems} />
          )}
        </CardContent>
      </Card>

      {rig && (
        <POGeneratorModal
          open={poOpen}
          onOpenChange={setPoOpen}
          lineItems={lineItems.filter(
            (li) => li.status === "pending" || li.status === "on-track",
          )}
          rigName={rig.name}
          projectName={`${rig.name} Program`}
          annexureName={annexure.name}
          projectId={projectId}
          annexureId={annexure.id}
          raisedById={user?.id ?? "demo-user"}
          raisedByName={user?.full_name ?? "Demo User"}
        />
      )}
    </main>
  );
}
