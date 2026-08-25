-- Make the database the authoritative settlement calculator.  The client
-- may preview amounts, but creation and approval now recalculate statutory
-- components transactionally from current employee/leave/loan records.

CREATE OR REPLACE FUNCTION public.hr_termination_refresh_components(_termination_id UUID)
RETURNS public.hr_terminations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term public.hr_terminations;
  v_gross NUMERIC;
  v_service JSONB;
  v_leave_days NUMERIC;
  v_leave_override NUMERIC;
  v_loan_balance NUMERIC;
  v_row public.hr_terminations;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'hr.termination', 'edit')
    OR public.has_permission(auth.uid(), 'hr.termination', 'approve')
    OR public.is_admin(auth.uid())
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إعادة احتساب المخالصة';
  END IF;

  SELECT * INTO v_term
  FROM public.hr_terminations
  WHERE id = _termination_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف إنهاء الخدمة غير موجود'; END IF;
  IF v_term.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'لا يمكن إعادة احتساب مخالصة في الحالة (%)', v_term.status;
  END IF;

  SELECT COALESCE(gross_salary,
    COALESCE(basic_salary, 0) + COALESCE(housing_allowance, 0)
      + COALESCE(transport_allowance, 0) + COALESCE(other_allowances, 0), 0)
  INTO v_gross
  FROM public.hr_employees
  WHERE id = v_term.employee_id;

  v_service := public.hr_calculate_service_period(v_term.employee_id, v_term.last_working_day);
  v_leave_override := NULLIF(v_term.settlement_details->>'leave_days_override', '')::NUMERIC;
  v_leave_days := COALESCE(
    v_leave_override,
    public.hr_leave_accrued_for_settlement(v_term.employee_id, v_term.last_working_day)
  );

  SELECT COALESCE(SUM(GREATEST(amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO v_loan_balance
  FROM public.hr_loans
  WHERE employee_id = v_term.employee_id AND status = 'active';

  UPDATE public.hr_terminations
  SET calendar_service_days = (v_service->>'calendar_days')::INTEGER,
      excluded_service_days = (v_service->>'excluded_days')::INTEGER,
      effective_service_days = (v_service->>'effective_days')::INTEGER,
      service_years = (v_service->>'effective_years')::NUMERIC,
      eos_amount = public.hr_calc_end_of_service(
        v_gross,
        (v_service->>'effective_years')::NUMERIC,
        v_term.reason::TEXT
      ),
      leave_balance_days = ROUND(v_leave_days, 2),
      leave_balance_amount = ROUND(v_leave_days * (v_gross / 30.0), 2),
      loan_settlement = v_loan_balance,
      settlement_details = COALESCE(settlement_details, '{}'::JSONB)
        || jsonb_build_object(
          'service_period', v_service,
          'calculation_version', 'termination-v2',
          'calculated_at', now()
        )
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_termination_create_draft(_input JSONB)
RETURNS public.hr_terminations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee public.hr_employees;
  v_row public.hr_terminations;
  v_reason public.hr_termination_reason;
  v_last_day DATE;
  v_notice_days NUMERIC := COALESCE((_input->>'notice_days')::NUMERIC, 0);
  v_last_month_days NUMERIC := COALESCE((_input->>'last_month_days')::NUMERIC, 0);
  v_unpaid_days NUMERIC := COALESCE((_input->>'last_period_unpaid_days')::NUMERIC, 0);
  v_other_receivables NUMERIC := COALESCE((_input->>'other_receivables')::NUMERIC, 0);
  v_other_deductions NUMERIC := COALESCE((_input->>'other_deductions')::NUMERIC, 0);
  v_article77 NUMERIC := COALESCE((_input->>'article77_amount')::NUMERIC, 0);
  v_article77_direction TEXT := NULLIF(_input->>'article77_direction', '');
  v_gross NUMERIC;
  v_gosi_employee NUMERIC := 0;
  v_notice_value NUMERIC;
  v_month_earned NUMERIC;
  v_unpaid_value NUMERIC;
  v_details JSONB;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'hr.termination', 'create')
    OR public.has_permission(auth.uid(), 'hr.termination', 'edit')
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إنشاء مخالصة';
  END IF;

  SELECT * INTO v_employee
  FROM public.hr_employees
  WHERE id = (_input->>'employee_id')::UUID AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'الموظف غير موجود أو غير نشط'; END IF;

  v_reason := (_input->>'reason')::public.hr_termination_reason;
  v_last_day := (_input->>'last_working_day')::DATE;
  IF v_last_day IS NULL OR v_employee.hire_date IS NULL OR v_last_day < v_employee.hire_date THEN
    RAISE EXCEPTION 'تاريخ آخر يوم عمل غير صالح';
  END IF;
  IF v_notice_days < 0 OR v_last_month_days < 0 OR v_last_month_days > 31
     OR v_unpaid_days < 0 OR v_unpaid_days > 31
     OR v_other_receivables < 0 OR v_other_deductions < 0 OR v_article77 < 0 THEN
    RAISE EXCEPTION 'قيم أيام أو مبالغ المخالصة غير صالحة';
  END IF;
  IF v_reason = 'probation' THEN v_notice_days := 0; END IF;
  IF v_article77_direction NOT IN ('employee', 'company') THEN
    v_article77_direction := NULL;
    v_article77 := 0;
  END IF;

  v_gross := COALESCE(v_employee.gross_salary,
    COALESCE(v_employee.basic_salary, 0) + COALESCE(v_employee.housing_allowance, 0)
      + COALESCE(v_employee.transport_allowance, 0) + COALESCE(v_employee.other_allowances, 0), 0);
  v_notice_value := ROUND(v_notice_days * (v_gross / 30.0), 2);
  v_month_earned := ROUND(v_last_month_days * (v_gross / 30.0), 2);
  v_unpaid_value := ROUND(v_unpaid_days * (v_gross / 30.0), 2);

  SELECT ROUND(employee_share * v_last_month_days / 30.0, 2)
  INTO v_gosi_employee
  FROM public.hr_calc_gosi(
    COALESCE(v_employee.basic_salary, 0) + COALESCE(v_employee.housing_allowance, 0),
    v_employee.is_saudi
  );
  v_gosi_employee := COALESCE(v_gosi_employee, 0);

  v_details := jsonb_build_object(
    'notice_days', v_notice_days,
    'notice_value', v_notice_value,
    'last_period_unpaid_days', v_unpaid_days,
    'unpaid_value', v_unpaid_value,
    'last_month_days', v_last_month_days,
    'month_earned', v_month_earned,
    'gosi_employee', v_gosi_employee,
    'other_receivables_manual', v_other_receivables,
    'other_deductions_manual', v_other_deductions,
    'leave_days_override', _input->>'leave_days_override',
    'calculation_version', 'termination-v2'
  );
  IF v_article77_direction IS NOT NULL THEN
    v_details := v_details || jsonb_build_object('article77', jsonb_build_object(
      'amount', v_article77,
      'direction', v_article77_direction,
      'basis', COALESCE(_input->>'article77_basis', 'manual')
    ));
  END IF;

  INSERT INTO public.hr_terminations (
    termination_no, employee_id, reason, reason_details, last_working_day,
    outstanding_deductions, other_receivables, other_payables,
    settlement_details, clearance_status, status, created_by
  ) VALUES (
    'TERM-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_employee.id,
    v_reason,
    NULLIF(_input->>'reason_details', ''),
    v_last_day,
    ROUND(v_gosi_employee + v_unpaid_value + v_other_deductions, 2),
    ROUND(v_notice_value + v_month_earned + v_other_receivables
      + CASE WHEN v_article77_direction = 'employee' THEN v_article77 ELSE 0 END, 2),
    CASE WHEN v_article77_direction = 'company' THEN v_article77 ELSE 0 END,
    v_details,
    public.hr_termination_clearance(v_employee.id),
    'draft',
    auth.uid()
  ) RETURNING * INTO v_row;

  RETURN public.hr_termination_refresh_components(v_row.id);
END;
$$;

-- Outstanding loans are settled from the final settlement itself.  They are
-- advisory in clearance and must not make approval impossible; unreturned
-- custody remains the hard blocker.
CREATE OR REPLACE FUNCTION public.hr_termination_clearance(_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE loans_open INTEGER; assets_open INTEGER; loans_remaining NUMERIC;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'hr.termination', 'view')
    OR public.has_permission(auth.uid(), 'hr.termination', 'create')
    OR public.has_permission(auth.uid(), 'hr.termination', 'edit')
    OR public.has_permission(auth.uid(), 'hr.termination', 'approve')
    OR public.is_admin(auth.uid())
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية الاطلاع على تسوية الموظف';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(GREATEST(amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO loans_open, loans_remaining
  FROM public.hr_loans
  WHERE employee_id = _employee_id AND status = 'active';

  SELECT COUNT(*) INTO assets_open
  FROM public.hr_assets_assignment
  WHERE employee_id = _employee_id AND is_returned = false;

  RETURN jsonb_build_object(
    'loans_open', loans_open,
    'loans_remaining_amount', loans_remaining,
    'loans_settled_by_final_settlement', true,
    'assets_not_returned', assets_open,
    'can_terminate', assets_open = 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_termination_approve(_termination_id UUID)
RETURNS public.hr_terminations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term public.hr_terminations;
  v_clr JSONB;
  v_closed_loans JSONB;
  v_closed_installments JSONB;
  v_live_loan_balance NUMERIC;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'hr.termination', 'approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد إنهاء الخدمة';
  END IF;

  SELECT * INTO v_term FROM public.hr_terminations WHERE id = _termination_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ملف إنهاء الخدمة غير موجود'; END IF;
  IF v_term.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'ملف إنهاء الخدمة ليس في حالة قابلة للاعتماد (%)', v_term.status;
  END IF;

  -- Refresh service, EOS, leave and loans immediately before approval so a
  -- stale browser preview can never become the approved financial record.
  v_term := public.hr_termination_refresh_components(_termination_id);
  v_clr := public.hr_termination_clearance(v_term.employee_id);
  IF NOT (v_clr->>'can_terminate')::BOOLEAN THEN
    RAISE EXCEPTION 'لا يمكن إنهاء الخدمة قبل استرجاع جميع العهد (المتبقي: %)', v_clr->>'assets_not_returned';
  END IF;

  SELECT COALESCE(SUM(GREATEST(amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO v_live_loan_balance
  FROM public.hr_loans
  WHERE employee_id = v_term.employee_id AND status = 'active';
  IF ABS(COALESCE(v_term.loan_settlement, 0) - v_live_loan_balance) > 0.01 THEN
    RAISE EXCEPTION 'تغير رصيد السلف أثناء الاعتماد؛ أعد المحاولة';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'prior_paid_amount', paid_amount)), '[]'::JSONB)
  INTO v_closed_loans
  FROM public.hr_loans
  WHERE employee_id = v_term.employee_id AND status = 'active';

  SELECT COALESCE(jsonb_agg(li.id), '[]'::JSONB)
  INTO v_closed_installments
  FROM public.hr_loan_installments li
  JOIN public.hr_loans l ON l.id = li.loan_id
  WHERE l.employee_id = v_term.employee_id AND l.status = 'active' AND li.paid = false;

  UPDATE public.hr_terminations
  SET status = 'approved', approved_at = now(), approved_by = auth.uid(), clearance_status = v_clr,
      settlement_details = COALESCE(settlement_details, '{}'::JSONB)
        || jsonb_build_object('_closed_loans', v_closed_loans, '_closed_installments', v_closed_installments)
  WHERE id = _termination_id
  RETURNING * INTO v_term;

  UPDATE public.hr_employees SET status = 'terminated' WHERE id = v_term.employee_id;
  UPDATE public.hr_loans SET status = 'completed', paid_amount = amount, updated_at = now()
  WHERE employee_id = v_term.employee_id AND status = 'active';
  UPDATE public.hr_loan_installments li SET paid = true, paid_at = now()
  FROM public.hr_loans l
  WHERE li.loan_id = l.id AND l.employee_id = v_term.employee_id AND li.paid = false;

  RETURN v_term;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_termination_create_draft(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_termination_create_draft(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.hr_termination_clearance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_termination_clearance(UUID) TO authenticated, service_role;

-- Force every new settlement through the validating RPC.  SECURITY DEFINER
-- executes as the function owner, while authenticated clients can no longer
-- forge pre-calculated amounts with a direct PostgREST insert.
DROP POLICY IF EXISTS "hr_term_insert" ON public.hr_terminations;
REVOKE INSERT ON public.hr_terminations FROM authenticated;
