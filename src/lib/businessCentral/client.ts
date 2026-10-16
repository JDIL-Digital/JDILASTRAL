/**
 * Microsoft Dynamics 365 Business Central — REST client.
 *
 * Authenticates via OAuth 2.0 client-credentials flow against Azure AD,
 * then issues calls against the BC v2.0 API for the configured company.
 *
 * TODO: Add Azure AD credentials
 *   Set these environment variables in `.env.local` before going live:
 *     BC_CLIENT_ID        — Azure AD app registration (Application/client) ID
 *     BC_CLIENT_SECRET    — Client secret issued for that app registration
 *     BC_TENANT_ID        — Optional override; falls back to BC_CONFIG.tenantId
 *     BC_ENVIRONMENT      — Optional override; defaults to "Production"
 *     BC_COMPANY_ID       — Optional override; defaults to BC_CONFIG.companyId
 *
 *   The app registration needs the API permission
 *     `Dynamics 365 Business Central / app_access`
 *   with admin consent granted, plus the BC user/permission set linked
 *   to the same AAD object id in the target environment.
 */

import { BC_CONFIG } from "@/lib/constants";
import type {
  BCAuthToken,
  BCLineItem,
  BCListResponse,
  BCPurchaseOrder,
  BCSyncStatus,
  BCVendor,
} from "@/types/businessCentral";
import type { PurchaseOrder, PurchaseOrderLine } from "@/types";
import { convert } from "@/lib/currency/exchangeRate";
import type { Currency } from "@/lib/constants";

// --------------------------------------------------------------------------
// Configuration accessors
// --------------------------------------------------------------------------

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name] ?? undefined;
}

export function getBCEnv() {
  return {
    tenantId: readEnv("BC_TENANT_ID") ?? BC_CONFIG.tenantId,
    clientId: readEnv("BC_CLIENT_ID") ?? "", // TODO: Add Azure AD credentials
    clientSecret: readEnv("BC_CLIENT_SECRET") ?? "", // TODO: Add Azure AD credentials
    environment: readEnv("BC_ENVIRONMENT") ?? BC_CONFIG.environment,
    companyId: readEnv("BC_COMPANY_ID") ?? BC_CONFIG.companyId,
    companyName: BC_CONFIG.companyName,
  };
}

/**
 * Returns true when client-credentials env vars are present. The sync UI
 * uses this to render an actionable banner instead of attempting a call
 * that would fail with an opaque 401.
 */
export function isBCConfigured(): boolean {
  const env = getBCEnv();
  return Boolean(env.clientId && env.clientSecret && env.tenantId);
}

// --------------------------------------------------------------------------
// OAuth — client-credentials flow against Azure AD
// --------------------------------------------------------------------------

let cachedToken: BCAuthToken | null = null;

export async function getAccessToken(force = false): Promise<BCAuthToken> {
  if (!force && cachedToken && cachedToken.expires_at - Date.now() > 60_000) {
    return cachedToken;
  }

  const env = getBCEnv();
  if (!env.clientId || !env.clientSecret) {
    // TODO: Add Azure AD credentials — see header.
    throw new Error(
      "Business Central is not configured. Set BC_CLIENT_ID and BC_CLIENT_SECRET in .env.local.",
    );
  }

  const tokenUrl = `${BC_CONFIG.oauthAuthority}/${env.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    scope: BC_CONFIG.scopes.join(" "),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure AD token request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as Omit<BCAuthToken, "expires_at">;
  cachedToken = { ...json, expires_at: Date.now() + json.expires_in * 1000 };
  return cachedToken;
}

// --------------------------------------------------------------------------
// Generic request helper
// --------------------------------------------------------------------------

function companyScopedBase(): string {
  const env = getBCEnv();
  // BC URL shape: {base}/{tenantId}/{environment}/api/v2.0/companies({companyId})
  return `${BC_CONFIG.apiBaseUrl}${env.tenantId}/${env.environment}/api/v2.0/companies(${env.companyId})`;
}

async function bcFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${companyScopedBase()}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BC API ${res.status} on ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function getPurchaseOrders(options?: {
  top?: number;
  filter?: string;
}): Promise<BCPurchaseOrder[]> {
  const params = new URLSearchParams();
  params.set("$expand", "purchaseOrderLines");
  if (options?.top) params.set("$top", String(options.top));
  if (options?.filter) params.set("$filter", options.filter);
  const data = await bcFetch<BCListResponse<BCPurchaseOrder>>(
    `purchaseOrders?${params.toString()}`,
  );
  return data.value;
}

export async function getPurchaseOrderById(poNumberOrId: string): Promise<BCPurchaseOrder> {
  // BC supports filtering by either the system id or the user-facing number.
  // We try id first (UUID-shaped) and fall back to number-based lookup.
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    poNumberOrId,
  );
  if (isGuid) {
    return bcFetch<BCPurchaseOrder>(
      `purchaseOrders(${poNumberOrId})?$expand=purchaseOrderLines`,
    );
  }
  const safe = poNumberOrId.replace(/'/g, "''");
  const data = await bcFetch<BCListResponse<BCPurchaseOrder>>(
    `purchaseOrders?$filter=number eq '${safe}'&$expand=purchaseOrderLines&$top=1`,
  );
  if (!data.value.length) {
    throw new Error(`Purchase Order ${poNumberOrId} not found in Business Central.`);
  }
  return data.value[0];
}

export async function getVendors(options?: { top?: number; filter?: string }): Promise<BCVendor[]> {
  const params = new URLSearchParams();
  if (options?.top) params.set("$top", String(options.top));
  if (options?.filter) params.set("$filter", options.filter);
  const data = await bcFetch<BCListResponse<BCVendor>>(`vendors?${params.toString()}`);
  return data.value;
}

// --------------------------------------------------------------------------
// Transformation — BC → JDIL·ASTRAL
// --------------------------------------------------------------------------

function mapBCStatusToForge(status: string): PurchaseOrder["status"] {
  switch (status) {
    case "Draft":
      return "draft";
    case "In Review":
      return "pending_approval";
    case "Open":
      return "approved";
    case "Released":
      return "issued";
    case "Canceled":
      return "cancelled";
    default:
      return "draft";
  }
}

function mapBCLine(line: BCLineItem, poId: string): PurchaseOrderLine {
  return {
    id: line.id,
    po_id: poId,
    line_item_id: line.itemId ?? null,
    sku: line.itemId ?? null,
    description: line.description,
    uom: line.unitOfMeasureCode ?? "EA",
    quantity: line.quantity,
    unit_price: line.unitCost,
    total: line.amountIncludingTax,
  };
}

/**
 * Transform a BC purchase order into the JDIL·ASTRAL shape used throughout
 * the app. Currency conversion to USD uses the active FX rate table.
 *
 * The caller is expected to supply `rigId`, `projectId`, `annexureId`
 * mappings — BC does not natively carry those concepts. When omitted we
 * leave them as best-effort empty strings; the sync page surfaces those
 * as "Pending mapping" so the operator can resolve them.
 */
export function syncPOToForge(
  po: BCPurchaseOrder,
  context: {
    rigId?: string;
    projectId?: string;
    annexureId?: string;
    raisedById?: string;
  } = {},
): PurchaseOrder {
  const currency = (po.currencyCode || "USD").toUpperCase() as Currency;
  const subtotal = po.totalAmountExcludingTax;
  const taxAmount = po.totalTaxAmount;
  const total = po.totalAmountIncludingTax;
  const taxPct = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;

  return {
    id: po.id,
    po_number: po.number,
    rig_id: context.rigId ?? "",
    project_id: context.projectId ?? "",
    annexure_id: context.annexureId ?? "",
    vendor_name: po.vendorName,
    vendor_address:
      [
        po.buyFromAddressLine1,
        po.buyFromAddressLine2,
        po.buyFromCity,
        po.buyFromState,
        po.buyFromPostCode,
        po.buyFromCountry,
      ]
        .filter(Boolean)
        .join(", ") || null,
    vendor_contact: null,
    vendor_email: null,
    vendor_gstin: null,
    currency,
    subtotal,
    tax_pct: Number(taxPct.toFixed(2)),
    tax_amount: taxAmount,
    freight: 0,
    total,
    total_usd: convert(total, currency, "USD"),
    payment_terms: po.paymentTermsId ?? "Net 30",
    delivery_terms: po.shipmentMethodId ?? "DAP",
    delivery_location:
      [po.shipToName, po.shipToAddressLine1, po.shipToCity, po.shipToCountry]
        .filter(Boolean)
        .join(", ") || "",
    required_by: po.requestedReceiptDate ?? po.orderDate,
    status: mapBCStatusToForge(po.status),
    raised_by: context.raisedById ?? "bc-sync",
    approved_by: null,
    approved_at: null,
    issued_at: po.status === "Released" ? po.lastModifiedDateTime : null,
    notes: `Imported from Business Central · ${BC_CONFIG.companyName}`,
    line_items: (po.purchaseOrderLines ?? []).map((l) => mapBCLine(l, po.id)),
    created_at: po.orderDate,
    updated_at: po.lastModifiedDateTime,
  };
}

// --------------------------------------------------------------------------
// Demo / offline fixtures — used by the sync page until creds are wired up.
// Clearly marked so we never accidentally ship them to production payloads.
// --------------------------------------------------------------------------

/** TODO: Add Azure AD credentials — remove this fixture once live. */
export function getDemoPurchaseOrders(): BCPurchaseOrder[] {
  const today = new Date();
  const iso = (offsetDays: number) =>
    new Date(today.getTime() - offsetDays * 86400000).toISOString();

  const make = (
    i: number,
    overrides: Partial<BCPurchaseOrder> = {},
  ): BCPurchaseOrder => {
    const subtotal = 145_000 + i * 12_300;
    const tax = +(subtotal * 0.18).toFixed(2);
    return {
      id: `bc-po-${1000 + i}`,
      number: `BC-PO-2026-${String(2000 + i).padStart(5, "0")}`,
      orderDate: iso(i + 1),
      vendorId: `bc-vendor-${i % 6}`,
      vendorNumber: `V${10000 + (i % 6)}`,
      vendorName: [
        "Halliburton Worldwide Ltd.",
        "Schlumberger Asia Services",
        "Baker Hughes (Pvt) Ltd.",
        "Tenaris Global Services",
        "Cameron Solutions Inc.",
        "National Oilwell Varco",
      ][i % 6],
      currencyCode: ["USD", "INR", "AED"][i % 3],
      totalAmountExcludingTax: subtotal,
      totalTaxAmount: tax,
      totalAmountIncludingTax: subtotal + tax,
      status: (["Draft", "In Review", "Open", "Released", "Canceled"] as const)[i % 5],
      lastModifiedDateTime: iso(i),
      requestedReceiptDate: iso(-15 - i),
      shipToName: `Jindal Rig ${(i % 6) + 1}`,
      buyFromCity: "Mumbai",
      buyFromCountry: "IN",
      purchaseOrderLines: Array.from({ length: 3 + (i % 3) }).map((_, j) => ({
        id: `bc-line-${i}-${j}`,
        sequence: (j + 1) * 10000,
        description: [
          "12 1/4\" PDC Drill Bit",
          "9 5/8\" Casing — L80",
          "Barite Weighting Agent",
          "Class G Cement",
          "MWD Tool Rental (30 days)",
          "5K Wellhead Christmas Tree",
        ][(i + j) % 6],
        lineType: "Item",
        unitOfMeasureCode: ["EA", "MT", "BBL", "DAY"][j % 4],
        quantity: 1 + ((i + j) % 5),
        unitCost: 4500 + (j + 1) * 720,
        amountExcludingTax: (4500 + (j + 1) * 720) * (1 + ((i + j) % 5)),
        amountIncludingTax: (4500 + (j + 1) * 720) * (1 + ((i + j) % 5)) * 1.18,
        netAmount: (4500 + (j + 1) * 720) * (1 + ((i + j) % 5)),
        netAmountIncludingTax: (4500 + (j + 1) * 720) * (1 + ((i + j) % 5)) * 1.18,
      })),
      ...overrides,
    };
  };
  return Array.from({ length: 12 }).map((_, i) => make(i));
}

/** Lightweight default status mapping used by the sync UI. */
export function deriveSyncStatus(po: BCPurchaseOrder): BCSyncStatus {
  if (po.status === "Canceled") return "error";
  if (po.status === "Draft" || po.status === "In Review") return "pending";
  return "synced";
}
