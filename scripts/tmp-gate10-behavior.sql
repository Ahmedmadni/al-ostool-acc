\set ON_ERROR_STOP on

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.hr_workflow_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.hr_workflow_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.hr_workflow_requests', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated still has direct request DML';
  END IF;
  IF has_table_privilege('authenticated', 'public.hr_workflow_steps', 'INSERT')
     OR has_table_privilege('authenticated', 'public.hr_workflow_steps', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.hr_workflow_steps', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated still has direct step DML';
  END IF;
  IF has_function_privilege('anon', 'public.hr_submit_workflow_request(public.hr_request_type,uuid,text,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.hr_decide_workflow_step(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute Gate 10 workflow RPCs';
  END IF;
  IF has_function_privilege('authenticated', 'public.hr_leave_validate_request()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.hr_leave_guard_decision()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.hr_leaves_balance_sync()', 'EXECUTE') THEN
    RAISE EXCEPTION 'trigger-only leave functions remain RPC-callable';
  END IF;
END $$;

DO $$
DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(ARRAY[
      'hr_submit_workflow_request','hr_decide_workflow_step','hr_calculate_service_period',
      'hr_termination_refresh_components','hr_termination_create_draft','hr_termination_clearance',
      'hr_termination_approve','hr_leave_rule','hr_calc_leave_entitlement','hr_get_leave_summary',
      'hr_leave_validate_request','hr_leave_guard_decision','hr_leaves_balance_sync','hr_leave_decide'
    ])
    AND position('search_path=""' in COALESCE(array_to_string(p.proconfig, ','), '')) = 0;
  IF bad_count <> 0 THEN
    RAISE EXCEPTION '% authoritative HR functions do not have empty search_path', bad_count;
  END IF;
END $$;

SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET app.test_permission = '';
SET app.test_admin = '';

-- A caller may submit only for their linked employee without delegated HR permission.
SELECT public.hr_submit_workflow_request(
  'leave'::public.hr_request_type,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Self request',
  'note',
  '{}'::jsonb
);

DO $$
DECLARE c integer;
BEGIN
  SELECT count(*) INTO c
  FROM public.hr_workflow_steps s
  JOIN public.hr_workflow_requests r ON r.id = s.request_id
  WHERE r.subject = 'Self request' AND s.action = 'pending' AND s.step_order = 1;
  IF c <> 1 THEN RAISE EXCEPTION 'submission did not create exactly one pending approval step'; END IF;
END $$;

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.hr_submit_workflow_request(
      'leave'::public.hr_request_type,
      '10000000-0000-0000-0000-000000000002'::uuid,
      'Forged other employee request', NULL, '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'self-service caller submitted for another employee'; END IF;
END $$;

-- Delegated HR creator can submit for another employee.
SET app.test_permission = 'hr.workflow:create';
SELECT public.hr_submit_workflow_request(
  'promotion'::public.hr_request_type,
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Delegated request', NULL, '{}'::jsonb
);
SET app.test_permission = '';

-- Request owner without approve permission cannot decide.
DO $$
DECLARE denied boolean := false;
DECLARE v_step uuid;
BEGIN
  SELECT s.id INTO v_step
  FROM public.hr_workflow_steps s
  JOIN public.hr_workflow_requests r ON r.id = s.request_id
  WHERE r.subject = 'Self request' AND s.action = 'pending';
  BEGIN
    PERFORM public.hr_decide_workflow_step(v_step, 'approved', NULL);
  EXCEPTION WHEN OTHERS THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'request owner decided workflow without approve permission'; END IF;
END $$;

SET app.test_permission = 'hr.workflow:approve';
DO $$
DECLARE v_step uuid;
DECLARE v_request uuid;
DECLARE v_status public.hr_request_status;
BEGIN
  SELECT s.id, r.id INTO v_step, v_request
  FROM public.hr_workflow_steps s
  JOIN public.hr_workflow_requests r ON r.id = s.request_id
  WHERE r.subject = 'Self request' AND s.action = 'pending';

  SELECT (public.hr_decide_workflow_step(v_step, 'approved', 'approved in test')).status INTO v_status;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'approved step did not approve request'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.hr_workflow_requests
    WHERE id = v_request AND status = 'approved' AND completed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'approved request final state is incomplete'; END IF;

  BEGIN
    PERFORM public.hr_decide_workflow_step(v_step, 'approved', NULL);
    RAISE EXCEPTION 'workflow step was decided twice';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'workflow step was decided twice' THEN RAISE; END IF;
  END;
END $$;

-- Rejection propagates to the request.
DO $$
DECLARE v_step uuid;
DECLARE v_status public.hr_request_status;
BEGIN
  SELECT s.id INTO v_step
  FROM public.hr_workflow_steps s
  JOIN public.hr_workflow_requests r ON r.id = s.request_id
  WHERE r.subject = 'Delegated request' AND s.action = 'pending';
  SELECT (public.hr_decide_workflow_step(v_step, 'rejected', 'rejected in test')).status INTO v_status;
  IF v_status <> 'rejected' THEN RAISE EXCEPTION 'rejected step did not reject request'; END IF;
END $$;

RESET ROLE;

-- Service role retains backend mutation capability.
DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.hr_workflow_requests', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.hr_workflow_requests', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.hr_workflow_requests', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.hr_workflow_steps', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.hr_workflow_steps', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.hr_workflow_steps', 'DELETE') THEN
    RAISE EXCEPTION 'service_role lost backend workflow mutation privileges';
  END IF;
END $$;

SELECT 'Gate 10 PostgreSQL behavioral checks passed' AS result;
