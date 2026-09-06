-- Gate 10 — HR full integration and RLS closure.
-- Close direct workflow-write gaps, make request/decision transitions server-authoritative,
-- and pin the remaining authoritative HR SECURITY DEFINER functions to an empty search path.

DO $$
BEGIN
  IF to_regclass('public.hr_workflow_requests') IS NULL
     OR to_regclass('public.hr_workflow_steps') IS NULL
     OR to_regclass('public.hr_employees') IS NULL THEN
    RAISE EXCEPTION 'Gate 10 requires the HR workflow foundation';
  END IF;

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL
     OR to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Gate 10 requires the permission foundation';
  END IF;

  IF to_regprocedure('public.hr_submit_workflow_request(public.hr_request_type,uuid,text,text,jsonb)') IS NOT NULL
     OR to_regprocedure('public.hr_decide_workflow_step(uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Gate 10 appears partially or already applied; inspect before retrying';
  END IF;
END;
$$;

-- The old policies allowed any authenticated caller to forge requested_by/status on
-- INSERT and allowed own-request updates without a WITH CHECK. Steps also had a FOR ALL
-- policy whose INSERT path reduced to auth.uid() IS NOT NULL. All authenticated workflow
-- mutation now goes through the two RPCs below.
DROP POLICY IF EXISTS "hr_wf_insert" ON public.hr_workflow_requests;
DROP POLICY IF EXISTS "hr_wf_update" ON public.hr_workflow_requests;
DROP POLICY IF EXISTS "hr_wf_delete" ON public.hr_workflow_requests;
DROP POLICY IF EXISTS "hr_wf_steps_write" ON public.hr_workflow_steps;

REVOKE INSERT, UPDATE, DELETE ON public.hr_workflow_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.hr_workflow_steps FROM authenticated;

-- Keep read access explicit and ownership-aware.
DROP POLICY IF EXISTS "hr_wf_read" ON public.hr_workflow_requests;
CREATE POLICY hr_wf_read ON public.hr_workflow_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR public.has_permission(auth.uid(), 'hr.workflow', 'view')
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "hr_wf_steps_read" ON public.hr_workflow_steps;
CREATE POLICY hr_wf_steps_read ON public.hr_workflow_steps
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.hr_workflow_requests r
    WHERE r.id = request_id
      AND (
        r.requested_by = auth.uid()
        OR public.has_permission(auth.uid(), 'hr.workflow', 'view')
        OR public.has_permission(auth.uid(), 'hr.workflow', 'approve')
        OR public.is_admin(auth.uid())
      )
  )
);

CREATE FUNCTION public.hr_submit_workflow_request(
  _request_type public.hr_request_type,
  _employee_id UUID,
  _subject TEXT,
  _notes TEXT DEFAULT NULL,
  _payload JSONB DEFAULT '{}'::JSONB
)
RETURNS public.hr_workflow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_employee_user UUID;
  v_request public.hr_workflow_requests;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee is required';
  END IF;
  IF _subject IS NOT NULL AND length(_subject) > 500 THEN
    RAISE EXCEPTION 'Workflow subject is too long';
  END IF;
  IF pg_column_size(COALESCE(_payload, '{}'::JSONB)) > 65536 THEN
    RAISE EXCEPTION 'Workflow payload is too large';
  END IF;

  SELECT e.user_id
  INTO v_employee_user
  FROM public.hr_employees e
  WHERE e.id = _employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- Self-service is allowed only for the employee linked to the caller. HR workflow
  -- creators/editors may submit on behalf of another employee.
  IF v_employee_user IS DISTINCT FROM v_uid
     AND NOT (
       public.has_permission(v_uid, 'hr.workflow', 'create')
       OR public.has_permission(v_uid, 'hr.workflow', 'edit')
       OR public.is_admin(v_uid)
     ) THEN
    RAISE EXCEPTION 'Insufficient permission to submit this HR workflow request';
  END IF;

  INSERT INTO public.hr_workflow_requests (
    request_no,
    request_type,
    requested_by,
    employee_id,
    subject,
    payload,
    status,
    current_step,
    submitted_at,
    notes
  ) VALUES (
    'REQ-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-'
      || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6)),
    _request_type,
    v_uid,
    _employee_id,
    nullif(btrim(_subject), ''),
    COALESCE(_payload, '{}'::JSONB),
    'pending',
    1,
    now(),
    nullif(btrim(_notes), '')
  )
  RETURNING * INTO v_request;

  -- Until a configurable multi-step approval matrix is introduced, Gate 10 creates
  -- one authoritative HR approval step. The step is intentionally unassigned; only
  -- hr.workflow:approve or admin can decide it.
  INSERT INTO public.hr_workflow_steps (
    request_id,
    step_order,
    approver_id,
    approver_role,
    action
  ) VALUES (
    v_request.id,
    1,
    NULL,
    'hr.workflow:approve',
    'pending'
  );

  RETURN v_request;
END;
$$;

CREATE FUNCTION public.hr_decide_workflow_step(
  _step_id UUID,
  _action TEXT,
  _comment TEXT DEFAULT NULL
)
RETURNS public.hr_workflow_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_step public.hr_workflow_steps;
  v_request public.hr_workflow_requests;
  v_pending_count INTEGER;
  v_rejected_count INTEGER;
  v_next_step INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Workflow decision must be approved or rejected';
  END IF;
  IF _comment IS NOT NULL AND length(_comment) > 4000 THEN
    RAISE EXCEPTION 'Workflow decision comment is too long';
  END IF;

  -- Request first, then step, gives one deterministic lock order for all decisions.
  SELECT r.*
  INTO v_request
  FROM public.hr_workflow_requests r
  JOIN public.hr_workflow_steps s ON s.request_id = r.id
  WHERE s.id = _step_id
  FOR UPDATE OF r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found';
  END IF;

  SELECT *
  INTO v_step
  FROM public.hr_workflow_steps
  WHERE id = _step_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found';
  END IF;

  IF v_request.status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'Workflow request is not awaiting a decision (%)', v_request.status;
  END IF;
  IF v_step.action IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Workflow step has already been decided (%)', v_step.action;
  END IF;

  -- approver_id is nullable for role-based approval steps. Keep the comparison
  -- null-safe so SQL three-valued logic can never turn NULL into an authorization pass.
  IF NOT (
    (v_step.approver_id IS NOT NULL AND v_step.approver_id = v_uid)
    OR public.has_permission(v_uid, 'hr.workflow', 'approve')
    OR public.is_admin(v_uid)
  ) THEN
    RAISE EXCEPTION 'Insufficient permission to decide this HR workflow step';
  END IF;

  UPDATE public.hr_workflow_steps
  SET action = _action,
      approver_id = v_uid,
      comment = nullif(btrim(_comment), ''),
      acted_at = now()
  WHERE id = _step_id;

  SELECT
    COUNT(*) FILTER (WHERE action = 'pending'),
    COUNT(*) FILTER (WHERE action = 'rejected'),
    MIN(step_order) FILTER (WHERE action = 'pending')
  INTO v_pending_count, v_rejected_count, v_next_step
  FROM public.hr_workflow_steps
  WHERE request_id = v_request.id;

  UPDATE public.hr_workflow_requests
  SET status = CASE
        WHEN v_rejected_count > 0 THEN 'rejected'::public.hr_request_status
        WHEN v_pending_count = 0 THEN 'approved'::public.hr_request_status
        ELSE 'in_progress'::public.hr_request_status
      END,
      current_step = COALESCE(v_next_step, v_step.step_order),
      completed_at = CASE
        WHEN v_rejected_count > 0 OR v_pending_count = 0 THEN now()
        ELSE NULL
      END
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_submit_workflow_request(public.hr_request_type, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_submit_workflow_request(public.hr_request_type, UUID, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.hr_submit_workflow_request(public.hr_request_type, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.hr_decide_workflow_step(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_decide_workflow_step(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.hr_decide_workflow_step(UUID, TEXT, TEXT) TO authenticated, service_role;

-- Pin authoritative HR functions. Their bodies qualify application objects with public/auth,
-- so an empty search path removes object-shadowing risk without changing behavior.
ALTER FUNCTION public.hr_calculate_service_period(UUID, DATE) SET search_path = '';
ALTER FUNCTION public.hr_termination_refresh_components(UUID) SET search_path = '';
ALTER FUNCTION public.hr_termination_create_draft(JSONB) SET search_path = '';
ALTER FUNCTION public.hr_termination_clearance(UUID) SET search_path = '';
ALTER FUNCTION public.hr_termination_approve(UUID) SET search_path = '';
ALTER FUNCTION public.hr_leave_rule(TEXT, DATE) SET search_path = '';
ALTER FUNCTION public.hr_calc_leave_entitlement(UUID, TEXT, INTEGER) SET search_path = '';
ALTER FUNCTION public.hr_get_leave_summary(UUID, INTEGER) SET search_path = '';
ALTER FUNCTION public.hr_leave_validate_request() SET search_path = '';
ALTER FUNCTION public.hr_leave_guard_decision() SET search_path = '';
ALTER FUNCTION public.hr_leaves_balance_sync() SET search_path = '';
ALTER FUNCTION public.hr_leave_decide(UUID, BOOLEAN) SET search_path = '';

-- Explicitly remove the default PUBLIC execute grant from client-facing and internal
-- authoritative HR helpers; re-grant only the public API surface actually used by the app.
REVOKE ALL ON FUNCTION public.hr_calculate_service_period(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_calculate_service_period(UUID, DATE) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.hr_termination_refresh_components(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_termination_refresh_components(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.hr_termination_create_draft(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_termination_create_draft(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.hr_termination_clearance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_termination_clearance(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.hr_termination_approve(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_termination_approve(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.hr_leave_rule(TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_rule(TEXT, DATE) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.hr_calc_leave_entitlement(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_calc_leave_entitlement(UUID, TEXT, INTEGER) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.hr_get_leave_summary(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_get_leave_summary(UUID, INTEGER) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.hr_leave_decide(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_decide(UUID, BOOLEAN) TO authenticated;

-- Trigger helpers should never be callable as RPCs.
REVOKE ALL ON FUNCTION public.hr_leave_validate_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_leave_guard_decision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_leaves_balance_sync() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.hr_submit_workflow_request(public.hr_request_type, UUID, TEXT, TEXT, JSONB) IS
  'Gate 10 authoritative HR workflow submission. Creates the request and its initial approval step atomically.';
COMMENT ON FUNCTION public.hr_decide_workflow_step(UUID, TEXT, TEXT) IS
  'Gate 10 authoritative HR workflow decision. Locks request/step, enforces approver permission, and derives request status from steps.';
