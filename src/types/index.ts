import type {
  AnnexureName,
  Currency,
  POStatus,
  ProjectPhase,
  RigName,
  Role,
} from "@/lib/constants";

export type ID = string;

export interface User {
  id: ID;
  email: string;
  full_name: string;
  role: Role;
  rig_access: RigName[] | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = Role;

export interface Rig {
  id: ID;
  name: RigName;
  type: "Jackup" | "Semi-Submersible" | "Drillship";
  location: string;
  operator: string;
  status: "operational" | "maintenance" | "stacked" | "transit";
  daily_rate_usd: number;
  contract_start: string;
  contract_end: string;
  total_budget_usd: number;
  spent_usd: number;
  committed_usd: number;
  utilization_pct: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: ID;
  rig_id: ID;
  name: string;
  client: string;
  phase: ProjectPhase;
  status: "active" | "completed" | "on_hold" | "cancelled";
  start_date: string;
  end_date: string;
  budget_usd: number;
  spent_usd: number;
  committed_usd: number;
  progress_pct: number;
  manager_id: ID;
  created_at: string;
  updated_at: string;
}

export interface Annexure {
  id: ID;
  project_id: ID;
  code: string;
  name: AnnexureName;
  description: string | null;
  budget_usd: number;
  spent_usd: number;
  committed_usd: number;
  variance_pct: number;
  owner_id: ID | null;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: ID;
  annexure_id: ID;
  sku: string | null;
  description: string;
  category: string;
  vendor: string | null;
  uom: string;
  quantity: number;
  unit_price: number;
  currency: Currency;
  total_local: number;
  total_usd: number;
  budgeted_usd: number;
  status: "planned" | "requested" | "ordered" | "received" | "invoiced" | "paid";
  po_id: ID | null;
  required_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: ID;
  po_number: string;
  rig_id: ID;
  project_id: ID;
  annexure_id: ID;
  vendor_name: string;
  vendor_address: string | null;
  vendor_contact: string | null;
  vendor_email: string | null;
  vendor_gstin: string | null;
  currency: Currency;
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  freight: number;
  total: number;
  total_usd: number;
  payment_terms: string;
  delivery_terms: string;
  delivery_location: string;
  required_by: string;
  status: POStatus;
  raised_by: ID;
  approved_by: ID | null;
  approved_at: string | null;
  issued_at: string | null;
  notes: string | null;
  line_items: PurchaseOrderLine[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: ID;
  po_id: ID;
  line_item_id: ID | null;
  sku: string | null;
  description: string;
  uom: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ExchangeRate {
  id: ID;
  base: Currency;
  quote: Currency;
  rate: number;
  effective_at: string;
  source: string;
  created_at: string;
}

export interface KPI {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  trend?: "up" | "down" | "neutral";
  intent?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  hint?: string;
}

export interface ChartPoint {
  name: string;
  value: number;
  [key: string]: number | string;
}
