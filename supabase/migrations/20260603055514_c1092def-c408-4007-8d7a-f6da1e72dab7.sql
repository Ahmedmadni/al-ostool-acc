
-- ============================================================
-- PHASE 2C: ENTERPRISE DATA FOUNDATION
-- ============================================================

-- ---------- CHART OF ACCOUNTS ----------
DO $$ BEGIN
  CREATE TYPE public.account_category AS ENUM (
    'assets','liabilities','equity','revenue',
    'cost_of_revenue','operating_expenses','other_income','other_expenses'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('header','detail');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  account_type public.account_type NOT NULL DEFAULT 'detail',
  category public.account_category NOT NULL,
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  level int NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY coa_read ON public.chart_of_accounts FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY coa_write ON public.chart_of_accounts FOR ALL TO authenticated USING (can_write_finance(auth.uid())) WITH CHECK (can_write_finance(auth.uid()));

-- Link trial balance
ALTER TABLE public.trial_balance_entries ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

-- ---------- COMPANIES ----------
DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('parent','subsidiary','branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  company_type public.company_type NOT NULL DEFAULT 'parent',
  parent_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  commercial_register text,
  tax_number text,
  currency text DEFAULT 'SAR',
  fiscal_year_start text DEFAULT '01-01',
  address text,
  city text,
  country text DEFAULT 'المملكة العربية السعودية',
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_read ON public.companies FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY companies_write ON public.companies FOR ALL TO authenticated USING (can_delete_master(auth.uid())) WITH CHECK (can_delete_master(auth.uid()));

-- ---------- COMPANY SETTINGS ----------
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text,
  default_currency text DEFAULT 'SAR',
  fiscal_year_start text DEFAULT '01-01',
  language text DEFAULT 'ar',
  timezone text DEFAULT 'Asia/Riyadh',
  date_format text DEFAULT 'DD/MM/YYYY',
  number_format text DEFAULT 'ar-SA',
  settings jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_read ON public.company_settings FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY cs_write ON public.company_settings FOR ALL TO authenticated USING (can_delete_master(auth.uid())) WITH CHECK (can_delete_master(auth.uid()));

-- ---------- DEPARTMENTS ----------
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  manager text,
  parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dept_read ON public.departments FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY dept_write ON public.departments FOR ALL TO authenticated USING (can_write_operations(auth.uid())) WITH CHECK (can_write_operations(auth.uid()));

-- ---------- EMPLOYEES ----------
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  full_name_en text,
  nationality text,
  national_id text,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  hire_date date,
  termination_date date,
  email text,
  phone text,
  user_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY emp_read ON public.employees FOR SELECT TO authenticated USING (user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant','auditor']));
CREATE POLICY emp_write ON public.employees FOR ALL TO authenticated USING (user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant'])) WITH CHECK (user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant']));

-- ---------- CONTRACTS ----------
DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('draft','active','suspended','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  contract_value numeric DEFAULT 0,
  retention_pct numeric DEFAULT 0,
  retention_amount numeric DEFAULT 0,
  start_date date,
  end_date date,
  signed_date date,
  status public.contract_status DEFAULT 'draft',
  currency text DEFAULT 'SAR',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_read ON public.contracts FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY contracts_write ON public.contracts FOR ALL TO authenticated USING (can_write_operations(auth.uid())) WITH CHECK (can_write_operations(auth.uid()));

CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number text NOT NULL,
  amendment_date date,
  value_change numeric DEFAULT 0,
  new_end_date date,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_amendments TO authenticated;
GRANT ALL ON public.contract_amendments TO service_role;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ca_read ON public.contract_amendments FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY ca_write ON public.contract_amendments FOR ALL TO authenticated USING (can_write_operations(auth.uid())) WITH CHECK (can_write_operations(auth.uid()));

-- ---------- CURRENCIES ----------
CREATE TABLE IF NOT EXISTS public.currencies (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text,
  symbol text,
  decimals int DEFAULT 2,
  is_base boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY cur_read ON public.currencies FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY cur_write ON public.currencies FOR ALL TO authenticated USING (can_write_finance(auth.uid())) WITH CHECK (can_write_finance(auth.uid()));

INSERT INTO public.currencies (code, name_ar, name_en, symbol, is_base) VALUES
  ('SAR','ريال سعودي','Saudi Riyal','﷼', true),
  ('USD','دولار أمريكي','US Dollar','$', false),
  ('EUR','يورو','Euro','€', false),
  ('AED','درهم إماراتي','UAE Dirham','د.إ', false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL REFERENCES public.currencies(code),
  to_currency text NOT NULL REFERENCES public.currencies(code),
  rate numeric NOT NULL,
  rate_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_currency, to_currency, rate_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY er_read ON public.exchange_rates FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY er_write ON public.exchange_rates FOR ALL TO authenticated USING (can_write_finance(auth.uid())) WITH CHECK (can_write_finance(auth.uid()));

-- ---------- PROCUREMENT FOUNDATION ----------
CREATE TABLE IF NOT EXISTS public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_title text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contacts TO authenticated;
GRANT ALL ON public.vendor_contacts TO service_role;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY vc_read ON public.vendor_contacts FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY vc_write ON public.vendor_contacts FOR ALL TO authenticated USING (can_write_operations(auth.uid())) WITH CHECK (can_write_operations(auth.uid()));

DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft','approved','partial','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  order_date date DEFAULT CURRENT_DATE,
  expected_date date,
  amount numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  status public.po_status DEFAULT 'draft',
  currency text DEFAULT 'SAR',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_read ON public.purchase_orders FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY po_write ON public.purchase_orders FOR ALL TO authenticated USING (can_write_operations(auth.uid())) WITH CHECK (can_write_operations(auth.uid()));

DO $$ BEGIN
  CREATE TYPE public.purchase_invoice_status AS ENUM ('draft','received','due','overdue','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  issue_date date,
  due_date date,
  amount numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  status public.purchase_invoice_status DEFAULT 'draft',
  currency text DEFAULT 'SAR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY pi_read ON public.purchase_invoices FOR SELECT TO authenticated USING (can_read_business(auth.uid()));
CREATE POLICY pi_write ON public.purchase_invoices FOR ALL TO authenticated USING (can_write_finance(auth.uid())) WITH CHECK (can_write_finance(auth.uid()));

-- Extend payments table for vendor payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS direction text DEFAULT 'in';

-- ---------- COST RELATIONSHIPS ----------
ALTER TABLE public.cost_entries     ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.cost_entries     ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.hr_costs         ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.hr_costs         ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.hr_costs         ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.equipment_costs  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.equipment_costs  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_assets     ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_assets     ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- ---------- AUTOMATION: customer totals ----------
CREATE OR REPLACE FUNCTION public.recalc_customer_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;
BEGIN
  cid := COALESCE(NEW.customer_id, OLD.customer_id);
  IF cid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.customers c SET
    total_invoiced  = COALESCE((SELECT SUM(total_amount) FROM public.invoices WHERE customer_id = cid), 0),
    total_collected = COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = cid AND COALESCE(direction,'in') = 'in'), 0),
    total_outstanding = COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount,0)) FROM public.invoices WHERE customer_id = cid), 0),
    updated_at = now()
  WHERE c.id = cid;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_inv_cust_totals ON public.invoices;
CREATE TRIGGER trg_inv_cust_totals
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.recalc_customer_totals();

DROP TRIGGER IF EXISTS trg_pay_cust_totals ON public.payments;
CREATE TRIGGER trg_pay_cust_totals
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_customer_totals();

-- ---------- AUTOMATION: vendor totals ----------
CREATE OR REPLACE FUNCTION public.recalc_vendor_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vid uuid;
BEGIN
  vid := COALESCE(NEW.vendor_id, OLD.vendor_id);
  IF vid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.vendors v SET
    total_purchased = COALESCE((SELECT SUM(total_amount) FROM public.purchase_invoices WHERE vendor_id = vid), 0),
    total_paid      = COALESCE((SELECT SUM(amount) FROM public.payments WHERE vendor_id = vid AND COALESCE(direction,'in') = 'out'), 0),
    current_balance = COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount,0)) FROM public.purchase_invoices WHERE vendor_id = vid), 0),
    total_outstanding = COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount,0)) FROM public.purchase_invoices WHERE vendor_id = vid), 0),
    updated_at = now()
  WHERE v.id = vid;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_pi_vend_totals ON public.purchase_invoices;
CREATE TRIGGER trg_pi_vend_totals
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_totals();

DROP TRIGGER IF EXISTS trg_pay_vend_totals ON public.payments;
CREATE TRIGGER trg_pay_vend_totals
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_totals();

-- ---------- AUDIT LOGGING ----------
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid text;
BEGIN
  eid := COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)::text, '');
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    eid,
    jsonb_build_object(
      'old', CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'new', CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','vendors','projects','contracts','invoices','payments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t, t);
  END LOOP;
END $$;

-- ---------- PERFORMANCE INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_customers_code         ON public.customers(code);
CREATE INDEX IF NOT EXISTS idx_vendors_code           ON public.vendors(code);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date      ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer      ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project       ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer      ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor        ON public.payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice       ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_period    ON public.cost_entries(period);
CREATE INDEX IF NOT EXISTS idx_cost_entries_project   ON public.cost_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_costs_project       ON public.hr_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_costs_period        ON public.hr_costs(period);
CREATE INDEX IF NOT EXISTS idx_equipment_project      ON public.equipment_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_project   ON public.fixed_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer      ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project      ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer     ON public.contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_amendments_contract    ON public.contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor              ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pi_vendor              ON public.purchase_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pi_status              ON public.purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pi_due_date            ON public.purchase_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_tb_account             ON public.trial_balance_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_tb_period              ON public.trial_balance_entries(period);
CREATE INDEX IF NOT EXISTS idx_coa_parent             ON public.chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_category           ON public.chart_of_accounts(category);
CREATE INDEX IF NOT EXISTS idx_employees_dept         ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity           ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created          ON public.audit_logs(created_at DESC);

-- ---------- TIMESTAMPS ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['chart_of_accounts','companies','departments','employees','contracts','purchase_orders','purchase_invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_upd_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_upd_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_timestamp()', t, t);
  END LOOP;
END $$;
