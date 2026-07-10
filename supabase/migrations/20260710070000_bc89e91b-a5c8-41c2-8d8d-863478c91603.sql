-- Phase 2 security fixes: HR workflow request creation and payroll approval
-- segregation of duties.

-- H19: hr_wf_insert previously allowed ANY authenticated user to create an HR
-- workflow request for any employee and any request type (including
-- termination, salary_increase, dismissal-adjacent types), because the INSERT
-- policy only checked that the caller was logged in, not that they hold
-- hr.workflow:create. This matches every other HR table's insert policy
-- pattern in the schema.
DROP POLICY IF EXISTS "hr_wf_insert" ON public.hr_workflow_requests;
CREATE POLICY "hr_wf_insert" ON public.hr_workflow_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'hr.workflow','create') OR public.is_admin(auth.uid()));

-- H20: hr_payroll_runs/lines previously shared a single 'hr.payroll' edit
-- permission for everything — the same person who prepares a payroll run
-- could also approve it and mark it paid, with no segregation of duties.
-- This trigger requires a *separate* 'approve' action specifically for the
-- transition into 'approved' or 'paid' (mirrors the hr.workflow:approve
-- pattern already used for workflow steps); preparing/editing a draft still
-- only needs the existing hr.payroll:edit permission via the table's RLS
-- policy.
CREATE OR REPLACE FUNCTION public.hr_payroll_run_guard_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'paid')
     AND NOT (public.has_permission(auth.uid(), 'hr.payroll', 'approve') OR public.is_admin(auth.uid()))
  THEN
    RAISE EXCEPTION 'Insufficient permission: approving or marking a payroll run as paid requires hr.payroll:approve';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_payroll_run_guard ON public.hr_payroll_runs;
CREATE TRIGGER trg_hr_payroll_run_guard
BEFORE UPDATE ON public.hr_payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.hr_payroll_run_guard_status();
