/* eslint-disable no-console */
/**
 * JSIL·ASTRAL — Jindal Pioneer historical data migration
 *
 * Reads scripts/jindal-pioneer-data.xlsx and bulk-inserts the 11
 * annexures into Supabase.
 *
 * Design notes:
 *   • Headers span TWO rows (title row + unit row like "(in USD)"), so
 *     we concatenate rows N and N+1 cell-by-cell before pattern matching.
 *   • Ann I–V have one actual-cost column; Ann VI–XI have one per
 *     currency (AED / INR / USD). We detect ALL actual-cost columns and
 *     pick the first non-empty one per row, inferring the currency from
 *     either the column header or the cell's own prefix ("AED 18,325").
 *   • Column names drift: "Description" vs "DEPARTMENT / RIG" vs
 *     "Particulars"; "Budgetory Cost" vs "Budget" vs "Alloc." vs
 *     "Sanctioned". Patterns are regex, matched case-insensitively.
 *   • Idempotent: delete-then-insert per annexure. Safe to re-run.
 *   • Never crashes on a single bad row — logs and continues.
 *
 * Run: npm run migrate
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as XLSX from "xlsx";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ────────────────────────────── config ────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env.local");
const XLSX_PATH = path.join(PROJECT_ROOT, "scripts", "jindal-pioneer-data.xlsx");

dotenv.config({ path: ENV_PATH });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BATCH_SIZE = 50;
const HEADER_SCAN_LIMIT = 25;

const DEFAULT_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 0.012,
  AED: 0.272,
};

// ────────────────────────────── types ─────────────────────────────────

type Currency = "USD" | "INR" | "AED";
type LineItemStatus = "pending" | "on-track" | "watch" | "overrun";

interface ParsedLineItem {
  sr_no: number | null;
  material_code: string | null;
  area: string | null;
  description: string;
  work_by: string | null;
  budget_usd: number;
  actual_local_amount: number | null;
  actual_local_currency: Currency;
  actual_local_date: string | null;
  exchange_rate_to_usd: number;
  projected_cost: number | null;
  mr_no: string | null;
  po_no: string | null;
  remarks: string | null;
  status: LineItemStatus;
}

// A single scalar column we detect by regex.
type ScalarCol =
  | "sr_no"
  | "material_code"
  | "area"
  | "description"
  | "work_by"
  | "budget_usd"
  | "exchange_rate_to_usd"
  | "actual_local_date"
  | "projected_cost"
  | "mr_no"
  | "po_no"
  | "remarks";

// "Actual cost" columns are plural — one per currency in Ann VI–XI.
interface ActualColumn {
  index: number;
  /** Currency we think the column is denominated in. May be refined per-row. */
  currencyHint: Currency | null;
}

interface HeaderMap {
  headerRow: number;
  colMap: Partial<Record<ScalarCol, number>>;
  actualCols: ActualColumn[];
}

interface ParseFailure {
  sheet: string;
  row: number;
  reason: string;
}

// ─────────────────────────── header patterns ──────────────────────────

const COLUMN_PATTERNS: Record<ScalarCol, RegExp[]> = {
  sr_no: [/^s\.?\s*no\.?$/i, /^sr\.?\s*no\.?$/i, /^serial\s*(?:no|#)?$/i, /^#$/],
  material_code: [/material\s*code/i, /^item\s*code$/i, /^code$/i],
  area: [/^area$/i, /^location$/i, /^section$/i],
  description: [
    /^description$/i,
    /^particulars?$/i,
    /^item$/i,
    /scope\s*of/i,
    /^nature$/i,
    /^detail/i,
    /^services?$/i,
    // Ann VI–XI label the item column "DEPARTMENT / RIG" or
    // "Equipment Description". Treat both as the description.
    /^department(\s*\/\s*rig)?$/i,
    /work\s*(?:to\s*be\s*)?(?:carried|done)/i,
    /^equipment(\s+description)?$/i,
    /\bequipment\s+description\b/i,
  ],
  work_by: [
    /work\s*(?:done\s*)?by/i,
    /executed\s*by/i,
    /^vendor$/i,
    /^supplier$/i,
    /^agency$/i,
    /^contractor$/i,
  ],
  budget_usd: [
    // Prefer explicit "(in USD)" variants first.
    /budget(?:ed|ory)?\s*cost\s*\(?\s*(?:in\s*)?usd\)?/i,
    /budget.*usd/i,
    /^budget$/i,
    /^budgeted$/i,
    /^budgetory$/i,
    /^budget(?:ed|ory)?\s*cost$/i,
    /^alloc(?:ation|ated)?$/i,
    /^sanctioned$/i,
    /^estimated$/i,
    /^planned$/i,
    /total\s*cost\s*(?:usd)?/i,
    /cost\s*usd/i,
  ],
  exchange_rate_to_usd: [
    /exchange\s*rate/i,
    /^rate$/i,
    /^fx(\s*rate)?$/i,
    /conv(?:ersion)?\s*rate/i,
  ],
  actual_local_date: [/^date$/i, /actual\s*date/i, /invoice\s*date/i],
  projected_cost: [/projected/i, /forecast/i, /estimate(?:d)?/i],
  mr_no: [/mr\.?\s*(?:no|#)/i, /material\s*req/i],
  po_no: [/po\.?\s*(?:no|#)/i, /^po$/i, /purchase\s*order/i],
  remarks: [/^remarks?$/i, /^notes?$/i, /^comments?$/i],
};

const ACTUAL_PATTERN = /\bactual\b.*\b(?:cost|amount|local)\b|^actual$|actual.*cost/i;

// Sheet-name fuzzy matching. First match wins.
const ANNEXURE_SHEETS: Array<{ num: number; patterns: RegExp[] }> = [
  { num: 1, patterns: [/^ann\s*i\b(?!i)/i, /\btowage\b/i] },
  { num: 2, patterns: [/^ann\s*ii\b(?!i)/i, /\bclass\b/i] },
  { num: 3, patterns: [/^ann\s*iii\b/i, /\bport\b/i, /\bkhalid\b/i, /\blamprell\b/i] },
  { num: 4, patterns: [/^ann\s*iv\b/i, /\bcha\b/i, /customs/i, /clearing/i, /forward/i] },
  { num: 5, patterns: [/^ann\s*v\b(?!i)/i, /\bcrew\b/i] },
  { num: 6, patterns: [/^ann\s*vi\b(?!i)/i, /\bdrill/i] },
  { num: 7, patterns: [/^ann\s*vii\b(?!i)/i, /\bmech/i] },
  { num: 8, patterns: [/^ann\s*viii\b/i, /\belec/i] },
  { num: 9, patterns: [/^ann\s*ix\b/i, /\bmarine\b/i, /\bsafety\b/i] },
  { num: 10, patterns: [/^ann\s*x\b(?!i)/i, /contract/i] },
  { num: 11, patterns: [/^ann\s*xi\b/i, /missing/i, /saipem/i] },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

// ─────────────────────────── parse helpers ────────────────────────────

function parseString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  const raw = v.trim();
  if (!raw) return null;
  if (/^(n\.?\/?a|nil|none|-+)$/i.test(raw)) return null;

  const negative = /^\(.+\)$/.test(raw);
  const cleaned = raw
    .replace(/[()]/g, "")
    .replace(/[$₹]/g, "")
    .replace(/\b(?:AED|INR|USD|Dh|Rs\.?)\b/gi, "")
    .replace(/[,'\s]/g, "")
    .replace(/^\./, "0.");

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

/** Infer currency from a cell OR header. Returns null if indeterminate. */
function detectCurrency(v: unknown): Currency | null {
  const s = parseString(v);
  if (!s) return null;
  const u = s.toUpperCase();
  if (/\bINR\b|₹|RS\.?\b/.test(u)) return "INR";
  if (/\bAED\b|DH\b|DIRHAM/i.test(u)) return "AED";
  if (/\bUSD\b|\$/.test(u)) return "USD";
  return null;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const utcMs = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Normalize a header string: collapse whitespace, strip newlines. */
function normalizeHeader(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/**
 * Decide whether a cell from row N+1 looks like a unit annotation
 * (e.g. "(in USD)", "USD", "$") that should be appended to the row-N
 * header, rather than real data from the first data row.
 */
function isUnitLikeCell(s: string): boolean {
  if (!s) return false;
  if (s.length > 20) return false;
  if (/^\(.*\)$/.test(s)) return true;
  if (/^(in\s+)?(usd|inr|aed|\$|₹|dh|rs\.?)$/i.test(s)) return true;
  // Short all-caps currency codes
  if (/^[A-Z]{1,4}$/.test(s)) return true;
  return false;
}

/**
 * Build header labels for row N. If row N+1 contains a unit-like cell
 * (e.g. "(in USD)") directly beneath, concatenate. Otherwise leave
 * row N's cell alone so data rows below aren't accidentally joined in.
 */
function joinedHeaderRow(rows: unknown[][], rowIndex: number): string[] {
  const row = rows[rowIndex] ?? [];
  const next = rows[rowIndex + 1] ?? [];
  const width = Math.max(row.length, next.length);
  const out: string[] = [];
  for (let c = 0; c < width; c += 1) {
    const a = normalizeHeader(row[c]);
    const b = normalizeHeader(next[c]);
    if (a && b && isUnitLikeCell(b)) {
      out.push(`${a} ${b}`);
    } else if (!a && b && isUnitLikeCell(b)) {
      // Row N blank, row N+1 is unit only — still use the unit text.
      out.push(b);
    } else {
      out.push(a);
    }
  }
  return out;
}

/**
 * Find the row most likely to be the header. Signal strength:
 *   - +3 if a column matches description
 *   - +2 if a column matches sr_no OR material_code OR particulars
 *   - +2 if any column matches budget
 *   - +1 if any column matches actual
 *
 * The row with the highest score (≥ 3) wins. If no row scores high
 * enough, we abandon the sheet.
 */
function findHeaderRow(rows: unknown[][]): HeaderMap | null {
  const limit = Math.min(HEADER_SCAN_LIMIT, rows.length);
  let best: HeaderMap | null = null;
  let bestScore = 0;

  for (let r = 0; r < limit; r += 1) {
    const headers = joinedHeaderRow(rows, r);
    const colMap: Partial<Record<ScalarCol, number>> = {};
    const actualCols: ActualColumn[] = [];

    headers.forEach((header, i) => {
      if (!header) return;

      // Scalar columns — first match wins per key.
      for (const key of Object.keys(COLUMN_PATTERNS) as ScalarCol[]) {
        if (colMap[key] !== undefined) continue;
        if (COLUMN_PATTERNS[key].some((p) => p.test(header))) {
          colMap[key] = i;
        }
      }

      // Any-currency actual-cost columns — collect them all.
      if (ACTUAL_PATTERN.test(header)) {
        const currencyHint = detectCurrency(header);
        actualCols.push({ index: i, currencyHint });
      }
    });

    // Score the row.
    let score = 0;
    if (colMap.description !== undefined) score += 3;
    if (colMap.sr_no !== undefined) score += 2;
    if (colMap.material_code !== undefined) score += 2;
    if (colMap.budget_usd !== undefined) score += 2;
    if (actualCols.length > 0) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = { headerRow: r, colMap, actualCols };
    }
  }

  return bestScore >= 3 ? best : null;
}

/**
 * Pick the first non-empty actual-cost column for this row and return
 * the amount + inferred currency.
 */
function pickActual(
  row: unknown[],
  actualCols: ActualColumn[],
): { amount: number; currency: Currency } | null {
  for (const col of actualCols) {
    const raw = row[col.index];
    const amount = parseNumber(raw);
    if (amount === null || amount === 0) continue;
    const currency =
      detectCurrency(raw) ?? col.currencyHint ?? "USD";
    return { amount, currency };
  }
  return null;
}

function deriveStatus(budget: number, actualUsd: number): LineItemStatus {
  if (!actualUsd) return "pending";
  if (budget <= 0) return actualUsd > 0 ? "overrun" : "pending";
  const pct = actualUsd / budget;
  if (pct > 1) return "overrun";
  if (pct >= 0.9) return "watch";
  return "on-track";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ───────────────────────────── row parsing ────────────────────────────

function parseRow(
  rowIndex: number,
  row: unknown[],
  hdr: HeaderMap,
  sheetName: string,
  failures: ParseFailure[],
): ParsedLineItem | null {
  try {
    const descCol = hdr.colMap.description;
    if (descCol === undefined) return null;
    const description = parseString(row[descCol]);
    if (!description) return null;

    // Skip summary rows that would otherwise double-count totals.
    if (/^(grand\s*)?total/i.test(description)) return null;
    if (/^sub[-\s]?total/i.test(description)) return null;

    const budget_usd =
      hdr.colMap.budget_usd !== undefined
        ? parseNumber(row[hdr.colMap.budget_usd]) ?? 0
        : 0;

    const actual = pickActual(row, hdr.actualCols);

    const actual_local_amount = actual?.amount ?? null;
    const actual_local_currency: Currency = actual?.currency ?? "USD";

    const sheetRate =
      hdr.colMap.exchange_rate_to_usd !== undefined
        ? parseNumber(row[hdr.colMap.exchange_rate_to_usd])
        : null;

    const exchange_rate_to_usd =
      sheetRate && sheetRate > 0 ? sheetRate : DEFAULT_RATES[actual_local_currency];

    const actual_usd = (actual_local_amount ?? 0) * exchange_rate_to_usd;

    return {
      sr_no:
        hdr.colMap.sr_no !== undefined
          ? parseNumber(row[hdr.colMap.sr_no]) ?? null
          : null,
      material_code:
        hdr.colMap.material_code !== undefined
          ? parseString(row[hdr.colMap.material_code])
          : null,
      area:
        hdr.colMap.area !== undefined
          ? parseString(row[hdr.colMap.area])
          : null,
      description,
      work_by:
        hdr.colMap.work_by !== undefined
          ? parseString(row[hdr.colMap.work_by])
          : null,
      budget_usd,
      actual_local_amount,
      actual_local_currency,
      actual_local_date:
        hdr.colMap.actual_local_date !== undefined
          ? parseDate(row[hdr.colMap.actual_local_date])
          : null,
      exchange_rate_to_usd,
      projected_cost:
        hdr.colMap.projected_cost !== undefined
          ? parseNumber(row[hdr.colMap.projected_cost])
          : null,
      mr_no:
        hdr.colMap.mr_no !== undefined
          ? parseString(row[hdr.colMap.mr_no])
          : null,
      po_no:
        hdr.colMap.po_no !== undefined
          ? parseString(row[hdr.colMap.po_no])
          : null,
      remarks:
        hdr.colMap.remarks !== undefined
          ? parseString(row[hdr.colMap.remarks])
          : null,
      status: deriveStatus(budget_usd, actual_usd),
    };
  } catch (e) {
    failures.push({
      sheet: sheetName,
      row: rowIndex + 1,
      reason: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ───────────────────────────── Supabase I/O ───────────────────────────

interface Annexure {
  id: string;
  number: number;
  name: string;
}

async function wipeAnnexure(client: SupabaseClient, annexureId: string): Promise<number> {
  const { error, count } = await client
    .from("line_items")
    .delete({ count: "exact" })
    .eq("annexure_id", annexureId);
  if (error) {
    console.warn(`  ⚠ delete failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function insertBatch(
  client: SupabaseClient,
  rows: Array<ParsedLineItem & { annexure_id: string }>,
): Promise<number> {
  const { error, count } = await client
    .from("line_items")
    .insert(rows, { count: "exact" });
  if (error) {
    console.warn(`  ⚠ batch insert failed (${rows.length} rows): ${error.message}`);
    return 0;
  }
  return count ?? rows.length;
}

async function updateAnnexureBudget(
  client: SupabaseClient,
  annexureId: string,
  totalBudgetUsd: number,
): Promise<void> {
  const { error } = await client
    .from("annexures")
    .update({ budget_usd: totalBudgetUsd })
    .eq("id", annexureId);
  if (error) {
    console.warn(`  ⚠ annexure budget update failed: ${error.message}`);
  }
}

// ────────────────────────────── summary ───────────────────────────────

interface SheetSummary {
  num: number;
  name: string;
  sheet: string | null;
  headerRow: number | null;
  deleted: number;
  parsed: number;
  inserted: number;
  budget: number;
  actual: number;
}

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

function printDetectedHeaders(sheetName: string, hdr: HeaderMap): void {
  console.log(
    `   headers detected (row ${hdr.headerRow + 1} in "${sheetName}"):`,
  );
  for (const key of Object.keys(hdr.colMap) as ScalarCol[]) {
    const idx = hdr.colMap[key];
    if (idx !== undefined) {
      console.log(`     • ${key.padEnd(22)} → col ${colLetter(idx)}`);
    }
  }
  if (hdr.actualCols.length > 0) {
    const cols = hdr.actualCols
      .map((c) => `${colLetter(c.index)}${c.currencyHint ? `(${c.currencyHint})` : ""}`)
      .join(", ");
    console.log(`     • ${"actual (any currency)".padEnd(22)} → cols ${cols}`);
  }
}

// ──────────────────────────────── main ────────────────────────────────

async function main(): Promise<void> {
  console.log("\n=== JSIL·ASTRAL · Jindal Pioneer migration ===\n");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }
  if (SERVICE_KEY === "your_service_role_key_here" || !SERVICE_KEY.startsWith("eyJ")) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a placeholder. Replace it with the real service-role key from Supabase Dashboard → Project Settings → API.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`Input file not found: ${XLSX_PATH}`);
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: projRows, error: projErr } = await client
    .from("projects")
    .select("id, name")
    .ilike("name", "%jindal pioneer%")
    .limit(1);
  if (projErr) {
    console.error("Supabase error loading projects:", projErr.message);
    process.exit(1);
  }
  const project = projRows?.[0];
  if (!project) {
    console.error(
      "No project matched '%jindal pioneer%'. Run 001_initial_schema.sql first.",
    );
    process.exit(1);
  }
  console.log(`✓ Project: ${project.name} (${project.id})`);

  const { data: annRows, error: annErr } = await client
    .from("annexures")
    .select("id, number, name")
    .eq("project_id", project.id)
    .order("number");
  if (annErr || !annRows || annRows.length === 0) {
    console.error("No annexures for this project — did the seed run?");
    process.exit(1);
  }
  const annByNum = new Map<number, Annexure>(
    annRows.map((a) => [a.number, { id: a.id, number: a.number, name: a.name }]),
  );
  console.log(`✓ Annexures: ${annRows.length} rows\n`);

  const wb = XLSX.readFile(XLSX_PATH);
  console.log(`✓ Workbook: ${wb.SheetNames.length} sheets\n`);

  const summary: SheetSummary[] = [];
  const failures: ParseFailure[] = [];

  for (const target of ANNEXURE_SHEETS) {
    const annexure = annByNum.get(target.num);
    if (!annexure) continue;

    const sheetName = wb.SheetNames.find((n) =>
      target.patterns.some((p) => p.test(n)),
    );
    console.log(`─ Ann ${roman(target.num)} ${annexure.name}`);
    if (!sheetName) {
      console.log(`   ⚠ no matching sheet found — skipping\n`);
      summary.push({
        num: target.num,
        name: annexure.name,
        sheet: null,
        headerRow: null,
        deleted: 0,
        parsed: 0,
        inserted: 0,
        budget: 0,
        actual: 0,
      });
      continue;
    }

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: null,
    });

    const hdr = findHeaderRow(rows);
    if (!hdr) {
      console.log(`   ⚠ no header row scored high enough in "${sheetName}" — skipping\n`);
      summary.push({
        num: target.num,
        name: annexure.name,
        sheet: sheetName,
        headerRow: null,
        deleted: 0,
        parsed: 0,
        inserted: 0,
        budget: 0,
        actual: 0,
      });
      continue;
    }

    printDetectedHeaders(sheetName, hdr);

    const parsed: ParsedLineItem[] = [];
    for (let r = hdr.headerRow + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const item = parseRow(r, row, hdr, sheetName, failures);
      if (item) parsed.push(item);
    }

    const deleted = await wipeAnnexure(client, annexure.id);

    let inserted = 0;
    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const chunk = parsed.slice(i, i + BATCH_SIZE).map((it) => ({
        ...it,
        annexure_id: annexure.id,
      }));
      inserted += await insertBatch(client, chunk);
    }

    const totalBudget = parsed.reduce((s, i) => s + i.budget_usd, 0);
    const totalActual = parsed.reduce(
      (s, i) => s + (i.actual_local_amount ?? 0) * i.exchange_rate_to_usd,
      0,
    );
    await updateAnnexureBudget(client, annexure.id, totalBudget);

    summary.push({
      num: target.num,
      name: annexure.name,
      sheet: sheetName,
      headerRow: hdr.headerRow + 1,
      deleted,
      parsed: parsed.length,
      inserted,
      budget: totalBudget,
      actual: totalActual,
    });

    console.log(
      `   ✓ deleted ${deleted}, inserted ${inserted}/${parsed.length} ` +
        `(budget $${fmt(totalBudget)}, actual $${fmt(totalActual)})\n`,
    );
  }

  console.log("=== Summary ===\n");
  console.table(
    summary.map((s) => ({
      Ann: roman(s.num),
      Name: s.name,
      Sheet: s.sheet ?? "—",
      Hdr: s.headerRow ?? "—",
      Del: s.deleted,
      Parsed: s.parsed,
      Ins: s.inserted,
      Budget: `$${fmt(s.budget)}`,
      Actual: `$${fmt(s.actual)}`,
    })),
  );

  const totals = summary.reduce(
    (acc, s) => ({
      inserted: acc.inserted + s.inserted,
      budget: acc.budget + s.budget,
      actual: acc.actual + s.actual,
    }),
    { inserted: 0, budget: 0, actual: 0 },
  );

  console.log(`\nTotal rows inserted: ${totals.inserted}`);
  console.log(`Total budget: $${fmt(totals.budget)}`);
  console.log(`Total actual: $${fmt(totals.actual)}`);

  if (failures.length) {
    console.log(`\n=== Failed row parses (${failures.length}) ===`);
    failures.slice(0, 25).forEach((f) =>
      console.log(`  • ${f.sheet} row ${f.row}: ${f.reason}`),
    );
    if (failures.length > 25) {
      console.log(`  … and ${failures.length - 25} more`);
    }
  } else {
    console.log("\n✓ No row parse failures.");
  }

  console.log("\nDone.\n");
}

main().catch((e: unknown) => {
  console.error("\nFatal error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
