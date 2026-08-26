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
      data_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          history: Json
          id: string
          mapping: Json
          name: string
          table_key: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          history?: Json
          id?: string
          mapping?: Json
          name: string
          table_key: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          history?: Json
          id?: string
          mapping?: Json
          name?: string
          table_key?: string
          updated_at?: string
          version?: number
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
      fleet_drivers: {
        Row: {
          created_at: string
          employee_id: string | null
          full_name: string
          id: string
          iqama_expiry: string | null
          iqama_no: string | null
          license_class: string | null
          license_expiry: string | null
          license_no: string | null
          national_id: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          full_name: string
          id?: string
          iqama_expiry?: string | null
          iqama_no?: string | null
          license_class?: string | null
          license_expiry?: string | null
          license_no?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          iqama_expiry?: string | null
          iqama_no?: string | null
          license_class?: string | null
          license_expiry?: string | null
          license_no?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_drivers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_fuel: {
        Row: {
          cost: number
          created_at: string
          driver_id: string | null
          fuel_date: string
          id: string
          liters: number
          notes: string | null
          odometer_km: number | null
          price_per_liter: number | null
          project_id: string | null
          station: string | null
          trip_id: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          driver_id?: string | null
          fuel_date?: string
          id?: string
          liters?: number
          notes?: string | null
          odometer_km?: number | null
          price_per_liter?: number | null
          project_id?: string | null
          station?: string | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          driver_id?: string | null
          fuel_date?: string
          id?: string
          liters?: number
          notes?: string | null
          odometer_km?: number | null
          price_per_liter?: number | null
          project_id?: string | null
          station?: string | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_fuel_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_fuel_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_fuel_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_locations: {
        Row: {
          altitude_m: number | null
          created_at: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          source: string | null
          speed_kmh: number | null
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          altitude_m?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at: string
          source?: string | null
          speed_kmh?: number | null
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          altitude_m?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          source?: string | null
          speed_kmh?: number | null
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "fleet_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_locations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_maintenance: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          id: string
          invoice_ref: string | null
          maintenance_type: Database["public"]["Enums"]["fleet_maintenance_type"]
          next_service_date: string | null
          next_service_km: number | null
          odometer_km: number | null
          project_id: string | null
          service_date: string
          updated_at: string
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_ref?: string | null
          maintenance_type?: Database["public"]["Enums"]["fleet_maintenance_type"]
          next_service_date?: string | null
          next_service_km?: number | null
          odometer_km?: number | null
          project_id?: string | null
          service_date?: string
          updated_at?: string
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_ref?: string | null
          maintenance_type?: Database["public"]["Enums"]["fleet_maintenance_type"]
          next_service_date?: string | null
          next_service_km?: number | null
          odometer_km?: number | null
          project_id?: string | null
          service_date?: string
          updated_at?: string
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_maintenance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_trips: {
        Row: {
          actual_distance_km: number | null
          cargo_description: string | null
          cargo_weight_tons: number | null
          contract_id: string | null
          created_at: string
          customer_id: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_name: string | null
          driver_id: string | null
          end_at: string | null
          fuel_cost: number | null
          id: string
          notes: string | null
          origin_lat: number | null
          origin_lng: number | null
          origin_name: string | null
          other_costs: number | null
          planned_distance_km: number | null
          project_id: string | null
          revenue: number | null
          start_at: string | null
          status: Database["public"]["Enums"]["fleet_trip_status"]
          trip_no: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_distance_km?: number | null
          cargo_description?: string | null
          cargo_weight_tons?: number | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name?: string | null
          driver_id?: string | null
          end_at?: string | null
          fuel_cost?: number | null
          id?: string
          notes?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name?: string | null
          other_costs?: number | null
          planned_distance_km?: number | null
          project_id?: string | null
          revenue?: number | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["fleet_trip_status"]
          trip_no?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_distance_km?: number | null
          cargo_description?: string | null
          cargo_weight_tons?: number | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name?: string | null
          driver_id?: string | null
          end_at?: string | null
          fuel_cost?: number | null
          id?: string
          notes?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name?: string | null
          other_costs?: number | null
          planned_distance_km?: number | null
          project_id?: string | null
          revenue?: number | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["fleet_trip_status"]
          trip_no?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_trips_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_trips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_trips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          brand: string | null
          capacity_tons: number | null
          color: string | null
          created_at: string
          current_driver_id: string | null
          fixed_asset_id: string | null
          fuel_type: string | null
          gps_device_id: string | null
          gps_provider: string | null
          id: string
          inspection_expiry: string | null
          insurance_expiry: string | null
          last_lat: number | null
          last_lng: number | null
          last_ping_at: string | null
          last_speed_kmh: number | null
          load_volume_m3: number | null
          model: string | null
          notes: string | null
          odometer_km: number | null
          plate_no: string
          registration_expiry: string | null
          status: Database["public"]["Enums"]["fleet_vehicle_status"]
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["fleet_vehicle_type"]
          vin: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          capacity_tons?: number | null
          color?: string | null
          created_at?: string
          current_driver_id?: string | null
          fixed_asset_id?: string | null
          fuel_type?: string | null
          gps_device_id?: string | null
          gps_provider?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          last_speed_kmh?: number | null
          load_volume_m3?: number | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate_no: string
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["fleet_vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["fleet_vehicle_type"]
          vin?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          capacity_tons?: number | null
          color?: string | null
          created_at?: string
          current_driver_id?: string | null
          fixed_asset_id?: string | null
          fuel_type?: string | null
          gps_device_id?: string | null
          gps_provider?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          last_speed_kmh?: number | null
          load_volume_m3?: number | null
          model?: string | null
          notes?: string | null
          odometer_km?: number | null
          plate_no?: string
          registration_expiry?: string | null
          status?: Database["public"]["Enums"]["fleet_vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["fleet_vehicle_type"]
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "fleet_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicles_fixed_asset_id_fkey"
            columns: ["fixed_asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
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
          annual_leave_days: number | null
          bank_iban: string | null
          bank_name: string | null
          basic_salary: number | null
          commission: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          dependents_count: number | null
          employee_no: string
          environment_allowance: number | null
          eos_reserved_balance: number | null
          food_allowance: number | null
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
          meal_allowance: number | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          opening_leave_balance_days: number | null
          other_allowances: number | null
          passport_expiry: string | null
          passport_number: string | null
          penalty_clause_amount: number | null
          personal_email: string | null
          personal_phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance: number | null
          updated_at: string
          user_id: string | null
          years_of_service_snapshot: number | null
        }
        Insert: {
          address?: string | null
          annual_leave_days?: number | null
          bank_iban?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          commission?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          dependents_count?: number | null
          employee_no: string
          environment_allowance?: number | null
          eos_reserved_balance?: number | null
          food_allowance?: number | null
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
          meal_allowance?: number | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          opening_leave_balance_days?: number | null
          other_allowances?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          penalty_clause_amount?: number | null
          personal_email?: string | null
          personal_phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance?: number | null
          updated_at?: string
          user_id?: string | null
          years_of_service_snapshot?: number | null
        }
        Update: {
          address?: string | null
          annual_leave_days?: number | null
          bank_iban?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          commission?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          dependents_count?: number | null
          employee_no?: string
          environment_allowance?: number | null
          eos_reserved_balance?: number | null
          food_allowance?: number | null
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
          meal_allowance?: number | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          opening_leave_balance_days?: number | null
          other_allowances?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          penalty_clause_amount?: number | null
          personal_email?: string | null
          personal_phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["hr_employee_status"]
          transport_allowance?: number | null
          updated_at?: string
          user_id?: string | null
          years_of_service_snapshot?: number | null
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
      hr_leave_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          employee_id: string
          id: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          reason: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days: number
          employee_id: string
          id?: string
          leave_type: Database["public"]["Enums"]["hr_leave_type"]
          reason?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          employee_id?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["hr_leave_type"]
          reason?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_adjustments_employee_id_fkey"
            columns: ["employee_id"]
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
      hr_attendance_correction_requests: {
        Row: {
          attendance_day_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          employee_id: string
          id: string
          original_snapshot: Json
          reason: string
          requested_by: string
          requested_check_in: string | null
          requested_check_out: string | null
          status: string
        }
        Insert: {
          attendance_day_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          employee_id: string
          id?: string
          original_snapshot: Json
          reason: string
          requested_by: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          status?: string
        }
        Update: {
          attendance_day_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          employee_id?: string
          id?: string
          original_snapshot?: Json
          reason?: string
          requested_by?: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          status?: string
        }
        Relationships: []
      }
      hr_attendance_days: {
        Row: {
          actual_minutes: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          assignment_id: string | null
          calculated_at: string
          calculation_details: Json
          early_leave_minutes: number
          employee_id: string
          first_check_in: string | null
          group_id: string | null
          id: string
          last_check_out: string | null
          late_minutes: number
          notes: string | null
          overtime_minutes: number
          schedule_id: string | null
          scheduled_minutes: number
          status: string
          updated_at: string
          work_date: string
        }
        Insert: { id?: string; employee_id: string; work_date: string; assignment_id?: string | null; group_id?: string | null; schedule_id?: string | null; first_check_in?: string | null; last_check_out?: string | null; scheduled_minutes?: number; actual_minutes?: number; late_minutes?: number; early_leave_minutes?: number; overtime_minutes?: number; status: string; approval_status?: string; approved_by?: string | null; approved_at?: string | null; notes?: string | null; calculation_details?: Json; calculated_at?: string; updated_at?: string }
        Update: { id?: string; employee_id?: string; work_date?: string; assignment_id?: string | null; group_id?: string | null; schedule_id?: string | null; first_check_in?: string | null; last_check_out?: string | null; scheduled_minutes?: number; actual_minutes?: number; late_minutes?: number; early_leave_minutes?: number; overtime_minutes?: number; status?: string; approval_status?: string; approved_by?: string | null; approved_at?: string | null; notes?: string | null; calculation_details?: Json; calculated_at?: string; updated_at?: string }
        Relationships: []
      }
      hr_attendance_holidays: {
        Row: { id: string; name_ar: string; date_from: string; date_to: string; group_id: string | null; is_paid: boolean; notes: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name_ar: string; date_from: string; date_to: string; group_id?: string | null; is_paid?: boolean; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; name_ar?: string; date_from?: string; date_to?: string; group_id?: string | null; is_paid?: boolean; notes?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      hr_attendance_period_audit: {
        Row: { id: string; period_id: string; action: string; actor_id: string; reason: string | null; snapshot: Json; created_at: string }
        Insert: { id?: string; period_id: string; action: string; actor_id: string; reason?: string | null; snapshot: Json; created_at?: string }
        Update: { id?: string; period_id?: string; action?: string; actor_id?: string; reason?: string | null; snapshot?: Json; created_at?: string }
        Relationships: []
      }
      hr_attendance_periods: {
        Row: { id: string; period_year: number; period_month: number; status: string; summary_snapshot: Json; closed_by: string | null; closed_at: string | null; reopened_by: string | null; reopened_at: string | null; reopen_reason: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; period_year: number; period_month: number; status?: string; summary_snapshot?: Json; closed_by?: string | null; closed_at?: string | null; reopened_by?: string | null; reopened_at?: string | null; reopen_reason?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; period_year?: number; period_month?: number; status?: string; summary_snapshot?: Json; closed_by?: string | null; closed_at?: string | null; reopened_by?: string | null; reopened_at?: string | null; reopen_reason?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      hr_attendance_policies: {
        Row: { id: string; group_id: string; grace_minutes: number; minimum_overtime_minutes: number; deduct_absence: boolean; deduct_late_minutes: boolean; pay_overtime: boolean; overtime_multiplier: number; salary_day_divisor: number; require_daily_approval: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; group_id: string; grace_minutes?: number; minimum_overtime_minutes?: number; deduct_absence?: boolean; deduct_late_minutes?: boolean; pay_overtime?: boolean; overtime_multiplier?: number; salary_day_divisor?: number; require_daily_approval?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; group_id?: string; grace_minutes?: number; minimum_overtime_minutes?: number; deduct_absence?: boolean; deduct_late_minutes?: boolean; pay_overtime?: boolean; overtime_multiplier?: number; salary_day_divisor?: number; require_daily_approval?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      hr_attendance_events: {
        Row: {
          id: string;
          employee_id: string;
          event_type: string;
          source: string;
          occurred_at: string;
          site_id: string | null;
          device_id: string | null;
          latitude: number | null;
          longitude: number | null;
          gps_accuracy_meters: number | null;
          distance_from_site_meters: number | null;
          schedule_id: string | null;
          validation_status: string;
          external_event_id: string | null;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          event_type: string;
          source: string;
          occurred_at?: string;
          site_id?: string | null;
          device_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          gps_accuracy_meters?: number | null;
          distance_from_site_meters?: number | null;
          schedule_id?: string | null;
          validation_status?: string;
          external_event_id?: string | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          event_type?: string;
          source?: string;
          occurred_at?: string;
          site_id?: string | null;
          device_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          gps_accuracy_meters?: number | null;
          distance_from_site_meters?: number | null;
          schedule_id?: string | null;
          validation_status?: string;
          external_event_id?: string | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      hr_attendance_anomalies: {
        Row: { id: string; anomaly_type: string; severity: string; employee_id: string | null; device_id: string | null; event_id: string | null; dedupe_key: string; details: Json; status: string; first_detected_at: string; last_detected_at: string; resolved_by: string | null; resolved_at: string | null; resolution_notes: string | null }
        Insert: { id?: string; anomaly_type: string; severity: string; employee_id?: string | null; device_id?: string | null; event_id?: string | null; dedupe_key: string; details?: Json; status?: string; first_detected_at?: string; last_detected_at?: string; resolved_by?: string | null; resolved_at?: string | null; resolution_notes?: string | null }
        Update: { id?: string; anomaly_type?: string; severity?: string; employee_id?: string | null; device_id?: string | null; event_id?: string | null; dedupe_key?: string; details?: Json; status?: string; first_detected_at?: string; last_detected_at?: string; resolved_by?: string | null; resolved_at?: string | null; resolution_notes?: string | null }
        Relationships: []
      }
      hr_biometric_devices: {
        Row: {
          id: string;
          device_code: string;
          name_ar: string;
          site_id: string | null;
          vendor: string | null;
          is_active: boolean;
          last_seen_at: string | null;
          token_hash: string | null;
          token_last_four: string | null;
          token_rotated_at: string | null;
          auth_failures: number;
          last_auth_failure_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_code: string;
          name_ar: string;
          site_id?: string | null;
          vendor?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
          token_hash?: string | null;
          token_last_four?: string | null;
          token_rotated_at?: string | null;
          auth_failures?: number;
          last_auth_failure_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_code?: string;
          name_ar?: string;
          site_id?: string | null;
          vendor?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
          token_hash?: string | null;
          token_last_four?: string | null;
          token_rotated_at?: string | null;
          auth_failures?: number;
          last_auth_failure_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_shift_assignments: {
        Row: {
          id: string;
          employee_id: string;
          group_id: string;
          effective_from: string;
          effective_to: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          group_id: string;
          effective_from: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          group_id?: string;
          effective_from?: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      hr_shift_group_sites: {
        Row: { group_id: string; site_id: string };
        Insert: { group_id: string; site_id: string };
        Update: { group_id?: string; site_id?: string };
        Relationships: [];
      };
      hr_shift_groups: {
        Row: {
          id: string;
          code: string;
          name_ar: string;
          timezone: string;
          work_minutes: number;
          break_minutes: number;
          break_is_paid: boolean;
          is_flexible: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_ar: string;
          timezone?: string;
          work_minutes?: number;
          break_minutes?: number;
          break_is_paid?: boolean;
          is_flexible?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_ar?: string;
          timezone?: string;
          work_minutes?: number;
          break_minutes?: number;
          break_is_paid?: boolean;
          is_flexible?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_shift_schedules: {
        Row: {
          id: string;
          group_id: string;
          day_of_week: number;
          is_working_day: boolean;
          start_time: string;
          end_time: string;
          checkin_open_before_minutes: number;
          checkin_close_after_minutes: number;
          checkout_open_before_minutes: number;
          checkout_close_after_minutes: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          day_of_week: number;
          is_working_day?: boolean;
          start_time: string;
          end_time: string;
          checkin_open_before_minutes?: number;
          checkin_close_after_minutes?: number;
          checkout_open_before_minutes?: number;
          checkout_close_after_minutes?: number;
        };
        Update: {
          id?: string;
          group_id?: string;
          day_of_week?: number;
          is_working_day?: boolean;
          start_time?: string;
          end_time?: string;
          checkin_open_before_minutes?: number;
          checkin_close_after_minutes?: number;
          checkout_open_before_minutes?: number;
          checkout_close_after_minutes?: number;
        };
        Relationships: [];
      };
      hr_work_sites: {
        Row: {
          id: string;
          code: string;
          name_ar: string;
          latitude: number;
          longitude: number;
          radius_meters: number;
          max_gps_accuracy_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_ar: string;
          latitude: number;
          longitude: number;
          radius_meters?: number;
          max_gps_accuracy_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_ar?: string;
          latitude?: number;
          longitude?: number;
          radius_meters?: number;
          max_gps_accuracy_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_leave_rules: {
        Row: {
          balance_mode: string
          created_at: string
          effective_from: string
          effective_to: string | null
          entitlement_days: number | null
          gender_restriction: string | null
          id: string
          label_ar: string
          leave_type: string
          legal_reference: string | null
          max_request_days: number | null
          minimum_service_days: number
          notes: string | null
          pay_schedule: Json
        }
        Insert: {
          balance_mode: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          entitlement_days?: number | null
          gender_restriction?: string | null
          id?: string
          label_ar: string
          leave_type: string
          legal_reference?: string | null
          max_request_days?: number | null
          minimum_service_days?: number
          notes?: string | null
          pay_schedule?: Json
        }
        Update: {
          balance_mode?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          entitlement_days?: number | null
          gender_restriction?: string | null
          id?: string
          label_ar?: string
          leave_type?: string
          legal_reference?: string | null
          max_request_days?: number | null
          minimum_service_days?: number
          notes?: string | null
          pay_schedule?: Json
        }
        Relationships: []
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
          sick_cycle_start: string | null
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
          sick_cycle_start?: string | null
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
          sick_cycle_start?: string | null
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
          attendance_absence_days: number
          attendance_late_minutes: number
          attendance_overtime_minutes: number
          basic_salary: number | null
          bonuses: number | null
          calculation_details: Json
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
          sick_leave_days: number
          sick_leave_deduction: number
          total_deductions: number | null
          transport_allowance: number | null
          unpaid_leave_deduction: number | null
          unpaid_leave_days: number
          updated_at: string
        }
        Insert: {
          absence_deduction?: number | null
          attendance_absence_days?: number
          attendance_late_minutes?: number
          attendance_overtime_minutes?: number
          basic_salary?: number | null
          bonuses?: number | null
          calculation_details?: Json
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
          sick_leave_days?: number
          sick_leave_deduction?: number
          total_deductions?: number | null
          transport_allowance?: number | null
          unpaid_leave_deduction?: number | null
          unpaid_leave_days?: number
          updated_at?: string
        }
        Update: {
          absence_deduction?: number | null
          attendance_absence_days?: number
          attendance_late_minutes?: number
          attendance_overtime_minutes?: number
          basic_salary?: number | null
          bonuses?: number | null
          calculation_details?: Json
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
          sick_leave_days?: number
          sick_leave_deduction?: number
          total_deductions?: number | null
          transport_allowance?: number | null
          unpaid_leave_deduction?: number | null
          unpaid_leave_days?: number
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
      hr_service_interruptions: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          exclude_from_service: boolean
          from_date: string
          id: string
          legal_basis: string | null
          notes: string | null
          reason: string
          to_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          exclude_from_service?: boolean
          from_date: string
          id?: string
          legal_basis?: string | null
          notes?: string | null
          reason: string
          to_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          exclude_from_service?: boolean
          from_date?: string
          id?: string
          legal_basis?: string | null
          notes?: string | null
          reason?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_service_interruptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_terminations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clearance_status: Json | null
          contract_id: string | null
          calendar_service_days: number | null
          created_at: string
          created_by: string | null
          employee_id: string
          eos_amount: number | null
          effective_service_days: number | null
          excluded_service_days: number
          id: string
          last_working_day: string
          leave_balance_amount: number | null
          leave_balance_days: number | null
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
          calendar_service_days?: number | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          eos_amount?: number | null
          effective_service_days?: number | null
          excluded_service_days?: number
          id?: string
          last_working_day: string
          leave_balance_amount?: number | null
          leave_balance_days?: number | null
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
          calendar_service_days?: number | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          eos_amount?: number | null
          effective_service_days?: number | null
          excluded_service_days?: number
          id?: string
          last_working_day?: string
          leave_balance_amount?: number | null
          leave_balance_days?: number | null
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
      inventory_issue_consumptions: {
        Row: {
          id: string
          issue_line_id: string
          qty: number
          stock_layer_id: string
          unit_cost: number
        }
        Insert: {
          id?: string
          issue_line_id: string
          qty: number
          stock_layer_id: string
          unit_cost: number
        }
        Update: {
          id?: string
          issue_line_id?: string
          qty?: number
          stock_layer_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issue_consumptions_issue_line_id_fkey"
            columns: ["issue_line_id"]
            isOneToOne: false
            referencedRelation: "inventory_issue_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issue_consumptions_stock_layer_id_fkey"
            columns: ["stock_layer_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_layers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issue_lines: {
        Row: {
          id: string
          issue_id: string
          item_id: string
          line_total: number | null
          qty: number
          unit_cost: number
        }
        Insert: {
          id?: string
          issue_id: string
          item_id: string
          line_total?: number | null
          qty: number
          unit_cost?: number
        }
        Update: {
          id?: string
          issue_id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issue_lines_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inventory_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issue_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issues: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_date: string
          issue_no: string
          issue_type: string
          notes: string | null
          project_id: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          issue_no: string
          issue_type?: string
          notes?: string | null
          project_id?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          issue_no?: string
          issue_type?: string
          notes?: string | null
          project_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          reorder_point: number
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          reorder_point?: number
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          reorder_point?: number
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_receipt_lines: {
        Row: {
          id: string
          item_id: string
          line_total: number | null
          qty: number
          receipt_id: string
          unit_cost: number
        }
        Insert: {
          id?: string
          item_id: string
          line_total?: number | null
          qty: number
          receipt_id: string
          unit_cost: number
        }
        Update: {
          id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          receipt_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          receipt_date: string
          receipt_no: string
          reference: string | null
          source_type: string
          vendor_id: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          receipt_date?: string
          receipt_no: string
          reference?: string | null
          source_type?: string
          vendor_id?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          receipt_date?: string
          receipt_no?: string
          reference?: string | null
          source_type?: string
          vendor_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_layers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          qty_received: number
          qty_remaining: number
          receipt_line_id: string | null
          received_at: string
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          qty_received: number
          qty_remaining: number
          receipt_line_id?: string | null
          received_at?: string
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          qty_received?: number
          qty_remaining?: number
          receipt_line_id?: string | null
          received_at?: string
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_layers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_layers_receipt_line_id_fkey"
            columns: ["receipt_line_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_layers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_warehouses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          notes: string | null
          project_id: string | null
          site_location: string | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          notes?: string | null
          project_id?: string | null
          site_location?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          project_id?: string | null
          site_location?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_warehouses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
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
          tax_category: string | null
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
          tax_category?: string | null
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
          tax_category?: string | null
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
          tax_category: string | null
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
          tax_category?: string | null
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
          tax_category?: string | null
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
      tax_rate_rules: {
        Row: { id: string; tax_type: string; rate: number; effective_from: string; effective_to: string | null; source_note: string; created_by: string | null; created_at: string }
        Insert: { id?: string; tax_type: string; rate: number; effective_from: string; effective_to?: string | null; source_note: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; tax_type?: string; rate?: number; effective_from?: string; effective_to?: string | null; source_note?: string; created_by?: string | null; created_at?: string }
        Relationships: []
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
      vat_return_status_events: {
        Row: { id: string; return_id: string; from_status: string | null; to_status: string; reason: string | null; changed_by: string | null; changed_at: string }
        Insert: { id?: string; return_id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_by?: string | null; changed_at?: string }
        Update: { id?: string; return_id?: string; from_status?: string | null; to_status?: string; reason?: string | null; changed_by?: string | null; changed_at?: string }
        Relationships: []
      }
      vat_return_adjustments: {
        Row: { id: string; return_id: string; direction: string; tax_category: string; net_amount: number; vat_amount: number; reason: string; created_by: string; created_at: string }
        Insert: { id?: string; return_id: string; direction: string; tax_category: string; net_amount: number; vat_amount: number; reason: string; created_by: string; created_at?: string }
        Update: { id?: string; return_id?: string; direction?: string; tax_category?: string; net_amount?: number; vat_amount?: number; reason?: string; created_by?: string; created_at?: string }
        Relationships: []
      }
      vat_return_sources: {
        Row: { id: string; return_id: string; source_type: string; source_id: string; tax_category: string; net_amount: number; vat_amount: number; source_snapshot: Json; created_at: string }
        Insert: { id?: string; return_id: string; source_type: string; source_id: string; tax_category: string; net_amount: number; vat_amount: number; source_snapshot: Json; created_at?: string }
        Update: { id?: string; return_id?: string; source_type?: string; source_id?: string; tax_category?: string; net_amount?: number; vat_amount?: number; source_snapshot?: Json; created_at?: string }
        Relationships: []
      }
      vat_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          calculated_by: string | null
          filed_at: string | null
          filed_by: string | null
          filing_reference: string | null
          source_fingerprint: string | null
          status: string
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
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          filed_at?: string | null
          filed_by?: string | null
          filing_reference?: string | null
          source_fingerprint?: string | null
          status?: string
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
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          filed_at?: string | null
          filed_by?: string | null
          filing_reference?: string | null
          source_fingerprint?: string | null
          status?: string
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
      zakat_account_mappings: {
        Row: { id: string; account_code: string; target_key: string; multiplier: number; is_active: boolean; created_by: string; updated_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; account_code: string; target_key: string; multiplier?: number; is_active?: boolean; created_by: string; updated_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; account_code?: string; target_key?: string; multiplier?: number; is_active?: boolean; created_by?: string; updated_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      zakat_return_status_events: {
        Row: { id: string; return_id: string; from_status: string | null; to_status: string; reason: string | null; changed_by: string | null; changed_at: string }
        Insert: { id?: string; return_id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_by?: string | null; changed_at?: string }
        Update: { id?: string; return_id?: string; from_status?: string | null; to_status?: string; reason?: string | null; changed_by?: string | null; changed_at?: string }
        Relationships: []
      }
      zakat_return_adjustments: {
        Row: { id: string; return_id: string; field_key: string; amount: number; reason: string; created_by: string; created_at: string }
        Insert: { id?: string; return_id: string; field_key: string; amount: number; reason: string; created_by: string; created_at?: string }
        Update: { id?: string; return_id?: string; field_key?: string; amount?: number; reason?: string; created_by?: string; created_at?: string }
        Relationships: []
      }
      zakat_return_sources: {
        Row: { id: string; return_id: string; trial_balance_entry_id: string; target_key: string; multiplier: number; source_snapshot: Json; created_at: string }
        Insert: { id?: string; return_id: string; trial_balance_entry_id: string; target_key: string; multiplier?: number; source_snapshot: Json; created_at?: string }
        Update: { id?: string; return_id?: string; trial_balance_entry_id?: string; target_key?: string; multiplier?: number; source_snapshot?: Json; created_at?: string }
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
          status: string
          source_fingerprint: string | null
          calculated_by: string | null
          calculated_at: string | null
          submitted_by: string | null
          submitted_at: string | null
          submission_reference: string | null
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
          status?: string
          source_fingerprint?: string | null
          calculated_by?: string | null
          calculated_at?: string | null
          submitted_by?: string | null
          submitted_at?: string | null
          submission_reference?: string | null
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
          status?: string
          source_fingerprint?: string | null
          calculated_by?: string | null
          calculated_at?: string | null
          submitted_by?: string | null
          submitted_at?: string | null
          submission_reference?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      inventory_stock_balance: {
        Row: {
          avg_cost: number | null
          item_id: string | null
          qty_on_hand: number | null
          total_value: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_layers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_layers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      vat_file_return: { Args: { _return_id: string; _reference: string }; Returns: Database["public"]["Tables"]["vat_returns"]["Row"] }
      vat_reopen_return: { Args: { _return_id: string; _reason: string }; Returns: Database["public"]["Tables"]["vat_returns"]["Row"] }
      zakat_reopen_return: { Args: { _return_id: string; _reason: string }; Returns: Database["public"]["Tables"]["zakat_returns"]["Row"] }
      zakat_save_account_mappings: { Args: { _mappings: Json }; Returns: number }
      zakat_submit_return: { Args: { _return_id: string; _reference: string }; Returns: Database["public"]["Tables"]["zakat_returns"]["Row"] }
      zakat_source_fingerprint: { Args: { _return_id: string }; Returns: string }
      zakat_calculate_return_mapped: { Args: { _year_from: string; _year_to: string; _sources?: Json; _manual_adjustments?: Json; _form_data?: Json; _zakat_rate?: number; _income_tax_rate?: number }; Returns: Database["public"]["Tables"]["zakat_returns"]["Row"] }
      zakat_approve_return: { Args: { _return_id: string }; Returns: Database["public"]["Tables"]["zakat_returns"]["Row"] }
      zakat_calculate_return_flexible: { Args: { _year_from: string; _year_to: string; _sources?: Json; _manual_data?: Json; _zakat_rate?: number; _income_tax_rate?: number }; Returns: Database["public"]["Tables"]["zakat_returns"]["Row"] }
      vat_return_stored_fingerprint: { Args: { _return_id: string }; Returns: string }
      vat_calculate_return_flexible: { Args: { _period_from: string; _period_to: string; _sales_ids: string[]; _purchase_ids: string[]; _manual_adjustments?: Json; _carried_forward?: number; _header?: Json }; Returns: Database["public"]["Tables"]["vat_returns"]["Row"] }
      vat_source_fingerprint: { Args: { _from: string; _to: string }; Returns: string }
      vat_calculate_return: { Args: { _period_from: string; _period_to: string; _carried_forward?: number; _header?: Json }; Returns: Database["public"]["Tables"]["vat_returns"]["Row"] }
      vat_approve_return: { Args: { _return_id: string }; Returns: Database["public"]["Tables"]["vat_returns"]["Row"] }
      hr_attendance_register_device: { Args: { _device_code: string; _name_ar: string; _site_id: string | null; _vendor?: string | null }; Returns: Json }
      hr_attendance_rotate_device_token: { Args: { _device_id: string }; Returns: Json }
      hr_attendance_authenticate_device: { Args: { _device_code: string; _token: string }; Returns: boolean }
      hr_attendance_scan_anomalies: { Args: { _from?: string; _to?: string }; Returns: number }
      hr_attendance_resolve_anomaly: { Args: { _anomaly_id: string; _dismiss: boolean; _notes: string }; Returns: Database["public"]["Tables"]["hr_attendance_anomalies"]["Row"] }
      hr_attendance_run_maintenance: { Args: { _work_date?: string }; Returns: Json }
      hr_attendance_period_is_closed: { Args: { _work_date: string }; Returns: boolean }
      hr_attendance_close_period: { Args: { _year: number; _month: number }; Returns: Database["public"]["Tables"]["hr_attendance_periods"]["Row"] }
      hr_attendance_reopen_period: { Args: { _period_id: string; _reason: string }; Returns: Database["public"]["Tables"]["hr_attendance_periods"]["Row"] }
      hr_attendance_request_correction: { Args: { _attendance_day_id: string; _requested_check_in: string | null; _requested_check_out: string | null; _reason: string }; Returns: Database["public"]["Tables"]["hr_attendance_correction_requests"]["Row"] }
      hr_attendance_decide_correction: { Args: { _request_id: string; _approved: boolean; _decision_notes?: string }; Returns: Database["public"]["Tables"]["hr_attendance_correction_requests"]["Row"] }
      hr_attendance_refresh_days: { Args: { _date_from: string; _date_to: string; _employee_id?: string }; Returns: number }
      hr_attendance_decide_day: { Args: { _day_id: string; _approved: boolean; _notes?: string }; Returns: Database["public"]["Tables"]["hr_attendance_days"]["Row"] }
      hr_apply_attendance_to_payroll: { Args: { _run_id: string }; Returns: number }
      hr_attendance_mobile_punch: {
        Args: {
          _event_type: string;
          _site_id: string;
          _latitude: number;
          _longitude: number;
          _accuracy_meters?: number;
        };
        Returns: Database["public"]["Tables"]["hr_attendance_events"]["Row"];
      };
      hr_attendance_biometric_ingest: {
        Args: {
          _device_code: string;
          _employee_no: string;
          _event_type: string;
          _occurred_at: string;
          _external_event_id: string;
        };
        Returns: Database["public"]["Tables"]["hr_attendance_events"]["Row"];
      };
      hr_distance_meters: {
        Args: { _lat1: number; _lng1: number; _lat2: number; _lng2: number };
        Returns: number;
      };
      calc_customer_balance: { Args: { _customer_id: string }; Returns: number }
      calc_vendor_balance: { Args: { _vendor_id: string }; Returns: number }
      can_delete_master: { Args: { _user_id: string }; Returns: boolean }
      can_read_business: { Args: { _user_id: string }; Returns: boolean }
      can_read_fleet: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      can_read_inventory: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      can_read_sensitive_finance: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_write_finance: { Args: { _user_id: string }; Returns: boolean }
      can_write_fleet: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      can_write_inventory: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
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
      current_job_title_id: { Args: never; Returns: string }
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
      hr_calculate_service_period: {
        Args: { _as_of?: string; _employee_id: string }
        Returns: Json
      }
      hr_leave_decide: {
        Args: { _approved: boolean; _leave_id: string }
        Returns: Database["public"]["Tables"]["hr_leaves"]["Row"]
      }
      hr_leave_rule: {
        Args: { _as_of?: string; _leave_type: string }
        Returns: Database["public"]["Tables"]["hr_leave_rules"]["Row"]
      }
      hr_payroll_create_run: {
        Args: { _period_month: number; _period_year: number }
        Returns: Database["public"]["Tables"]["hr_payroll_runs"]["Row"]
      }
      hr_sick_leave_pay_breakdown: {
        Args: {
          _daily_wage: number
          _employee_id: string
          _period_from: string
          _period_to: string
        }
        Returns: Json
      }
      hr_termination_create_draft: {
        Args: { _input: Json }
        Returns: Database["public"]["Tables"]["hr_terminations"]["Row"]
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
      hr_leave_accrued_for_settlement: {
        Args: { _as_of?: string; _employee_id: string }
        Returns: number
      }
      hr_leave_balance_report: {
        Args: { _leave_type?: string; _year?: number }
        Returns: {
          department_id: string
          employee_id: string
          employee_no: string
          entitled: number
          full_name_ar: string
          pending: number
          remaining: number
          used: number
        }[]
      }
      hr_payroll_mark_paid: {
        Args: { _run_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "hr_payroll_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_approve: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_cancel: {
        Args: { _reason?: string; _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_clearance: {
        Args: { _employee_id: string }
        Returns: Json
      }
      hr_termination_mark_paid: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_refresh_components: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_reject: {
        Args: { _reason?: string; _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_restore: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_revert_approval: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_revert_disbursement: {
        Args: { _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_termination_undo_approval: {
        Args: { _target_status: string; _termination_id: string }
        Returns: {
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
          leave_balance_days: number | null
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
        SetofOptions: {
          from: "*"
          to: "hr_terminations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      inventory_issue_line_fifo: {
        Args: { _issue_id: string; _item_id: string; _qty: number }
        Returns: {
          id: string
          issue_id: string
          item_id: string
          line_total: number | null
          qty: number
          unit_cost: number
        }
        SetofOptions: {
          from: "*"
          to: "inventory_issue_lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_task_participant: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      mark_overdue_tasks: { Args: never; Returns: number }
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
      fleet_maintenance_type:
        | "preventive"
        | "repair"
        | "oil_change"
        | "tires"
        | "inspection"
        | "other"
      fleet_trip_status: "planned" | "in_progress" | "completed" | "cancelled"
      fleet_vehicle_status:
        | "active"
        | "maintenance"
        | "idle"
        | "sold"
        | "out_of_service"
      fleet_vehicle_type:
        | "truck"
        | "trailer"
        | "pickup"
        | "car"
        | "van"
        | "equipment"
        | "other"
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
        | "marriage"
        | "bereavement"
        | "sibling_bereavement"
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
        | "probation"
        | "arbitrary_dismissal"
        | "unlawful_resignation"
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
      fleet_maintenance_type: [
        "preventive",
        "repair",
        "oil_change",
        "tires",
        "inspection",
        "other",
      ],
      fleet_trip_status: ["planned", "in_progress", "completed", "cancelled"],
      fleet_vehicle_status: [
        "active",
        "maintenance",
        "idle",
        "sold",
        "out_of_service",
      ],
      fleet_vehicle_type: [
        "truck",
        "trailer",
        "pickup",
        "car",
        "van",
        "equipment",
        "other",
      ],
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
        "marriage",
        "bereavement",
        "sibling_bereavement",
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
        "probation",
        "arbitrary_dismissal",
        "unlawful_resignation",
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
