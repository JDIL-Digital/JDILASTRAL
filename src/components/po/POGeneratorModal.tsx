"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Download, FileText, Loader2 } from "lucide-react";
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
import { CURRENCIES, type Currency } from "@/lib/constants";
import { convert } from "@/lib/currency/exchangeRate";
import { downloadPO } from "@/lib/pdf/generatePO";
import { formatCurrency } from "@/lib/utils";
import type { LineItem, PurchaseOrder } from "@/types";

const formSchema = z.object({
  vendor_name: z.string().min(2, "Vendor name is required"),
  vendor_address: z.string().optional(),
  vendor_contact: z.string().optional(),
  vendor_email: z.string().email().optional().or(z.literal("")),
  vendor_gstin: z.string().optional(),
  currency: z.enum(["USD", "INR", "AED"]),
  tax_pct: z.coerce.number().min(0).max(100),
  freight: z.coerce.number().min(0),
  payment_terms: z.string().min(2),
  delivery_terms: z.string().min(2),
  delivery_location: z.string().min(2),
  required_by: z.string().min(2),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface POGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItems: LineItem[];
  rigName: string;
  projectName: string;
  annexureName: string;
  rigId: string;
  projectId: string;
  annexureId: string;
  raisedById: string;
  raisedByName: string;
  onCreated?: (po: PurchaseOrder) => void;
}

export function POGeneratorModal({
  open,
  onOpenChange,
  lineItems,
  rigName,
  projectName,
  annexureName,
  rigId,
  projectId,
  annexureId,
  raisedById,
  raisedByName,
  onCreated,
}: POGeneratorModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const defaultCurrency: Currency = (lineItems[0]?.currency as Currency) ?? "USD";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      vendor_name: lineItems[0]?.vendor ?? "",
      currency: defaultCurrency,
      tax_pct: 18,
      freight: 0,
      payment_terms: "Net 30 from invoice date",
      delivery_terms: "DAP - Delivery at Place",
      delivery_location: `${rigName} · Mumbai High Offshore`,
      required_by: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    },
  });

  const watched = watch();

  const totals = useMemo(() => {
    const currency = (watched.currency ?? defaultCurrency) as Currency;
    const subtotal = lineItems.reduce(
      (acc, it) => acc + convert(it.total_local, it.currency, currency),
      0,
    );
    const taxPct = Number(watched.tax_pct ?? 0);
    const freight = Number(watched.freight ?? 0);
    const taxAmount = (subtotal * taxPct) / 100;
    const total = subtotal + taxAmount + freight;
    const total_usd = convert(total, currency, "USD");
    return { subtotal, taxAmount, freight, total, total_usd, currency };
  }, [lineItems, watched, defaultCurrency]);

  function onSubmit(values: FormValues) {
    setSubmitting(true);
    const po: PurchaseOrder = {
      id: `tmp-${Date.now()}`,
      po_number: `JSIL-PO-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 100000),
      ).padStart(5, "0")}`,
      rig_id: rigId,
      project_id: projectId,
      annexure_id: annexureId,
      vendor_name: values.vendor_name,
      vendor_address: values.vendor_address ?? null,
      vendor_contact: values.vendor_contact ?? null,
      vendor_email: values.vendor_email || null,
      vendor_gstin: values.vendor_gstin ?? null,
      currency: values.currency,
      subtotal: totals.subtotal,
      tax_pct: values.tax_pct,
      tax_amount: totals.taxAmount,
      freight: values.freight,
      total: totals.total,
      total_usd: totals.total_usd,
      payment_terms: values.payment_terms,
      delivery_terms: values.delivery_terms,
      delivery_location: values.delivery_location,
      required_by: values.required_by,
      status: "draft",
      raised_by: raisedById,
      approved_by: null,
      approved_at: null,
      issued_at: null,
      notes: values.notes ?? null,
      line_items: lineItems.map((li) => ({
        id: `pol-${li.id}`,
        po_id: "tmp",
        line_item_id: li.id,
        sku: li.sku,
        description: li.description,
        uom: li.uom,
        quantity: li.quantity,
        unit_price: convert(li.unit_price, li.currency, values.currency),
        total: convert(li.total_local, li.currency, values.currency),
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    downloadPO({
      po,
      rigName,
      projectName,
      annexureName,
      raisedByName,
    });

    setSubmitting(false);
    onCreated?.(po);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Vendor
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="vendor_name">Vendor Name *</Label>
                <Input id="vendor_name" {...register("vendor_name")} />
                {errors.vendor_name && (
                  <p className="mt-1 text-xs text-brand-danger">{errors.vendor_name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="vendor_contact">Contact</Label>
                <Input id="vendor_contact" {...register("vendor_contact")} />
              </div>
              <div>
                <Label htmlFor="vendor_email">Email</Label>
                <Input id="vendor_email" type="email" {...register("vendor_email")} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="vendor_address">Address</Label>
                <Textarea id="vendor_address" rows={2} {...register("vendor_address")} />
              </div>
              <div>
                <Label htmlFor="vendor_gstin">GSTIN / Tax ID</Label>
                <Input id="vendor_gstin" {...register("vendor_gstin")} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Commercial
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select id="currency" {...register("currency")}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="tax_pct">Tax %</Label>
                <Input id="tax_pct" type="number" step="0.01" {...register("tax_pct")} />
              </div>
              <div>
                <Label htmlFor="freight">Freight</Label>
                <Input id="freight" type="number" step="0.01" {...register("freight")} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Input id="payment_terms" {...register("payment_terms")} />
              </div>
              <div>
                <Label htmlFor="required_by">Required By</Label>
                <Input id="required_by" type="date" {...register("required_by")} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="delivery_terms">Delivery Terms</Label>
                <Input id="delivery_terms" {...register("delivery_terms")} />
              </div>
              <div>
                <Label htmlFor="delivery_location">Delivery Location</Label>
                <Input id="delivery_location" {...register("delivery_location")} />
              </div>
              <div className="col-span-3">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} {...register("notes")} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-brand-border bg-brand-bg/40 p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-brand-muted">Subtotal</span>
              <span className="font-mono">{formatCurrency(totals.subtotal, totals.currency)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-brand-muted">Tax ({watched.tax_pct ?? 0}%)</span>
              <span className="font-mono">{formatCurrency(totals.taxAmount, totals.currency)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-brand-muted">Freight</span>
              <span className="font-mono">{formatCurrency(totals.freight, totals.currency)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-brand-border pt-2 text-base font-semibold text-brand-green">
              <span>Grand Total</span>
              <span className="font-mono">{formatCurrency(totals.total, totals.currency)}</span>
            </div>
            <div className="mt-1 text-right text-xs text-brand-muted">
              USD equivalent: {formatCurrency(totals.total_usd, "USD")}
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Generate PO
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
