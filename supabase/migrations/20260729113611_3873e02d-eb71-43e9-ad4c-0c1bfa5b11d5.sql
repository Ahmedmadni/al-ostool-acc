-- H2: leave accrual started counting only from the employee's hire_date as
-- recorded in this system, so a long-tenured employee entered into the
-- system today showed a near-zero balance and any leave carried over from
-- before go-live was simply lost. Add an explicit opening balance captured
-- on the employee's file, applied on top of the period accrued since
-- registration, with leave actually taken deducted from the total.
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS opening_leave_balance_days NUMERIC(8,2) DEFAULT 0;

COMMENT ON COLUMN public.hr_employees.opening_leave_balance_days IS
  'رصيد الإجازات المرحّل من قبل تسجيل الموظف في النظام — يُضاف إلى الرصيد المستحق عن الفترة اللاحقة للتسجيل، ويُخصم منه ما استُخدم فعلياً.';

-- Settlement accrual: prorated entitlement since the last completed service
-- anniversary, plus the opening balance carried in, minus leave taken.
-- The opening balance is a one-time carry-in, so it is only added while it
-- has not yet been consumed — it is not re-granted every service year.
CREATE OR REPLACE FUNCTION public.hr_leave_accrued_for_settlement(_employee_id UUID, _as_of DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hire DATE;
  v_annual_override NUMERIC;
  v_opening NUMERIC;
  v_years_completed NUMERIC;
  v_rate NUMERIC;
  v_last_anniv DATE;
  v_days_since_anniv NUMERIC;
  v_accrued NUMERIC;
  v_used_since_anniv NUMERIC;
  v_used_before_anniv NUMERIC;
  v_opening_left NUMERIC;
BEGIN
  SELECT hire_date, annual_leave_days, COALESCE(opening_leave_balance_days, 0)
    INTO v_hire, v_annual_override, v_opening
  FROM public.hr_employees WHERE id = _employee_id;
  IF v_hire IS NULL OR _as_of < v_hire THEN RETURN 0; END IF;

  v_years_completed := FLOOR((_as_of - v_hire) / 365.25);
  v_rate := COALESCE(v_annual_override, CASE WHEN ((_as_of - v_hire) / 365.25) >= 5 THEN 30 ELSE 21 END);
  v_last_anniv := v_hire + make_interval(years => v_years_completed::int);
  v_days_since_anniv := GREATEST(_as_of - v_last_anniv, 0);
  v_accrued := ROUND(v_rate * v_days_since_anniv / 365.25, 2);

  SELECT COALESCE(SUM(days_count), 0) INTO v_used_since_anniv
  FROM public.hr_leaves
  WHERE employee_id = _employee_id AND leave_type = 'annual'
    AND status IN ('approved','taken') AND from_date >= v_last_anniv AND from_date <= _as_of;

  -- Leave taken before the current service year first draws down the
  -- carried-in opening balance; whatever survives that is still owed.
  SELECT COALESCE(SUM(days_count), 0) INTO v_used_before_anniv
  FROM public.hr_leaves
  WHERE employee_id = _employee_id AND leave_type = 'annual'
    AND status IN ('approved','taken') AND from_date < v_last_anniv;

  v_opening_left := GREATEST(v_opening - v_used_before_anniv, 0);

  RETURN GREATEST(v_accrued + v_opening_left - v_used_since_anniv, 0);
END $$;

-- Day-to-day entitlement (leave-request balance checks) counts the opening
-- balance only in the employee's first system year: after that the annual
-- allowance resets, and a carry-in re-added every year would silently
-- inflate the balance forever.
CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(_employee_id uuid, _leave_type text, _year integer DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hire date;
  v_service_years numeric;
  v_year integer := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_contract_annual numeric;
  v_opening numeric;
  v_base numeric;
  v_adjustment numeric;
BEGIN
  SELECT hire_date, annual_leave_days, COALESCE(opening_leave_balance_days, 0)
    INTO v_hire, v_contract_annual, v_opening
  FROM public.hr_employees WHERE id = _employee_id;
  IF v_hire IS NULL THEN RETURN 0; END IF;
  v_service_years := (COALESCE(make_date(_year,12,31), CURRENT_DATE) - v_hire) / 365.25;

  v_base := CASE _leave_type
    WHEN 'annual'       THEN COALESCE(v_contract_annual, CASE WHEN v_service_years >= 5 THEN 30 ELSE 21 END)
    WHEN 'sick'         THEN 120
    WHEN 'emergency'    THEN 5
    WHEN 'maternity'    THEN 70
    WHEN 'paternity'    THEN 3
    WHEN 'hajj'         THEN 15
    WHEN 'compensatory' THEN 999
    WHEN 'study'        THEN 15
    WHEN 'unpaid'       THEN 999
    ELSE 0
  END;

  IF _leave_type = 'annual' AND v_year = EXTRACT(YEAR FROM v_hire)::int THEN
    v_base := v_base + v_opening;
  END IF;

  SELECT COALESCE(SUM(days), 0) INTO v_adjustment
  FROM public.hr_leave_adjustments
  WHERE employee_id = _employee_id AND leave_type::text = _leave_type AND year = v_year;

  RETURN v_base + v_adjustment;
END $$;
