-- G1: the termination workflow only ever moved forward
-- (draft → pending → approved → paid). There was no way to reject a
-- submission, cancel a file, undo an approval, or delete a mistaken draft —
-- once submitted, a termination was permanent. This adds the missing
-- transitions, and closes a real permission hole found while doing it:
-- hr_termination_approve is SECURITY DEFINER and was only gated by
-- GRANT EXECUTE TO authenticated, with no has_permission() check inside —
-- any authenticated user, including one with only 'view' on hr.termination,
-- could call the RPC directly and approve/terminate any employee. Every
-- status-changing function below now checks has_permission() explicitly,
-- the same way C20 fixed the equivalent hole in the AI functions.

-- G2: leave_balance_amount was SAR-only with no day count stored anywhere
-- queryable — the settlement UI could show/edit only a lump sum, so nobody
-- reviewing a termination could tell whether the value reflected accrued
-- days or a manual override. Add the day count as a first-class column.
ALTER TABLE public.hr_terminations ADD COLUMN IF NOT EXISTS leave_balance_days NUMERIC(8,2) DEFAULT 0;

UPDATE public.hr_terminations t SET leave_balance_days = COALESCE(
  (t.settlement_details->>'leave_days')::numeric,
  CASE WHEN e.gross_salary > 0 THEN ROUND(t.leave_balance_amount / (e.gross_salary / 30.0), 2) ELSE 0 END
)
FROM public.hr_employees e
WHERE e.id = t.employee_id AND t.leave_balance_days = 0 AND t.leave_balance_amount > 0;

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
  IF NOT (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تعديل ملفات إنهاء الخدمة';
  END IF;

  SELECT employee_id, last_working_day INTO v_emp, v_last_day FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;

  SELECT COALESCE(gross_salary, basic_salary, 0) INTO v_gross FROM public.hr_employees WHERE id = v_emp;
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_loan_balance FROM public.hr_loans WHERE employee_id = v_emp AND status = 'active';
  v_leave_days := public.hr_leave_accrued_for_settlement(v_emp, COALESCE(v_last_day, CURRENT_DATE));
  v_leave_value := ROUND(v_leave_days * (v_gross / 30.0), 2);

  UPDATE public.hr_terminations SET
    loan_settlement = v_loan_balance,
    leave_balance_days = v_leave_days,
    leave_balance_amount = v_leave_value
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.hr_termination_approve(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_status TEXT;
  v_clr JSONB;
  v_closed_loans JSONB;
  v_closed_installments JSONB;
  v_row public.hr_terminations;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد إنهاء الخدمة';
  END IF;

  SELECT employee_id, status INTO v_emp, v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'termination is not in an approvable state (%)', v_status; END IF;

  v_clr := public.hr_termination_clearance(v_emp);
  IF NOT (v_clr->>'can_terminate')::boolean THEN
    RAISE EXCEPTION 'لا يمكن إنهاء الخدمة قبل تسوية العهد (عهد لم تُسترجع: %)', v_clr->>'assets_not_returned';
  END IF;

  -- Snapshot what approval is about to close, so a later revert/cancel can
  -- restore exactly this — not just "any active loan the employee happens
  -- to have now", which could clobber loans taken out after approval.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'prior_paid_amount', paid_amount)), '[]'::jsonb)
    INTO v_closed_loans FROM public.hr_loans WHERE employee_id = v_emp AND status = 'active';
  SELECT COALESCE(jsonb_agg(li.id), '[]'::jsonb) INTO v_closed_installments
    FROM public.hr_loan_installments li JOIN public.hr_loans l ON li.loan_id = l.id
    WHERE l.employee_id = v_emp AND l.status = 'active' AND li.paid = FALSE;

  UPDATE public.hr_terminations
  SET status = 'approved', approved_at = now(), approved_by = auth.uid(), clearance_status = v_clr,
      settlement_details = COALESCE(settlement_details, '{}'::jsonb)
        || jsonb_build_object('_closed_loans', v_closed_loans, '_closed_installments', v_closed_installments)
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  UPDATE public.hr_employees SET status = 'terminated' WHERE id = v_emp;

  UPDATE public.hr_loans SET status = 'completed', paid_amount = amount, updated_at = now()
  WHERE employee_id = v_emp AND status = 'active';

  UPDATE public.hr_loan_installments li SET paid = TRUE, paid_at = now()
  FROM public.hr_loans l
  WHERE li.loan_id = l.id AND l.employee_id = v_emp AND li.paid = FALSE;

  RETURN v_row;
END $$;

-- Undo exactly what hr_termination_approve closed, using the snapshot taken
-- at approval time. Shared by both "revert to pending" (fix a mistake
-- before payout) and "cancel an approved file" (called with _target_status).
CREATE OR REPLACE FUNCTION public.hr_termination_undo_approval(_termination_id UUID, _target_status TEXT)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID;
  v_status TEXT;
  v_details JSONB;
  v_row public.hr_terminations;
  v_loan JSONB;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية التراجع عن اعتماد إنهاء الخدمة';
  END IF;

  SELECT employee_id, status, settlement_details INTO v_emp, v_status, v_details FROM public.hr_terminations WHERE id = _termination_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'termination is not approved (%)', v_status; END IF;

  FOR v_loan IN SELECT * FROM jsonb_array_elements(COALESCE(v_details->'_closed_loans', '[]'::jsonb)) LOOP
    UPDATE public.hr_loans SET status = 'active', paid_amount = (v_loan->>'prior_paid_amount')::numeric, updated_at = now()
    WHERE id = (v_loan->>'id')::uuid;
  END LOOP;

  UPDATE public.hr_loan_installments SET paid = FALSE, paid_at = NULL
  WHERE id IN (SELECT (jsonb_array_elements_text(COALESCE(v_details->'_closed_installments', '[]'::jsonb)))::uuid);

  UPDATE public.hr_employees SET status = 'active' WHERE id = v_emp AND status = 'terminated';

  UPDATE public.hr_terminations
  SET status = _target_status, approved_at = NULL, approved_by = NULL,
      settlement_details = (COALESCE(settlement_details, '{}'::jsonb) - '_closed_loans' - '_closed_installments')
  WHERE id = _termination_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.hr_termination_reject(_termination_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية رفض ملف إنهاء الخدمة';
  END IF;
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'termination is not pending approval (%)', v_status; END IF;

  UPDATE public.hr_terminations
  SET status = 'draft',
      settlement_details = COALESCE(settlement_details, '{}'::jsonb) || jsonb_build_object('rejection_reason', _reason, 'rejected_at', now())
  WHERE id = _termination_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.hr_termination_cancel(_termination_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status NOT IN ('draft','pending','approved') THEN RAISE EXCEPTION 'termination cannot be cancelled from state (%)', v_status; END IF;

  IF v_status = 'approved' THEN
    -- Undoing an approval (reopening loans, reactivating the employee) is
    -- an approval-level action, so it needs 'approve', not just 'edit'.
    v_row := public.hr_termination_undo_approval(_termination_id, 'cancelled');
    UPDATE public.hr_terminations
    SET settlement_details = COALESCE(settlement_details, '{}'::jsonb) || jsonb_build_object('cancel_reason', _reason, 'cancelled_at', now())
    WHERE id = _termination_id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF NOT (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إلغاء ملف إنهاء الخدمة';
  END IF;

  UPDATE public.hr_terminations
  SET status = 'cancelled',
      settlement_details = COALESCE(settlement_details, '{}'::jsonb) || jsonb_build_object('cancel_reason', _reason, 'cancelled_at', now())
  WHERE id = _termination_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.hr_termination_restore(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية استعادة ملف إنهاء الخدمة';
  END IF;
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'termination is not cancelled (%)', v_status; END IF;

  UPDATE public.hr_terminations SET status = 'draft' WHERE id = _termination_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.hr_termination_undo_approval(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_termination_reject(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_termination_cancel(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_termination_restore(UUID) TO authenticated;

-- The revert action (approved → pending, for fixing a mistake before payout)
-- is undo_approval targeting 'pending'; expose it under its own name so the
-- client doesn't need to know the internal helper's signature.
CREATE OR REPLACE FUNCTION public.hr_termination_revert_approval(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.hr_termination_undo_approval(_termination_id, 'pending');
END $$;
GRANT EXECUTE ON FUNCTION public.hr_termination_revert_approval(UUID) TO authenticated;

-- DELETE was previously covered by the FOR ALL "hr_term_all" policy's USING
-- clause, which only checked 'view' — anyone who could see terminations
-- could delete them outright via a direct table call. Split the policy so
-- DELETE requires the dedicated 'delete' permission and is only possible
-- on draft/cancelled files (never an approved/paid financial record).
DROP POLICY IF EXISTS "hr_term_all" ON public.hr_terminations;

CREATE POLICY "hr_term_select" ON public.hr_terminations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.termination','view') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_term_insert" ON public.hr_terminations FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_term_update" ON public.hr_terminations FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_term_delete" ON public.hr_terminations FOR DELETE TO authenticated
  USING (
    (public.has_permission(auth.uid(),'hr.termination','delete') OR public.is_admin(auth.uid()))
    AND status IN ('draft','cancelled')
  );
