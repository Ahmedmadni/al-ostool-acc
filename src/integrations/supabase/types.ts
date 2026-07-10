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
      adjustments: {
        Row: {
          adjustment_date: string
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          party_type: string
          reason: string | null
          type: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          adjustment_date?: string
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          party_type: string
          reason?: string | null
          type?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          adjustment_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          party_type?: string
          reason?: string | null
          type?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
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
      budget_lines: {
        Row: {
          account_id: string | null
          amount: number
          budget_id: string
          category: string | null
          created_at: string
          id: string
          notes: string | null
          period: string | null
          project_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          budget_id: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period?: string | null
          project_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          budget_id?: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string | null
          fiscal_year: number
          id: string
          name: string
          notes: string | null
          period_type: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fiscal_year: number
          id?: string
          name: string
          notes?: string | null
          period_type?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fiscal_year?: number
          id?: string
          name?: string
          notes?: string | null
          period_type?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          category: Database["public"]["Enums"]["account_category"]
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          is_current: boolean | null
          level: number
          name_ar: string
          name_en: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          category: Database["public"]["Enums"]["account_category"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          level?: number
          name_ar: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          category?: Database["public"]["Enums"]["account_category"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          level?: number
          name_ar?: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          code: string
          commercial_register: string | null
          company_type: Database["public"]["Enums"]["company_type"]
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          fiscal_year_start: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          parent_id: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          commercial_register?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          parent_id?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          commercial_register?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          parent_id?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string | null
          date_format: string | null
          default_currency: string | null
          fiscal_year_start: string | null
          id: string
          language: string | null
          logo_url: string | null
          number_format: string | null
          settings: Json | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          date_format?: string | null
          default_currency?: string | null
          fiscal_year_start?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          number_format?: string | null
          settings?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          date_format?: string | null
          default_currency?: string | null
          fiscal_year_start?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          number_format?: string | null
          settings?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_amendments: {
        Row: {
          amendment_date: string | null
          amendment_number: string
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          new_end_date: string | null
          notes: string | null
          reason: string | null
          value_change: number | null
        }
        Insert: {
          amendment_date?: string | null
          amendment_number: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_end_date?: string | null
          notes?: string | null
          reason?: string | null
          value_change?: number | null
        }
        Update: {
          amendment_date?: string | null
          amendment_number?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_end_date?: string | null
          notes?: string | null
          reason?: string | null
          value_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_number: string
          contract_value: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          party_type: string
          project_id: string | null
          retention_amount: number | null
          retention_pct: number | null
          signed_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          contract_number: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          party_type?: string
          project_id?: string | null
          retention_amount?: number | null
          retention_pct?: number | null
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          contract_number?: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          party_type?: string
          project_id?: string | null
          retention_amount?: number | null
          retention_pct?: number | null
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number | null
          category: string
          company: string | null
          department: string | null
          department_id: string | null
          description: string | null
          id: string
          imported_at: string
          imported_by: string | null
          meta: Json | null
          period: string | null
          project: string | null
          project_id: string | null
          section: string | null
        }
        Insert: {
          amount?: number | null
          category: string
          company?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          meta?: Json | null
          period?: string | null
          project?: string | null
          project_id?: string | null
          section?: string | null
        }
        Update: {
          amount?: number | null
          category?: string
          company?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          meta?: Json | null
          period?: string | null
          project?: string | null
          project_id?: string | null
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number | null
          is_active: boolean | null
          is_base: boolean | null
          name_ar: string
          name_en: string | null
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number | null
          is_active?: boolean | null
          is_base?: boolean | null
          name_ar: string
          name_en?: string | null
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number | null
          is_active?: boolean | null
          is_base?: boolean | null
          name_ar?: string
          name_en?: string | null
          symbol?: string | null
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
          opening_balance: number
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
          opening_balance?: number
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
          opening_balance?: number
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
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          manager: string | null
          name_ar: string
          name_en: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager?: string | null
          name_ar: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager?: string | null
          name_ar?: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          employee_code: string
          full_name: string
          full_name_en: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          national_id: string | null
          nationality: string | null
          phone: string | null
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code: string
          full_name: string
          full_name_en?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          national_id?: string | null
          nationality?: string | null
          phone?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_code?: string
          full_name?: string
          full_name_en?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          national_id?: string | null
          nationality?: string | null
          phone?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_costs: {
        Row: {
          department: string | null
          department_id: string | null
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
          project_id: string | null
          purchase_cost: number | null
          total_cost: number | null
        }
        Insert: {
          department?: string | null
          department_id?: string | null
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
          project_id?: string | null
          purchase_cost?: number | null
          total_cost?: number | null
        }
        Update: {
          department?: string | null
          department_id?: string | null
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
          project_id?: string | null
          purchase_cost?: number | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_costs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          rate: number
          rate_date: string
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          rate: number
          rate_date?: string
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_from_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_to_currency_fkey"
            columns: ["to_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
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
          department_id: string | null
          id: string
          imported_at: string
          imported_by: string | null
          net_book_value: number | null
          project: string | null
          project_id: string | null
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
          department_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          net_book_value?: number | null
          project?: string | null
          project_id?: string | null
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
          department_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          net_book_value?: number | null
          project?: string | null
          project_id?: string | null
          purchase_date?: string | null
          status?: string | null
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_assets_assignment: {
        Row: {
          asset_name: string
          asset_type: Database["public"]["Enums"]["hr_asset_type"]
          assigned_date: string
          condition_notes: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          file_path: string | null
          id: string
          is_returned: boolean
          return_date: string | null
          serial_no: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          asset_name: string
          asset_type: Database["public"]["Enums"]["hr_asset_type"]
          assigned_date?: string
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          file_path?: string | null
          id?: string
          is_returned?: boolean
          return_date?: string | null
          serial_no?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["hr_asset_type"]
          assigned_date?: string
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          file_path?: string | null
          id?: string
          is_returned?: boolean
          return_date?: string | null
          serial_no?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_assets_assignment_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_contract_amendments: {
        Row: {
          amendment_date: string
          amendment_no: string | null
          amendment_type: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          amendment_date?: string
          amendment_no?: string | null
          amendment_type?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          amendment_date?: string
          amendment_no?: string | null
          amendment_type?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "hr_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_contracts: {
        Row: {
          annual_leave_days: number | null
          basic_salary: number
          contract_no: string
          contract_type: Database["public"]["Enums"]["hr_contract_type"]
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          file_path: string | null
          housing_allowance: number | null
          id: string
          notes: string | null
          notice_period_days: number | null
          other_allowances: number | null
          probation_months: number | null
          project_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["hr_contract_status"]
          transport_allowance: number | null
          updated_at: string
          work_location: string | null
          working_hours_per_week: number | null
        }
        Insert: {
          annual_leave_days?: number | null
          basic_salary?: number
          contract_no: string
          contract_type: Database["public"]["Enums"]["hr_contract_type"]
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          file_path?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          other_allowances?: number | null
          probation_months?: number | null
          project_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["hr_contract_status"]
          transport_allowance?: number | null
          updated_at?: string
          work_location?: string | null
          working_hours_per_week?: number | null
        }
        Update: {
          annual_leave_days?: number | null
          basic_salary?: number
          contract_no?: string
          contract_type?: Database["public"]["Enums"]["hr_contract_type"]
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          file_path?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          notice_period_days?: number | null
          other_allowances?: number | null
          probation_months?: number | null
          project_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["hr_contract_status"]
          transport_allowance?: number | null
          updated_at?: string
          work_location?: string | null
          working_hours_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_costs: {
        Row: {
          department: string | null
          department_id: string | null
          employee_code: string | null
          employee_id: string | null
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
          project_id: string | null
          salary: number | null
          tickets: number | null
          total_cost: number | null
        }
        Insert: {
          department?: string | null
          department_id?: string | null
          employee_code?: string | null
          employee_id?: string | null
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
          project_id?: string | null
          salary?: number | null
          tickets?: number | null
          total_cost?: number | null
        }
        Update: {
          department?: string | null
          department_id?: string | null
          employee_code?: string | null
          employee_id?: string | null
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
          project_id?: string | null
          salary?: number | null
          tickets?: number | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_costs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_costs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employee_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_number: string | null
          doc_type: Database["public"]["Enums"]["hr_document_type"]
          employee_id: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          id: string
          issue_date: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type: Database["public"]["Enums"]["hr_document_type"]
          employee_id: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["hr_document_type"]
          employee_id?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          address: string | null
          bank_iban: string | null
          bank_name: string | null
          basic_salary: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          dependents_count: number | null
          employee_no: string
          full_name_ar: string
          full_name_en: string | null
          gender: string | null
          gosi_subscription: number | null
          gross_salary: number | null
          hire_date: string | null
          housing_allowance: number | null
          id: string
          iqama_expiry: string | null
          iqama_number: string | null
          is_saudi: boolean
          job_title_id: string | null
          manager_id: string | null
          marital_status: string | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          other_allowances: number | null
          passport_expiry: string | null
          passport_number: string | null
          personal_email: string | null
          personal_phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          dependents_count?: number | null
          employee_no: string
          full_name_ar: string
          full_name_en?: string | null
          gender?: string | null
          gosi_subscription?: number | null
          gross_salary?: number | null
          hire_date?: string | null
          housing_allowance?: number | null
          id?: string
          iqama_expiry?: string | null
          iqama_number?: string | null
          is_saudi?: boolean
          job_title_id?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          other_allowances?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          dependents_count?: number | null
          employee_no?: string
          full_name_ar?: string
          full_name_en?: string | null
          gender?: string | null
          gosi_subscription?: number | null
          gross_salary?: number | null
          hire_date?: string | null
          housing_allowance?: number | null
          id?: string
          iqama_expiry?: string | null
          iqama_number?: string | null
          is_saudi?: boolean
          job_title_id?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          other_allowances?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_balances: {
        Row: {
          balance_days: number | null
          employee_id: string
          entitled_days: number
          id: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          balance_days?: number | null
          employee_id: string
          entitled_days?: number
          id?: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          balance_days?: number | null
          employee_id?: string
          entitled_days?: number
          id?: string
          leave_type?: Database["public"]["Enums"]["hr_leave_type"]
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          days_count: number
          employee_id: string
          from_date: string
          id: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          reason: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["hr_leave_status"]
          to_date: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          days_count: number
          employee_id: string
          from_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          reason?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["hr_leave_status"]
          to_date: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          days_count?: number
          employee_id?: string
          from_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["hr_leave_type"]
          reason?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["hr_leave_status"]
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leaves_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_workflow_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_loan_installments: {
        Row: {
          amount: number
          due_date: string
          id: string
          installment_no: number
          loan_id: string
          paid: boolean
          paid_at: string | null
          payroll_line_id: string | null
        }
        Insert: {
          amount: number
          due_date: string
          id?: string
          installment_no: number
          loan_id: string
          paid?: boolean
          paid_at?: string | null
          payroll_line_id?: string | null
        }
        Update: {
          amount?: number
          due_date?: string
          id?: string
          installment_no?: number
          loan_id?: string
          paid?: boolean
          paid_at?: string | null
          payroll_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "hr_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_loans: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          installments_count: number
          loan_date: string
          loan_no: string
          monthly_deduction: number
          paid_amount: number | null
          reason: string | null
          remaining_amount: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          installments_count?: number
          loan_date?: string
          loan_no: string
          monthly_deduction: number
          paid_amount?: number | null
          reason?: string | null
          remaining_amount?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          installments_count?: number
          loan_date?: string
          loan_no?: string
          monthly_deduction?: number
          paid_amount?: number | null
          reason?: string | null
          remaining_amount?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll_lines: {
        Row: {
          absence_deduction: number | null
          basic_salary: number | null
          bonuses: number | null
          cost_entry_id: string | null
          created_at: string
          employee_id: string
          gosi_employee: number | null
          gosi_employer: number | null
          gross_salary: number | null
          housing_allowance: number | null
          id: string
          late_deduction: number | null
          loan_deduction: number | null
          net_salary: number | null
          notes: string | null
          other_allowances: number | null
          other_deductions: number | null
          overtime: number | null
          project_id: string | null
          run_id: string
          total_deductions: number | null
          transport_allowance: number | null
          unpaid_leave_deduction: number | null
          updated_at: string
        }
        Insert: {
          absence_deduction?: number | null
          basic_salary?: number | null
          bonuses?: number | null
          cost_entry_id?: string | null
          created_at?: string
          employee_id: string
          gosi_employee?: number | null
          gosi_employer?: number | null
          gross_salary?: number | null
          housing_allowance?: number | null
          id?: string
          late_deduction?: number | null
          loan_deduction?: number | null
          net_salary?: number | null
          notes?: string | null
          other_allowances?: number | null
          other_deductions?: number | null
          overtime?: number | null
          project_id?: string | null
          run_id: string
          total_deductions?: number | null
          transport_allowance?: number | null
          unpaid_leave_deduction?: number | null
          updated_at?: string
        }
        Update: {
          absence_deduction?: number | null
          basic_salary?: number | null
          bonuses?: number | null
          cost_entry_id?: string | null
          created_at?: string
          employee_id?: string
          gosi_employee?: number | null
          gosi_employer?: number | null
          gross_salary?: number | null
          housing_allowance?: number | null
          id?: string
          late_deduction?: number | null
          loan_deduction?: number | null
          net_salary?: number | null
          notes?: string | null
          other_allowances?: number | null
          other_deductions?: number | null
          overtime?: number | null
          project_id?: string | null
          run_id?: string
          total_deductions?: number | null
          transport_allowance?: number | null
          unpaid_leave_deduction?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_payroll_lines_cost_entry_id_fkey"
            columns: ["cost_entry_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hr_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employees_count: number | null
          id: string
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          run_no: string
          status: Database["public"]["Enums"]["hr_payroll_status"]
          total_deductions: number | null
          total_gosi: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employees_count?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          run_no: string
          status?: Database["public"]["Enums"]["hr_payroll_status"]
          total_deductions?: number | null
          total_gosi?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employees_count?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          run_no?: string
          status?: Database["public"]["Enums"]["hr_payroll_status"]
          total_deductions?: number | null
          total_gosi?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hr_terminations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clearance_status: Json | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          eos_amount: number | null
          id: string
          last_working_day: string
          leave_balance_amount: number | null
          loan_settlement: number | null
          net_settlement: number | null
          other_payables: number | null
          other_receivables: number | null
          outstanding_allowances: number | null
          outstanding_deductions: number | null
          reason: Database["public"]["Enums"]["hr_termination_reason"]
          reason_details: string | null
          request_id: string | null
          service_years: number | null
          settlement_details: Json | null
          status: string
          termination_no: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clearance_status?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          eos_amount?: number | null
          id?: string
          last_working_day: string
          leave_balance_amount?: number | null
          loan_settlement?: number | null
          net_settlement?: number | null
          other_payables?: number | null
          other_receivables?: number | null
          outstanding_allowances?: number | null
          outstanding_deductions?: number | null
          reason: Database["public"]["Enums"]["hr_termination_reason"]
          reason_details?: string | null
          request_id?: string | null
          service_years?: number | null
          settlement_details?: Json | null
          status?: string
          termination_no: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clearance_status?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          eos_amount?: number | null
          id?: string
          last_working_day?: string
          leave_balance_amount?: number | null
          loan_settlement?: number | null
          net_settlement?: number | null
          other_payables?: number | null
          other_receivables?: number | null
          outstanding_allowances?: number | null
          outstanding_deductions?: number | null
          reason?: Database["public"]["Enums"]["hr_termination_reason"]
          reason_details?: string | null
          request_id?: string | null
          service_years?: number | null
          settlement_details?: Json | null
          status?: string
          termination_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_terminations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "hr_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_terminations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_terminations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_workflow_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_workflow_requests: {
        Row: {
          attachments: Json | null
          completed_at: string | null
          created_at: string
          current_step: number | null
          employee_id: string | null
          id: string
          notes: string | null
          payload: Json | null
          request_no: string
          request_type: Database["public"]["Enums"]["hr_request_type"]
          requested_by: string | null
          status: Database["public"]["Enums"]["hr_request_status"]
          subject: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          payload?: Json | null
          request_no: string
          request_type: Database["public"]["Enums"]["hr_request_type"]
          requested_by?: string | null
          status?: Database["public"]["Enums"]["hr_request_status"]
          subject?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          payload?: Json | null
          request_no?: string
          request_type?: Database["public"]["Enums"]["hr_request_type"]
          requested_by?: string | null
          status?: Database["public"]["Enums"]["hr_request_status"]
          subject?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_workflow_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_workflow_steps: {
        Row: {
          acted_at: string | null
          action: string | null
          approver_id: string | null
          approver_role: string | null
          comment: string | null
          created_at: string
          id: string
          request_id: string
          step_order: number
        }
        Insert: {
          acted_at?: string | null
          action?: string | null
          approver_id?: string | null
          approver_role?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          request_id: string
          step_order: number
        }
        Update: {
          acted_at?: string | null
          action?: string | null
          approver_id?: string | null
          approver_role?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          request_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_workflow_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_workflow_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          ai_detection: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          duplicate_rows: number
          error_rows: number
          field_mapping: Json
          file_name: string | null
          file_size: number | null
          id: string
          imported_rows: number
          notes: string | null
          period: string | null
          source_type: string
          started_at: string | null
          status: string
          template_id: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
        }
        Insert: {
          ai_detection?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          field_mapping?: Json
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_rows?: number
          notes?: string | null
          period?: string | null
          source_type: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Update: {
          ai_detection?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          field_mapping?: Json
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_rows?: number
          notes?: string | null
          period?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          batch_id: string
          created_at: string
          error_type: string
          field: string | null
          id: string
          message: string
          row_data: Json | null
          row_number: number | null
          severity: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_type: string
          field?: string | null
          id?: string
          message: string
          row_data?: Json | null
          row_number?: number | null
          severity?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_type?: string
          field?: string | null
          id?: string
          message?: string
          row_data?: Json | null
          row_number?: number | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          field_mapping: Json
          id: string
          is_shared: boolean
          name: string
          options: Json
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_mapping?: Json
          id?: string
          is_shared?: boolean
          name: string
          options?: Json
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_mapping?: Json
          id?: string
          is_shared?: boolean
          name?: string
          options?: Json
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          payment_id: string
          purchase_invoice_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id: string
          purchase_invoice_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id?: string
          purchase_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
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
          retention_amount: number
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
          retention_amount?: number
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
          retention_amount?: number
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
      job_title_permissions: {
        Row: {
          action_key: string
          granted: boolean
          id: string
          job_title_id: string
          module_key: string
        }
        Insert: {
          action_key: string
          granted?: boolean
          id?: string
          job_title_id: string
          module_key: string
        }
        Update: {
          action_key?: string
          granted?: boolean
          id?: string
          job_title_id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_title_permissions_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "permission_actions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "job_title_permissions_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_title_permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["key"]
          },
        ]
      }
      job_titles: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          metadata: Json
          read_at: string | null
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
          metadata?: Json
          read_at?: string | null
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
          metadata?: Json
          read_at?: string | null
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
          direction: string | null
          id: string
          invoice_id: string | null
          method: string | null
          notes: string | null
          payment_date: string
          purchase_invoice_id: string | null
          reference: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          payment_date?: string
          purchase_invoice_id?: string | null
          reference?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          payment_date?: string
          purchase_invoice_id?: string | null
          reference?: string | null
          vendor_id?: string | null
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
          {
            foreignKeyName: "payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_imports: {
        Row: {
          allowances: number
          basic_salary: number
          batch_id: string | null
          created_at: string
          deductions: number
          department: string | null
          employee_code: string | null
          employee_name: string | null
          gosi: number
          id: string
          net_pay: number
          overtime: number
          period: string
          project_id: string | null
          total_cost: number
        }
        Insert: {
          allowances?: number
          basic_salary?: number
          batch_id?: string | null
          created_at?: string
          deductions?: number
          department?: string | null
          employee_code?: string | null
          employee_name?: string | null
          gosi?: number
          id?: string
          net_pay?: number
          overtime?: number
          period: string
          project_id?: string | null
          total_cost?: number
        }
        Update: {
          allowances?: number
          basic_salary?: number
          batch_id?: string | null
          created_at?: string
          deductions?: number
          department?: string | null
          employee_code?: string | null
          employee_name?: string | null
          gosi?: number
          id?: string
          net_pay?: number
          overtime?: number
          period?: string
          project_id?: string | null
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_imports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_actions: {
        Row: {
          key: string
          name_ar: string
          sort_order: number
        }
        Insert: {
          key: string
          name_ar: string
          sort_order?: number
        }
        Update: {
          key?: string
          name_ar?: string
          sort_order?: number
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          action_key: string
          changed_at: string
          changed_by: string | null
          id: string
          module_key: string
          new_value: boolean | null
          old_value: boolean | null
          user_id: string
        }
        Insert: {
          action_key: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          module_key: string
          new_value?: boolean | null
          old_value?: boolean | null
          user_id: string
        }
        Update: {
          action_key?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          module_key?: string
          new_value?: boolean | null
          old_value?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      permission_modules: {
        Row: {
          category: string | null
          created_at: string
          key: string
          name_ar: string
          name_en: string | null
          parent_key: string | null
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          key: string
          name_ar: string
          name_en?: string | null
          parent_key?: string | null
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          key?: string
          name_ar?: string
          name_en?: string | null
          parent_key?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "permission_modules_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["key"]
          },
        ]
      }
      personal_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          done_at: string | null
          due_date: string | null
          id: string
          is_done: boolean
          order_index: number
          pinned: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          order_index?: number
          pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          done_at?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          order_index?: number
          pinned?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          job_title_id: string | null
          manager_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          job_title_id?: string | null
          manager_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          job_title_id?: string | null
          manager_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
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
      purchase_invoices: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          notes: string | null
          paid_amount: number | null
          project_id: string | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"] | null
          total_amount: number | null
          updated_at: string
          vat_amount: number | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          notes?: string | null
          paid_amount?: number | null
          project_id?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          po_number: string
          project_id: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          total_amount: number | null
          updated_at: string
          vat_amount: number | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          total_amount?: number | null
          updated_at?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      retention_guarantees: {
        Row: {
          contract_id: string | null
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          project_id: string | null
          released_amount: number
          status: string
          total_retention: number
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          released_amount?: number
          status?: string
          total_retention?: number
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          released_amount?: number
          status?: string
          total_retention?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_guarantees_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_guarantees_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action_key: string
          created_at: string
          granted: boolean
          id: string
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action_key: string
          created_at?: string
          granted?: boolean
          id?: string
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action_key?: string
          created_at?: string
          granted?: boolean
          id?: string
          module_key?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      task_assignees: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          order_index: number
          task_id: string
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          order_index?: number
          task_id: string
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          order_index?: number
          task_id?: string
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          proposed_assignee: string | null
          proposed_due_date: string | null
          reason: string | null
          request_type: string
          requested_by: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          proposed_assignee?: string | null
          proposed_due_date?: string | null
          reason?: string | null
          request_type: string
          requested_by: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          proposed_assignee?: string | null
          proposed_due_date?: string | null
          reason?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completion_approval_note: string | null
          completion_approved_at: string | null
          completion_approved_by: string | null
          completion_note: string | null
          completion_outcome: string | null
          completion_percentage: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_group_task: boolean
          manager_evaluation_notes: string | null
          manager_evaluation_score: number | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string | null
          project_id: string | null
          rated_at: string | null
          rated_by: string | null
          rating: number | null
          rating_note: string | null
          return_reason: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          type: Database["public"]["Enums"]["task_type"] | null
          updated_at: string
          visibility: string
          visible_to_user_ids: string[]
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_approval_note?: string | null
          completion_approved_at?: string | null
          completion_approved_by?: string | null
          completion_note?: string | null
          completion_outcome?: string | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_group_task?: boolean
          manager_evaluation_notes?: string | null
          manager_evaluation_score?: number | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          project_id?: string | null
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rating_note?: string | null
          return_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          type?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string
          visibility?: string
          visible_to_user_ids?: string[]
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_approval_note?: string | null
          completion_approved_at?: string | null
          completion_approved_by?: string | null
          completion_note?: string | null
          completion_outcome?: string | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_group_task?: boolean
          manager_evaluation_notes?: string | null
          manager_evaluation_score?: number | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string | null
          project_id?: string | null
          rated_at?: string | null
          rated_by?: string | null
          rating?: number | null
          rating_note?: string | null
          return_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string
          visibility?: string
          visible_to_user_ids?: string[]
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
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "trial_balance_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          action_key: string
          granted: boolean
          granted_at: string
          granted_by: string | null
          id: string
          module_key: string
          source: string
          user_id: string
        }
        Insert: {
          action_key: string
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          module_key: string
          source?: string
          user_id: string
        }
        Update: {
          action_key?: string
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          module_key?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "permission_actions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "permission_modules"
            referencedColumns: ["key"]
          },
        ]
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
      vat_returns: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          final_vat: number | null
          id: string
          net_vat: number | null
          period_from: string
          period_to: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          final_vat?: number | null
          id?: string
          net_vat?: number | null
          period_from: string
          period_to: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          final_vat?: number | null
          id?: string
          net_vat?: number | null
          period_from?: string
          period_to?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          job_title: string | null
          name: string
          phone: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          name: string
          phone?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          name?: string
          phone?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
          opening_balance: number
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
          opening_balance?: number
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
          opening_balance?: number
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
      zakat_returns: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          tax_due: number | null
          updated_at: string
          updated_by: string | null
          year_from: string
          year_to: string
          zakat_due: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          tax_due?: number | null
          updated_at?: string
          updated_by?: string | null
          year_from: string
          year_to: string
          zakat_due?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          tax_due?: number | null
          updated_at?: string
          updated_by?: string | null
          year_from?: string
          year_to?: string
          zakat_due?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_customer_balance: { Args: { _customer_id: string }; Returns: number }
      calc_vendor_balance: { Args: { _vendor_id: string }; Returns: number }
      can_delete_master: { Args: { _user_id: string }; Returns: boolean }
      can_read_business: { Args: { _user_id: string }; Returns: boolean }
      can_read_sensitive_finance: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_write_finance: { Args: { _user_id: string }; Returns: boolean }
      can_write_operations: { Args: { _user_id: string }; Returns: boolean }
      create_notification: {
        Args: {
          _link: string
          _message: string
          _metadata: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      get_email_by_employee_id: {
        Args: { _employee_id: string }
        Returns: string
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_calc_end_of_service: {
        Args: { _monthly_wage: number; _reason: string; _service_years: number }
        Returns: number
      }
      hr_calc_gosi: {
        Args: { _gross_wage: number; _is_saudi: boolean }
        Returns: {
          employee_share: number
          employer_share: number
        }[]
      }
      hr_calc_leave_entitlement: {
        Args: { _employee_id: string; _leave_type: string; _year?: number }
        Returns: number
      }
      hr_get_leave_summary: {
        Args: { _employee_id: string; _year?: number }
        Returns: {
          entitled: number
          leave_type: string
          pending: number
          remaining: number
          used: number
        }[]
      }
      hr_termination_clearance: {
        Args: { _employee_id: string }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_task_participant: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      mark_overdue_tasks: { Args: never; Returns: number }
      record_collection: {
        Args: {
          _allocations: Json
          _customer_id: string
          _method: string
          _notes: string
          _payment_date: string
          _reference: string
        }
        Returns: string[]
      }
      user_has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_category:
        | "assets"
        | "liabilities"
        | "equity"
        | "revenue"
        | "cost_of_revenue"
        | "operating_expenses"
        | "other_income"
        | "other_expenses"
      account_type: "header" | "detail"
      app_role:
        | "admin"
        | "finance_manager"
        | "project_manager"
        | "accountant"
        | "ceo"
        | "cfo"
        | "chief_accountant"
        | "cost_controller"
        | "auditor"
        | "read_only"
      company_type: "parent" | "subsidiary" | "branch"
      contract_status:
        | "draft"
        | "active"
        | "suspended"
        | "completed"
        | "cancelled"
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
      hr_asset_type:
        | "vehicle"
        | "laptop"
        | "mobile"
        | "equipment"
        | "tool"
        | "card"
        | "key"
        | "uniform"
        | "other"
      hr_contract_status:
        | "active"
        | "expiring_soon"
        | "expired"
        | "cancelled"
        | "draft"
      hr_contract_type:
        | "fixed_term"
        | "unlimited"
        | "part_time"
        | "temporary"
        | "training"
      hr_document_type:
        | "national_id"
        | "iqama"
        | "passport"
        | "contract"
        | "certificate"
        | "license"
        | "driving_license"
        | "other"
      hr_employee_status: "active" | "on_leave" | "suspended" | "terminated"
      hr_leave_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "taken"
      hr_leave_type:
        | "annual"
        | "sick"
        | "emergency"
        | "unpaid"
        | "compensatory"
        | "maternity"
        | "paternity"
        | "hajj"
        | "study"
        | "other"
      hr_payroll_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "paid"
        | "cancelled"
      hr_request_status:
        | "draft"
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
        | "completed"
      hr_request_type:
        | "hiring"
        | "promotion"
        | "salary_increase"
        | "transfer"
        | "secondment"
        | "leave"
        | "return_from_leave"
        | "resignation"
        | "termination"
        | "warning"
        | "violation"
        | "loan"
        | "asset_assignment"
        | "asset_return"
        | "other"
      hr_termination_reason:
        | "resignation"
        | "end_of_contract"
        | "dismissal"
        | "mutual_agreement"
        | "retirement"
        | "death"
        | "other"
      invoice_status:
        | "draft"
        | "issued"
        | "due"
        | "overdue"
        | "paid"
        | "unbilled"
      po_status: "draft" | "approved" | "partial" | "received" | "cancelled"
      project_status:
        | "new"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "delayed"
      purchase_invoice_status: "draft" | "received" | "due" | "overdue" | "paid"
      task_status:
        | "pending"
        | "in_progress"
        | "done"
        | "cancelled"
        | "overdue"
        | "waiting_review"
        | "approved"
        | "returned"
      task_type:
        | "meeting"
        | "visit"
        | "call"
        | "collection_reminder"
        | "other"
        | "vendor_followup"
        | "contract_review"
        | "audit"
        | "report"
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
      account_category: [
        "assets",
        "liabilities",
        "equity",
        "revenue",
        "cost_of_revenue",
        "operating_expenses",
        "other_income",
        "other_expenses",
      ],
      account_type: ["header", "detail"],
      app_role: [
        "admin",
        "finance_manager",
        "project_manager",
        "accountant",
        "ceo",
        "cfo",
        "chief_accountant",
        "cost_controller",
        "auditor",
        "read_only",
      ],
      company_type: ["parent", "subsidiary", "branch"],
      contract_status: [
        "draft",
        "active",
        "suspended",
        "completed",
        "cancelled",
      ],
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
      hr_asset_type: [
        "vehicle",
        "laptop",
        "mobile",
        "equipment",
        "tool",
        "card",
        "key",
        "uniform",
        "other",
      ],
      hr_contract_status: [
        "active",
        "expiring_soon",
        "expired",
        "cancelled",
        "draft",
      ],
      hr_contract_type: [
        "fixed_term",
        "unlimited",
        "part_time",
        "temporary",
        "training",
      ],
      hr_document_type: [
        "national_id",
        "iqama",
        "passport",
        "contract",
        "certificate",
        "license",
        "driving_license",
        "other",
      ],
      hr_employee_status: ["active", "on_leave", "suspended", "terminated"],
      hr_leave_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "taken",
      ],
      hr_leave_type: [
        "annual",
        "sick",
        "emergency",
        "unpaid",
        "compensatory",
        "maternity",
        "paternity",
        "hajj",
        "study",
        "other",
      ],
      hr_payroll_status: [
        "draft",
        "pending_approval",
        "approved",
        "paid",
        "cancelled",
      ],
      hr_request_status: [
        "draft",
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "cancelled",
        "completed",
      ],
      hr_request_type: [
        "hiring",
        "promotion",
        "salary_increase",
        "transfer",
        "secondment",
        "leave",
        "return_from_leave",
        "resignation",
        "termination",
        "warning",
        "violation",
        "loan",
        "asset_assignment",
        "asset_return",
        "other",
      ],
      hr_termination_reason: [
        "resignation",
        "end_of_contract",
        "dismissal",
        "mutual_agreement",
        "retirement",
        "death",
        "other",
      ],
      invoice_status: ["draft", "issued", "due", "overdue", "paid", "unbilled"],
      po_status: ["draft", "approved", "partial", "received", "cancelled"],
      project_status: ["new", "in_progress", "on_hold", "completed", "delayed"],
      purchase_invoice_status: ["draft", "received", "due", "overdue", "paid"],
      task_status: [
        "pending",
        "in_progress",
        "done",
        "cancelled",
        "overdue",
        "waiting_review",
        "approved",
        "returned",
      ],
      task_type: [
        "meeting",
        "visit",
        "call",
        "collection_reminder",
        "other",
        "vendor_followup",
        "contract_review",
        "audit",
        "report",
      ],
    },
  },
} as const
