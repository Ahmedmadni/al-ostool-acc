
-- ENUMS
CREATE TYPE public.hr_employee_status AS ENUM ('active','on_leave','suspended','terminated');
CREATE TYPE public.hr_contract_type AS ENUM ('fixed_term','unlimited','part_time','temporary','training');
CREATE TYPE public.hr_contract_status AS ENUM ('active','expiring_soon','expired','cancelled','draft');
CREATE TYPE public.hr_document_type AS ENUM ('national_id','iqama','passport','contract','certificate','license','driving_license','other');
CREATE TYPE public.hr_request_type AS ENUM ('hiring','promotion','salary_increase','transfer','secondment','leave','return_from_leave','resignation','termination','warning','violation','loan','asset_assignment','asset_return','other');
CREATE TYPE public.hr_request_status AS ENUM ('draft','pending','in_progress','approved','rejected','cancelled','completed');
CREATE TYPE public.hr_leave_type AS ENUM ('annual','sick','emergency','unpaid','compensatory','maternity','paternity','hajj','study','other');
CREATE TYPE public.hr_leave_status AS ENUM ('pending','approved','rejected','cancelled','taken');
CREATE TYPE public.hr_asset_type AS ENUM ('vehicle','laptop','mobile','equipment','tool','card','key','uniform','other');
CREATE TYPE public.hr_payroll_status AS ENUM ('draft','pending_approval','approved','paid','cancelled');
CREATE TYPE public.hr_termination_reason AS ENUM ('resignation','end_of_contract','dismissal','mutual_agreement','retirement','death','other');

-- EMPLOYEES
CREATE TABLE public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no TEXT UNIQUE NOT NULL,
  full_name_ar TEXT NOT NULL,
  full_name_en TEXT,
  nationality TEXT,
  is_saudi BOOLEAN NOT NULL DEFAULT FALSE,
  national_id TEXT,
  iqama_number TEXT,
  iqama_expiry DATE,
  passport_number TEXT,
  passport_expiry DATE,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female')),
  marital_status TEXT,
  dependents_count INT DEFAULT 0,
  personal_email TEXT,
  personal_phone TEXT,
  address TEXT,
  photo_url TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  job_title_id UUID REFERENCES public.job_titles(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  hire_date DATE,
  status public.hr_employee_status NOT NULL DEFAULT 'active',
  basic_salary NUMERIC(14,2) DEFAULT 0,
  housing_allowance NUMERIC(14,2) DEFAULT 0,
  transport_allowance NUMERIC(14,2) DEFAULT 0,
  other_allowances NUMERIC(14,2) DEFAULT 0,
  gross_salary NUMERIC(14,2) GENERATED ALWAYS AS (COALESCE(basic_salary,0)+COALESCE(housing_allowance,0)+COALESCE(transport_allowance,0)+COALESCE(other_allowances,0)) STORED,
  gosi_subscription NUMERIC(14,2) DEFAULT 0,
  bank_name TEXT,
  bank_iban TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_employees_dept ON public.hr_employees(department_id);
CREATE INDEX idx_hr_employees_manager ON public.hr_employees(manager_id);
CREATE INDEX idx_hr_employees_status ON public.hr_employees(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employees TO authenticated;
GRANT ALL ON public.hr_employees TO service_role;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employees_read" ON public.hr_employees FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.employees','view') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_employees_insert" ON public.hr_employees FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'hr.employees','create') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_employees_update" ON public.hr_employees FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'hr.employees','edit') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_employees_delete" ON public.hr_employees FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'hr.employees','delete') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_employees_updated BEFORE UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- DOCUMENTS
CREATE TABLE public.hr_employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  doc_type public.hr_document_type NOT NULL,
  doc_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_path TEXT,
  file_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_docs_emp ON public.hr_employee_documents(employee_id);
CREATE INDEX idx_hr_docs_expiry ON public.hr_employee_documents(expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_documents TO authenticated;
GRANT ALL ON public.hr_employee_documents TO service_role;
ALTER TABLE public.hr_employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_docs_all" ON public.hr_employee_documents FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.employees','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.employees','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_docs_updated BEFORE UPDATE ON public.hr_employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- CONTRACTS
CREATE TABLE public.hr_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no TEXT UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  contract_type public.hr_contract_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  probation_months INT DEFAULT 3,
  notice_period_days INT DEFAULT 60,
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  housing_allowance NUMERIC(14,2) DEFAULT 0,
  transport_allowance NUMERIC(14,2) DEFAULT 0,
  other_allowances NUMERIC(14,2) DEFAULT 0,
  working_hours_per_week INT DEFAULT 48,
  annual_leave_days INT DEFAULT 21,
  work_location TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status public.hr_contract_status NOT NULL DEFAULT 'active',
  file_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_contracts_emp ON public.hr_contracts(employee_id);
CREATE INDEX idx_hr_contracts_end ON public.hr_contracts(end_date);
CREATE INDEX idx_hr_contracts_status ON public.hr_contracts(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_contracts TO authenticated;
GRANT ALL ON public.hr_contracts TO service_role;
ALTER TABLE public.hr_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_contracts_all" ON public.hr_contracts FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.contracts','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.contracts','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_contracts_updated BEFORE UPDATE ON public.hr_contracts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- CONTRACT AMENDMENTS
CREATE TABLE public.hr_contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.hr_contracts(id) ON DELETE CASCADE,
  amendment_no TEXT,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amendment_type TEXT,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  file_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_amend_contract ON public.hr_contract_amendments(contract_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_contract_amendments TO authenticated;
GRANT ALL ON public.hr_contract_amendments TO service_role;
ALTER TABLE public.hr_contract_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_amend_all" ON public.hr_contract_amendments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.contracts','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.contracts','edit') OR public.is_admin(auth.uid()));

-- WORKFLOW REQUESTS
CREATE TABLE public.hr_workflow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT UNIQUE NOT NULL,
  request_type public.hr_request_type NOT NULL,
  requested_by UUID REFERENCES auth.users(id),
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  subject TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  status public.hr_request_status NOT NULL DEFAULT 'draft',
  current_step INT DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_wf_emp ON public.hr_workflow_requests(employee_id);
CREATE INDEX idx_hr_wf_status ON public.hr_workflow_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_requests TO authenticated;
GRANT ALL ON public.hr_workflow_requests TO service_role;
ALTER TABLE public.hr_workflow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_wf_read" ON public.hr_workflow_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','view') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_wf_insert" ON public.hr_workflow_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hr_wf_update" ON public.hr_workflow_requests FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','edit') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_wf_delete" ON public.hr_workflow_requests FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'hr.workflow','delete') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_wf_updated BEFORE UPDATE ON public.hr_workflow_requests FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- WORKFLOW STEPS
CREATE TABLE public.hr_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.hr_workflow_requests(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  approver_id UUID REFERENCES auth.users(id),
  approver_role TEXT,
  action TEXT CHECK (action IN ('pending','approved','rejected','skipped','returned')),
  comment TEXT,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_wf_steps_req ON public.hr_workflow_steps(request_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_steps TO authenticated;
GRANT ALL ON public.hr_workflow_steps TO service_role;
ALTER TABLE public.hr_workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_wf_steps_read" ON public.hr_workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_workflow_requests r WHERE r.id = request_id AND (r.requested_by = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','view') OR public.is_admin(auth.uid()))));
CREATE POLICY "hr_wf_steps_write" ON public.hr_workflow_steps FOR ALL TO authenticated
  USING (approver_id = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','approve') OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() IS NOT NULL);

-- LEAVES
CREATE TABLE public.hr_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type public.hr_leave_type NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count NUMERIC(6,2) NOT NULL,
  status public.hr_leave_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  attachment_url TEXT,
  request_id UUID REFERENCES public.hr_workflow_requests(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_leaves_emp ON public.hr_leaves(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leaves TO authenticated;
GRANT ALL ON public.hr_leaves TO service_role;
ALTER TABLE public.hr_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leaves_all" ON public.hr_leaves FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.leaves','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.leaves','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_leaves_updated BEFORE UPDATE ON public.hr_leaves FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- LEAVE BALANCES
CREATE TABLE public.hr_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type public.hr_leave_type NOT NULL,
  year INT NOT NULL,
  entitled_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  balance_days NUMERIC(6,2) GENERATED ALWAYS AS (COALESCE(entitled_days,0) - COALESCE(used_days,0)) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_balances TO authenticated;
GRANT ALL ON public.hr_leave_balances TO service_role;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_lb_all" ON public.hr_leave_balances FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.leaves','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.leaves','edit') OR public.is_admin(auth.uid()));

-- LOANS
CREATE TABLE public.hr_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_no TEXT UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  installments_count INT NOT NULL DEFAULT 1,
  monthly_deduction NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  remaining_amount NUMERIC(14,2) GENERATED ALWAYS AS (COALESCE(amount,0) - COALESCE(paid_amount,0)) STORED,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_loans_emp ON public.hr_loans(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_loans TO authenticated;
GRANT ALL ON public.hr_loans TO service_role;
ALTER TABLE public.hr_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_loans_all" ON public.hr_loans FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.loans','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.loans','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_loans_updated BEFORE UPDATE ON public.hr_loans FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TABLE public.hr_loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.hr_loans(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  payroll_line_id UUID
);
CREATE INDEX idx_hr_loan_inst_loan ON public.hr_loan_installments(loan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_loan_installments TO authenticated;
GRANT ALL ON public.hr_loan_installments TO service_role;
ALTER TABLE public.hr_loan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_loan_inst_all" ON public.hr_loan_installments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.loans','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.loans','edit') OR public.is_admin(auth.uid()));

-- ASSETS
CREATE TABLE public.hr_assets_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  asset_type public.hr_asset_type NOT NULL,
  asset_name TEXT NOT NULL,
  serial_no TEXT,
  value NUMERIC(14,2) DEFAULT 0,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_date DATE,
  is_returned BOOLEAN NOT NULL DEFAULT FALSE,
  condition_notes TEXT,
  file_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_assets_emp ON public.hr_assets_assignment(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_assets_assignment TO authenticated;
GRANT ALL ON public.hr_assets_assignment TO service_role;
ALTER TABLE public.hr_assets_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_assets_all" ON public.hr_assets_assignment FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.assets','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.assets','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_assets_updated BEFORE UPDATE ON public.hr_assets_assignment FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- PAYROLL
CREATE TABLE public.hr_payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no TEXT UNIQUE NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status public.hr_payroll_status NOT NULL DEFAULT 'draft',
  employees_count INT DEFAULT 0,
  total_gross NUMERIC(16,2) DEFAULT 0,
  total_deductions NUMERIC(16,2) DEFAULT 0,
  total_gosi NUMERIC(16,2) DEFAULT 0,
  total_net NUMERIC(16,2) DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payroll_runs TO authenticated;
GRANT ALL ON public.hr_payroll_runs TO service_role;
ALTER TABLE public.hr_payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pr_all" ON public.hr_payroll_runs FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.payroll','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.payroll','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_pr_updated BEFORE UPDATE ON public.hr_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TABLE public.hr_payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
  basic_salary NUMERIC(14,2) DEFAULT 0,
  housing_allowance NUMERIC(14,2) DEFAULT 0,
  transport_allowance NUMERIC(14,2) DEFAULT 0,
  other_allowances NUMERIC(14,2) DEFAULT 0,
  overtime NUMERIC(14,2) DEFAULT 0,
  bonuses NUMERIC(14,2) DEFAULT 0,
  gross_salary NUMERIC(14,2) DEFAULT 0,
  gosi_employee NUMERIC(14,2) DEFAULT 0,
  gosi_employer NUMERIC(14,2) DEFAULT 0,
  loan_deduction NUMERIC(14,2) DEFAULT 0,
  absence_deduction NUMERIC(14,2) DEFAULT 0,
  late_deduction NUMERIC(14,2) DEFAULT 0,
  other_deductions NUMERIC(14,2) DEFAULT 0,
  unpaid_leave_deduction NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  net_salary NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  cost_entry_id UUID REFERENCES public.cost_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, employee_id)
);
CREATE INDEX idx_hr_pl_run ON public.hr_payroll_lines(run_id);
CREATE INDEX idx_hr_pl_emp ON public.hr_payroll_lines(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payroll_lines TO authenticated;
GRANT ALL ON public.hr_payroll_lines TO service_role;
ALTER TABLE public.hr_payroll_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pl_all" ON public.hr_payroll_lines FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.payroll','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.payroll','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_pl_updated BEFORE UPDATE ON public.hr_payroll_lines FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- TERMINATIONS
CREATE TABLE public.hr_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termination_no TEXT UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.hr_contracts(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.hr_workflow_requests(id) ON DELETE SET NULL,
  reason public.hr_termination_reason NOT NULL,
  reason_details TEXT,
  last_working_day DATE NOT NULL,
  service_years NUMERIC(6,2),
  eos_amount NUMERIC(14,2) DEFAULT 0,
  leave_balance_amount NUMERIC(14,2) DEFAULT 0,
  outstanding_allowances NUMERIC(14,2) DEFAULT 0,
  outstanding_deductions NUMERIC(14,2) DEFAULT 0,
  loan_settlement NUMERIC(14,2) DEFAULT 0,
  other_receivables NUMERIC(14,2) DEFAULT 0,
  other_payables NUMERIC(14,2) DEFAULT 0,
  net_settlement NUMERIC(14,2) DEFAULT 0,
  settlement_details JSONB DEFAULT '{}'::jsonb,
  clearance_status JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','paid','cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_term_emp ON public.hr_terminations(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_terminations TO authenticated;
GRANT ALL ON public.hr_terminations TO service_role;
ALTER TABLE public.hr_terminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_term_all" ON public.hr_terminations FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.termination','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_hr_term_updated BEFORE UPDATE ON public.hr_terminations FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- SAUDI LABOR LAW FUNCTIONS
CREATE OR REPLACE FUNCTION public.hr_calc_end_of_service(_monthly_wage NUMERIC, _service_years NUMERIC, _reason TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE first5 NUMERIC; rest NUMERIC; base NUMERIC; factor NUMERIC := 1.0;
BEGIN
  IF _monthly_wage IS NULL OR _service_years IS NULL OR _service_years <= 0 THEN RETURN 0; END IF;
  first5 := LEAST(_service_years, 5) * (_monthly_wage / 2);
  rest := GREATEST(_service_years - 5, 0) * _monthly_wage;
  base := first5 + rest;
  IF _reason = 'resignation' THEN
    IF _service_years < 2 THEN factor := 0;
    ELSIF _service_years < 5 THEN factor := 1.0/3.0;
    ELSIF _service_years < 10 THEN factor := 2.0/3.0;
    ELSE factor := 1.0; END IF;
  END IF;
  RETURN ROUND(base * factor, 2);
END $$;

CREATE OR REPLACE FUNCTION public.hr_calc_gosi(_gross_wage NUMERIC, _is_saudi BOOLEAN)
RETURNS TABLE(employee_share NUMERIC, employer_share NUMERIC)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT
    CASE WHEN _is_saudi THEN ROUND(_gross_wage * 0.0975, 2) ELSE 0 END,
    CASE WHEN _is_saudi THEN ROUND(_gross_wage * 0.1175, 2) ELSE ROUND(_gross_wage * 0.02, 2) END
$$;

CREATE OR REPLACE FUNCTION public.hr_termination_clearance(_employee_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE loans_open INT; assets_open INT; loans_remaining NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount - COALESCE(paid_amount,0)),0)
    INTO loans_open, loans_remaining FROM public.hr_loans WHERE employee_id = _employee_id AND status = 'active';
  SELECT COUNT(*) INTO assets_open FROM public.hr_assets_assignment WHERE employee_id = _employee_id AND is_returned = FALSE;
  RETURN jsonb_build_object('loans_open', loans_open, 'loans_remaining_amount', loans_remaining, 'assets_not_returned', assets_open, 'can_terminate', (assets_open = 0));
END $$;

-- SEED PERMISSION MODULES
INSERT INTO public.permission_modules (key, name_ar, name_en, parent_key, sort_order)
VALUES
  ('hr','الموارد البشرية','Human Resources',NULL,100),
  ('hr.employees','الموظفون','Employees','hr',101),
  ('hr.contracts','عقود الموظفين','Employee Contracts','hr',102),
  ('hr.leaves','الإجازات','Leaves','hr',103),
  ('hr.loans','السلف','Loans','hr',104),
  ('hr.assets','العهد','Assets Assignment','hr',105),
  ('hr.payroll','الرواتب','Payroll','hr',106),
  ('hr.termination','إنهاء الخدمة','Termination','hr',107),
  ('hr.workflow','طلبات الموارد البشرية','HR Workflow','hr',108),
  ('hr.reports','تقارير الموارد البشرية','HR Reports','hr',109)
ON CONFLICT (key) DO NOTHING;
