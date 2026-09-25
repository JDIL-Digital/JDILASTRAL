"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plug,
  RefreshCw,
  Server,
} from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/cards/KPICard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deriveSyncStatus,
  getDemoPurchaseOrders,
  getPurchaseOrders,
  isBCConfigured,
} from "@/lib/businessCentral/client";
import { BC_CONFIG } from "@/lib/constants";
import { formatCompact, formatCurrency, formatDate } from "@/lib/utils";
import type { BCPurchaseOrder, BCSyncStatus } from "@/types/businessCentral";

const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const STATUS_VARIANT: Record<BCSyncStatus, "default" | "warning" | "destructive"> = {
  synced: "default",
  pending: "warning",
  error: "destructive",
};

const STATUS_LABEL: Record<BCSyncStatus, string> = {
  synced: "Synced",
  pending: "Pending",
  error: "Error",
};

const STATUS_ICON: Record<BCSyncStatus, React.ComponentType<{ className?: string }>> = {
  synced: CheckCircle2,
  pending: Clock,
  error: AlertTriangle,
};

export default function BCSyncPage() {
  const [pos, setPos] = useState<BCPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const configured = isBCConfigured();

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (configured) {
        const live = await getPurchaseOrders({ top: 50 });
        setPos(live);
      } else {
        // TODO: Add Azure AD credentials — replace fixture once env is wired.
        await new Promise((r) => setTimeout(r, 600));
        setPos(getDemoPurchaseOrders());
      }
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  // Initial load
  useEffect(() => {
    void sync();
  }, [sync]);

  // Auto-sync timer
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoSync) {
      intervalRef.current = setInterval(() => {
        void sync();
      }, AUTO_SYNC_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSync, sync]);

  const summary = useMemo(() => {
    const grouped: Record<BCSyncStatus, number> = { synced: 0, pending: 0, error: 0 };
    let totalValueUsd = 0;
    pos.forEach((p) => {
      grouped[deriveSyncStatus(p)] += 1;
      const c = p.currencyCode?.toUpperCase();
      const fx = c === "INR" ? 1 / 83.3 : c === "AED" ? 1 / 3.673 : 1;
      totalValueUsd += p.totalAmountIncludingTax * fx;
    });
    return { ...grouped, totalValueUsd, count: pos.length };
  }, [pos]);

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-brand-green md:text-3xl">
                Business Central Sync
              </h1>
              <Badge variant="default">
                <Plug className="mr-1 h-3 w-3" />
                {BC_CONFIG.environment}
              </Badge>
            </div>
            <p className="text-sm text-brand-muted">
              {BC_CONFIG.companyName} · API {BC_CONFIG.apiVersion}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Last sync:{" "}
              <span className="font-medium text-brand-text">
                {lastSync
                  ? new Date(lastSync).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })
                  : "Never"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="auto-sync"
              className="flex cursor-pointer items-center gap-2 rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm"
            >
              <input
                id="auto-sync"
                type="checkbox"
                className="h-4 w-4 accent-brand-green"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
              />
              <span className="text-brand-text">Auto-sync every 15 min</span>
            </label>
            <Button onClick={() => void sync()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Now
            </Button>
          </div>
        </header>

        <RoleGuard allow={["manager", "csuite"]}>
          {!configured && (
            <Card className="border-brand-warning/40 bg-brand-warning/5">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-warning" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-brand-text">
                    Demo mode — Azure AD credentials not configured
                  </p>
                  <p className="text-brand-muted">
                    Showing fixture data. To enable live sync, set{" "}
                    <code className="rounded bg-brand-border/40 px-1 py-0.5 font-mono text-xs">
                      BC_CLIENT_ID
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-brand-border/40 px-1 py-0.5 font-mono text-xs">
                      BC_CLIENT_SECRET
                    </code>{" "}
                    in <code className="font-mono text-xs">.env.local</code> against tenant{" "}
                    <code className="font-mono text-xs">{BC_CONFIG.tenantId}</code>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-brand-danger/40 bg-brand-danger/5">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-danger" />
                <div>
                  <p className="font-semibold text-brand-text">Sync failed</p>
                  <p className="text-sm text-brand-muted">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Pulled from BC"
              value={summary.count}
              hint="Purchase orders"
              icon={<Server className="h-5 w-5" />}
            />
            <KPICard
              label="Synced"
              value={summary.synced}
              intent="positive"
              hint="Mapped into ASTRAL"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <KPICard
              label="Pending"
              value={summary.pending}
              intent={summary.pending > 0 ? "neutral" : "positive"}
              hint="Awaiting mapping/approval"
              icon={<Clock className="h-5 w-5" />}
            />
            <KPICard
              label="Total BC Value"
              value={`$${formatCompact(summary.totalValueUsd)}`}
              hint="USD equivalent"
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders from Business Central</CardTitle>
              <CardDescription>
                Live view of POs in <code className="font-mono text-xs">{BC_CONFIG.companyName}</code>
                . Click Sync Now to pull the latest snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-brand-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BC PO Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>BC Status</TableHead>
                      <TableHead>Sync Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pos.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-brand-muted"
                        >
                          {loading ? "Loading from Business Central..." : "No POs pulled yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pos.map((po) => {
                        const syncStatus = deriveSyncStatus(po);
                        const Icon = STATUS_ICON[syncStatus];
                        return (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono text-xs">{po.number}</TableCell>
                            <TableCell className="font-medium">{po.vendorName}</TableCell>
                            <TableCell className="text-sm">{formatDate(po.orderDate)}</TableCell>
                            <TableCell className="text-right text-sm text-brand-muted">
                              {po.purchaseOrderLines?.length ?? 0}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(
                                po.totalAmountIncludingTax,
                                (po.currencyCode || "USD") as "USD" | "INR" | "AED",
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-brand-muted">
                              {po.status}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={STATUS_VARIANT[syncStatus]}
                                className="inline-flex items-center gap-1 capitalize"
                              >
                                <Icon className="h-3 w-3" />
                                {STATUS_LABEL[syncStatus]}
                              </Badge>
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
              </RoleGuard>
    </main>
  );
}
