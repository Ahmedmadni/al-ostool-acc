
-- Phase 3.1: Smart Import Center foundation

-- 1) Import templates: reusable column mappings per source type
CREATE TABLE public.import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL, -- trial_balance | customer_balances | vendor_balances | aging | bank_statements | cost_report | project_report | asset_report | equipment_report | payroll | budget
  description text,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb, -- { systemField: excelHeader }
  options jsonb NOT NULL DEFAULT '{}'::jsonb, -- { skipRows, sheet, dateFormat, ... }
  is_shared boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_templates TO authenticated;
GRANT ALL ON public.import_templates TO service_role;
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_read" ON public.import_templates FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "templates_write" ON public.import_templates FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "templates_update" ON public.import_templates FOR UPDATE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE POLICY "templates_delete" ON public.import_templates FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE INDEX idx_import_templates_type ON public.import_templates(source_type);

-- 2) Import batches: each upload session
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  file_name text,
  file_size bigint,
  template_id uuid REFERENCES public.import_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | validating | ready | importing | completed | failed | partial
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  ai_detection jsonb, -- { detectedType, confidence, suggestedMapping, notes }
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  period text, -- e.g. "2026-05"
  notes text,
  created_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches_read" ON public.import_batches FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "batches_write" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "batches_update" ON public.import_batches FOR UPDATE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE POLICY "batches_delete" ON public.import_batches FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE INDEX idx_import_batches_type ON public.import_batches(source_type);
CREATE INDEX idx_import_batches_status ON public.import_batches(status);
CREATE INDEX idx_import_batches_created ON public.import_batches(created_at DESC);

-- 3) Import errors per batch
CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number integer,
  severity text NOT NULL DEFAULT 'error', -- error | warning | info
  error_type text NOT NULL, -- missing | duplicate | invalid_format | inconsistency | reference_not_found
  field text,
  message text NOT NULL,
  row_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.import_errors TO authenticated;
GRANT ALL ON public.import_errors TO service_role;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "errors_read" ON public.import_errors FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "errors_write" ON public.import_errors FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "errors_delete" ON public.import_errors FOR DELETE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE INDEX idx_import_errors_batch ON public.import_errors(batch_id);

-- 4) Budgets + budget lines (for variance analysis later)
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  period_type text NOT NULL DEFAULT 'annual', -- annual | quarterly | monthly
  status text NOT NULL DEFAULT 'draft', -- draft | approved | closed
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_read" ON public.budgets FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "budgets_write" ON public.budgets FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE INDEX idx_budgets_year ON public.budgets(fiscal_year);

CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  category text, -- labor | equipment | materials | g_and_a | revenue | other
  period text, -- e.g. "2026-Q1" or "2026-05"
  amount numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT ALL ON public.budget_lines TO service_role;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blines_read" ON public.budget_lines FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "blines_write" ON public.budget_lines FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY "blines_update" ON public.budget_lines FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY "blines_delete" ON public.budget_lines FOR DELETE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE INDEX idx_blines_budget ON public.budget_lines(budget_id);
CREATE INDEX idx_blines_project ON public.budget_lines(project_id);
CREATE INDEX idx_blines_account ON public.budget_lines(account_id);
CREATE INDEX idx_blines_period ON public.budget_lines(period);

-- 5) Payroll imports (lightweight summary table for HR imports from payroll systems)
CREATE TABLE public.payroll_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  employee_code text,
  employee_name text,
  department text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  overtime numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  gosi numeric(14,2) NOT NULL DEFAULT 0,
  net_pay numeric(14,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_imports TO authenticated;
GRANT ALL ON public.payroll_imports TO service_role;
ALTER TABLE public.payroll_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_read" ON public.payroll_imports FOR SELECT TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant','auditor']));
CREATE POLICY "payroll_write" ON public.payroll_imports FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY "payroll_update" ON public.payroll_imports FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY "payroll_delete" ON public.payroll_imports FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE INDEX idx_payroll_period ON public.payroll_imports(period);
CREATE INDEX idx_payroll_project ON public.payroll_imports(project_id);
CREATE INDEX idx_payroll_batch ON public.payroll_imports(batch_id);

-- Timestamps
CREATE TRIGGER trg_import_templates_ts BEFORE UPDATE ON public.import_templates FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_import_batches_ts BEFORE UPDATE ON public.import_batches FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_budgets_ts BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
