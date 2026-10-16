"use client";

/**
 * Project Summary PDF (A4). Jindal letterhead → green rule → project
 * meta → 10-column summary table with totals → per-annexure breakdown
 * table → footer with brand line + page number.
 *
 * No external chart embedding — kept pure jsPDF for portability and
 * deterministic file size. The team's own Excel has the charts; this
 * PDF is the printable record.
 */

import jsPDF from "jspdf";
import { BRAND } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { LineItemsByAnnexure } from "@/hooks/useAllLineItems";

const USD_TO_INR = 83.3;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

export interface ProjectSummaryPdfInput {
  projectName: string;
  rigName: string;
  rigType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  grouped: LineItemsByAnnexure[];
}

/* --------------------------- colors & geometry --------------------------- */

const C_GREEN = BRAND.primary;
const C_RED = BRAND.danger;
const C_NAVY = "#0D1B2A";
const C_INK = "#1F2937";
const C_MUTED = "#64748B";
const C_STRIPE = "#F8FAFC";
const C_RULE = "#E2E8F0";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}
function setFill(doc: jsPDF, c: string) {
  const [r, g, b] = hex(c);
  doc.setFillColor(r, g, b);
}
function setText(doc: jsPDF, c: string) {
  const [r, g, b] = hex(c);
  doc.setTextColor(r, g, b);
}
function hr(doc: jsPDF, y: number, color: string, thickness = 0.5) {
  doc.setDrawColor(color);
  doc.setLineWidth(thickness);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

/* ------------------------------ page helpers ----------------------------- */

function drawHeader(doc: jsPDF, input: ProjectSummaryPdfInput, page: number, pages: number) {
  setFill(doc, C_GREEN);
  doc.rect(0, 0, PAGE_W, 8, "F");

  setText(doc, C_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("JINDAL DRILLING & INDUSTRIES LTD.", MARGIN, 32);

  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("JDIL·ASTRAL · Fleet Operations & Rig Governance Engine", MARGIN, 44);

  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PROJECT SUMMARY", PAGE_W - MARGIN, 32, { align: "right" });

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(new Date())}`, PAGE_W - MARGIN, 46, { align: "right" });
  setText(doc, C_MUTED);
  doc.setFontSize(8);
  doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, 56, { align: "right" });

  hr(doc, 64, C_GREEN, 1.2);
}

function drawProjectMeta(doc: jsPDF, input: ProjectSummaryPdfInput, startY: number): number {
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PROJECT", MARGIN, startY);

  setText(doc, C_INK);
  doc.setFontSize(10);
  doc.text(input.projectName, MARGIN, startY + 14);

  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rigLine = input.rigType
    ? `Rig: ${input.rigName} (${input.rigType})`
    : `Rig: ${input.rigName}`;
  doc.text(rigLine, MARGIN, startY + 26);
  if (input.startDate || input.endDate) {
    const dates = `${input.startDate ? formatDate(input.startDate) : "—"} → ${input.endDate ? formatDate(input.endDate) : "ongoing"}`;
    doc.text(dates, MARGIN, startY + 38);
  }

  hr(doc, startY + 46, C_RED, 0.8);
  return startY + 56;
}

/* --------------------------- summary table (10 cols) --------------------- */

const SUMMARY_COLS = {
  ann: 40,
  name: 95,
  budUsd: 60,
  budInr: 60,
  actUsd: 60,
  actInr: 60,
  remUsd: 55,
  remInr: 50,
  pct: 32,
  status: 11,
};

function drawSummaryHeader(doc: jsPDF, y: number): number {
  const rowH = 22;
  setFill(doc, C_GREEN);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);

  let x = MARGIN;
  const pad = 4;
  const h = (label: string, w: number, align: "left" | "right" = "left") => {
    const tx = align === "right" ? x + w - pad : x + pad;
    doc.text(label, tx, y + 14, { align });
    x += w;
  };
  h("Ann", SUMMARY_COLS.ann);
  h("Annexure Name", SUMMARY_COLS.name);
  h("Budget USD", SUMMARY_COLS.budUsd, "right");
  h("Budget INR", SUMMARY_COLS.budInr, "right");
  h("Actual USD", SUMMARY_COLS.actUsd, "right");
  h("Actual INR", SUMMARY_COLS.actInr, "right");
  h("Rem. USD", SUMMARY_COLS.remUsd, "right");
  h("Rem. INR", SUMMARY_COLS.remInr, "right");
  h("% Used", SUMMARY_COLS.pct, "right");
  h("Status", SUMMARY_COLS.status);

  return y + rowH;
}

function drawSummaryRow(
  doc: jsPDF,
  y: number,
  idx: number,
  g: LineItemsByAnnexure,
): number {
  const rowH = 18;
  const pad = 4;
  if (idx % 2 === 1) {
    setFill(doc, C_STRIPE);
    doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
  }

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const budget = g.total_budget || g.budget_usd;
  const actual = g.total_actual;
  const remaining = budget - actual;
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  const over = pct > 100;

  let x = MARGIN;
  const cell = (
    text: string,
    w: number,
    align: "left" | "right" = "left",
    color = C_INK,
  ) => {
    setText(doc, color);
    const tx = align === "right" ? x + w - pad : x + pad;
    doc.text(text, tx, y + 12, { align });
    x += w;
  };

  cell(roman(g.number), SUMMARY_COLS.ann);
  cell(g.name, SUMMARY_COLS.name);
  cell(formatCurrency(budget, "USD"), SUMMARY_COLS.budUsd, "right");
  cell(formatCurrency(budget * USD_TO_INR, "INR"), SUMMARY_COLS.budInr, "right");
  cell(formatCurrency(actual, "USD"), SUMMARY_COLS.actUsd, "right");
  cell(formatCurrency(actual * USD_TO_INR, "INR"), SUMMARY_COLS.actInr, "right");
  cell(
    formatCurrency(remaining, "USD"),
    SUMMARY_COLS.remUsd,
    "right",
    remaining < 0 ? C_RED : C_INK,
  );
  cell(
    formatCurrency(remaining * USD_TO_INR, "INR"),
    SUMMARY_COLS.remInr,
    "right",
    remaining < 0 ? C_RED : C_INK,
  );
  cell(`${pct.toFixed(0)}%`, SUMMARY_COLS.pct, "right", over ? C_RED : C_INK);
  // Status pip
  const dotColor = over ? C_RED : pct > 85 ? "#F59E0B" : C_GREEN;
  setFill(doc, dotColor);
  doc.circle(x + 4, y + 10, 2.4, "F");

  return y + rowH;
}

function drawSummaryTotals(
  doc: jsPDF,
  y: number,
  grouped: LineItemsByAnnexure[],
): number {
  const rowH = 22;
  setFill(doc, C_NAVY);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "F");

  const totalBudget = grouped.reduce(
    (s, g) => s + (g.total_budget || g.budget_usd),
    0,
  );
  const totalActual = grouped.reduce((s, g) => s + g.total_actual, 0);
  const totalRemaining = totalBudget - totalActual;
  const pct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const pad = 4;
  let x = MARGIN;
  const put = (text: string, w: number, align: "left" | "right" = "left") => {
    const tx = align === "right" ? x + w - pad : x + pad;
    doc.text(text, tx, y + 14, { align });
    x += w;
  };
  put("TOTAL", SUMMARY_COLS.ann);
  put(`${grouped.length} annexures`, SUMMARY_COLS.name);
  put(formatCurrency(totalBudget, "USD"), SUMMARY_COLS.budUsd, "right");
  put(formatCurrency(totalBudget * USD_TO_INR, "INR"), SUMMARY_COLS.budInr, "right");
  put(formatCurrency(totalActual, "USD"), SUMMARY_COLS.actUsd, "right");
  put(formatCurrency(totalActual * USD_TO_INR, "INR"), SUMMARY_COLS.actInr, "right");
  put(formatCurrency(totalRemaining, "USD"), SUMMARY_COLS.remUsd, "right");
  put(formatCurrency(totalRemaining * USD_TO_INR, "INR"), SUMMARY_COLS.remInr, "right");
  put(`${pct.toFixed(1)}%`, SUMMARY_COLS.pct, "right");
  put("", SUMMARY_COLS.status);

  return y + rowH;
}

/* -------------------------------- footer -------------------------------- */

function drawFooter(doc: jsPDF, page: number, pages: number) {
  const y = PAGE_H - 24;
  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "JDIL·ASTRAL | Fleet Operations & Rig Governance Engine",
    MARGIN,
    y,
  );
  doc.text(
    "Jindal Drilling & Industries Ltd.  |  CONFIDENTIAL",
    PAGE_W / 2,
    y,
    { align: "center" },
  );
  doc.text(`Page ${page} / ${pages}`, PAGE_W - MARGIN, y, { align: "right" });

  setFill(doc, C_GREEN);
  doc.rect(0, PAGE_H - 6, PAGE_W, 6, "F");
}

/* -------------------------------- entrypoint ------------------------------- */

export function generateProjectSummaryPdf(input: ProjectSummaryPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Single-page summary — the 11-row table + totals + meta all fit on one A4
  // at this density. If a future project grows past 11 annexures, extend
  // the paginator here.
  const pages = 1;
  const page = 1;

  drawHeader(doc, input, page, pages);
  let cursor = drawProjectMeta(doc, input, 80);
  cursor = drawSummaryHeader(doc, cursor);
  input.grouped.forEach((g, i) => {
    cursor = drawSummaryRow(doc, cursor, i, g);
  });
  cursor = drawSummaryTotals(doc, cursor, input.grouped);

  drawFooter(doc, page, pages);
  return doc;
}

export function downloadProjectSummaryPdf(input: ProjectSummaryPdfInput): string {
  const doc = generateProjectSummaryPdf(input);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `JDIL-ASTRAL-Summary-${today}.pdf`;
  doc.save(filename);
  return filename;
}
