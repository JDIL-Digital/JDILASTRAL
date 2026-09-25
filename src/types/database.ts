export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: "engineer" | "manager" | "csuite";
          rig_access: string[] | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          role?: "engineer" | "manager" | "csuite";
          rig_access?: string[] | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      rigs: {
        Row: {
          id: string;
          name: string;
          type: string;
          location: string;
          operator: string;
          status: string;
          daily_rate_usd: number;
          contract_start: string;
          contract_end: string;
          total_budget_usd: number;
          spent_usd: number;
          committed_usd: number;
          utilization_pct: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rigs"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rigs"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          rig_id: string;
          name: string;
          client: string;
          phase: string;
          status: string;
          start_date: string;
          end_date: string;
          budget_usd: number;
          spent_usd: number;
          committed_usd: number;
          progress_pct: number;
          manager_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["projects"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      annexures: {
        Row: {
          id: string;
          project_id: string;
          code: string;
          name: string;
          description: string | null;
          budget_usd: number;
          spent_usd: number;
          committed_usd: number;
          variance_pct: number;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["annexures"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["annexures"]["Insert"]>;
      };
      line_items: {
        Row: {
          id: string;
          annexure_id: string;
          sku: string | null;
          description: string;
          category: string;
          vendor: string | null;
          uom: string;
          quantity: number;
          unit_price: number;
          currency: string;
          total_local: number;
          total_usd: number;
          budgeted_usd: number;
          status: string;
          po_id: string | null;
          required_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["line_items"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["line_items"]["Insert"]>;
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          rig_id: string;
          project_id: string;
          annexure_id: string;
          vendor_name: string;
          vendor_address: string | null;
          vendor_contact: string | null;
          vendor_email: string | null;
          vendor_gstin: string | null;
          currency: string;
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
          status: string;
          raised_by: string;
          approved_by: string | null;
          approved_at: string | null;
          issued_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["purchase_orders"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
      };
      exchange_rates: {
        Row: {
          id: string;
          base: string;
          quote: string;
          rate: number;
          effective_at: string;
          source: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["exchange_rates"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exchange_rates"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
