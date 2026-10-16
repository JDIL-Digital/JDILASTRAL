"use client";

/**
 * Project Summary multi-sheet .xlsx exporter.
 *
 * Sheet 1   "Summary"      — 10-column annexure roll-up + totals
 * Sheet 2–12 "Ann I … XI"   — all line items of each annexure
 *
 * Mimics the layout the Jindal operations team has used for the past
 * decade: title block, green header row, totals row at the bottom,
 * numeric columns right-aligned via column width config.
 */

import * as XLSX from "xlsx";
import type { LineItemsByAnnexure } from "@/hooks/useAllLineItems";

const USD_TO_INR = 83.3;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

interface ExportInput {
  projectName: string;
  rigName: string;
  startDate?: string | null;
  grouped: LineItemsByAnnexure[];
}

/* ----------------------------- Sheet 1: Summary ----------------------------- */

const SUMMARY_HEADERS = [
  "Annexure No",
  "Annexure Name",
  "Budgetary Cost USD",
  "Budgetary Cost INR",
  "Actual Cost USD",
  "Actual Cost INR",
  "Remaining USD",
  "Remaining INR",
  "% Used",
  "Status",
];

function statusLabel(pct: number, actualUsd: number): string {
  if (pct > 100) return "Overrun";
  if (pct > 85) return "Watch";
  if (actualUsd === 0) return "Pending";
  return "On Track";
}

function buildSummarySheet(input: ExportInput): XLSX.WorkSheet {
  const title: (string | number)[][] = [
    ["Jindal Drilling & Industries Ltd."],
    [input.projectName],
    [`Rig: ${input.rigName}${input.startDate ? ` · Started ${input.startDate}` : ""}`],
    [`Exported ${new Date().toLocaleString("en-IN")}`],
    [],
  ];

  const rows: (string | number)[][] = input.grouped.map((g) => {
    const budgetUsd = g.total_budget || g.budget_usd;
    const actualUsd = g.total_actual;
    const remainingUsd = budgetUsd - actualUsd;
    const pct = budgetUsd > 0 ? (actualUsd / budgetUsd) * 100 : 0;
    return [
      roman(g.number),
      g.name,
      Number(budgetUsd.toFixed(2)),
      Number((budgetUsd * USD_TO_INR).toFixed(2)),
      Number(actualUsd.toFixed(2)),
      Number((actualUsd * USD_TO_INR).toFixed(2)),
      Number(remainingUsd.toFixed(2)),
      Number((remainingUsd * USD_TO_INR).toFixed(2)),
      `${pct.toFixed(1)}%`,
      statusLabel(pct, actualUsd),
    ];
  });

  // Totals row
  const totalBudget = input.grouped.reduce(
    (s, g) => s + (g.total_budget || g.budget_usd),
    0,
  );
  const totalActual = input.grouped.reduce((s, g) => s + g.total_actual, 0);
  const totalRemaining = totalBudget - totalActual;
  const grandPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const totalRow: (string | number)[] = [
    "",
    `TOTAL (${input.grouped.length} annexures)`,
    Number(totalBudget.toFixed(2)),
    Number((totalBudget * USD_TO_INR).toFixed(2)),
    Number(totalActual.toFixed(2)),
    Number((totalActual * USD_TO_INR).toFixed(2)),
    Number(totalRemaining.toFixed(2)),
    Number((totalRemaining * USD_TO_INR).toFixed(2)),
    `${grandPct.toFixed(1)}%`,
    statusLabel(grandPct, totalActual),
  ];

  const aoa = [...title, SUMMARY_HEADERS, ...rows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 12 },  // Ann No
    { wch: 28 },  // Name
    { wch: 18 },  // Budget USD
    { wch: 18 },  // Budget INR
    { wch: 18 },  // Actual USD
    { wch: 18 },  // Actual INR
    { wch: 18 },  // Remaining USD
    { wch: 18 },  // Remaining INR
    { wch: 10 },  // % Used
    { wch: 12 },  // Status
  ];

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: SUMMARY_HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: SUMMARY_HEADERS.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: SUMMARY_HEADERS.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: SUMMARY_HEADERS.length - 1 } },
  ];

  return ws;
}

/* ----------------------------- Sheet N: per-annexure ----------------------------- */

const ANNEXURE_HEADERS = [
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

function buildAnnexureSheet(
  group: LineItemsByAnnexure,
  projectName: string,
  rigName: string,
): XLSX.WorkSheet {
  const title: (string | number)[][] = [
    [`Jindal Drilling & Industries Ltd. · ${rigName}`],
    [projectName],
    [`Annexure ${roman(group.number)} — ${group.name}`],
    [`Exported ${new Date().toLocaleString("en-IN")}`],
    [],
  ];

  const rows: (string | number)[][] = group.items.map((li, idx) => [
    li.sr_no ?? idx + 1,
    li.material_code ?? "",
    li.area ?? "",
    li.description ?? "",
    li.work_by ?? "",
    Number((li.budget_usd ?? 0).toFixed(2)),
    Number((li.actual_local_amount ?? 0).toFixed(2)),
    li.actual_local_currency ?? "USD",
    li.actual_local_date ?? "",
    Number((li.exchange_rate_to_usd ?? 1).toFixed(6)),
    Number((li.actual_usd_computed ?? 0).toFixed(2)),
    Number((li.surplus_usd ?? 0).toFixed(2)),
    li.mr_no ?? "",
    li.po_no ?? "",
    li.status,
  ]);

  const totalRow: (string | number)[] = [
    "",
    "",
    "",
    `TOTALS (${group.items.length} items)`,
    "",
    Number(group.total_budget.toFixed(2)),
    "",
    "",
    "",
    "",
    Number(group.total_actual.toFixed(2)),
    Number((group.total_budget - group.total_actual).toFixed(2)),
    "",
    "",
    "",
  ];

  const aoa = [...title, ANNEXURE_HEADERS, ...rows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 6 },   // Sr
    { wch: 14 },  // Code
    { wch: 14 },  // Area
    { wch: 44 },  // Description
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

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ANNEXURE_HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: ANNEXURE_HEADERS.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: ANNEXURE_HEADERS.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: ANNEXURE_HEADERS.length - 1 } },
  ];

  return ws;
}

/* -------------------------------- entrypoint -------------------------------- */

export function exportProjectSummaryToXlsx(input: ExportInput): string {
  const wb = XLSX.utils.book_new();

  const summarySheet = buildSummarySheet(input);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  input.grouped.forEach((g) => {
    const sheet = buildAnnexureSheet(g, input.projectName, input.rigName);
    // Sheet names max 31 chars; truncate any oversize names.
    const sheetName = `Ann ${roman(g.number)}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `JDIL-ASTRAL-Summary-${today}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
