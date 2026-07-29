-- E1: trg_hr_termination_recalc_settlement (H15) did not exist on the live
-- database despite being committed in 20260710100000 — every termination's
-- net_settlement was silently stuck at eos_amount only, ignoring leave
-- balance, allowances, deductions, loan settlement, and other payables
-- entirely. This is the third instance this session of a migration file
-- being committed but never actually deployed. Redeployed correctly and
-- every existing row is recomputed.
CREATE OR REPLACE FUNCTION public.hr_termination_recalc_settlement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.net_settlement :=
    COALESCE(NEW.eos_amount, 0)
    + COALESCE(NEW.leave_balance_amount, 0)
    + COALESCE(NEW.outstanding_allowances, 0)
    + COALESCE(NEW.other_receivables, 0)
    - COALESCE(NEW.outstanding_deductions, 0)
    - COALESCE(NEW.loan_settlement, 0)
    - COALESCE(NEW.other_payables, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_termination_recalc_settlement ON public.hr_terminations;
CREATE TRIGGER trg_hr_termination_recalc_settlement
BEFORE INSERT OR UPDATE ON public.hr_terminations
FOR EACH ROW EXECUTE FUNCTION public.hr_termination_recalc_settlement();

-- Force a recompute pass over every existing row now that the trigger exists.
UPDATE public.hr_terminations SET updated_at = now();

-- E4: some employees' contracts stipulate a flat annual leave entitlement
-- (e.g. 30 days from year one) instead of the standard 21/30-by-service-years
-- formula. NULL keeps the automatic formula; a value overrides it.
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS annual_leave_days NUMERIC(5,2);
COMMENT ON COLUMN public.hr_employees.annual_leave_days IS
  'Contractual annual leave entitlement override (e.g. 30 days regardless of service years). NULL = use the default 21/30-by-service-years formula.';

CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(_employee_id uuid, _leave_type text, _year integer DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire date;
  v_service_years numeric;
  v_year integer := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_base numeric;
  v_adjustment numeric;
  v_contract_annual numeric;
BEGIN
  SELECT hire_date, annual_leave_days INTO v_hire, v_contract_annual FROM public.hr_employees WHERE id = _employee_id;
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

  SELECT COALESCE(SUM(days), 0) INTO v_adjustment
  FROM public.hr_leave_adjustments
  WHERE employee_id = _employee_id AND leave_type::text = _leave_type AND year = v_year;

  RETURN v_base + v_adjustment;
END $$;
