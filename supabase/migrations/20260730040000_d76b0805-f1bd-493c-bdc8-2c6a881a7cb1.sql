-- H21: a termination marked 'paid' (settlement disbursed) had no way back —
-- not even to fix a mistaken disbursement — and could never be deleted even
-- after being cancelled, because hr_termination_cancel only accepted
-- draft/pending/approved. Add a direct paid -> approved revert (undoing the
-- disbursement record, not the underlying approval), and let 'paid' files
-- be cancelled the same way 'approved' ones already are (full undo of the
-- employee/loan side effects from hr_termination_approve). Deleting the
-- record itself still only ever happens once it reaches draft/cancelled —
-- the existing hr_term_delete policy is untouched, so a paid settlement
-- must be reversed through this proper undo path before it can be deleted,
-- never dropped directly while still an active financial record.

CREATE OR REPLACE FUNCTION public.hr_termination_revert_disbursement(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية التراجع عن صرف مخالصة نهاية الخدمة';
  END IF;
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status <> 'paid' THEN RAISE EXCEPTION 'termination is not marked as paid (%)', v_status; END IF;

  UPDATE public.hr_terminations SET status = 'approved' WHERE id = _termination_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.hr_termination_revert_disbursement(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_termination_cancel(_termination_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status NOT IN ('draft','pending','approved','paid') THEN RAISE EXCEPTION 'termination cannot be cancelled from state (%)', v_status; END IF;

  IF v_status IN ('approved','paid') THEN
    -- Undoing an approval/disbursement (reopening loans, reactivating the
    -- employee) is an approval-level action, so it needs 'approve', not
    -- just 'edit' — checked here before any row is touched, since
    -- hr_termination_undo_approval only checks the row's current status
    -- against 'approved', not 'paid'. A paid file is stepped back to
    -- approved first (after the permission check), then through the same
    -- undo as before.
    IF NOT (public.has_permission(auth.uid(),'hr.termination','approve') OR public.is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'ليست لديك صلاحية إلغاء ملف إنهاء الخدمة المعتمد/المصروف';
    END IF;
    IF v_status = 'paid' THEN
      UPDATE public.hr_terminations SET status = 'approved' WHERE id = _termination_id;
    END IF;
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
