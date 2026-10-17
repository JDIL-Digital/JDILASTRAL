"use client";

/**
 * Analytics & Forecasting PDF.
 *
 * Single-page A4 (overflows paginate automatically):
 *   • Jindal letterhead
 *   • Executive summary (health score, traffic light, one-line summary,
 *     CPI/SPI/EAC/VAC pills)
 *   • EVM metrics block
 *   • Annexure performance table with risk pips
 *   • Top overruns list
 *   • Footer with brand line + page number
 *
 * No external chart embedding — tabular + sparkline-style data only.
 * The dashboard view carries the interactive charts; this is the
 * portable record for email / print.
 */

import jsPDF from "jspdf";
import { BRAND } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  AnalyticsData,
  AnnexurePerformance,
  OverrunItem,
  RiskLevel,
} from "@/hooks/useAnalytics";

/* ---------------------------- geometry ---------------------------- */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C_GREEN = BRAND.primary;
const C_WARNING = BRAND.warning;
const C_DANGER = BRAND.danger;
const C_NAVY = "#0D1B2A";
const C_INK = "#1F2937";
const C_MUTED = "#64748B";
const C_STRIPE = "#F8FAFC";

function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
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

const RISK_COLOR: Record<RiskLevel, string> = {
  low: C_GREEN,
  medium: C_WARNING,
  high: "#F97316",
  critical: C_DANGER,
};
const RISK_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

/* ----------------------------- header ----------------------------- */

function drawHeader(doc: jsPDF, page: number, pages: number) {
  setFill(doc, C_GREEN);
  doc.rect(0, 0, PAGE_W, 8, "F");

  setText(doc, C_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("JINDAL DRILLING & INDUSTRIES LTD.", MARGIN, 32);

  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "JDIL·ASTRAL · Fleet Operations & Rig Governance Engine",
    MARGIN,
    44,
  );

  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ANALYTICS & FORECAST", PAGE_W - MARGIN, 32, { align: "right" });

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(new Date())}`, PAGE_W - MARGIN, 46, { align: "right" });
  setText(doc, C_MUTED);
  doc.setFontSize(8);
  doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, 56, { align: "right" });

  hr(doc, 64, C_GREEN, 1.2);
}

function drawFooter(doc: jsPDF, page: number, pages: number) {
  const y = PAGE_H - 24;
  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("JDIL·ASTRAL | Analytics & Forecasting", MARGIN, y);
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

/* ------------------------- executive summary ------------------------- */

function drawExecutive(doc: jsPDF, startY: number, data: AnalyticsData): number {
  const exec = data.executive;

  // Traffic light + health score
  const bandY = startY;
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EXECUTIVE SUMMARY", MARGIN, bandY);

  const scoreX = PAGE_W - MARGIN - 90;
  // Score chip
  const chipColor =
    exec.traffic === "healthy"
      ? C_GREEN
      : exec.traffic === "watch"
        ? C_WARNING
        : C_DANGER;
  setFill(doc, chipColor);
  doc.roundedRect(scoreX, bandY - 10, 90, 20, 10, 10, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `HEALTH ${exec.healthScore} / 100 · ${exec.traffic.toUpperCase()}`,
    scoreX + 45,
    bandY + 4,
    { align: "center" },
  );

  // One-line summary
  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(exec.summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, bandY + 20);
  const summaryBottom = bandY + 20 + summaryLines.length * 12;

  // KPI pills row
  const pillY = summaryBottom + 6;
  const pills = [
    { label: "CPI", value: exec.cpi.toFixed(2), good: exec.cpi >= 1 },
    { label: "SPI", value: exec.spi.toFixed(2), good: exec.spi >= 1 },
    { label: "EAC", value: `$${formatMillions(exec.eac)}`, good: exec.eac <= exec.bac },
    {
      label: "VAC",
      value: `${exec.vac < 0 ? "-" : ""}$${formatMillions(Math.abs(exec.vac))}`,
      good: exec.vac >= 0,
    },
    { label: "% Complete", value: `${exec.pctComplete.toFixed(0)}%`, good: true },
  ];
  const pillW = (CONTENT_W - 6 * (pills.length - 1)) / pills.length;
  pills.forEach((p, i) => {
    const x = MARGIN + i * (pillW + 6);
    setFill(doc, p.good ? "#ECFDF5" : "#FEF2F2");
    doc.setDrawColor(p.good ? C_GREEN : C_DANGER);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, pillY, pillW, 32, 4, 4, "FD");
    setText(doc, C_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(p.label, x + 6, pillY + 11);
    setText(doc, p.good ? C_GREEN : C_DANGER);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(p.value, x + 6, pillY + 25);
  });

  return pillY + 32 + 14;
}

/* ------------------------- EVM metrics block ------------------------- */

function drawEvm(doc: jsPDF, startY: number, data: AnalyticsData): number {
  const exec = data.executive;
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EARNED VALUE METRICS", MARGIN, startY);

  const rows: Array<[string, string]> = [
    ["Budget At Completion (BAC)", formatCurrency(exec.bac, "USD")],
    ["Actual Cost (AC)", formatCurrency(exec.ac, "USD")],
    ["Earned Value (EV)", formatCurrency(exec.ev, "USD")],
    ["Planned Value (PV)", formatCurrency(exec.pv, "USD")],
    ["Estimate At Completion (EAC)", formatCurrency(exec.eac, "USD")],
    ["Variance At Completion (VAC)", formatCurrency(exec.vac, "USD")],
    ["Avg Monthly Burn", formatCurrency(data.avgMonthlyBurn, "USD") + " / mo"],
    [
      "Months to Completion",
      Number.isFinite(data.projectedMonthsToCompletion)
        ? `${data.projectedMonthsToCompletion.toFixed(1)} mo at current burn`
        : "— (no burn yet)",
    ],
  ];

  const colW = CONTENT_W / 2;
  const rowH = 14;
  rows.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colW;
    const y = startY + 14 + row * rowH;
    if (row % 2 === 0) {
      setFill(doc, C_STRIPE);
      doc.rect(x, y - 10, colW, rowH, "F");
    }
    setText(doc, C_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(r[0], x + 4, y);
    setText(doc, C_INK);
    doc.setFont("helvetica", "bold");
    doc.text(r[1], x + colW - 4, y, { align: "right" });
  });
  return startY + 14 + Math.ceil(rows.length / 2) * rowH + 12;
}

/* ----------------------- annexure performance ----------------------- */

const PERF_COLS = {
  ann: 24,
  name: 150,
  budget: 76,
  actual: 76,
  cpi: 40,
  forecast: 76,
  risk: 42,
  trend: 39,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

function drawPerformanceHeader(doc: jsPDF, y: number): number {
  const rowH = 20;
  setFill(doc, C_GREEN);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  let x = MARGIN;
  const pad = 4;
  const h = (label: string, w: number, align: "left" | "right" = "left") => {
    const tx = align === "right" ? x + w - pad : x + pad;
    doc.text(label, tx, y + 13, { align });
    x += w;
  };
  h("Ann", PERF_COLS.ann);
  h("Annexure", PERF_COLS.name);
  h("Budget", PERF_COLS.budget, "right");
  h("Actual", PERF_COLS.actual, "right");
  h("CPI", PERF_COLS.cpi, "right");
  h("Forecast", PERF_COLS.forecast, "right");
  h("Risk", PERF_COLS.risk);
  h("Trend", PERF_COLS.trend);
  return y + rowH;
}

function drawPerformanceRow(
  doc: jsPDF,
  y: number,
  idx: number,
  row: AnnexurePerformance,
): number {
  const rowH = 16;
  const pad = 4;
  if (idx % 2 === 1) {
    setFill(doc, C_STRIPE);
    doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
  }

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let x = MARGIN;
  const cell = (text: string, w: number, align: "left" | "right" = "left") => {
    const tx = align === "right" ? x + w - pad : x + pad;
    doc.text(text, tx, y + 11, { align });
    x += w;
  };

  cell(roman(row.number), PERF_COLS.ann);
  cell(row.name, PERF_COLS.name);
  cell(formatCurrency(row.budget, "USD"), PERF_COLS.budget, "right");
  cell(formatCurrency(row.actual, "USD"), PERF_COLS.actual, "right");
  // CPI with color
  setText(doc, row.cpi >= 1 ? C_GREEN : row.cpi >= 0.9 ? C_WARNING : C_DANGER);
  doc.setFont("helvetica", "bold");
  cell(row.cpi.toFixed(2), PERF_COLS.cpi, "right");
  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  cell(formatCurrency(row.forecast, "USD"), PERF_COLS.forecast, "right");

  // Risk pill
  setFill(doc, RISK_COLOR[row.risk]);
  doc.roundedRect(x + pad, y + 3, 32, 10, 2, 2, "F");
  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(RISK_LABEL[row.risk], x + pad + 16, y + 10, { align: "center" });
  x += PERF_COLS.risk;

  // Trend arrow
  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const arrow =
    row.trend === "improving" ? "↑" : row.trend === "deteriorating" ? "↓" : "→";
  cell(arrow, PERF_COLS.trend);

  return y + rowH;
}

/* ---------------------------- overruns ---------------------------- */

function drawOverruns(doc: jsPDF, startY: number, overruns: OverrunItem[]): number {
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOP OVERRUNS", MARGIN, startY);

  if (overruns.length === 0) {
    setText(doc, C_MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("No overruns detected in this scope.", MARGIN, startY + 14);
    return startY + 24;
  }

  let y = startY + 10;
  const rowH = 14;
  overruns.forEach((o, i) => {
    if (i % 2 === 0) {
      setFill(doc, C_STRIPE);
      doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }
    setText(doc, C_INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const descLines = doc.splitTextToSize(o.description, 340);
    doc.text(descLines[0] ?? "", MARGIN + 4, y + 10);
    setText(doc, C_MUTED);
    doc.setFontSize(7.5);
    doc.text(
      `${o.area ?? "—"} · ${o.work_by ?? "—"}`,
      MARGIN + 350,
      y + 10,
    );
    setText(doc, C_DANGER);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(
      `+${formatCurrency(o.overrun, "USD")}`,
      PAGE_W - MARGIN - 4,
      y + 10,
      { align: "right" },
    );
    y += rowH;
  });
  return y + 10;
}

/* --------------------------- entrypoint --------------------------- */

function formatMillions(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export function generateAnalyticsPdf(data: AnalyticsData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pages = 1;
  const page = 1;
  drawHeader(doc, page, pages);

  let cursor = 82;
  cursor = drawExecutive(doc, cursor, data);
  cursor = drawEvm(doc, cursor, data);

  // Annexure performance table
  cursor = drawPerformanceHeader(doc, cursor);
  data.annexurePerformance.forEach((row, i) => {
    cursor = drawPerformanceRow(doc, cursor, i, row);
  });
  cursor += 10;

  // Overrun block if there's room
  if (cursor < PAGE_H - 120) {
    cursor = drawOverruns(doc, cursor, data.topOverruns.slice(0, 6));
  }

  drawFooter(doc, page, pages);
  return doc;
}

export function downloadAnalyticsPdf(data: AnalyticsData): string {
  const doc = generateAnalyticsPdf(data);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `JDIL-ASTRAL-Analytics-${today}.pdf`;
  doc.save(filename);
  return filename;
}
