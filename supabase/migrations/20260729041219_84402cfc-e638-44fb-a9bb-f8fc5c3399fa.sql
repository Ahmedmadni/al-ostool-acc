-- H28: hr_terminations.loan_settlement and leave_balance_amount were dead
-- columns — nothing in the app ever wrote to them, so net_settlement for
-- every real termination silently equaled eos_amount only, even though
-- H15's recalc trigger was ready to fold them in. Meanwhile
-- hr_termination_clearance blocked termination entirely while any loan was
-- open, so the amount could never legitimately be nonzero anyway. This
-- switches the workflow to the standard Saudi practice: the outstanding
-- loan balance is deducted from the settlement instead of blocking it, and
-- is closed out automatically when the termination is approved. Asset
-- custody still hard-blocks (a physical asset can't be netted out).

CREATE OR REPLACE FUNCTION public.hr_termination_clearance(_employee_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE loans_open INT; assets_open INT; loans_remaining NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(remaining_amount),0)
    INTO loans_open, loans_remaining FROM public.hr_loans WHERE employee_id = _employee_id AND status = 'active';
  SELECT COUNT(*) INTO assets_open FROM public.hr_assets_assignment WHERE employee_id = _employee_id AND is_returned = FALSE;
  RETURN jsonb_build_object(
    'loans_open', loans_open, 'loans_remaining_amount', loans_remaining,
    'assets_not_returned', assets_open,
    -- Loans no longer block: they are deducted from the settlement and
    -- closed on approval instead. Only unreturned assets block.
    'can_terminate', (assets_open = 0)
  );
END $$;

-- Recompute the settlement's loan/leave components from live data.
-- Callable any time on a draft termination to refresh loan_settlement from
-- hr_loans and leave_balance_amount from hr_get_leave_summary.
CREATE OR REPLACE FUNCTION public.hr_termination_refresh_components(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_gross NUMERIC;
  v_loan_balance NUMERIC;
  v_leave_days NUMERIC;
  v_leave_value NUMERIC;
  v_row public.hr_terminations;
BEGIN
  SELECT employee_id INTO v_emp FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;

  SELECT COALESCE(gross_salary, basic_salary, 0) INTO v_gross FROM public.hr_employees WHERE id = v_emp;
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_loan_balance FROM public.hr_loans WHERE employee_id = v_emp AND status = 'active';
  SELECT COALESCE(remaining, 0) INTO v_leave_days FROM public.hr_get_leave_summary(v_emp) WHERE leave_type = 'annual';
  v_leave_value := ROUND(v_leave_days * (v_gross / 30.0), 2);

  UPDATE public.hr_terminations SET
    loan_settlement = v_loan_balance,
    leave_balance_amount = v_leave_value
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- Single transactional approval: re-check asset clearance, flip status,
-- mark the employee terminated, and close out the loans whose balance was
-- already folded into net_settlement — replaces the previous 2-step
-- client-side update that left loans dangling as 'active' forever.
CREATE OR REPLACE FUNCTION public.hr_termination_approve(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_status TEXT;
  v_clr JSONB;
  v_row public.hr_terminations;
BEGIN
  SELECT employee_id, status INTO v_emp, v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'termination is not in an approvable state (%)', v_status; END IF;

  v_clr := public.hr_termination_clearance(v_emp);
  IF NOT (v_clr->>'can_terminate')::boolean THEN
    RAISE EXCEPTION 'لا يمكن إنهاء الخدمة قبل تسوية العهد (عهد لم تُسترجع: %)', v_clr->>'assets_not_returned';
  END IF;

  UPDATE public.hr_terminations
  SET status = 'approved', approved_at = now(), clearance_status = v_clr
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  UPDATE public.hr_employees SET status = 'terminated' WHERE id = v_emp;

  -- Loan balance was already deducted into net_settlement; close the loans now.
  UPDATE public.hr_loans SET status = 'completed', paid_amount = amount, updated_at = now()
  WHERE employee_id = v_emp AND status = 'active';

  UPDATE public.hr_loan_installments li SET paid = TRUE, paid_at = now()
  FROM public.hr_loans l
  WHERE li.loan_id = l.id AND l.employee_id = v_emp AND li.paid = FALSE;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.hr_termination_refresh_components(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_termination_approve(UUID) TO authenticated;
