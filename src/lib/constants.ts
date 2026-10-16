/**
 * 12 × 8 dark-navy gradient encoded as a base64 SVG — used as Next/Image
 * `blurDataURL` so rig photos fade in from a brand-aligned blur rather
 * than a stark white box.
 */
export const BLUR_DATA_URL =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' preserveAspectRatio='none'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#1A1A2E'/>
          <stop offset='60%' stop-color='#16213E'/>
          <stop offset='100%' stop-color='#0D1B2A'/>
        </linearGradient>
      </defs>
      <rect width='12' height='8' fill='url(#g)'/>
    </svg>`.replace(/\s{2,}/g, " "),
  ).toString("base64");

export const BRAND = {
  primary: "#1A7A3C",
  accent: "#C8102E",
  background: "#0D1B2A",
  surface: "#1C2B3A",
  border: "#2A3F52",
  textPrimary: "#F5F5F5",
  textSecondary: "#8A9BB0",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#C8102E",
} as const;

export const APP = {
  name: "JDIL·ASTRAL",
  tagline: "Fleet Operations & Rig Governance Engine",
  company: "Jindal Drilling & Industries Ltd.",
  footer: "Powered by JDIL Digital",
  version: "1.0.0",
} as const;

export const RIGS = [
  "Discovery 1",
  "Virtue 1",
  "Jindal Star",
  "Jindal Explorer",
  "Jindal Pioneer",
  "Jindal Supreme",
] as const;

export type RigName = (typeof RIGS)[number];

export const ANNEXURES = [
  "Annexure A — Drilling Operations",
  "Annexure B — Mud & Chemicals",
  "Annexure C — Casing & Tubing",
  "Annexure D — Wellhead & Christmas Tree",
  "Annexure E — Cementing Services",
  "Annexure F — Logging & MWD/LWD",
  "Annexure G — Marine & Logistics",
  "Annexure H — Catering & Camp Services",
  "Annexure I — HSE & Safety Equipment",
  "Annexure J — Spares & Consumables",
  "Annexure K — Third-Party Services",
] as const;

export type AnnexureName = (typeof ANNEXURES)[number];

export const CURRENCIES = ["USD", "INR", "AED"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ROLES = ["engineer", "manager", "csuite"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  engineer: "Engineer",
  manager: "Manager",
  csuite: "C-Suite Executive",
};

export const PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "issued",
  "received",
  "closed",
  "cancelled",
] as const;

export type POStatus = (typeof PO_STATUSES)[number];

export const PROJECT_PHASES = [
  "mobilization",
  "drilling",
  "completion",
  "demobilization",
  "maintenance",
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const DEFAULT_FX_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 83.3,
  AED: 3.673,
};

/**
 * Microsoft Dynamics 365 Business Central — environment configuration.
 * Auth uses Azure AD client-credentials (server-to-server). The actual
 * tenantId / clientId / clientSecret must be supplied via env vars at
 * runtime — see `src/lib/businessCentral/client.ts` for the wiring.
 */
export const BC_CONFIG = {
  tenantId: "a8f07817-7a72-49f9-bd08-05babb9a6b75",
  environment: "Production",
  companyName: "Jindal Drilling & Ind. Ltd.",
  companyId: "a8f07817-7a72-49f9-bd08-05babb9a6b75",
  apiVersion: "v2.0",
  apiBaseUrl: "https://api.businesscentral.dynamics.com/v2.0/",
  oauthAuthority: "https://login.microsoftonline.com",
  scopes: ["https://api.businesscentral.dynamics.com/.default"],
} as const;
