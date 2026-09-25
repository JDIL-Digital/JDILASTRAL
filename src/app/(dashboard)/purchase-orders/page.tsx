"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Search } from "lucide-react";
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
import { formatCompact, formatCurrency, formatDate } from "@/lib/utils";
import type { POStatus } from "@/types/database";

const PO_STATUSES: POStatus[] = ["draft", "approved", "issued", "cancelled"];

const STATUS_VARIANT: Record<POStatus, "default" | "secondary" | "warning" | "destructive"> = {
  draft: "secondary",
  approved: "default",
  issued: "default",
  cancelled: "destructive",
};

export default function PurchaseOrdersPage() {
  const { pos, loading, error, refresh } = usePOs();
  const { rigs } = useRigs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [rigFilter, setRigFilter] = useState<string>("");

  const filtered = useMemo(
    () =>
      pos.filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (rigFilter && p.projects?.rigs?.name !== rigFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.po_number.toLowerCase().includes(q) ||
            p.vendor_name.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [pos, search, statusFilter, rigFilter],
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

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-green md:text-3xl">
            Purchase Orders
          </h1>
          <p className="text-sm text-brand-muted">
            Fleet-wide procurement governance and approval workflow.
          </p>
        </div>
        <Button>
          <Download className="h-4 w-4" /> Export
        </Button>
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
          label="Pending Approval"
          value={summary.pending}
          numericValue={summary.pending}
          format={(n) => Math.round(n).toString()}
          intent={summary.pending > 0 ? "negative" : "positive"}
          hint="Draft POs"
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
          <div className="mb-4 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                placeholder="Search by PO number or vendor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="md:w-44"
            >
              <option value="">All statuses</option>
              {PO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              value={rigFilter}
              onChange={(e) => setRigFilter(e.target.value)}
              className="md:w-48"
            >
              <option value="">All rigs</option>
              {rigs.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4" /> More
            </Button>
          </div>

          {error ? (
            <QueryError message={error} onRetry={() => void refresh()} />
          ) : loading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No purchase orders match"
              message={
                pos.length === 0
                  ? "Once POs are created they will appear here."
                  : "Try clearing filters."
              }
            />
          ) : (
            <div className="rounded-xl border border-brand-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Rig</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po: PurchaseOrderWithJoins) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                      <TableCell className="font-medium">{po.vendor_name}</TableCell>
                      <TableCell className="text-sm text-brand-muted">
                        {po.projects?.rigs?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-brand-muted">
                        {po.projects?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          Number(po.local_amount ?? po.amount_usd ?? 0),
                          (po.local_currency as "USD" | "INR" | "AED") ?? "USD",
                        )}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
