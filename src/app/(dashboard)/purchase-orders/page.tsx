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
import { usePOs } from "@/hooks/usePO";
import { PO_STATUSES, RIGS } from "@/lib/constants";
import { formatCompact, formatCurrency, formatDate, slugify } from "@/lib/utils";
import type { PurchaseOrder } from "@/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
  draft: "secondary",
  pending_approval: "warning",
  approved: "default",
  issued: "default",
  received: "default",
  closed: "secondary",
  cancelled: "destructive",
};

export default function PurchaseOrdersPage() {
  const { pos } = usePOs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [rigFilter, setRigFilter] = useState<string>("");

  const filtered = useMemo(
    () =>
      pos.filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (rigFilter && p.rig_id !== rigFilter) return false;
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

  const totals = useMemo(() => {
    const open = pos.filter((p) =>
      ["draft", "pending_approval", "approved", "issued"].includes(p.status),
    );
    const pending = pos.filter((p) => p.status === "pending_approval");
    return {
      count: pos.length,
      value: pos.reduce((acc, p) => acc + p.total_usd, 0),
      openValue: open.reduce((acc, p) => acc + p.total_usd, 0),
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
          <KPICard label="Total POs" value={totals.count} hint="All statuses" />
          <KPICard
            label="Total PO Value"
            value={`$${formatCompact(totals.value)}`}
            hint="USD equivalent"
          />
          <KPICard
            label="Open Commitments"
            value={`$${formatCompact(totals.openValue)}`}
            hint="Not yet closed"
            intent="neutral"
          />
          <KPICard
            label="Pending Approval"
            value={totals.pending}
            intent={totals.pending > 0 ? "negative" : "positive"}
            hint="Awaiting manager"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>All Purchase Orders</CardTitle>
            <CardDescription>{filtered.length} of {pos.length} shown</CardDescription>
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
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
              <Select
                value={rigFilter}
                onChange={(e) => setRigFilter(e.target.value)}
                className="md:w-48"
              >
                <option value="">All rigs</option>
                {RIGS.map((r) => (
                  <option key={r} value={slugify(r)}>
                    {r}
                  </option>
                ))}
              </Select>
              <Button variant="outline">
                <Filter className="h-4 w-4" /> More
              </Button>
            </div>

            <div className="rounded-xl border border-brand-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Rig</TableHead>
                    <TableHead>Required By</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-brand-muted">
                        No purchase orders match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((po: PurchaseOrder) => {
                      const rigName = RIGS.find((r) => slugify(r) === po.rig_id) ?? po.rig_id;
                      return (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                          <TableCell className="font-medium">{po.vendor_name}</TableCell>
                          <TableCell className="text-sm text-brand-muted">{rigName}</TableCell>
                          <TableCell className="text-sm">{formatDate(po.required_by)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(po.total, po.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANT[po.status] ?? "secondary"}
                              className="capitalize"
                            >
                              {po.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-brand-muted">
                            {formatDate(po.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
      </Card>
    </main>
  );
}
