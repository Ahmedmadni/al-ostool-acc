-- H14: hr_termination_clearance's can_terminate only checked returned assets,
-- ignoring outstanding loans — even though the termination detail page's
-- warning banner (src/routes/_authenticated/hr/termination/$id.tsx) already
-- displays "سلف قائمة" alongside "عهد لم تُسترجع" under a single "cannot
-- terminate before settling custody" message, and gates the approval buttons
-- on can_terminate. The UI already implied loans were blocking; the backend
-- now actually enforces it.
CREATE OR REPLACE FUNCTION public.hr_termination_clearance(_employee_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE loans_open INT; assets_open INT; loans_remaining NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount - COALESCE(paid_amount,0)),0)
    INTO loans_open, loans_remaining FROM public.hr_loans WHERE employee_id = _employee_id AND status = 'active';
  SELECT COUNT(*) INTO assets_open FROM public.hr_assets_assignment WHERE employee_id = _employee_id AND is_returned = FALSE;
  RETURN jsonb_build_object(
    'loans_open', loans_open, 'loans_remaining_amount', loans_remaining,
    'assets_not_returned', assets_open,
    'can_terminate', (assets_open = 0 AND loans_open = 0)
  );
END $$;

-- H15: net_settlement was only computed once at creation (net_settlement =
-- eos_amount) and never revisited — if leave_balance_amount, outstanding
-- allowances/deductions, other receivables/payables, or loan_settlement were
-- filled in afterwards, the displayed "صافي المخالصة" silently went stale.
-- This recomputes it on every insert/update from the current line items, so
-- it can never drift from what's actually recorded.
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
