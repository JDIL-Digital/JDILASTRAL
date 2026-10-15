"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Download, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/cards/KPICard";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { QueryError } from "@/components/ui/ErrorBoundary";
import { EditableLineItemsTable } from "@/components/tables/EditableLineItemsTable";
import { AnnexureTabs } from "@/components/annexures/AnnexureTabs";
import { POGeneratorModal } from "@/components/po/POGeneratorModal";
import { useAnnexures, useAnnexure } from "@/hooks/useAnnexures";
import { useLineItems } from "@/hooks/useLineItems";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { exportAnnexureToXlsx } from "@/lib/excel/exportAnnexure";
import { formatCompact, formatCurrency } from "@/lib/utils";
import type { DbLineItem } from "@/types/database";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export default function AnnexurePage() {
  const params = useParams<{ projectId: string; annexureId: string }>();
  const projectId = params.projectId;
  const annexureId = params.annexureId;

  const { projects } = useProjects();
  const currentProject = projects.find((p) => p.id === projectId) ?? null;

  const {
    annexures,
    loading: annexuresLoading,
    error: annexuresError,
    refresh: refreshAnnexures,
  } = useAnnexures(projectId);
  const { annexure } = useAnnexure(projectId, annexureId);

  const {
    lineItems,
    loading: lineItemsLoading,
    error: lineItemsError,
    refresh: refreshLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  } = useLineItems(annexure?.id ?? null);

  const { user } = useAuth();
  const toast = useToast();
  const [poOpen, setPoOpen] = useState(false);
  const [poLineItems, setPoLineItems] = useState<DbLineItem[]>([]);
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    let budget = 0;
    let actual = 0;
    lineItems.forEach((li) => {
      budget += Number(li.budget_usd ?? 0);
      actual += Number(li.actual_usd_computed ?? 0);
    });
    const annexureBudget = Number(annexure?.budget_usd ?? budget);
    return {
      budget: annexureBudget,
      actual,
      remaining: annexureBudget - actual,
    };
  }, [lineItems, annexure]);

  const handleAddRow = useCallback(async () => {
    if (!annexure) return;
    setAdding(true);
    try {
      const nextSrNo =
        (lineItems.reduce((max, li) => Math.max(max, li.sr_no ?? 0), 0) ?? 0) + 1;
      await addLineItem({
        sr_no: nextSrNo,
        description: "New line item",
        budget_usd: 0,
        actual_local_amount: 0,
        actual_local_currency: "USD",
        exchange_rate_to_usd: 1,
        status: "pending",
      });
      toast.success("Row added");
    } catch (e) {
      toast.error("Add failed", e instanceof Error ? e.message : undefined);
    } finally {
      setAdding(false);
    }
  }, [addLineItem, annexure, lineItems, toast]);

  const handleExport = useCallback(() => {
    if (!annexure || !currentProject) return;
    try {
      exportAnnexureToXlsx({
        annexureNumber: annexure.number,
        annexureName: annexure.name,
        projectName: currentProject.name,
        rigName: currentProject.rigs?.name ?? "—",
        items: lineItems,
      });
      toast.success("Excel exported");
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    }
  }, [annexure, currentProject, lineItems, toast]);

  const handleGeneratePO = useCallback((row: DbLineItem) => {
    setPoLineItems([row]);
    setPoOpen(true);
  }, []);

  if (annexuresError) {
    return (
      <main className="flex-1 p-6">
        <QueryError message={annexuresError} onRetry={() => void refreshAnnexures()} />
      </main>
    );
  }

  if (annexuresLoading || !annexure) {
    return (
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <TableSkeleton rows={6} columns={10} />
      </main>
    );
  }

  const rigName = currentProject?.rigs?.name ?? "—";
  const projectName = currentProject?.name ?? "Project";
  const annexureRoman = ROMAN[annexure.number - 1] ?? String(annexure.number);
  const remainingNegative = totals.remaining < 0;

  return (
    <main className="flex-1 space-y-5 p-4 md:p-6">
      {/* -------- Breadcrumb + title + actions -------- */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1 text-xs text-brand-muted">
            <Link href="/fleet" className="hover:text-brand-text">Fleet</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/projects" className="hover:text-brand-text">Projects</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-text">{rigName}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-text">{projectName}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            Ann. {annexureRoman} — {annexure.name}
          </h1>
          <p className="text-sm text-brand-muted">
            {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} · live editing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={lineItems.length === 0}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button size="sm" onClick={handleAddRow} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Row
          </Button>
        </div>
      </header>

      {/* -------- Three KPI cards -------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          intent={totals.actual / (totals.budget || 1) > 0.9 ? "negative" : "positive"}
          trend="up"
          delta={totals.budget ? (totals.actual / totals.budget) * 100 : 0}
          deltaLabel="of budget"
          index={1}
        />
        <KPICard
          label="Remaining"
          value={`${remainingNegative ? "-" : ""}$${formatCompact(Math.abs(totals.remaining))}`}
          numericValue={Math.abs(totals.remaining)}
          format={(n) => `${remainingNegative ? "-" : ""}$${formatCompact(n)}`}
          intent={remainingNegative ? "negative" : "positive"}
          hint={remainingNegative ? "Over budget" : "Available to commit"}
          index={2}
        />
      </section>

      {/* -------- Tabs across all 11 annexures -------- */}
      <AnnexureTabs
        projectId={projectId}
        annexures={annexures}
        currentAnnexureId={annexure.id}
      />

      {/* -------- Editable table -------- */}
      {lineItemsError ? (
        <QueryError message={lineItemsError} onRetry={() => void refreshLineItems()} />
      ) : lineItemsLoading ? (
        <TableSkeleton rows={8} columns={15} />
      ) : (
        <EditableLineItemsTable
          items={lineItems}
          onUpdate={async (id, patch) => updateLineItem(id, patch)}
          onDelete={async (id) => deleteLineItem(id)}
          onGeneratePO={handleGeneratePO}
          onBulkGeneratePO={(rows) => {
            setPoLineItems(rows);
            setPoOpen(true);
          }}
        />
      )}

      {/* -------- PO modal (opened from row action or bulk selection) -------- */}
      <POGeneratorModal
        open={poOpen}
        onOpenChange={setPoOpen}
        lineItems={poLineItems}
        rigName={rigName}
        projectName={projectName}
        annexureName={annexure.name}
        projectId={projectId}
        annexureId={annexure.id}
        raisedById={user?.id ?? "demo-user"}
        raisedByName={user?.full_name ?? "Demo User"}
        onCreated={() => void refreshLineItems()}
      />
    </main>
  );
}
