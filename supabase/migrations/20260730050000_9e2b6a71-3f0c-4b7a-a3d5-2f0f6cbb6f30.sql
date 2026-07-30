-- H29: hr_term_update only ever checked 'edit' permission, with no
-- restriction on which status a direct client update could set. A user
-- holding just 'hr.termination:edit' (not 'approve') could therefore call
-- supabase.from('hr_terminations').update({status:'approved'}) directly —
-- exactly the bypass PR #8 closed for the RPC itself (hr_termination_approve
-- checks permission internally), except the raw table write was never
-- covered. Going around the RPC this way skips the clearance check (assets
-- not returned), skips closing the employee's active loans/installments and
-- snapshotting them for a later cancel/revert, and skips marking the
-- employee 'terminated' — leaving an approved settlement with an employee
-- still shown active and loans never closed. The same raw-update path was
-- also how "تسجيل صرف المخالصة" (approved -> paid) worked, so it gets its
-- own gated RPC here instead.
--
-- Direct client updates are now only allowed while the row is still
-- 'draft' (editing settlement line items, or submitting into 'pending').
-- Every later transition (approve/reject/cancel/revert/mark paid/restore)
-- already goes through a SECURITY DEFINER function, which bypasses RLS on
-- its own internal UPDATE — so none of those flows are affected.

CREATE OR REPLACE FUNCTION public.hr_termination_mark_paid(_termination_id UUID)
RETURNS public.hr_terminations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_row public.hr_terminations;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تسجيل صرف المخالصة';
  END IF;
  SELECT status INTO v_status FROM public.hr_terminations WHERE id = _termination_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'termination not found'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'termination is not approved (%)', v_status; END IF;

  UPDATE public.hr_terminations SET status = 'paid' WHERE id = _termination_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.hr_termination_mark_paid(UUID) TO authenticated;

DROP POLICY IF EXISTS "hr_term_update" ON public.hr_terminations;
CREATE POLICY "hr_term_update" ON public.hr_terminations FOR UPDATE TO authenticated
  USING ((public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) AND status = 'draft')
  WITH CHECK ((public.has_permission(auth.uid(),'hr.termination','edit') OR public.is_admin(auth.uid())) AND status IN ('draft','pending'));
