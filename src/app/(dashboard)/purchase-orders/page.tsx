"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Filter,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KPICard } from "@/components/cards/KPICard";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { usePOs, type PurchaseOrderWithJoins } from "@/hooks/usePOs";
import { useRigs } from "@/hooks/useRigs";
import { useToast } from "@/components/ui/Toast";
import { formatCompact, formatCurrency, formatDate } from "@/lib/utils";
import type { POStatus } from "@/types/database";

const PO_STATUSES: POStatus[] = ["draft", "approved", "issued", "cancelled"];

const STATUS_VARIANT: Record<POStatus, "default" | "secondary" | "warning" | "destructive"> = {
  draft: "secondary",
  approved: "default",
  issued: "default",
  cancelled: "destructive",
};

/** Which status transition each row is eligible for. */
function nextStatusAction(status: POStatus): {
  next: POStatus;
  label: string;
} | null {
  switch (status) {
    case "draft":
      return { next: "approved", label: "Submit for Approval" };
    case "approved":
      return { next: "issued", label: "Issue PO" };
    case "issued":
      return { next: "issued", label: "Mark Complete" };
    default:
      return null;
  }
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { pos, loading, error, refresh, updatePO } = usePOs();
  const { rigs } = useRigs();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [rigFilter, setRigFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filtered = useMemo(
    () =>
      pos.filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (rigFilter && p.projects?.rigs?.name !== rigFilter) return false;
        if (dateFrom && p.created_at < dateFrom) return false;
        if (dateTo && p.created_at > dateTo + "T23:59:59Z") return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.po_number.toLowerCase().includes(q) ||
            p.vendor_name.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [pos, search, statusFilter, rigFilter, dateFrom, dateTo],
  );

  const summary = useMemo(() => {
    const open = pos.filter((p) => ["draft", "approved", "issued"].includes(p.status));
    const pending = pos.filter((p) => p.status === "draft");
    return {
      count: pos.length,
      value: pos.reduce((acc, p) => acc + Number(p.amount_usd ?? 0), 0),
      openValue: open.reduce((acc, p) => acc + Number(p.amount_usd ?? 0), 0),
      pending: pending.length,
    };
  }, [pos]);

  const advanceStatus = async (po: PurchaseOrderWithJoins) => {
    const action = nextStatusAction(po.status);
    if (!action) return;
    try {
      await updatePO(po.id, { status: action.next });
      toast.success(`Status updated: ${action.next}`);
    } catch (e) {
      toast.error("Status update failed", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-green md:text-3xl">
            Purchase Orders
          </h1>
          <p className="text-sm text-brand-muted">
            {pos.length} total · {formatCurrency(summary.value, "USD")} value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button>
            <Plus className="h-4 w-4" /> Create PO
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total POs"
          value={summary.count}
          numericValue={summary.count}
          format={(n) => Math.round(n).toString()}
          hint="All statuses"
          index={0}
        />
        <KPICard
          label="Total PO Value"
          value={`$${formatCompact(summary.value)}`}
          numericValue={summary.value}
          format={(n) => `$${formatCompact(n)}`}
          hint="USD equivalent"
          index={1}
        />
        <KPICard
          label="Open Commitments"
          value={`$${formatCompact(summary.openValue)}`}
          numericValue={summary.openValue}
          format={(n) => `$${formatCompact(n)}`}
          hint="Not yet closed"
          index={2}
        />
        <KPICard
          label="Draft POs"
          value={summary.pending}
          numericValue={summary.pending}
          format={(n) => Math.round(n).toString()}
          intent={summary.pending > 0 ? "negative" : "positive"}
          hint="Awaiting approval"
          index={3}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
          <CardDescription>
            {filtered.length} of {pos.length} shown · live from Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ---------- Filter bar ---------- */}
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-6">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                placeholder="Search by PO# or vendor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {PO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select value={rigFilter} onChange={(e) => setRigFilter(e.target.value)}>
              <option value="">All rigs</option>
              {rigs.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
          </div>

          {error ? (
            <QueryError message={error} onRetry={() => void refresh()} />
          ) : loading ? (
            <TableSkeleton rows={6} columns={9} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No purchase orders match"
              message={
                pos.length === 0
                  ? "Once POs are created they will appear here."
                  : "Try clearing filters."
              }
              action={
                <Button variant="outline" size="sm" onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setRigFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl border border-brand-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Project / Rig</TableHead>
                    <TableHead>Annexure</TableHead>
                    <TableHead className="text-right">Amount USD</TableHead>
                    <TableHead className="text-right">Local Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po) => {
                    const action = nextStatusAction(po.status);
                    return (
                      <TableRow key={po.id} className="group">
                        <TableCell>
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="font-mono text-xs font-semibold text-brand-green hover:underline"
                          >
                            {po.po_number}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{po.vendor_name}</TableCell>
                        <TableCell className="text-sm">
                          <div>{po.projects?.name ?? "—"}</div>
                          <div className="text-xs text-brand-muted">
                            {po.projects?.rigs?.name ?? ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-brand-muted">
                          {po.line_items?.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(po.amount_usd ?? 0), "USD")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-brand-muted">
                          {po.local_currency !== "USD" && po.local_amount
                            ? formatCurrency(
                                Number(po.local_amount),
                                (po.local_currency as "USD" | "INR" | "AED") ?? "USD",
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANT[po.status] ?? "secondary"}
                            className="capitalize"
                          >
                            {po.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-brand-muted">
                          {formatDate(po.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                            {action && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void advanceStatus(po)}
                                title={action.label}
                              >
                                {po.status === "draft" && <Send className="h-3 w-3" />}
                                {po.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                                {po.status === "issued" && <CheckCircle2 className="h-3 w-3" />}
                                <span className="hidden sm:inline">{action.label}</span>
                              </Button>
                            )}
                            <button
                              type="button"
                              aria-label="Open PO"
                              onClick={() => router.push(`/purchase-orders/${po.id}`)}
                              className="rounded-md p-1.5 text-brand-muted hover:bg-brand-border/40 hover:text-brand-text"
                              title="View PO"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete"
                              onClick={async () => {
                                if (!window.confirm(`Delete ${po.po_number}?`)) return;
                                try {
                                  await updatePO(po.id, { status: "cancelled" });
                                  toast.success("PO cancelled");
                                } catch (e) {
                                  toast.error(
                                    "Delete failed",
                                    e instanceof Error ? e.message : undefined,
                                  );
                                }
                              }}
                              className="rounded-md p-1.5 text-brand-muted hover:bg-brand-danger/15 hover:text-brand-danger"
                              title="Cancel PO"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-brand-muted">
            <Filter className="h-3 w-3" />
            Tip: click a PO number to open its detail page and download the PDF.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
