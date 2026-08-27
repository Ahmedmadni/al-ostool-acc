-- Phase D2: sick-leave pay cycles and server-authoritative, leave-aware payroll.

ALTER TABLE public.hr_leaves
  ADD COLUMN IF NOT EXISTS sick_cycle_start DATE;

ALTER TABLE public.hr_payroll_lines
  ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_details JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_hr_leaves_sick_cycle
  ON public.hr_leaves(employee_id, sick_cycle_start)
  WHERE leave_type = 'sick';

-- Backfill historical sick leaves into entitlement years anchored on the
-- first sick day. A new 365-day cycle starts only after the previous cycle.
DO $$
DECLARE
  v_employee UUID;
  v_leave RECORD;
  v_cycle DATE;
BEGIN
  FOR v_employee IN
    SELECT DISTINCT employee_id FROM public.hr_leaves
    WHERE leave_type = 'sick' AND status IN ('approved', 'taken')
  LOOP
    v_cycle := NULL;
    FOR v_leave IN
      SELECT id, from_date FROM public.hr_leaves
      WHERE employee_id = v_employee AND leave_type = 'sick'
        AND status IN ('approved', 'taken')
      ORDER BY from_date, id
    LOOP
      IF v_cycle IS NULL OR v_leave.from_date >= (v_cycle + INTERVAL '1 year')::DATE THEN
        v_cycle := v_leave.from_date;
      END IF;
      UPDATE public.hr_leaves SET sick_cycle_start = v_cycle WHERE id = v_leave.id;
    END LOOP;
  END LOOP;
END;
$$;

UPDATE public.cost_entries c
SET amount = GREATEST(COALESCE(pl.gross_salary, 0)
      - COALESCE(pl.unpaid_leave_deduction, 0)
      - COALESCE(pl.sick_leave_deduction, 0), 0)
      + COALESCE(pl.gosi_employer, 0),
    meta = COALESCE(c.meta, '{}'::JSONB) || jsonb_build_object(
      'unpaid_leave_deduction', COALESCE(pl.unpaid_leave_deduction, 0),
      'sick_leave_deduction', COALESCE(pl.sick_leave_deduction, 0),
      'gosi_employer', COALESCE(pl.gosi_employer, 0)
    )
FROM public.hr_payroll_lines pl
WHERE pl.cost_entry_id = c.id
  AND COALESCE(c.meta->>'source', '') = 'hr_payroll';

-- Keep the invariant even if an approver uses PostgREST directly instead of
-- the UI RPC: every approved sick leave must belong to a dated pay cycle.
CREATE OR REPLACE FUNCTION public.hr_leave_guard_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle DATE;
  v_cycle_days INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    IF NOT (public.has_permission(auth.uid(), 'hr.leaves', 'approve') OR public.is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'اعتماد أو رفض الإجازة يتطلب صلاحية hr.leaves:approve';
    END IF;

    IF NEW.status = 'approved' AND NEW.leave_type = 'sick' THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.employee_id::TEXT, 0));
      SELECT sick_cycle_start INTO v_cycle
      FROM public.hr_leaves
      WHERE employee_id = NEW.employee_id AND leave_type = 'sick'
        AND status IN ('approved', 'taken') AND sick_cycle_start IS NOT NULL
        AND NEW.from_date >= sick_cycle_start
        AND NEW.from_date < (sick_cycle_start + INTERVAL '1 year')::DATE
      ORDER BY sick_cycle_start DESC LIMIT 1;
      v_cycle := COALESCE(v_cycle, NEW.from_date);

      SELECT COUNT(DISTINCT gs::DATE) INTO v_cycle_days
      FROM public.hr_leaves l
      CROSS JOIN LATERAL generate_series(l.from_date, l.to_date, INTERVAL '1 day') gs
      WHERE l.employee_id = NEW.employee_id AND l.leave_type = 'sick'
        AND l.status IN ('approved', 'taken') AND l.sick_cycle_start = v_cycle
        AND l.id <> NEW.id;
      IF COALESCE(v_cycle_days, 0) + NEW.days_count > 120 THEN
        RAISE EXCEPTION 'يتجاوز الطلب رصيد الإجازة المرضية البالغ 120 يوماً في دورة الاستحقاق الحالية';
      END IF;
      NEW.sick_cycle_start := v_cycle;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_leave_decide(_leave_id UUID, _approved BOOLEAN)
RETURNS public.hr_leaves
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.hr_leaves;
  v_cycle DATE;
  v_cycle_days INTEGER;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'hr.leaves', 'approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد أو رفض الإجازات';
  END IF;

  SELECT * INTO v_row FROM public.hr_leaves WHERE id = _leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الإجازة غير موجود'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'طلب الإجازة ليس قيد الاعتماد'; END IF;

  IF _approved AND v_row.leave_type = 'sick' THEN
    SELECT sick_cycle_start INTO v_cycle
    FROM public.hr_leaves
    WHERE employee_id = v_row.employee_id AND leave_type = 'sick'
      AND status IN ('approved', 'taken')
      AND sick_cycle_start IS NOT NULL
      AND v_row.from_date >= sick_cycle_start
      AND v_row.from_date < (sick_cycle_start + INTERVAL '1 year')::DATE
    ORDER BY sick_cycle_start DESC
    LIMIT 1;
    v_cycle := COALESCE(v_cycle, v_row.from_date);

    SELECT COUNT(DISTINCT gs::DATE) INTO v_cycle_days
    FROM public.hr_leaves l
    CROSS JOIN LATERAL generate_series(l.from_date, l.to_date, INTERVAL '1 day') gs
    WHERE l.employee_id = v_row.employee_id AND l.leave_type = 'sick'
      AND l.status IN ('approved', 'taken') AND l.sick_cycle_start = v_cycle;

    IF COALESCE(v_cycle_days, 0) + v_row.days_count > 120 THEN
      RAISE EXCEPTION 'يتجاوز الطلب رصيد الإجازة المرضية البالغ 120 يوماً في دورة الاستحقاق الحالية';
    END IF;
    v_row.sick_cycle_start := v_cycle;
  END IF;

  UPDATE public.hr_leaves
  SET status = CASE WHEN _approved THEN 'approved'::public.hr_leave_status ELSE 'rejected'::public.hr_leave_status END,
      sick_cycle_start = CASE WHEN _approved AND v_row.leave_type = 'sick' THEN v_row.sick_cycle_start ELSE sick_cycle_start END,
      approved_by = auth.uid(), approved_at = now()
  WHERE id = _leave_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_sick_leave_pay_breakdown(
  _employee_id UUID,
  _period_from DATE,
  _period_to DATE,
  _daily_wage NUMERIC
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_sick_days AS (
    SELECT DISTINCT gs::DATE AS day, l.sick_cycle_start
    FROM public.hr_leaves l
    CROSS JOIN LATERAL generate_series(
      GREATEST(l.from_date, _period_from),
      LEAST(l.to_date, _period_to),
      INTERVAL '1 day'
    ) gs
    WHERE l.employee_id = _employee_id AND l.leave_type = 'sick'
      AND l.status IN ('approved', 'taken')
      AND l.to_date >= _period_from AND l.from_date <= _period_to
  ),
  ranked AS (
    SELECT p.day, p.sick_cycle_start,
      (SELECT COUNT(DISTINCT all_days::DATE)
       FROM public.hr_leaves h
       CROSS JOIN LATERAL generate_series(h.from_date, LEAST(h.to_date, p.day), INTERVAL '1 day') all_days
       WHERE h.employee_id = _employee_id AND h.leave_type = 'sick'
         AND h.status IN ('approved', 'taken')
         AND h.sick_cycle_start = p.sick_cycle_start
         AND h.from_date <= p.day) AS ordinal
    FROM period_sick_days p
  ),
  valued AS (
    SELECT day, ordinal,
      CASE WHEN ordinal <= 30 THEN 100 WHEN ordinal <= 90 THEN 75 ELSE 0 END AS pay_percent
    FROM ranked
  )
  SELECT jsonb_build_object(
    'days', COUNT(*),
    'full_pay_days', COUNT(*) FILTER (WHERE pay_percent = 100),
    'three_quarter_pay_days', COUNT(*) FILTER (WHERE pay_percent = 75),
    'unpaid_days', COUNT(*) FILTER (WHERE pay_percent = 0),
    'deduction', ROUND(COALESCE(SUM(_daily_wage * (100 - pay_percent) / 100.0), 0), 2),
    'details', COALESCE(jsonb_agg(jsonb_build_object(
      'date', day, 'cycle_day', ordinal, 'pay_percent', pay_percent
    ) ORDER BY day), '[]'::JSONB)
  )
  FROM valued
$$;

CREATE OR REPLACE FUNCTION public.hr_payroll_create_run(_period_year INTEGER, _period_month INTEGER)
RETURNS public.hr_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from DATE;
  v_to DATE;
  v_run public.hr_payroll_runs;
  v_emp public.hr_employees;
  v_contract_gross NUMERIC;
  v_payable_days NUMERIC;
  v_gross NUMERIC;
  v_gosi_employee NUMERIC;
  v_gosi_employer NUMERIC;
  v_unpaid_days NUMERIC;
  v_unpaid_deduction NUMERIC;
  v_sick JSONB;
  v_sick_days NUMERIC;
  v_sick_deduction NUMERIC;
  v_leave_deduction NUMERIC;
  v_requested_loan NUMERIC;
  v_loan_deduction NUMERIC;
  v_total_deductions NUMERIC;
  v_net NUMERIC;
  v_count INTEGER := 0;
  v_total_gross NUMERIC := 0;
  v_total_deductions_sum NUMERIC := 0;
  v_total_gosi NUMERIC := 0;
  v_total_net NUMERIC := 0;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'hr.payroll', 'create')
    OR public.has_permission(auth.uid(), 'hr.payroll', 'edit')
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إنشاء مسير رواتب';
  END IF;
  IF _period_month NOT BETWEEN 1 AND 12 OR _period_year NOT BETWEEN 2000 AND 2200 THEN
    RAISE EXCEPTION 'فترة مسير الرواتب غير صالحة';
  END IF;

  v_from := make_date(_period_year, _period_month, 1);
  v_to := (v_from + INTERVAL '1 month - 1 day')::DATE;

  INSERT INTO public.hr_payroll_runs(run_no, period_year, period_month, status, created_by)
  VALUES ('PR-' || _period_year || '-' || lpad(_period_month::TEXT, 2, '0'), _period_year, _period_month, 'draft', auth.uid())
  RETURNING * INTO v_run;

  FOR v_emp IN
    SELECT * FROM public.hr_employees
    WHERE status IN ('active', 'on_leave') AND hire_date <= v_to
    ORDER BY employee_no
  LOOP
    v_contract_gross := COALESCE(v_emp.gross_salary,
      COALESCE(v_emp.basic_salary, 0) + COALESCE(v_emp.housing_allowance, 0)
        + COALESCE(v_emp.transport_allowance, 0) + COALESCE(v_emp.other_allowances, 0), 0);
    v_payable_days := CASE
      WHEN v_emp.hire_date <= v_from THEN 30
      ELSE LEAST(30, v_to - v_emp.hire_date + 1)
    END;
    v_gross := ROUND(v_contract_gross * v_payable_days / 30.0, 2);

    SELECT employee_share, employer_share INTO v_gosi_employee, v_gosi_employer
    FROM public.hr_calc_gosi(
      COALESCE(v_emp.basic_salary, 0) + COALESCE(v_emp.housing_allowance, 0),
      v_emp.is_saudi
    );
    v_gosi_employee := ROUND(COALESCE(v_gosi_employee, 0) * v_payable_days / 30.0, 2);
    v_gosi_employer := ROUND(COALESCE(v_gosi_employer, 0) * v_payable_days / 30.0, 2);

    SELECT COUNT(DISTINCT gs::DATE) INTO v_unpaid_days
    FROM public.hr_leaves l
    CROSS JOIN LATERAL generate_series(
      GREATEST(l.from_date, v_from), LEAST(l.to_date, v_to), INTERVAL '1 day'
    ) gs
    WHERE l.employee_id = v_emp.id AND l.leave_type = 'unpaid'
      AND l.status IN ('approved', 'taken')
      AND l.to_date >= v_from AND l.from_date <= v_to;
    v_unpaid_days := COALESCE(v_unpaid_days, 0);
    v_unpaid_deduction := ROUND(v_contract_gross / 30.0 * v_unpaid_days, 2);

    v_sick := public.hr_sick_leave_pay_breakdown(v_emp.id, v_from, v_to, v_contract_gross / 30.0);
    v_sick_days := COALESCE((v_sick->>'days')::NUMERIC, 0);
    v_sick_deduction := COALESCE((v_sick->>'deduction')::NUMERIC, 0);
    v_leave_deduction := LEAST(v_gross, v_unpaid_deduction + v_sick_deduction);

    SELECT COALESCE(SUM(LEAST(monthly_deduction, GREATEST(amount - COALESCE(paid_amount, 0), 0))), 0)
    INTO v_requested_loan
    FROM public.hr_loans
    WHERE employee_id = v_emp.id AND status = 'active';
    v_loan_deduction := LEAST(v_requested_loan, GREATEST(v_gross - v_leave_deduction - COALESCE(v_gosi_employee, 0), 0));

    v_total_deductions := ROUND(COALESCE(v_gosi_employee, 0) + v_leave_deduction + v_loan_deduction, 2);
    v_net := ROUND(v_gross - v_total_deductions, 2);

    INSERT INTO public.hr_payroll_lines (
      run_id, employee_id, basic_salary, housing_allowance, transport_allowance,
      other_allowances, gross_salary, gosi_employee, gosi_employer,
      loan_deduction, unpaid_leave_days, unpaid_leave_deduction,
      sick_leave_days, sick_leave_deduction, total_deductions, net_salary,
      calculation_details
    ) VALUES (
      v_run.id, v_emp.id, COALESCE(v_emp.basic_salary, 0), COALESCE(v_emp.housing_allowance, 0),
      COALESCE(v_emp.transport_allowance, 0), COALESCE(v_emp.other_allowances, 0),
      v_gross, COALESCE(v_gosi_employee, 0), COALESCE(v_gosi_employer, 0),
      v_loan_deduction, v_unpaid_days, v_unpaid_deduction,
      v_sick_days, v_sick_deduction, v_total_deductions, v_net,
      jsonb_build_object(
        'calculation_version', 'payroll-v2',
        'period_from', v_from,
        'period_to', v_to,
        'contract_gross', v_contract_gross,
        'payable_days', v_payable_days,
        'unpaid_leave', jsonb_build_object('days', v_unpaid_days, 'deduction', v_unpaid_deduction),
        'sick_leave', v_sick,
        'loan_requested', v_requested_loan,
        'loan_applied', v_loan_deduction,
        'calculated_at', now()
      )
    );

    v_count := v_count + 1;
    v_total_gross := v_total_gross + v_gross;
    v_total_deductions_sum := v_total_deductions_sum + v_total_deductions;
    v_total_gosi := v_total_gosi + COALESCE(v_gosi_employee, 0) + COALESCE(v_gosi_employer, 0);
    v_total_net := v_total_net + v_net;
  END LOOP;

  UPDATE public.hr_payroll_runs
  SET employees_count = v_count, total_gross = ROUND(v_total_gross, 2),
      total_deductions = ROUND(v_total_deductions_sum, 2),
      total_gosi = ROUND(v_total_gosi, 2), total_net = ROUND(v_total_net, 2)
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_sick_leave_pay_breakdown(UUID, DATE, DATE, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_payroll_create_run(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_sick_leave_pay_breakdown(UUID, DATE, DATE, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_payroll_create_run(INTEGER, INTEGER) TO authenticated;

-- New runs and calculated lines must be created atomically by the engine.
REVOKE INSERT ON public.hr_payroll_runs FROM authenticated;
REVOKE INSERT ON public.hr_payroll_lines FROM authenticated;

-- Payroll cost is the earned wage, not the contractual gross before unpaid
-- and partially-paid sick leave. Replace the earlier cost-ledger helper so
-- newly approved runs do not overstate HR/project cost.
CREATE OR REPLACE FUNCTION public.hr_sync_payroll_cost_entries(_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_line RECORD;
  v_cost_entry_id UUID;
  v_created INTEGER := 0;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id = _run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;
  IF v_run.status NOT IN ('approved', 'paid') THEN RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير غير معتمد'; END IF;

  FOR v_line IN
    SELECT pl.id, pl.employee_id, pl.project_id, pl.gross_salary, pl.gosi_employer,
           pl.unpaid_leave_deduction, pl.sick_leave_deduction,
           e.employee_no, e.full_name_ar, e.department_id, p.name AS project_name
    FROM public.hr_payroll_lines pl
    JOIN public.hr_employees e ON e.id = pl.employee_id
    LEFT JOIN public.projects p ON p.id = pl.project_id
    WHERE pl.run_id = _run_id AND pl.cost_entry_id IS NULL
    FOR UPDATE OF pl
  LOOP
    INSERT INTO public.cost_entries (
      category, description, project, project_id, department_id, period,
      amount, meta, imported_by
    ) VALUES (
      'hr.payroll',
      'راتب ' || v_line.full_name_ar || ' (' || v_line.employee_no || ') - ' || v_run.run_no,
      v_line.project_name, v_line.project_id, v_line.department_id,
      format('%s-%s', v_run.period_year, lpad(v_run.period_month::TEXT, 2, '0')),
      GREATEST(COALESCE(v_line.gross_salary, 0)
        - COALESCE(v_line.unpaid_leave_deduction, 0)
        - COALESCE(v_line.sick_leave_deduction, 0), 0)
        + COALESCE(v_line.gosi_employer, 0),
      jsonb_build_object(
        'source', 'hr_payroll', 'payroll_run_id', v_run.id,
        'payroll_line_id', v_line.id, 'employee_id', v_line.employee_id,
        'gross_salary', COALESCE(v_line.gross_salary, 0),
        'unpaid_leave_deduction', COALESCE(v_line.unpaid_leave_deduction, 0),
        'sick_leave_deduction', COALESCE(v_line.sick_leave_deduction, 0),
        'gosi_employer', COALESCE(v_line.gosi_employer, 0)
      ), auth.uid()
    ) RETURNING id INTO v_cost_entry_id;

    UPDATE public.hr_payroll_lines SET cost_entry_id = v_cost_entry_id WHERE id = v_line.id;
    v_created := v_created + 1;
  END LOOP;
  RETURN v_created;
END;
$$;
