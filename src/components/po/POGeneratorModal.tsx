"use client";

import * as React from "react";
import { Download, FileText, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/Toast";
import { usePOs } from "@/hooks/usePOs";
import { useManagers } from "@/hooks/useManagers";
import { useLineItems } from "@/hooks/useLineItems";
import { getFxRate } from "@/lib/fx/frankfurter";
import { getNextPoNumber, poNumberPrefix } from "@/lib/po/poNumber";
import { downloadPO, type POPdfInput, type POPdfLineItem } from "@/lib/pdf/generatePO";
import { formatCurrency } from "@/lib/utils";
import { CURRENCIES, type Currency } from "@/lib/constants";
import type { DbLineItem } from "@/types/database";

const UNIT_OPTIONS = ["nos", "set", "lump sum", "kg", "mt", "day", "lot"] as const;
const DEFAULT_PAYMENT_TERMS = "Payment within 30 days of invoice";
const DEFAULT_DELIVERY = "As per project schedule";

interface POGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Supabase line_items selected for this PO. */
  lineItems: DbLineItem[];
  /** Context labels displayed in the FROM / project block. */
  rigName: string;
  rigType?: string | null;
  projectName: string;
  annexureName: string;
  annexureId: string;
  projectId: string;
  contractRef?: string | null;
  raisedById: string;
  raisedByName: string;
  /** Called after a successful save/generate so parents can refresh. */
  onCreated?: (po: { po_number: string; id: string }) => void;
}

interface ModalLine {
  line_item_id: string;
  description: string;
  area: string;
  qty: number;
  unit: string;
  unit_rate_usd: number;
  amount_usd: number;
}

export function POGeneratorModal(props: POGeneratorModalProps) {
  const {
    open,
    onOpenChange,
    lineItems,
    rigName,
    rigType,
    projectName,
    annexureName,
    annexureId,
    projectId,
    contractRef,
    raisedById,
    raisedByName,
    onCreated,
  } = props;

  const toast = useToast();
  const { createPO } = usePOs();
  const { managers } = useManagers();
  const { updateLineItem } = useLineItems(annexureId);

  const [poNumber, setPoNumber] = React.useState<string>("");
  const [poNumberLoading, setPoNumberLoading] = React.useState(false);
  const [date, setDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [status] = React.useState<string>("DRAFT");

  // Vendor fields
  const [vendorName, setVendorName] = React.useState("");
  const [vendorAddress, setVendorAddress] = React.useState("");
  const [vendorContact, setVendorContact] = React.useState("");
  const [vendorEmail, setVendorEmail] = React.useState("");

  // Totals
  const [currency, setCurrency] = React.useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = React.useState<number>(1);
  const [fxLoading, setFxLoading] = React.useState(false);

  // Terms
  const [termsPayment, setTermsPayment] = React.useState(DEFAULT_PAYMENT_TERMS);
  const [termsDelivery, setTermsDelivery] = React.useState(DEFAULT_DELIVERY);
  const [termsNotes, setTermsNotes] = React.useState("");

  // Approval
  const [approverId, setApproverId] = React.useState<string>("");

  // Working line items (local to the modal — qty/unit are editable)
  const [lines, setLines] = React.useState<ModalLine[]>([]);

  const [savingDraft, setSavingDraft] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  /** Seed modal state when it opens. */
  React.useEffect(() => {
    if (!open) return;

    // 1. Reserve a PO number from the DB.
    setPoNumberLoading(true);
    void (async () => {
      const { number } = await getNextPoNumber();
      setPoNumber(number);
      setPoNumberLoading(false);
    })();

    // 2. Seed vendor / terms from the first line item.
    setVendorName(lineItems[0]?.work_by ?? "");
    setVendorAddress("");
    setVendorContact("");
    setVendorEmail("");
    setCurrency((lineItems[0]?.actual_local_currency as Currency) ?? "USD");
    setExchangeRate(Number(lineItems[0]?.exchange_rate_to_usd ?? 1));
    setTermsPayment(DEFAULT_PAYMENT_TERMS);
    setTermsDelivery(DEFAULT_DELIVERY);
    setTermsNotes("");
    setApproverId("");
    setDate(new Date().toISOString().slice(0, 10));

    // 3. Project the selected line items into modal rows.
    setLines(
      lineItems.map((li) => {
        const unitRate = Number(li.budget_usd ?? 0);
        return {
          line_item_id: li.id,
          description: li.description ?? "",
          area: li.area ?? "",
          qty: 1,
          unit: "nos",
          unit_rate_usd: unitRate,
          amount_usd: unitRate,
        };
      }),
    );
  }, [open, lineItems]);

  /** Refresh FX whenever the user picks a different currency or date. */
  const refreshFx = React.useCallback(
    async (nextCurrency: Currency, nextDate: string) => {
      if (nextCurrency === "USD") {
        setExchangeRate(1);
        return;
      }
      setFxLoading(true);
      try {
        const { rate } = await getFxRate("USD", nextCurrency, nextDate);
        setExchangeRate(rate);
      } catch (e) {
        toast.error("FX fetch failed", e instanceof Error ? e.message : undefined);
      } finally {
        setFxLoading(false);
      }
    },
    [toast],
  );

  /** Recompute amount when qty or unit_rate change on a line. */
  const updateLine = (idx: number, patch: Partial<ModalLine>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const merged = { ...l, ...patch };
        merged.amount_usd = Number(merged.qty || 0) * Number(merged.unit_rate_usd || 0);
        return merged;
      }),
    );
  };

  const subtotalUsd = React.useMemo(
    () => lines.reduce((s, l) => s + l.amount_usd, 0),
    [lines],
  );

  const totalLocal = React.useMemo(
    () => subtotalUsd * exchangeRate,
    [subtotalUsd, exchangeRate],
  );

  const approver = managers.find((m) => m.id === approverId) ?? null;

  const buildPdfInput = React.useCallback(
    (poNo: string): POPdfInput => ({
      po_number: poNo,
      date,
      status,
      vendor: {
        name: vendorName,
        address: vendorAddress || null,
        contact: vendorContact || null,
        email: vendorEmail || null,
      },
      project: {
        name: projectName,
        rigName,
        rigType: rigType ?? null,
        annexureName,
        contractRef: contractRef ?? null,
      },
      lineItems: lines.map<POPdfLineItem>((l, i) => ({
        sr: i + 1,
        description: l.description,
        area: l.area,
        qty: l.qty,
        unit: l.unit,
        unit_rate_usd: l.unit_rate_usd,
        amount_usd: l.amount_usd,
      })),
      totals: {
        subtotal_usd: subtotalUsd,
        exchange_rate: exchangeRate,
        local_currency: currency,
        total_local: totalLocal,
        total_usd: subtotalUsd,
      },
      terms: {
        payment: termsPayment,
        delivery: termsDelivery,
        freeText: termsNotes || null,
      },
      signatures: {
        preparedBy: raisedByName,
        checkedBy: "",
        approvedBy: approver?.name ?? "",
      },
    }),
    [
      annexureName,
      approver,
      contractRef,
      currency,
      date,
      exchangeRate,
      lines,
      projectName,
      raisedByName,
      rigName,
      rigType,
      status,
      subtotalUsd,
      termsDelivery,
      termsNotes,
      termsPayment,
      totalLocal,
      vendorAddress,
      vendorContact,
      vendorEmail,
      vendorName,
    ],
  );

  /** Persist to Supabase (either as draft or alongside the PDF). */
  const persist = React.useCallback(
    async (poStatus: "draft" | "issued" = "draft") => {
      if (!poNumber) throw new Error("PO number not yet allocated");
      if (!vendorName) throw new Error("Vendor name is required");

      const row = await createPO({
        po_number: poNumber,
        project_id: projectId,
        line_item_id: lineItems[0]?.id ?? null,
        vendor_name: vendorName,
        description: lines.map((l) => l.description).join(" · "),
        amount_usd: subtotalUsd,
        local_amount: totalLocal,
        local_currency: currency,
        exchange_rate: exchangeRate,
        status: poStatus,
        created_by: raisedById.length === 36 ? raisedById : null,
        approved_by: approver?.id ?? null,
      });

      // Back-fill po_no on every line item in this PO. Fire the updates
      // in parallel — any failure gets toasted but doesn't block.
      await Promise.allSettled(
        lineItems.map((li) =>
          updateLineItem(li.id, { po_no: poNumber }),
        ),
      );

      return row;
    },
    [
      approver,
      createPO,
      currency,
      exchangeRate,
      lineItems,
      lines,
      poNumber,
      projectId,
      raisedById,
      subtotalUsd,
      totalLocal,
      updateLineItem,
      vendorName,
    ],
  );

  const onSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const row = await persist("draft");
      toast.success("Saved as draft", poNumber);
      if (row && onCreated) onCreated({ po_number: row.po_number, id: row.id });
      onOpenChange(false);
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingDraft(false);
    }
  };

  const onGeneratePdf = async () => {
    setGenerating(true);
    try {
      const row = await persist("draft");
      downloadPO(buildPdfInput(poNumber));
      toast.success("PDF generated", poNumber);
      if (row && onCreated) onCreated({ po_number: row.po_number, id: row.id });
      onOpenChange(false);
    } catch (e) {
      toast.error("Generation failed", e instanceof Error ? e.message : undefined);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-green" />
            Generate Purchase Order
          </DialogTitle>
          <DialogDescription>
            {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} · {rigName} ·{" "}
            {projectName}
          </DialogDescription>
        </DialogHeader>

        {/* ---------- Header meta: PO# · Date · Status ---------- */}
        <section className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-brand-border bg-brand-bg/40 p-4 sm:grid-cols-3">
          <div>
            <Label className="text-[10px]">PO Number</Label>
            <div className="mt-1 font-mono text-sm font-bold text-brand-green">
              {poNumberLoading ? (
                <span className="inline-flex items-center gap-2 text-brand-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Allocating…
                </span>
              ) : (
                poNumber || poNumberPrefix() + "?????"
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="po-date" className="text-[10px]">Date</Label>
            <Input
              id="po-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[10px]">Status</Label>
            <div className="mt-1">
              <Badge variant="secondary">{status}</Badge>
            </div>
          </div>
        </section>

        {/* ---------- Vendor + Project (two columns) ---------- */}
        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* VENDOR (TO) */}
          <div className="space-y-2 rounded-lg border border-brand-border p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-green">
              TO (Vendor)
            </h4>
            <div>
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="vendor-address">Address</Label>
              <Textarea
                id="vendor-address"
                rows={2}
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="vendor-contact">Contact</Label>
                <Input
                  id="vendor-contact"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* FROM (read-only project context) */}
          <div className="space-y-2 rounded-lg border border-brand-border bg-brand-bg/40 p-4 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-green">
              FROM
            </h4>
            <p className="font-semibold text-brand-text">
              Jindal Drilling &amp; Industries Ltd.
            </p>
            <p className="text-xs text-brand-muted">
              Pipavav Shipyard Road, Rajula, Gujarat 365560, India
            </p>
            <div className="pt-2 text-xs">
              <p>
                <span className="text-brand-muted">Project:</span>{" "}
                <span className="font-medium">{projectName}</span>
              </p>
              <p>
                <span className="text-brand-muted">Rig:</span>{" "}
                <span className="font-medium">
                  {rigName}
                  {rigType ? ` (${rigType})` : ""}
                </span>
              </p>
              <p>
                <span className="text-brand-muted">Annexure:</span>{" "}
                <span className="font-medium">{annexureName}</span>
              </p>
              {contractRef && (
                <p>
                  <span className="text-brand-muted">Contract Ref:</span>{" "}
                  <span className="font-medium">{contractRef}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Line items table (editable qty/unit/rate) ---------- */}
        <section className="mb-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-green">
            Line Items
          </h4>
          <div className="overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-brand-bg/50 text-brand-muted">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">Area</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-left">Unit</th>
                  <th className="px-2 py-2 text-right">Rate USD</th>
                  <th className="px-2 py-2 text-right">Amount USD</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l.line_item_id} className="border-t border-brand-border">
                    <td className="px-2 py-1.5 font-mono text-brand-muted">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.area}
                        onChange={(e) => updateLine(idx, { area: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.qty}
                        onChange={(e) =>
                          updateLine(idx, { qty: Number(e.target.value) })
                        }
                        className="h-7 w-20 text-right text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={l.unit}
                        onChange={(e) => updateLine(idx, { unit: e.target.value })}
                        className="h-7 text-xs"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={l.unit_rate_usd}
                        onChange={(e) =>
                          updateLine(idx, { unit_rate_usd: Number(e.target.value) })
                        }
                        className="h-7 w-28 text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">
                      {formatCurrency(l.amount_usd, "USD")}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-brand-muted">
                      No line items selected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Totals + Terms ---------- */}
        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-brand-border bg-brand-bg/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-green">
              Totals
            </h4>
            <div className="flex items-center justify-between text-sm">
              <span className="text-brand-muted">Subtotal (USD)</span>
              <span className="font-mono">{formatCurrency(subtotalUsd, "USD")}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <Label className="text-[10px]">Currency</Label>
                <Select
                  value={currency}
                  onChange={(e) => {
                    const next = e.target.value as Currency;
                    setCurrency(next);
                    void refreshFx(next, date);
                  }}
                  className="mt-1 h-8 text-xs"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Rate (1 USD =)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="h-8 pr-7 text-xs"
                    disabled={currency === "USD"}
                  />
                  {fxLoading && (
                    <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-brand-muted" />
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshFx(currency, date)}
                  disabled={currency === "USD" || fxLoading}
                  className="h-8 w-full text-xs"
                >
                  Refresh FX
                </Button>
              </div>
            </div>
            {currency !== "USD" && (
              <div className="flex items-center justify-between pt-1 text-sm">
                <span className="text-brand-muted">Total ({currency})</span>
                <span className="font-mono">
                  {formatCurrency(totalLocal, currency as "USD" | "INR" | "AED")}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2 text-base font-bold text-brand-green">
              <span>TOTAL USD</span>
              <span className="font-mono">{formatCurrency(subtotalUsd, "USD")}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-brand-border p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-green">
              Remarks
            </h4>
            <div>
              <Label htmlFor="terms-payment" className="text-[10px]">
                Payment Terms
              </Label>
              <Input
                id="terms-payment"
                value={termsPayment}
                onChange={(e) => setTermsPayment(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="terms-delivery" className="text-[10px]">
                Delivery Timeline
              </Label>
              <Input
                id="terms-delivery"
                value={termsDelivery}
                onChange={(e) => setTermsDelivery(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="terms-notes" className="text-[10px]">
                Additional Notes
              </Label>
              <Textarea
                id="terms-notes"
                rows={2}
                value={termsNotes}
                onChange={(e) => setTermsNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </section>

        {/* ---------- Approval ---------- */}
        <section className="mb-2 rounded-lg border border-brand-border bg-brand-bg/40 p-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-green">
            Approval
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[10px]">Prepared By</Label>
              <div className="mt-1 h-10 rounded-md border border-brand-border bg-brand-surface/40 px-3 py-2 text-sm">
                {raisedByName}
              </div>
            </div>
            <div>
              <Label htmlFor="approver" className="text-[10px]">
                Approved By
              </Label>
              <Select
                id="approver"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="mt-1"
              >
                <option value="">Select approver…</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Date</Label>
              <div className="mt-1 h-10 rounded-md border border-brand-border bg-brand-surface/40 px-3 py-2 text-sm">
                {date}
              </div>
            </div>
          </div>
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={savingDraft || generating || poNumberLoading}
          >
            {savingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={onGeneratePdf}
            disabled={savingDraft || generating || poNumberLoading}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
