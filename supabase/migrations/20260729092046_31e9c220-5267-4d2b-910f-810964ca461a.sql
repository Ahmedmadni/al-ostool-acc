-- F2: leave_balance_amount fed into termination settlements used the full
-- annual entitlement (21/30 days) from hr_get_leave_summary regardless of
-- how much of the service year had actually elapsed — an employee six
-- months into their first year with zero leave taken was credited a full
-- 21 days (10,500 SAR on a 15,000 wage) instead of the ~10 days they had
-- actually accrued (~5,000 SAR). hr_calc_leave_entitlement itself is left
-- unchanged (it correctly grants the full annual allowance up front for
-- day-to-day leave-request balance checking — that's standard practice);
-- this adds a separate, settlement-specific accrual calculation prorated
-- from the employee's last completed service-year anniversary.
CREATE OR REPLACE FUNCTION public.hr_leave_accrued_for_settlement(_employee_id UUID, _as_of DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hire DATE;
  v_annual_override NUMERIC;
  v_years_completed NUMERIC;
  v_rate NUMERIC;
  v_last_anniv DATE;
  v_days_since_anniv NUMERIC;
  v_accrued NUMERIC;
  v_used NUMERIC;
BEGIN
  SELECT hire_date, annual_leave_days INTO v_hire, v_annual_override FROM public.hr_employees WHERE id = _employee_id;
  IF v_hire IS NULL OR _as_of < v_hire THEN RETURN 0; END IF;

  v_years_completed := FLOOR((_as_of - v_hire) / 365.25);
  v_rate := COALESCE(v_annual_override, CASE WHEN ((_as_of - v_hire) / 365.25) >= 5 THEN 30 ELSE 21 END);
  v_last_anniv := v_hire + make_interval(years => v_years_completed::int);
  v_days_since_anniv := GREATEST(_as_of - v_last_anniv, 0);
  v_accrued := ROUND(v_rate * v_days_since_anniv / 365.25, 2);

  SELECT COALESCE(SUM(days_count), 0) INTO v_used
  FROM public.hr_leaves
  WHERE employee_id = _employee_id AND leave_type = 'annual'
    AND status IN ('approved','taken') AND from_date >= v_last_anniv AND from_date <= _as_of;

  RETURN GREATEST(v_accrued - v_used, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.hr_leave_accrued_for_settlement(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_termination_refresh_components(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_gross NUMERIC;
  v_last_day DATE;
  v_loan_balance NUMERIC;
  v_leave_days NUMERIC;
  v_leave_value NUMERIC;
  v_row public.hr_terminations;
BEGIN
  SELECT employee_id, last_working_day INTO v_emp, v_last_day FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;

  SELECT COALESCE(gross_salary, basic_salary, 0) INTO v_gross FROM public.hr_employees WHERE id = v_emp;
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_loan_balance FROM public.hr_loans WHERE employee_id = v_emp AND status = 'active';
  v_leave_days := public.hr_leave_accrued_for_settlement(v_emp, COALESCE(v_last_day, CURRENT_DATE));
  v_leave_value := ROUND(v_leave_days * (v_gross / 30.0), 2);

  UPDATE public.hr_terminations SET
    loan_settlement = v_loan_balance,
    leave_balance_amount = v_leave_value
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- Recompute draft/pending terminations only — approved/paid ones are
-- finalized financial records and must not silently change retroactively.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.hr_terminations WHERE status IN ('draft','pending') LOOP
    PERFORM public.hr_termination_refresh_components(r.id);
  END LOOP;
END $$;
