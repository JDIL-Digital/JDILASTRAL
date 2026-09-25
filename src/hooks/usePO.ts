"use client";

import { useMemo } from "react";
import { RIGS } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import type { PurchaseOrder } from "@/types";

function seedPOs(): PurchaseOrder[] {
  const vendors = ["Halliburton", "Schlumberger", "Baker Hughes", "Tenaris", "Cameron", "NOV"];
  const statuses: PurchaseOrder["status"][] = [
    "draft",
    "pending_approval",
    "approved",
    "issued",
    "received",
    "closed",
  ];
  // Deterministic dates so SSR/CSR markup matches on hydration.
  const baseEpoch = Date.UTC(2026, 5, 1);
  return Array.from({ length: 18 }).map((_, i) => {
    const subtotal = 145_000 + i * 22_500;
    const tax = subtotal * 0.18;
    const freight = 2500 + i * 250;
    const total = subtotal + tax + freight;
    const rig = RIGS[i % RIGS.length];
    const created = new Date(baseEpoch - i * 86400000).toISOString();
    return {
      id: `po-${i + 1}`,
      po_number: `JSIL-PO-2026-${String(1000 + i).padStart(5, "0")}`,
      rig_id: slugify(rig),
      project_id: `${slugify(rig)}-prj-1`,
      annexure_id: `${slugify(rig)}-prj-1-annex-${i % 11}`,
      vendor_name: vendors[i % vendors.length],
      vendor_address: "Hamriyah Free Zone, Sharjah, UAE",
      vendor_contact: "+971 6 555 1234",
      vendor_email: "ops@vendor.com",
      vendor_gstin: null,
      currency: "USD",
      subtotal,
      tax_pct: 18,
      tax_amount: tax,
      freight,
      total,
      total_usd: total,
      payment_terms: "Net 30",
      delivery_terms: "DAP",
      delivery_location: `${rig} · Mumbai High`,
      required_by: `2026-0${(i % 9) + 1}-15`,
      status: statuses[i % statuses.length],
      raised_by: "demo-user",
      approved_by: i % 3 === 0 ? null : "demo-manager",
      approved_at: i % 3 === 0 ? null : created,
      issued_at: i % 4 === 0 ? created : null,
      notes: null,
      line_items: [],
      created_at: created,
      updated_at: created,
    };
  });
}

const SEEDED_POS = seedPOs();

export function usePOs(filters?: { rigId?: string; status?: PurchaseOrder["status"] }) {
  const pos = useMemo(() => {
    if (!filters) return SEEDED_POS;
    return SEEDED_POS.filter((p) => {
      if (filters.rigId && p.rig_id !== filters.rigId) return false;
      if (filters.status && p.status !== filters.status) return false;
      return true;
    });
  }, [filters?.rigId, filters?.status]);

  return { pos, loading: false, error: null as string | null };
}
