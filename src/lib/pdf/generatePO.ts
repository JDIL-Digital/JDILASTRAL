import jsPDF from "jspdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import { APP, BRAND } from "@/lib/constants";
import type { PurchaseOrder } from "@/types";

interface GeneratePOInput {
  po: PurchaseOrder;
  rigName: string;
  projectName: string;
  annexureName: string;
  raisedByName: string;
  approvedByName?: string;
}

export function generatePOPdf({
  po,
  rigName,
  projectName,
  annexureName,
  raisedByName,
  approvedByName,
}: GeneratePOInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let cursor = margin;

  doc.setFillColor(BRAND.primary);
  doc.rect(0, 0, pageWidth, 8, "F");

  cursor += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor("#0D1B2A");
  doc.text(APP.company, margin, cursor);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#444");
  cursor += 14;
  doc.text(APP.name + " · " + APP.tagline, margin, cursor);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(BRAND.primary);
  doc.text("PURCHASE ORDER", pageWidth - margin, margin + 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#222");
  doc.text(`PO #: ${po.po_number}`, pageWidth - margin, margin + 36, { align: "right" });
  doc.text(`Date: ${formatDate(po.created_at)}`, pageWidth - margin, margin + 50, { align: "right" });
  doc.text(`Status: ${po.status.toUpperCase()}`, pageWidth - margin, margin + 64, { align: "right" });

  cursor += 28;
  doc.setDrawColor(200);
  doc.line(margin, cursor, pageWidth - margin, cursor);
  cursor += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#0D1B2A");
  doc.text("VENDOR", margin, cursor);
  doc.text("DELIVERY", pageWidth / 2, cursor);

  cursor += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#222");
  const vendorLines = [
    po.vendor_name,
    po.vendor_address ?? "",
    po.vendor_contact ?? "",
    po.vendor_email ?? "",
    po.vendor_gstin ? `GSTIN: ${po.vendor_gstin}` : "",
  ].filter(Boolean);
  vendorLines.forEach((line, i) => doc.text(line, margin, cursor + i * 12));

  const deliveryLines = [
    rigName,
    po.delivery_location,
    `Required By: ${formatDate(po.required_by)}`,
    `Project: ${projectName}`,
    `Annexure: ${annexureName}`,
  ];
  deliveryLines.forEach((line, i) => doc.text(line, pageWidth / 2, cursor + i * 12));

  cursor += Math.max(vendorLines.length, deliveryLines.length) * 12 + 16;
  doc.setDrawColor(200);
  doc.line(margin, cursor, pageWidth - margin, cursor);
  cursor += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#fff");
  doc.setFillColor(BRAND.primary);
  doc.rect(margin, cursor, pageWidth - 2 * margin, 18, "F");
  doc.text("S.NO", margin + 8, cursor + 12);
  doc.text("DESCRIPTION", margin + 50, cursor + 12);
  doc.text("UOM", margin + 290, cursor + 12);
  doc.text("QTY", margin + 340, cursor + 12);
  doc.text("UNIT PRICE", margin + 390, cursor + 12);
  doc.text("TOTAL", pageWidth - margin - 8, cursor + 12, { align: "right" });
  cursor += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#222");
  po.line_items.forEach((line, idx) => {
    if (cursor > 720) {
      doc.addPage();
      cursor = margin;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, cursor - 10, pageWidth - 2 * margin, 16, "F");
    }
    doc.setTextColor("#222");
    doc.text(String(idx + 1), margin + 8, cursor);
    const desc = doc.splitTextToSize(line.description, 230);
    doc.text(desc, margin + 50, cursor);
    doc.text(String(line.uom), margin + 290, cursor);
    doc.text(String(line.quantity), margin + 340, cursor);
    doc.text(String(formatCurrency(line.unit_price, po.currency)), margin + 390, cursor);
    doc.text(formatCurrency(line.total, po.currency), pageWidth - margin - 8, cursor, {
      align: "right",
    });
    cursor += Math.max(16, desc.length * 11);
  });

  cursor += 14;
  doc.setDrawColor(200);
  doc.line(pageWidth / 2, cursor, pageWidth - margin, cursor);
  cursor += 14;

  const totalsX = pageWidth - margin - 8;
  const labelX = pageWidth / 2 + 8;
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", labelX, cursor);
  doc.text(formatCurrency(po.subtotal, po.currency), totalsX, cursor, { align: "right" });
  cursor += 14;
  doc.text(`Tax (${po.tax_pct.toFixed(2)}%):`, labelX, cursor);
  doc.text(formatCurrency(po.tax_amount, po.currency), totalsX, cursor, { align: "right" });
  cursor += 14;
  doc.text("Freight:", labelX, cursor);
  doc.text(formatCurrency(po.freight, po.currency), totalsX, cursor, { align: "right" });
  cursor += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND.primary);
  doc.text("Grand Total:", labelX, cursor);
  doc.text(formatCurrency(po.total, po.currency), totalsX, cursor, { align: "right" });
  cursor += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#444");
  doc.text(`(USD equivalent: ${formatCurrency(po.total_usd, "USD")})`, totalsX, cursor, {
    align: "right",
  });
  cursor += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#0D1B2A");
  doc.text("TERMS & CONDITIONS", margin, cursor);
  cursor += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#222");
  const terms = [
    `Payment Terms: ${po.payment_terms}`,
    `Delivery Terms: ${po.delivery_terms}`,
    `Required By: ${formatDate(po.required_by)}`,
    po.notes ? `Notes: ${po.notes}` : "",
  ].filter(Boolean);
  terms.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - 2 * margin);
    doc.text(wrapped, margin, cursor + i * 12);
  });
  cursor += terms.length * 14 + 30;

  doc.setDrawColor(180);
  doc.line(margin, cursor, margin + 180, cursor);
  doc.line(pageWidth - margin - 180, cursor, pageWidth - margin, cursor);
  doc.setFontSize(9);
  doc.text(`Raised by: ${raisedByName}`, margin, cursor + 14);
  doc.text(
    `Approved by: ${approvedByName ?? "—"}`,
    pageWidth - margin,
    cursor + 14,
    { align: "right" },
  );

  doc.setFontSize(8);
  doc.setTextColor("#666");
  doc.text(
    `${APP.company} · ${APP.name} v${APP.version} · ${APP.footer}`,
    pageWidth / 2,
    820,
    { align: "center" },
  );

  return doc;
}

export function downloadPO(input: GeneratePOInput) {
  const doc = generatePOPdf(input);
  doc.save(`${input.po.po_number}.pdf`);
}
