"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Loader2,
  Mail,
  Send,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/ui/ErrorBoundary";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { usePOs } from "@/hooks/usePOs";
import { useToast } from "@/components/ui/Toast";
import { downloadPO, previewPOUrl, type POPdfInput, type POPdfLineItem } from "@/lib/pdf/generatePO";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { POStatus } from "@/types/database";

const STATUS_VARIANT: Record<POStatus, "default" | "secondary" | "warning" | "destructive"> = {
  draft: "secondary",
  approved: "default",
  issued: "default",
  cancelled: "destructive",
};

const TIMELINE: POStatus[] = ["draft", "approved", "issued"];

export default function PODetailPage() {
  const params = useParams<{ poId: string }>();
  const poId = params.poId;

  const { pos, loading, error, refresh, updatePO } = usePOs();
  const po = pos.find((p) => p.id === poId) ?? null;
  const toast = useToast();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const pdfInput = useMemo<POPdfInput | null>(() => {
    if (!po) return null;
    const amount = Number(po.amount_usd ?? 0);
    const localAmount = Number(po.local_amount ?? amount);
    const rate = Number(po.exchange_rate ?? 1);

    // We only persist a summary row — reconstruct a minimum-shape line
    // item list for the PDF from the DB description.
    const lineItems: POPdfLineItem[] = [
      {
        sr: 1,
        description: po.description || po.line_items?.description || "—",
        area: null,
        qty: 1,
        unit: "lump sum",
        unit_rate_usd: amount,
        amount_usd: amount,
      },
    ];

    return {
      po_number: po.po_number,
      date: po.created_at.slice(0, 10),
      status: po.status,
      vendor: {
        name: po.vendor_name,
        address: null,
        contact: null,
        email: null,
      },
      project: {
        name: po.projects?.name ?? "—",
        rigName: po.projects?.rigs?.name ?? "—",
        rigType: null,
        annexureName: po.line_items?.description ?? null,
        contractRef: null,
      },
      lineItems,
      totals: {
        subtotal_usd: amount,
        exchange_rate: rate,
        local_currency: po.local_currency ?? "USD",
        total_local: localAmount,
        total_usd: amount,
      },
      terms: {
        payment: "Within 30 days of invoice",
        delivery: "As per project schedule",
        freeText: null,
      },
      signatures: {
        preparedBy: "—",
        checkedBy: "",
        approvedBy: "",
      },
    };
  }, [po]);

  const handleDownload = () => {
    if (!pdfInput) return;
    try {
      downloadPO(pdfInput);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Download failed", e instanceof Error ? e.message : undefined);
    }
  };

  const advance = async (nextStatus: POStatus) => {
    if (!po) return;
    setWorking(true);
    try {
      await updatePO(po.id, { status: nextStatus });
      toast.success(`Status → ${nextStatus}`);
    } catch (e) {
      toast.error("Update failed", e instanceof Error ? e.message : undefined);
    } finally {
      setWorking(false);
    }
  };

  if (error) {
    return (
      <main className="flex-1 p-6">
        <QueryError message={error} onRetry={() => void refresh()} />
      </main>
    );
  }

  if (loading || !po || !pdfInput) {
    return (
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  const canEdit = po.status === "draft";
  const nextInWorkflow: POStatus | null =
    po.status === "draft" ? "approved" : po.status === "approved" ? "issued" : null;

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      {/* ---------- Breadcrumb + header ---------- */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-1 text-xs text-brand-muted">
            <Link href="/purchase-orders" className="hover:text-brand-text">
              Purchase Orders
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-text">{po.po_number}</span>
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            <span className="font-mono text-brand-green">{po.po_number}</span>
            <Badge variant={STATUS_VARIANT[po.status]} className="capitalize">
              {po.status}
            </Badge>
          </h1>
          <p className="text-sm text-brand-muted">
            {po.vendor_name} · {po.projects?.name ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" disabled title="Edit coming soon">
              <Edit className="h-4 w-4" /> Edit
            </Button>
          )}
          {nextInWorkflow && (
            <Button
              size="sm"
              onClick={() => void advance(nextInWorkflow)}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : po.status === "draft" ? (
                <Send className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {po.status === "draft" ? "Submit for Approval" : "Issue PO"}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled title="Email delivery — coming soon">
            <Mail className="h-4 w-4" /> Send via Email
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </header>

      {/* ---------- Status timeline ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status Timeline</CardTitle>
          <CardDescription>Draft → Approved → Issued</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            {TIMELINE.map((state, idx) => {
              const reached =
                TIMELINE.indexOf(po.status as POStatus) >= idx &&
                po.status !== "cancelled";
              const active = state === po.status;
              return (
                <div key={state} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold uppercase",
                        reached
                          ? "border-brand-green bg-brand-green/15 text-brand-green"
                          : "border-brand-border bg-brand-surface text-brand-muted",
                        active && "ring-2 ring-brand-green/40",
                      )}
                    >
                      {reached ? "✓" : idx + 1}
                    </div>
                    <span
                      className={cn(
                        "mt-2 text-xs font-semibold uppercase tracking-wider",
                        reached ? "text-brand-text" : "text-brand-muted",
                      )}
                    >
                      {state}
                    </span>
                  </div>
                  {idx < TIMELINE.length - 1 && (
                    <div
                      className={cn(
                        "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                        reached && TIMELINE.indexOf(po.status) > idx
                          ? "bg-brand-green"
                          : "bg-brand-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {po.status === "cancelled" && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-brand-danger/40 bg-brand-danger/5 p-3 text-sm">
              <XCircle className="h-4 w-4 text-brand-danger" />
              <span>This PO has been cancelled.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Summary blocks ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{po.vendor_name}</p>
            <p className="text-xs text-brand-muted">
              {po.description ?? "No description"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{po.projects?.name ?? "—"}</p>
            <p className="text-xs text-brand-muted">
              Rig: {po.projects?.rigs?.name ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-muted">Amount USD</span>
              <span className="font-mono font-bold text-brand-green">
                {formatCurrency(Number(po.amount_usd ?? 0), "USD")}
              </span>
            </div>
            {po.local_currency !== "USD" && (
              <div className="flex justify-between">
                <span className="text-brand-muted">Local ({po.local_currency})</span>
                <span className="font-mono">
                  {formatCurrency(
                    Number(po.local_amount ?? 0),
                    (po.local_currency as "USD" | "INR" | "AED") ?? "USD",
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs text-brand-muted">
              <span>Exchange Rate</span>
              <span className="font-mono">
                1 USD = {Number(po.exchange_rate ?? 1).toFixed(4)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---------- PDF preview ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">PDF Preview</CardTitle>
            <CardDescription>
              Rendered on the fly from the current PO data.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Hide" : "Show"} Preview
          </Button>
        </CardHeader>
        {previewOpen && (
          <CardContent>
            <iframe
              title={`PO ${po.po_number} preview`}
              src={previewPOUrl(pdfInput)}
              className="h-[720px] w-full rounded-lg border border-brand-border"
            />
          </CardContent>
        )}
      </Card>

      {/* ---------- Audit trail ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Audit Trail</CardTitle>
          <CardDescription>Lifecycle events for this PO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <AuditRow
            label="Created"
            value={formatDate(po.created_at)}
            userId={po.created_by ?? "—"}
          />
          {po.approved_by && (
            <AuditRow
              label="Approved"
              value={formatDate(po.updated_at)}
              userId={po.approved_by}
            />
          )}
          <AuditRow label="Updated" value={formatDate(po.updated_at)} />
        </CardContent>
      </Card>
    </main>
  );
}

function AuditRow({
  label,
  value,
  userId,
}: {
  label: string;
  value: string;
  userId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-brand-border bg-brand-bg/40 p-3">
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 text-brand-muted" />
        <div>
          <p className="font-semibold text-brand-text">{label}</p>
          {userId && userId !== "—" && (
            <p className="text-xs text-brand-muted">by {userId.slice(0, 8)}</p>
          )}
        </div>
      </div>
      <span className="font-mono text-xs text-brand-muted">{value}</span>
    </div>
  );
}
