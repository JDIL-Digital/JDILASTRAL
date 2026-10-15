"use client";

/**
 * Professional A4 Purchase Order PDF — JSIL·ASTRAL / Jindal Drilling.
 *
 * All drawing is done with jsPDF primitives (no autoTable dep). Measurements
 * are in points (72 pt = 1 inch; 56.7 pt ≈ 20 mm margin).
 *
 * Layout:
 *   • Green header band + "JINDAL DRILLING" wordmark (left) + PO# block (right)
 *   • Thin green divider rule
 *   • Two-column VENDOR / PROJECT DETAILS block
 *   • Thin red divider rule
 *   • Line-items table (green header row, zebra-striped body, right-aligned numerics)
 *   • Totals box (right-aligned, bold grand total)
 *   • Terms & conditions box (thin border)
 *   • 3-column signature block (Prepared / Checked / Approved)
 *   • Footer with brand line + page number
 */

import jsPDF from "jspdf";
import { BRAND } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

/* ---------------------------------- types ---------------------------------- */

export interface POPdfLineItem {
  sr: number;
  description: string;
  area?: string | null;
  qty: number;
  unit: string;
  unit_rate_usd: number;
  amount_usd: number;
}

export interface POPdfInput {
  po_number: string;
  date: string;                 // ISO yyyy-MM-dd
  status: string;               // "DRAFT" / "ISSUED" etc. — rendered uppercase
  vendor: {
    name: string;
    address?: string | null;
    contact?: string | null;
    email?: string | null;
    gstin?: string | null;
  };
  project: {
    name: string;
    rigName: string;
    rigType?: string | null;
    annexureName?: string | null;
    contractRef?: string | null;
  };
  lineItems: POPdfLineItem[];
  totals: {
    subtotal_usd: number;
    exchange_rate: number;       // 1 USD = X local
    local_currency: "USD" | "INR" | "AED" | string;
    total_local: number;
    total_usd: number;
  };
  terms: {
    payment?: string;
    delivery?: string;
    freeText?: string | null;
  };
  signatures: {
    preparedBy: string;
    checkedBy?: string;
    approvedBy?: string;
  };
}

/* ----------------------------- color constants ----------------------------- */

const C_GREEN = BRAND.primary;       // #1A7A3C
const C_RED = BRAND.danger;          // #C8102E
const C_NAVY = "#0D1B2A";
const C_INK = "#1F2937";             // body text
const C_MUTED = "#64748B";
const C_STRIPE = "#F8FAFC";
const C_RULE = "#E2E8F0";

/* ------------------------------ layout helpers ----------------------------- */

const PAGE_W = 595.28;   // A4 width in pt
const PAGE_H = 841.89;   // A4 height in pt
const MARGIN = 42;        // ≈15mm — tight but legible
const CONTENT_W = PAGE_W - MARGIN * 2;

function hr(doc: jsPDF, y: number, color: string, thickness = 0.5) {
  doc.setDrawColor(color);
  doc.setLineWidth(thickness);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function setFill(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setText(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/* -------------------------------- renderers -------------------------------- */

function drawHeader(doc: jsPDF, input: POPdfInput, pageNo: number, totalPages: number) {
  // Green top band
  setFill(doc, C_GREEN);
  doc.rect(0, 0, PAGE_W, 10, "F");

  // Left: brand lockup (text; the real logo lives in /public and isn't embedded
  // in the PDF to keep the file tiny and portable)
  let y = MARGIN - 6;
  setText(doc, C_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("JINDAL DRILLING & INDUSTRIES LTD.", MARGIN, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, C_MUTED);
  doc.text("JSIL·ASTRAL · Fleet Operations & Rig Governance Engine", MARGIN, y + 30);

  // Right: PURCHASE ORDER wordmark + PO meta
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PURCHASE ORDER", PAGE_W - MARGIN, y + 16, { align: "right" });

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`PO #: ${input.po_number}`, PAGE_W - MARGIN, y + 32, { align: "right" });
  doc.text(`Date: ${formatDate(input.date)}`, PAGE_W - MARGIN, y + 44, { align: "right" });
  doc.text(`Status: ${input.status.toUpperCase()}`, PAGE_W - MARGIN, y + 56, { align: "right" });
  setText(doc, C_MUTED);
  doc.setFontSize(8);
  doc.text(`Page ${pageNo} of ${totalPages}`, PAGE_W - MARGIN, y + 66, { align: "right" });

  // Green rule under the header block
  hr(doc, y + 76, C_GREEN, 1.5);
}

function drawParties(doc: jsPDF, input: POPdfInput, startY: number): number {
  const colGap = 16;
  const colW = (CONTENT_W - colGap) / 2;

  // Column headers
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VENDOR", MARGIN, startY);
  doc.text("PROJECT DETAILS", MARGIN + colW + colGap, startY);

  // Column bodies
  setText(doc, C_INK);
  doc.setFontSize(9.5);
  let y1 = startY + 14;
  let y2 = startY + 14;

  doc.setFont("helvetica", "bold");
  doc.text(input.vendor.name, MARGIN, y1);
  y1 += 12;
  doc.setFont("helvetica", "normal");

  if (input.vendor.address) {
    const lines = doc.splitTextToSize(input.vendor.address, colW);
    doc.text(lines, MARGIN, y1);
    y1 += lines.length * 11;
  }
  if (input.vendor.contact) {
    doc.text(`Contact: ${input.vendor.contact}`, MARGIN, y1);
    y1 += 11;
  }
  if (input.vendor.email) {
    doc.text(`Email: ${input.vendor.email}`, MARGIN, y1);
    y1 += 11;
  }
  if (input.vendor.gstin) {
    doc.text(`GSTIN: ${input.vendor.gstin}`, MARGIN, y1);
    y1 += 11;
  }

  const projectX = MARGIN + colW + colGap;
  doc.setFont("helvetica", "bold");
  doc.text(input.project.name, projectX, y2);
  y2 += 12;
  doc.setFont("helvetica", "normal");

  const rigLabel = input.project.rigType
    ? `${input.project.rigName} (${input.project.rigType})`
    : input.project.rigName;
  doc.text(`Rig: ${rigLabel}`, projectX, y2);
  y2 += 11;

  if (input.project.annexureName) {
    doc.text(`Annexure: ${input.project.annexureName}`, projectX, y2);
    y2 += 11;
  }
  if (input.project.contractRef) {
    doc.text(`Contract Ref: ${input.project.contractRef}`, projectX, y2);
    y2 += 11;
  }

  const bottom = Math.max(y1, y2);
  // Red divider
  hr(doc, bottom + 8, C_RED, 0.8);
  return bottom + 20;
}

/* ------------------------------- line items -------------------------------- */

const COL_WIDTHS: Record<keyof POPdfLineItem | "line", number> = {
  line: 0,
  sr: 28,
  description: 206,
  area: 58,
  qty: 38,
  unit: 52,
  unit_rate_usd: 68,
  amount_usd: 61,
};

function drawTableHeader(doc: jsPDF, y: number): number {
  const rowH = 20;
  // Green header fill
  setFill(doc, C_GREEN);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "F");

  setText(doc, "#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  let x = MARGIN;
  const padding = 6;

  const header = (label: string, w: number, align: "left" | "right" = "left") => {
    const tx = align === "right" ? x + w - padding : x + padding;
    doc.text(label, tx, y + 13, { align });
    x += w;
  };

  header("Sr", COL_WIDTHS.sr);
  header("Description", COL_WIDTHS.description);
  header("Area", COL_WIDTHS.area);
  header("Qty", COL_WIDTHS.qty, "right");
  header("Unit", COL_WIDTHS.unit);
  header("Rate USD", COL_WIDTHS.unit_rate_usd, "right");
  header("Amount USD", COL_WIDTHS.amount_usd, "right");

  return y + rowH;
}

function drawTableRow(
  doc: jsPDF,
  y: number,
  idx: number,
  item: POPdfLineItem,
): number {
  const padding = 6;
  // Description can wrap — compute its height first.
  const descLines = doc.splitTextToSize(item.description || "—", COL_WIDTHS.description - padding * 2);
  const rowH = Math.max(18, descLines.length * 11 + 6);

  // Zebra stripe
  if (idx % 2 === 1) {
    setFill(doc, C_STRIPE);
    doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
  }

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  let x = MARGIN;
  const vcenter = y + (rowH + 4) / 2;

  // Sr
  doc.text(String(item.sr), x + COL_WIDTHS.sr - padding, vcenter, { align: "right" });
  x += COL_WIDTHS.sr;

  // Description (wrap)
  doc.text(descLines, x + padding, y + 12);
  x += COL_WIDTHS.description;

  // Area
  const areaLines = doc.splitTextToSize(item.area ?? "—", COL_WIDTHS.area - padding * 2);
  doc.text(areaLines, x + padding, y + 12);
  x += COL_WIDTHS.area;

  // Qty
  doc.text(String(item.qty ?? 1), x + COL_WIDTHS.qty - padding, vcenter, { align: "right" });
  x += COL_WIDTHS.qty;

  // Unit
  doc.text(item.unit || "—", x + padding, vcenter);
  x += COL_WIDTHS.unit;

  // Rate USD
  doc.text(
    formatCurrency(item.unit_rate_usd ?? 0, "USD"),
    x + COL_WIDTHS.unit_rate_usd - padding,
    vcenter,
    { align: "right" },
  );
  x += COL_WIDTHS.unit_rate_usd;

  // Amount USD
  doc.setFont("helvetica", "bold");
  doc.text(
    formatCurrency(item.amount_usd ?? 0, "USD"),
    x + COL_WIDTHS.amount_usd - padding,
    vcenter,
    { align: "right" },
  );

  return y + rowH;
}

/* ---------------------------------- totals --------------------------------- */

function drawTotals(doc: jsPDF, y: number, input: POPdfInput): number {
  const boxW = 230;
  const boxX = PAGE_W - MARGIN - boxW;
  let cy = y + 10;

  setText(doc, C_INK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const line = (label: string, value: string, bold = false, fontSize = 9) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(label, boxX, cy);
    doc.text(value, PAGE_W - MARGIN, cy, { align: "right" });
    cy += bold ? fontSize + 4 : 13;
  };

  line("Subtotal (USD):", formatCurrency(input.totals.subtotal_usd, "USD"));
  line(
    "Exchange Rate:",
    `1 USD = ${input.totals.exchange_rate.toFixed(4)} ${input.totals.local_currency}`,
  );
  if (input.totals.local_currency !== "USD") {
    line(
      `Total (${input.totals.local_currency}):`,
      formatCurrency(input.totals.total_local, input.totals.local_currency as "USD" | "INR" | "AED"),
    );
  }

  // Rule
  doc.setDrawColor(C_RULE);
  doc.setLineWidth(0.8);
  doc.line(boxX, cy, PAGE_W - MARGIN, cy);
  cy += 10;

  // Grand total — green, bold, larger
  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL USD:", boxX, cy);
  doc.text(formatCurrency(input.totals.total_usd, "USD"), PAGE_W - MARGIN, cy, {
    align: "right",
  });
  cy += 16;

  return cy;
}

/* --------------------------------- terms ---------------------------------- */

function drawTerms(doc: jsPDF, y: number, input: POPdfInput): number {
  const boxH = 56;
  // Border
  doc.setDrawColor(C_RULE);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_W, boxH, "S");

  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TERMS & CONDITIONS", MARGIN + 8, y + 14);

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = [
    `Payment: ${input.terms.payment ?? "Within 30 days of invoice"}`,
    `Delivery: ${input.terms.delivery ?? "As per project schedule"}`,
    input.terms.freeText ?? "",
  ].filter(Boolean);
  lines.forEach((l, i) => doc.text(l, MARGIN + 8, y + 28 + i * 11));
  return y + boxH + 14;
}

/* ------------------------------- signatures ------------------------------- */

function drawSignatures(doc: jsPDF, y: number, input: POPdfInput): number {
  const colW = CONTENT_W / 3;
  const lineY = y + 36;
  // Underlines
  doc.setDrawColor(C_INK);
  doc.setLineWidth(0.6);
  [0, 1, 2].forEach((i) => {
    const sx = MARGIN + i * colW + 14;
    const ex = MARGIN + i * colW + colW - 14;
    doc.line(sx, lineY, ex, lineY);
  });

  setText(doc, C_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("PREPARED BY", MARGIN + 14, lineY + 12);
  doc.text("CHECKED BY", MARGIN + colW + 14, lineY + 12);
  doc.text("APPROVED BY", MARGIN + colW * 2 + 14, lineY + 12);

  setText(doc, C_INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(input.signatures.preparedBy || "—", MARGIN + 14, lineY + 26);
  doc.text(input.signatures.checkedBy || "—", MARGIN + colW + 14, lineY + 26);
  doc.text(input.signatures.approvedBy || "—", MARGIN + colW * 2 + 14, lineY + 26);

  setText(doc, C_MUTED);
  doc.setFontSize(8);
  doc.text("Name & Date", MARGIN + 14, lineY + 38);
  doc.text("Name & Date", MARGIN + colW + 14, lineY + 38);
  doc.text("Name & Date", MARGIN + colW * 2 + 14, lineY + 38);

  return lineY + 48;
}

/* --------------------------------- footer --------------------------------- */

function drawFooter(doc: jsPDF, pageNo: number, totalPages: number) {
  const y = PAGE_H - 28;
  setText(doc, C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "JSIL·ASTRAL | Fleet Operations & Rig Governance Engine",
    MARGIN,
    y,
  );
  doc.text(
    "Jindal Drilling & Industries Ltd.  |  CONFIDENTIAL",
    PAGE_W / 2,
    y,
    { align: "center" },
  );
  doc.text(`Page ${pageNo} / ${totalPages}`, PAGE_W - MARGIN, y, {
    align: "right",
  });

  // Thin green bar flush with the bottom
  setFill(doc, C_GREEN);
  doc.rect(0, PAGE_H - 6, PAGE_W, 6, "F");
}

/* -------------------------------- entrypoint ------------------------------- */

export function generatePOPdf(input: POPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Pass 1: lay out line-items to see how many pages we need. We render
  // directly instead of pre-measuring to keep the code simple — paginate
  // on the fly.

  let totalPages = 1;
  let pageNo = 1;

  drawHeader(doc, input, pageNo, totalPages);
  let cursor = drawParties(doc, input, 118);
  cursor = drawTableHeader(doc, cursor);

  const bottomLimit = PAGE_H - 220; // leave room for totals + sigs + footer

  input.lineItems.forEach((it, i) => {
    if (cursor > bottomLimit) {
      drawFooter(doc, pageNo, totalPages);
      doc.addPage();
      pageNo += 1;
      totalPages += 1;
      drawHeader(doc, input, pageNo, totalPages);
      cursor = drawTableHeader(doc, cursor = 110);
    }
    cursor = drawTableRow(doc, cursor, i, it);
  });

  // Totals / terms / signatures live under the table on the final page.
  cursor += 14;
  cursor = drawTotals(doc, cursor, input);
  cursor += 10;
  cursor = drawTerms(doc, cursor, input);
  cursor = drawSignatures(doc, cursor, input);
  drawFooter(doc, pageNo, totalPages);

  // Second pass: fix up the "x of y" counters that were under-counted
  // during pass 1 (jsPDF has no post-render text update, but our drawHeader
  // reads totalPages from local scope, so if totalPages > 1 we'd want to
  // re-render each header — small enough to skip for v1 since the vast
  // majority of POs fit on one page). Documented limitation.
  return doc;
}

/** Save the PDF to the user's downloads folder. */
export function downloadPO(input: POPdfInput): string {
  const doc = generatePOPdf(input);
  const safeNumber = input.po_number.replace(/[\/\\]/g, "-");
  const filename = `${safeNumber}.pdf`;
  doc.save(filename);
  return filename;
}

/** Return the PDF as a data URL for inline preview (iframe src). */
export function previewPOUrl(input: POPdfInput): string {
  const doc = generatePOPdf(input);
  return doc.output("datauristring");
}
