/* eslint-disable no-console */
/**
 * One-off inspector for scripts/jindal-pioneer-data.xlsx — prints the
 * first 25 rows of every sheet with their column letters so we can see
 * exactly how the headers are structured and update the migration
 * patterns accordingly.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/inspect-xlsx.ts
 */

import * as path from "node:path";
import * as XLSX from "xlsx";

const XLSX_PATH = path.join(__dirname, "jindal-pioneer-data.xlsx");

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

function trim(v: unknown, max = 60): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const wb = XLSX.readFile(XLSX_PATH);
console.log(`Workbook has ${wb.SheetNames.length} sheets:\n`);
wb.SheetNames.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
console.log("");

for (const sheetName of wb.SheetNames) {
  console.log("=".repeat(80));
  console.log(`SHEET: "${sheetName}"`);
  console.log("=".repeat(80));

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  });

  console.log(`  rows: ${rows.length}`);

  // Figure out the max column count across the first 25 rows
  const limit = Math.min(25, rows.length);
  let maxCol = 0;
  for (let r = 0; r < limit; r += 1) {
    maxCol = Math.max(maxCol, (rows[r] ?? []).length);
  }

  // Print column letter header
  if (maxCol > 0) {
    const letters = Array.from({ length: Math.min(maxCol, 20) }, (_, i) => colLetter(i).padEnd(14));
    console.log(`\n       ${letters.join("│ ")}`);
    console.log(`  ────────${"─".repeat(Math.min(maxCol, 20) * 16)}`);
  }

  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? [];
    const cells = Array.from({ length: Math.min(maxCol, 20) }, (_, i) => trim(row[i], 13).padEnd(14));
    const marker = cells.some((c) => c.trim()) ? " " : "·";
    console.log(`  r${String(r + 1).padStart(2, "0")}${marker}  ${cells.join("│ ")}`);
  }

  console.log("");
}
