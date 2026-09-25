/**
 * Supabase database types — hand-authored to match
 * supabase/migrations/001_initial_schema.sql exactly.
 *
 * Re-run `supabase gen types typescript --local` to auto-refresh from
 * the live schema; the hand-written shape here is a safe fallback that
 * matches the current migration 1:1.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RigStatus = "active" | "maintenance" | "standby";
export type ProjectStatus = "active" | "completed" | "on-hold";
export type LineItemCurrency = "USD" | "INR" | "AED";
export type LineItemStatus = "pending" | "on-track" | "watch" | "overrun";
export type POStatus = "draft" | "approved" | "issued" | "cancelled";
export type ProfileRole = "engineer" | "manager" | "csuite";

export interface Database {
  public: {
    Tables: {
      rigs: {
        Row: {
          id: string;
          name: string;
          type: string | null;
          status: RigStatus;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: string | null;
          status?: RigStatus;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rigs"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          rig_id: string | null;
          name: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          total_budget_usd: number;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rig_id?: string | null;
          name: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          total_budget_usd?: number;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      annexures: {
        Row: {
          id: string;
          project_id: string | null;
          number: number;
          name: string;
          budget_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          number: number;
          name: string;
          budget_usd?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["annexures"]["Insert"]>;
      };
      line_items: {
        Row: {
          id: string;
          annexure_id: string | null;
          sr_no: number | null;
          material_code: string | null;
          area: string | null;
          description: string;
          work_by: string | null;
          budget_usd: number;
          actual_local_amount: number | null;
          actual_local_currency: LineItemCurrency;
          actual_local_date: string | null;
          exchange_rate_to_usd: number;
          /** Generated column — actual_local_amount * exchange_rate_to_usd */
          actual_usd_computed: number | null;
          /** Generated column — budget_usd - actual_usd_computed */
          surplus_usd: number | null;
          projected_cost: number | null;
          mr_no: string | null;
          po_no: string | null;
          remarks: string | null;
          status: LineItemStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          annexure_id?: string | null;
          sr_no?: number | null;
          material_code?: string | null;
          area?: string | null;
          description: string;
          work_by?: string | null;
          budget_usd?: number;
          actual_local_amount?: number | null;
          actual_local_currency?: LineItemCurrency;
          actual_local_date?: string | null;
          exchange_rate_to_usd?: number;
          projected_cost?: number | null;
          mr_no?: string | null;
          po_no?: string | null;
          remarks?: string | null;
          status?: LineItemStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["line_items"]["Insert"]>;
      };
      purchase_orders: {
        Row: {
          id: string;
          project_id: string | null;
          line_item_id: string | null;
          po_number: string;
          vendor_name: string;
          description: string | null;
          amount_usd: number | null;
          local_amount: number | null;
          local_currency: string;
          exchange_rate: number;
          status: POStatus;
          pdf_url: string | null;
          created_by: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          line_item_id?: string | null;
          po_number: string;
          vendor_name: string;
          description?: string | null;
          amount_usd?: number | null;
          local_amount?: number | null;
          local_currency?: string;
          exchange_rate?: number;
          status?: POStatus;
          pdf_url?: string | null;
          created_by?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
      };
      exchange_rates: {
        Row: {
          id: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          rate_date: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          rate_date: string;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exchange_rates"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: ProfileRole;
          assigned_rig_id: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: ProfileRole;
          assigned_rig_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience aliases for hook consumers
export type DbRig = Database["public"]["Tables"]["rigs"]["Row"];
export type DbProject = Database["public"]["Tables"]["projects"]["Row"];
export type DbAnnexure = Database["public"]["Tables"]["annexures"]["Row"];
export type DbLineItem = Database["public"]["Tables"]["line_items"]["Row"];
export type DbPurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type DbExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];
export type DbProfile = Database["public"]["Tables"]["profiles"]["Row"];
