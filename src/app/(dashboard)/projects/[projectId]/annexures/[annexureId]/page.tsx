"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/cards/KPICard";
import { LineItemsTable } from "@/components/tables/LineItemsTable";
import dynamic from "next/dynamic";
import { DonutSkeleton } from "@/components/ui/Skeletons";

const BudgetDonutChart = dynamic(
  () => import("@/components/charts/BudgetDonutChart").then((m) => m.BudgetDonutChart),
  { ssr: false, loading: () => <DonutSkeleton /> },
);
import { POGeneratorModal } from "@/components/po/POGeneratorModal";
import { useAnnexure } from "@/hooks/useAnnexure";
import { useLineItems } from "@/hooks/useLineItems";
import { useRig } from "@/hooks/useRig";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/lib/constants";
import { formatCompact, formatCurrency } from "@/lib/utils";

export default function AnnexurePage() {
  const params = useParams<{ projectId: string; annexureId: string }>();
  const projectId = params.projectId;
  const annexureId = params.annexureId;

  const rigSlug = projectId.replace(/-prj-\d+$/, "");
  const { rig } = useRig(rigSlug);
  const { annexure } = useAnnexure(projectId, annexureId);
  const { items } = useLineItems(annexureId);
  const { user } = useAuth();
  const [poOpen, setPoOpen] = useState(false);

  const totals = useMemo(() => {
    const spent = items
      .filter((i) => ["received", "invoiced", "paid"].includes(i.status))
      .reduce((acc, i) => acc + i.total_usd, 0);
    const committed = items
      .filter((i) => ["requested", "ordered"].includes(i.status))
      .reduce((acc, i) => acc + i.total_usd, 0);
    const planned = items
      .filter((i) => i.status === "planned")
      .reduce((acc, i) => acc + i.total_usd, 0);
    const budget = annexure?.budget_usd ?? 0;
    return { spent, committed, planned, budget, remaining: Math.max(0, budget - spent - committed) };
  }, [items, annexure]);

  if (!annexure || !rig) {
    return (
      <main className="flex-1 p-6">
        <Card>
          <CardContent className="p-6 text-brand-muted">Annexure not found.</CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-1 text-xs text-brand-muted">
              <Link href="/fleet" className="hover:text-brand-text">Fleet</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/rig/${rigSlug}`} className="hover:text-brand-text">{rig.name}</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-brand-text">{annexure.code}</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
              {annexure.name}
            </h1>
            <p className="text-sm text-brand-muted">
              {items.length} line items · Budget {formatCurrency(annexure.budget_usd, "USD")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Add Line Item
            </Button>
            <Button onClick={() => setPoOpen(true)} size="sm">
              <FileText className="h-4 w-4" /> Generate PO
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard label="Budget" value={`$${formatCompact(totals.budget)}`} />
          <KPICard
            label="Spent"
            value={`$${formatCompact(totals.spent)}`}
            intent={totals.spent / totals.budget > 0.8 ? "negative" : "positive"}
            trend="up"
            delta={(totals.spent / totals.budget) * 100}
            deltaLabel="of budget"
          />
          <KPICard
            label="Committed"
            value={`$${formatCompact(totals.committed)}`}
            hint="Pending PO + Approved"
          />
          <KPICard
            label="Remaining"
            value={`$${formatCompact(totals.remaining)}`}
            intent={totals.remaining < totals.budget * 0.1 ? "negative" : "positive"}
            hint="Available to commit"
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
              <CardDescription>Annexure budget breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetDonutChart
                data={[
                  { name: "Spent", value: totals.spent, color: BRAND.danger },
                  { name: "Committed", value: totals.committed, color: BRAND.warning },
                  { name: "Available", value: totals.remaining, color: BRAND.primary },
                ]}
                centerLabel="Budget"
                centerValue={formatCurrency(totals.budget, "USD")}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Variance Analysis</CardTitle>
              <CardDescription>Line-item level commitment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["planned", "requested", "ordered", "received", "invoiced", "paid"] as const).map(
                  (status) => {
                    const filtered = items.filter((i) => i.status === status);
                    const total = filtered.reduce((acc, i) => acc + i.total_usd, 0);
                    const pct = totals.budget ? (total / totals.budget) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="capitalize text-brand-muted">
                            {status} ({filtered.length})
                          </span>
                          <span className="font-mono text-brand-text">
                            ${formatCompact(total)} · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-border/40">
                          <div
                            className="h-full rounded-full bg-brand-green"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>
              Procurement detail for {annexure.code} — {annexure.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineItemsTable items={items} />
          </CardContent>
        </Card>

        <POGeneratorModal
          open={poOpen}
          onOpenChange={setPoOpen}
          lineItems={items.filter((i) => i.status === "planned" || i.status === "requested")}
          rigName={rig.name}
          projectName={`${rig.name} Drilling Program`}
          annexureName={annexure.name}
          rigId={rig.id}
          projectId={projectId}
          annexureId={annexure.id}
          raisedById={user?.id ?? "demo-user"}
        raisedByName={user?.full_name ?? "Demo User"}
      />
    </main>
  );
}
