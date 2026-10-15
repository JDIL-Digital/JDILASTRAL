"use client";

/**
 * Export an annexure's line items to .xlsx matching the layout the
 * Jindal operations team has used for the past decade:
 *
 * Sr No · Material Code · Area · Description · Work By · Budget USD ·
 * Actual Amount · Currency · Date · Rate · Actual USD · Surplus ·
 * MR No · PO No · Status
 *
 * Trailing TOTAL row shows column sums. Filename follows:
 * JSIL-ASTRAL-Ann{number}-{yyyy-MM-dd}.xlsx
 */

import * as XLSX from "xlsx";
import type { DbLineItem } from "@/types/database";

interface ExportInput {
  annexureNumber: number;
  annexureName: string;
  projectName: string;
  rigName: string;
  items: DbLineItem[];
}

const HEADERS = [
  "Sr No",
  "Material Code",
  "Area",
  "Description",
  "Work By",
  "Budget USD",
  "Actual Amount",
  "Currency",
  "Date",
  "Rate",
  "Actual USD",
  "Surplus / Exceeded",
  "MR No",
  "PO No",
  "Status",
];

function statusLabel(s: DbLineItem["status"]): string {
  switch (s) {
    case "on-track":
      return "On Track";
    case "watch":
      return "Watch";
    case "overrun":
      return "Overrun";
    default:
      return "Pending";
  }
}

export function exportAnnexureToXlsx({
  annexureNumber,
  annexureName,
  projectName,
  rigName,
  items,
}: ExportInput): void {
  const wb = XLSX.utils.book_new();

  // Title block above the table — three merged header rows that mirror
  // the original spreadsheet's letterhead.
  const title = [
    [`JSIL·ASTRAL — Jindal Drilling & Industries Ltd.`],
    [`${rigName} · ${projectName}`],
    [`Annexure ${annexureNumber} — ${annexureName}`],
    [`Exported ${new Date().toLocaleString("en-IN")}`],
    [],
  ];

  const rows: (string | number)[][] = items.map((li, idx) => [
    idx + 1,
    li.material_code ?? "",
    li.area ?? "",
    li.description ?? "",
    li.work_by ?? "",
    Number(li.budget_usd ?? 0),
    Number(li.actual_local_amount ?? 0),
    li.actual_local_currency ?? "USD",
    li.actual_local_date ?? "",
    Number(li.exchange_rate_to_usd ?? 1),
    Number(li.actual_usd_computed ?? 0),
    Number(li.surplus_usd ?? 0),
    li.mr_no ?? "",
    li.po_no ?? "",
    statusLabel(li.status),
  ]);

  const totalBudget = items.reduce((s, i) => s + Number(i.budget_usd ?? 0), 0);
  const totalActual = items.reduce((s, i) => s + Number(i.actual_usd_computed ?? 0), 0);
  const totalSurplus = items.reduce((s, i) => s + Number(i.surplus_usd ?? 0), 0);

  const totalRow: (string | number)[] = [
    "",
    "",
    "",
    `TOTALS (${items.length} items)`,
    "",
    totalBudget,
    "",
    "",
    "",
    "",
    totalActual,
    totalSurplus,
    "",
    "",
    "",
  ];

  const aoa = [...title, HEADERS, ...rows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths — tuned to the longest content you typically see.
  ws["!cols"] = [
    { wch: 6 },   // Sr
    { wch: 16 },  // Code
    { wch: 14 },  // Area
    { wch: 46 },  // Description
    { wch: 12 },  // Work By
    { wch: 14 },  // Budget
    { wch: 14 },  // Actual
    { wch: 8 },   // Ccy
    { wch: 12 },  // Date
    { wch: 10 },  // Rate
    { wch: 14 },  // Actual USD
    { wch: 14 },  // Surplus
    { wch: 14 },  // MR
    { wch: 14 },  // PO
    { wch: 12 },  // Status
  ];

  // Merge the four title lines across the full width.
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: HEADERS.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: HEADERS.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Ann ${annexureNumber}`);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `JSIL-ASTRAL-Ann${annexureNumber}-${today}.xlsx`;
  XLSX.writeFile(wb, filename);
}
