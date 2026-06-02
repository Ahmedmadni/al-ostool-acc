
-- Customer balances imported from accounting trial balance
CREATE TABLE public.customer_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  account_code text NOT NULL,
  account_name text NOT NULL,
  opening_debit numeric DEFAULT 0,
  opening_credit numeric DEFAULT 0,
  period_debit numeric DEFAULT 0,
  period_credit numeric DEFAULT 0,
  closing_debit numeric DEFAULT 0,
  closing_credit numeric DEFAULT 0,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_balances TO authenticated;
GRANT ALL ON public.customer_balances TO service_role;
ALTER TABLE public.customer_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customer_balances" ON public.customer_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cust_bal_period ON public.customer_balances(period);

-- Supplier balances
CREATE TABLE public.supplier_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  account_code text NOT NULL,
  account_name text NOT NULL,
  opening_debit numeric DEFAULT 0,
  opening_credit numeric DEFAULT 0,
  period_debit numeric DEFAULT 0,
  period_credit numeric DEFAULT 0,
  closing_debit numeric DEFAULT 0,
  closing_credit numeric DEFAULT 0,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_balances TO authenticated;
GRANT ALL ON public.supplier_balances TO service_role;
ALTER TABLE public.supplier_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all supplier_balances" ON public.supplier_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Aging buckets (10 brackets)
CREATE TABLE public.aging_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  customer_code text NOT NULL,
  customer_name text NOT NULL,
  current_amt numeric DEFAULT 0,
  days_30 numeric DEFAULT 0,
  days_60 numeric DEFAULT 0,
  days_90 numeric DEFAULT 0,
  days_120 numeric DEFAULT 0,
  days_150 numeric DEFAULT 0,
  days_180 numeric DEFAULT 0,
  days_270 numeric DEFAULT 0,
  days_360 numeric DEFAULT 0,
  days_over_360 numeric DEFAULT 0,
  total_outstanding numeric DEFAULT 0,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aging_buckets TO authenticated;
GRANT ALL ON public.aging_buckets TO service_role;
ALTER TABLE public.aging_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all aging_buckets" ON public.aging_buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fixed assets
CREATE TABLE public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text,
  asset_name text NOT NULL,
  category text,
  purchase_date date,
  cost numeric DEFAULT 0,
  accumulated_depreciation numeric DEFAULT 0,
  net_book_value numeric DEFAULT 0,
  useful_life_years numeric DEFAULT 0,
  annual_depreciation numeric DEFAULT 0,
  project text,
  department text,
  status text DEFAULT 'active',
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all fixed_assets" ON public.fixed_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bank statements
CREATE TABLE public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_number text,
  txn_date date NOT NULL,
  description text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  balance numeric DEFAULT 0,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statements TO authenticated;
GRANT ALL ON public.bank_statements TO service_role;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all bank_statements" ON public.bank_statements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_bank_date ON public.bank_statements(txn_date);

-- Cost entries (unified cost intelligence)
CREATE TABLE public.cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- hr, equipment, insurance, tickets, accommodation, medical, eos, depreciation
  description text,
  project text,
  company text,
  department text,
  section text,
  period text,
  amount numeric DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_entries TO authenticated;
GRANT ALL ON public.cost_entries TO service_role;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cost_entries" ON public.cost_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cost_cat ON public.cost_entries(category);
CREATE INDEX idx_cost_project ON public.cost_entries(project);

-- HR costs (detailed)
CREATE TABLE public.hr_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text,
  employee_name text,
  nationality text,
  job_title text,
  department text,
  project text,
  period text,
  salary numeric DEFAULT 0,
  housing numeric DEFAULT 0,
  food numeric DEFAULT 0,
  tickets numeric DEFAULT 0,
  medical numeric DEFAULT 0,
  gosi numeric DEFAULT 0,
  eos numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_costs TO authenticated;
GRANT ALL ON public.hr_costs TO service_role;
ALTER TABLE public.hr_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all hr_costs" ON public.hr_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Equipment costs (detailed)
CREATE TABLE public.equipment_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_code text,
  equipment_name text,
  equipment_type text,
  project text,
  department text,
  period text,
  purchase_cost numeric DEFAULT 0,
  depreciation numeric DEFAULT 0,
  insurance numeric DEFAULT 0,
  operating_cost numeric DEFAULT 0,
  maintenance numeric DEFAULT 0,
  fuel numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_costs TO authenticated;
GRANT ALL ON public.equipment_costs TO service_role;
ALTER TABLE public.equipment_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all equipment_costs" ON public.equipment_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
