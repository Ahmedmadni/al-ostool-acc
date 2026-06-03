export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aging_buckets: {
        Row: {
          current_amt: number | null
          customer_code: string
          customer_name: string
          days_120: number | null
          days_150: number | null
          days_180: number | null
          days_270: number | null
          days_30: number | null
          days_360: number | null
          days_60: number | null
          days_90: number | null
          days_over_360: number | null
          id: string
          imported_at: string
          imported_by: string | null
          period: string
          total_outstanding: number | null
        }
        Insert: {
          current_amt?: number | null
          customer_code: string
          customer_name: string
          days_120?: number | null
          days_150?: number | null
          days_180?: number | null
          days_270?: number | null
          days_30?: number | null
          days_360?: number | null
          days_60?: number | null
          days_90?: number | null
          days_over_360?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          period: string
          total_outstanding?: number | null
        }
        Update: {
          current_amt?: number | null
          customer_code?: string
          customer_name?: string
          days_120?: number | null
          days_150?: number | null
          days_180?: number | null
          days_270?: number | null
          days_30?: number | null
          days_360?: number | null
          days_60?: number | null
          days_90?: number | null
          days_over_360?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          period?: string
          total_outstanding?: number | null
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          account_number: string | null
          balance: number | null
          bank_name: string
          credit: number | null
          debit: number | null
          description: string | null
          id: string
          imported_at: string
          imported_by: string | null
          txn_date: string
        }
        Insert: {
          account_number?: string | null
          balance?: number | null
          bank_name: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          txn_date: string
        }
        Update: {
          account_number?: string | null
          balance?: number | null
          bank_name?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          txn_date?: string
        }
        Relationships: []
      }
      cost_entries: {
        Row: {
          amount: number | null
          category: string
          company: string | null
          department: string | null
          description: string | null
          id: string
          imported_at: string
          imported_by: string | null
          meta: Json | null
          period: string | null
          project: string | null
          section: string | null
        }
        Insert: {
          amount?: number | null
          category: string
          company?: string | null
          department?: string | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          meta?: Json | null
          period?: string | null
          project?: string | null
          section?: string | null
        }
        Update: {
          amount?: number | null
          category?: string
          company?: string | null
          department?: string | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          meta?: Json | null
          period?: string | null
          project?: string | null
          section?: string | null
        }
        Relationships: []
      }
      customer_balances: {
        Row: {
          account_code: string
          account_name: string
          closing_credit: number | null
          closing_debit: number | null
          id: string
          imported_at: string
          imported_by: string | null
          opening_credit: number | null
          opening_debit: number | null
          period: string
          period_credit: number | null
          period_debit: number | null
        }
        Insert: {
          account_code: string
          account_name: string
          closing_credit?: number | null
          closing_debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          opening_credit?: number | null
          opening_debit?: number | null
          period: string
          period_credit?: number | null
          period_debit?: number | null
        }
        Update: {
          account_code?: string
          account_name?: string
          closing_credit?: number | null
          closing_debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          opening_credit?: number | null
          opening_debit?: number | null
          period?: string
          period_credit?: number | null
          period_debit?: number | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          job_title: string | null
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          job_title?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          job_title?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_manager: string | null
          activity: string | null
          address: string | null
          age_category: Database["public"]["Enums"]["customer_age"] | null
          city: string | null
          code: string
          commercial_register: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          current_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          mobile: string | null
          name: string
          name_en: string | null
          payment_period: number | null
          phone: string | null
          risk_level: Database["public"]["Enums"]["customer_risk"] | null
          sector: Database["public"]["Enums"]["customer_sector"] | null
          size_category: Database["public"]["Enums"]["customer_size"] | null
          tax_number: string | null
          total_collected: number | null
          total_invoiced: number | null
          total_outstanding: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager?: string | null
          activity?: string | null
          address?: string | null
          age_category?: Database["public"]["Enums"]["customer_age"] | null
          city?: string | null
          code: string
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name: string
          name_en?: string | null
          payment_period?: number | null
          phone?: string | null
          risk_level?: Database["public"]["Enums"]["customer_risk"] | null
          sector?: Database["public"]["Enums"]["customer_sector"] | null
          size_category?: Database["public"]["Enums"]["customer_size"] | null
          tax_number?: string | null
          total_collected?: number | null
          total_invoiced?: number | null
          total_outstanding?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager?: string | null
          activity?: string | null
          address?: string | null
          age_category?: Database["public"]["Enums"]["customer_age"] | null
          city?: string | null
          code?: string
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name?: string
          name_en?: string | null
          payment_period?: number | null
          phone?: string | null
          risk_level?: Database["public"]["Enums"]["customer_risk"] | null
          sector?: Database["public"]["Enums"]["customer_sector"] | null
          size_category?: Database["public"]["Enums"]["customer_size"] | null
          tax_number?: string | null
          total_collected?: number | null
          total_invoiced?: number | null
          total_outstanding?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      data_imports: {
        Row: {
          file_name: string | null
          id: string
          import_type: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          period: string | null
          replaced_at: string | null
          row_count: number | null
          status: string | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          import_type: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          period?: string | null
          replaced_at?: string | null
          row_count?: number | null
          status?: string | null
        }
        Update: {
          file_name?: string | null
          id?: string
          import_type?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          period?: string | null
          replaced_at?: string | null
          row_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      equipment_costs: {
        Row: {
          department: string | null
          depreciation: number | null
          equipment_code: string | null
          equipment_name: string | null
          equipment_type: string | null
          fuel: number | null
          id: string
          imported_at: string
          imported_by: string | null
          insurance: number | null
          maintenance: number | null
          meta: Json | null
          operating_cost: number | null
          period: string | null
          project: string | null
          purchase_cost: number | null
          total_cost: number | null
        }
        Insert: {
          department?: string | null
          depreciation?: number | null
          equipment_code?: string | null
          equipment_name?: string | null
          equipment_type?: string | null
          fuel?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          insurance?: number | null
          maintenance?: number | null
          meta?: Json | null
          operating_cost?: number | null
          period?: string | null
          project?: string | null
          purchase_cost?: number | null
          total_cost?: number | null
        }
        Update: {
          department?: string | null
          depreciation?: number | null
          equipment_code?: string | null
          equipment_name?: string | null
          equipment_type?: string | null
          fuel?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          insurance?: number | null
          maintenance?: number | null
          meta?: Json | null
          operating_cost?: number | null
          period?: string | null
          project?: string | null
          purchase_cost?: number | null
          total_cost?: number | null
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number | null
          annual_depreciation: number | null
          asset_code: string | null
          asset_name: string
          category: string | null
          cost: number | null
          department: string | null
          id: string
          imported_at: string
          imported_by: string | null
          net_book_value: number | null
          project: string | null
          purchase_date: string | null
          status: string | null
          useful_life_years: number | null
        }
        Insert: {
          accumulated_depreciation?: number | null
          annual_depreciation?: number | null
          asset_code?: string | null
          asset_name: string
          category?: string | null
          cost?: number | null
          department?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          net_book_value?: number | null
          project?: string | null
          purchase_date?: string | null
          status?: string | null
          useful_life_years?: number | null
        }
        Update: {
          accumulated_depreciation?: number | null
          annual_depreciation?: number | null
          asset_code?: string | null
          asset_name?: string
          category?: string | null
          cost?: number | null
          department?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          net_book_value?: number | null
          project?: string | null
          purchase_date?: string | null
          status?: string | null
          useful_life_years?: number | null
        }
        Relationships: []
      }
      hr_costs: {
        Row: {
          department: string | null
          employee_code: string | null
          employee_name: string | null
          eos: number | null
          food: number | null
          gosi: number | null
          housing: number | null
          id: string
          imported_at: string
          imported_by: string | null
          job_title: string | null
          medical: number | null
          meta: Json | null
          nationality: string | null
          period: string | null
          project: string | null
          salary: number | null
          tickets: number | null
          total_cost: number | null
        }
        Insert: {
          department?: string | null
          employee_code?: string | null
          employee_name?: string | null
          eos?: number | null
          food?: number | null
          gosi?: number | null
          housing?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          job_title?: string | null
          medical?: number | null
          meta?: Json | null
          nationality?: string | null
          period?: string | null
          project?: string | null
          salary?: number | null
          tickets?: number | null
          total_cost?: number | null
        }
        Update: {
          department?: string | null
          employee_code?: string | null
          employee_name?: string | null
          eos?: number | null
          food?: number | null
          gosi?: number | null
          housing?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          job_title?: string | null
          medical?: number | null
          meta?: Json | null
          nationality?: string | null
          period?: string | null
          project?: string | null
          salary?: number | null
          tickets?: number | null
          total_cost?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number | null
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          notes: string | null
          paid_amount: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          total_amount: number | null
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          method: string | null
          notes: string | null
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_milestones: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          progress: number | null
          project_id: string
          start_date: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          progress?: number | null
          project_id: string
          start_date?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          progress?: number | null
          project_id?: string
          start_date?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number | null
          billed_amount: number | null
          budget: number | null
          code: string
          contract_number: string | null
          contract_value: number | null
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          financial_progress: number | null
          id: string
          manager: string | null
          name: string
          progress_actual: number | null
          progress_planned: number | null
          retention_amount: number | null
          retention_pct: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          unbilled_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          billed_amount?: number | null
          budget?: number | null
          code: string
          contract_number?: string | null
          contract_value?: number | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          financial_progress?: number | null
          id?: string
          manager?: string | null
          name: string
          progress_actual?: number | null
          progress_planned?: number | null
          retention_amount?: number | null
          retention_pct?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          unbilled_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          billed_amount?: number | null
          budget?: number | null
          code?: string
          contract_number?: string | null
          contract_value?: number | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          financial_progress?: number | null
          id?: string
          manager?: string | null
          name?: string
          progress_actual?: number | null
          progress_planned?: number | null
          retention_amount?: number | null
          retention_pct?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          unbilled_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json | null
          id: string
          name: string
          report_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          name: string
          report_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          name?: string
          report_type?: string
        }
        Relationships: []
      }
      supplier_balances: {
        Row: {
          account_code: string
          account_name: string
          closing_credit: number | null
          closing_debit: number | null
          id: string
          imported_at: string
          imported_by: string | null
          opening_credit: number | null
          opening_debit: number | null
          period: string
          period_credit: number | null
          period_debit: number | null
        }
        Insert: {
          account_code: string
          account_name: string
          closing_credit?: number | null
          closing_debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          opening_credit?: number | null
          opening_debit?: number | null
          period: string
          period_credit?: number | null
          period_debit?: number | null
        }
        Update: {
          account_code?: string
          account_name?: string
          closing_credit?: number | null
          closing_debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          opening_credit?: number | null
          opening_debit?: number | null
          period?: string
          period_credit?: number | null
          period_debit?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          type: Database["public"]["Enums"]["task_type"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          type?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_balance_entries: {
        Row: {
          account_code: string
          account_name: string
          account_type: string | null
          balance: number | null
          credit: number | null
          debit: number | null
          id: string
          imported_at: string
          imported_by: string | null
          period: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type?: string | null
          balance?: number | null
          credit?: number | null
          debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          period: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string | null
          balance?: number | null
          credit?: number | null
          debit?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          period?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          code: string
          commercial_register: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          current_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          mobile: string | null
          name: string
          name_en: string | null
          payment_period: number | null
          phone: string | null
          region: string | null
          tax_number: string | null
          total_outstanding: number | null
          total_paid: number | null
          total_purchased: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          code: string
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name: string
          name_en?: string | null
          payment_period?: number | null
          phone?: string | null
          region?: string | null
          tax_number?: string | null
          total_outstanding?: number | null
          total_paid?: number | null
          total_purchased?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          code?: string
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name?: string
          name_en?: string | null
          payment_period?: number | null
          phone?: string | null
          region?: string | null
          tax_number?: string | null
          total_outstanding?: number | null
          total_paid?: number | null
          total_purchased?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "finance_manager" | "project_manager" | "accountant"
      customer_age: "lt_1" | "1_to_3" | "3_to_5" | "5_to_10" | "gt_10"
      customer_risk: "low" | "medium" | "high"
      customer_sector:
        | "infrastructure"
        | "crusher"
        | "equipment_rental"
        | "general_contracting"
        | "other_services"
        | "asset_sales"
      customer_size: "small" | "medium" | "large" | "strategic"
      invoice_status:
        | "draft"
        | "issued"
        | "due"
        | "overdue"
        | "paid"
        | "unbilled"
      project_status:
        | "new"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "delayed"
      task_status: "pending" | "in_progress" | "done" | "cancelled"
      task_type: "meeting" | "visit" | "call" | "collection_reminder" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "finance_manager", "project_manager", "accountant"],
      customer_age: ["lt_1", "1_to_3", "3_to_5", "5_to_10", "gt_10"],
      customer_risk: ["low", "medium", "high"],
      customer_sector: [
        "infrastructure",
        "crusher",
        "equipment_rental",
        "general_contracting",
        "other_services",
        "asset_sales",
      ],
      customer_size: ["small", "medium", "large", "strategic"],
      invoice_status: ["draft", "issued", "due", "overdue", "paid", "unbilled"],
      project_status: ["new", "in_progress", "on_hold", "completed", "delayed"],
      task_status: ["pending", "in_progress", "done", "cancelled"],
      task_type: ["meeting", "visit", "call", "collection_reminder", "other"],
    },
  },
} as const
