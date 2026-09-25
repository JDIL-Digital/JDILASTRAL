"use client";

import { useMemo, useState } from "react";
import { convert } from "@/lib/currency/exchangeRate";
import type { Currency } from "@/lib/constants";
import type { LineItem } from "@/types";

const SEED_DESCRIPTIONS = [
  { sku: "BHA-2451", desc: 'Drill Bit 12 1/4" PDC', category: "Drilling Tools", vendor: "Halliburton" },
  { sku: "CSG-7-9TR", desc: 'Casing 9 5/8" L80', category: "Casing & Tubing", vendor: "Tenaris" },
  { sku: "MUD-BARITE", desc: "Barite Weighting Agent", category: "Mud Chemicals", vendor: "M-I SWACO" },
  { sku: "CEM-CL-G", desc: "Class G Oilwell Cement", category: "Cementing", vendor: "Schlumberger" },
  { sku: "LWD-MWD-01", desc: "MWD/LWD Tool Rental — 30 days", category: "Logging", vendor: "Baker Hughes" },
  { sku: "CHRT-WHD-5K", desc: "5K Wellhead Christmas Tree", category: "Wellhead", vendor: "Cameron" },
  { sku: "MAR-SUPPLY", desc: "Marine Supply Vessel Charter", category: "Logistics", vendor: "GAC Group" },
  { sku: "CAT-OFF-30", desc: "Offshore Catering — 30 PAX/day", category: "Catering", vendor: "Sodexo" },
  { sku: "HSE-LIFE-50", desc: "Life Jackets (Pack of 50)", category: "HSE", vendor: "Survitec" },
  { sku: "SPR-BOP-RM", desc: "BOP Ram Spares Kit", category: "BOP Spares", vendor: "NOV" },
  { sku: "INSP-NDT-Q3", desc: "NDT Inspection Services — Q3", category: "Inspection", vendor: "Bureau Veritas" },
  { sku: "FUEL-MDO-T", desc: "Marine Diesel Oil — per tonne", category: "Fuel", vendor: "Indian Oil" },
];

function seedLineItems(annexureId: string): LineItem[] {
  return SEED_DESCRIPTIONS.map((s, i) => {
    const currency: Currency = (["USD", "INR", "AED"] as const)[i % 3] as Currency;
    const quantity = 1 + (i % 8);
    const unit_price = (1500 + i * 425) * (currency === "INR" ? 80 : currency === "AED" ? 3.5 : 1);
    const total_local = quantity * unit_price;
    const total_usd = convert(total_local, currency, "USD");
    const budgeted_usd = total_usd * (1 + (i % 5 === 0 ? -0.08 : 0.05));
    return {
      id: `${annexureId}-li-${i}`,
      annexure_id: annexureId,
      sku: s.sku,
      description: s.desc,
      category: s.category,
      vendor: s.vendor,
      uom: ["EA", "MT", "BBL", "DAY", "LOT"][i % 5],
      quantity,
      unit_price,
      currency,
      total_local,
      total_usd: Math.round(total_usd),
      budgeted_usd: Math.round(budgeted_usd),
      status: (["planned", "requested", "ordered", "received", "invoiced", "paid"] as const)[i % 6],
      po_id: null,
      required_by: `2026-0${(i % 9) + 1}-15`,
      notes: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
  });
}

export function useLineItems(annexureId: string) {
  const initial = useMemo(() => seedLineItems(annexureId), [annexureId]);
  const [items, setItems] = useState<LineItem[]>(initial);

  // Re-seed if annexureId changes mid-mount
  if (items[0]?.annexure_id !== annexureId) {
    setItems(initial);
  }

  return { items, loading: false, error: null as string | null, setItems };
}
