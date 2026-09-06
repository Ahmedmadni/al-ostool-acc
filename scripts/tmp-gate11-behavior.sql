\set ON_ERROR_STOP on

SELECT set_config('app.test_admin','true',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);

DO $$
DECLARE
  v_manual public.cost_entries;
  v_posted public.cost_entries;
  v_reversal public.cost_entries;
  v_period public.cost_periods;
  v_budget public.cost_budgets;
  v_result jsonb;
  v_count integer;
BEGIN
  -- Manual lifecycle and durable status audit.
  v_manual:=public.cost_entry_create_manual(
    'materials',1000,'2026-06-05','Manual cost',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  );
  IF v_manual.workflow_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'manual entry must start as draft';
  END IF;
  IF v_manual.project IS DISTINCT FROM 'Project One' OR v_manual.department IS DISTINCT FROM 'الإدارة الأولى' THEN
    RAISE EXCEPTION 'manual dimensions were not resolved authoritatively';
  END IF;

  v_posted:=public.cost_entry_approve(v_manual.id);
  IF v_posted.workflow_status IS DISTINCT FROM 'posted' OR v_posted.approved_at IS NULL THEN
    RAISE EXCEPTION 'manual approval did not post the cost';
  END IF;
  SELECT count(*) INTO v_count FROM public.cost_entry_status_events WHERE cost_entry_id=v_manual.id;
  IF v_count<>2 THEN RAISE EXCEPTION 'manual lifecycle audit count expected 2, got %',v_count; END IF;

  v_reversal:=public.cost_entry_reverse(v_manual.id,'تصحيح محاسبي موثق للاختبار');
  IF v_reversal.amount IS DISTINCT FROM -1000::numeric OR v_reversal.source_type IS DISTINCT FROM 'reversal' THEN
    RAISE EXCEPTION 'reversal entry is incorrect';
  END IF;
  IF (SELECT workflow_status FROM public.cost_entries WHERE id=v_manual.id) IS DISTINCT FROM 'reversed' THEN
    RAISE EXCEPTION 'original entry was not marked reversed';
  END IF;

  -- A draft entry prevents period close.
  v_manual:=public.cost_entry_create_manual('fuel',250,'2026-07-01','Draft blocker');
  BEGIN
    PERFORM public.cost_period_set_status('2026-07',true,'إقفال شهري للاختبار');
    RAISE EXCEPTION 'expected unresolved-cost close rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%قيود تكلفة غير مرحّلة%' THEN RAISE; END IF;
  END;
  PERFORM public.cost_entry_approve(v_manual.id);
  v_period:=public.cost_period_set_status('2026-07',true,'إقفال شهري للاختبار');
  IF v_period.status IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'period did not close'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.cost_period_status_events
    WHERE period='2026-07' AND to_status='closed'
  ) THEN RAISE EXCEPTION 'period close audit event missing'; END IF;

  BEGIN
    PERFORM public.cost_entry_create_manual('fuel',50,'2026-07-02','Closed-period test');
    RAISE EXCEPTION 'expected closed-period manual rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%فترة التكلفة مقفلة%' THEN RAISE; END IF;
  END;

  v_period:=public.cost_period_set_status('2026-07',false,'إعادة فتح موثقة للاختبار');
  IF v_period.status IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'period did not reopen'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.cost_period_status_events
    WHERE period='2026-07' AND from_status='closed' AND to_status='open'
  ) THEN RAISE EXCEPTION 'period reopen audit event missing'; END IF;

  -- General import: one durable source, exact retry allowed, conflicting retry rejected.
  v_result:=public.cost_import_post(
    'general-key-00000001','general.csv',
    '[{"category":"fuel","amount":"125.50","period":"2026-08-01","description":"Fuel"}]'::jsonb
  );
  IF COALESCE((v_result->>'duplicate')::boolean,true) THEN RAISE EXCEPTION 'first general import marked duplicate'; END IF;
  SELECT count(*) INTO v_count FROM public.cost_import_batches WHERE import_key='general-key-00000001';
  IF v_count<>1 THEN RAISE EXCEPTION 'general import batch count expected 1'; END IF;
  SELECT count(*) INTO v_count FROM public.cost_entries
  WHERE source_type='manual_import' AND meta->>'batch_id'=v_result->>'batch_id' AND workflow_status='posted';
  IF v_count<>1 THEN RAISE EXCEPTION 'general import ledger source expected 1 posted row'; END IF;

  v_result:=public.cost_import_post(
    'general-key-00000001','general.csv',
    '[{"category":"fuel","amount":"125.50","period":"2026-08-01","description":"Fuel"}]'::jsonb
  );
  IF NOT COALESCE((v_result->>'duplicate')::boolean,false) THEN RAISE EXCEPTION 'exact general retry was not duplicate'; END IF;
  SELECT count(*) INTO v_count FROM public.cost_entries
  WHERE source_type='manual_import' AND meta->>'batch_id'=v_result->>'batch_id';
  IF v_count<>1 THEN RAISE EXCEPTION 'general retry created duplicate ledger rows'; END IF;

  BEGIN
    PERFORM public.cost_import_post(
      'general-key-00000001','general.csv',
      '[{"category":"fuel","amount":"999.00","period":"2026-08-01"}]'::jsonb
    );
    RAISE EXCEPTION 'expected general idempotency conflict';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%محتوى مختلف%' THEN RAISE; END IF;
  END;

  PERFORM public.cost_period_set_status('2026-09',true,'إقفال فترة استيراد للاختبار');
  BEGIN
    PERFORM public.cost_import_post(
      'general-key-00000002','closed.csv',
      '[{"category":"fuel","amount":"10","period":"2026-09-01"}]'::jsonb
    );
    RAISE EXCEPTION 'expected closed-period import rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%فترة التكلفة مقفلة%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.cost_import_batches WHERE import_key='general-key-00000002') THEN
    RAISE EXCEPTION 'closed-period general import left a durable batch';
  END IF;

  -- Auxiliary HR import mirrors one accepted source to the ledger and is idempotent.
  v_result:=public.cost_aux_import_post(
    'hr','aux-key-0000000001','hr.csv',
    '[{"employee_name":"Employee A","salary":"100","housing":"20","total_cost":"120","period":"2026-10"}]'::jsonb
  );
  IF COALESCE((v_result->>'duplicate')::boolean,true) THEN RAISE EXCEPTION 'first aux import marked duplicate'; END IF;
  SELECT count(*) INTO v_count FROM public.hr_costs WHERE meta->>'batch_id'=v_result->>'batch_id';
  IF v_count<>1 THEN RAISE EXCEPTION 'aux HR source record expected 1'; END IF;
  SELECT count(*) INTO v_count FROM public.cost_entries
  WHERE source_type='hr_import' AND meta->>'batch_id'=v_result->>'batch_id' AND workflow_status='posted';
  IF v_count<>1 THEN RAISE EXCEPTION 'aux HR ledger row expected 1'; END IF;

  v_result:=public.cost_aux_import_post(
    'hr','aux-key-0000000001','hr.csv',
    '[{"employee_name":"Employee A","salary":"100","housing":"20","total_cost":"120","period":"2026-10"}]'::jsonb
  );
  IF NOT COALESCE((v_result->>'duplicate')::boolean,false) THEN RAISE EXCEPTION 'exact aux retry was not duplicate'; END IF;

  BEGIN
    PERFORM public.cost_aux_import_post(
      'hr','aux-key-0000000001','hr.csv',
      '[{"employee_name":"Employee A","salary":"200","total_cost":"200","period":"2026-10"}]'::jsonb
    );
    RAISE EXCEPTION 'expected aux idempotency conflict';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%محتوى مختلف%' THEN RAISE; END IF;
  END;

  -- Budget lifecycle respects the same cost-period lock and closed state.
  v_budget:=public.cost_budget_save(
    '2026-11','materials',5000,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Initial budget',NULL
  );
  IF v_budget.status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'budget must start draft'; END IF;
  v_budget:=public.cost_budget_approve(v_budget.id);
  IF v_budget.status IS DISTINCT FROM 'approved' OR v_budget.approved_at IS NULL THEN
    RAISE EXCEPTION 'budget approval failed';
  END IF;
  PERFORM public.cost_period_set_status('2026-11',true,'إقفال فترة الموازنة للاختبار');
  BEGIN
    PERFORM public.cost_budget_save('2026-11','materials',5100,NULL,NULL,'Should fail','مراجعة موثقة للاختبار');
    RAISE EXCEPTION 'expected closed-period budget save rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%فترة مقفلة%' THEN RAISE; END IF;
  END;
END;
$$;

-- Function security posture.
DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'cost_entry_create_manual','cost_entry_approve','cost_entry_reverse','cost_period_set_status',
      'cost_import_post','cost_aux_import_post','cost_budget_save','cost_budget_approve'
    )
    AND (
      NOT p.prosecdef
      OR NOT COALESCE(p.proconfig,'{}'::text[]) @> ARRAY['search_path=']::text[]
    );
  IF v_bad<>0 THEN RAISE EXCEPTION '% Gate11 public cost RPCs have invalid definer/search_path posture',v_bad; END IF;

  IF (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cost_entry_guard' LIMIT 1) THEN
    RAISE EXCEPTION 'cost_entry_guard must be SECURITY INVOKER';
  END IF;
END;
$$;

-- ACL posture: authenticated can execute supported RPCs, anon cannot; helpers are private.
DO $$
BEGIN
  IF NOT has_function_privilege('authenticated','public.cost_entry_create_manual(text,numeric,text,text,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost manual cost RPC';
  END IF;
  IF has_function_privilege('anon','public.cost_entry_create_manual(text,numeric,text,text,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute manual cost RPC';
  END IF;
  IF has_function_privilege('authenticated','public.cost_gate11_period_lock(text)','EXECUTE')
     OR has_function_privilege('service_role','public.cost_gate11_period_lock(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.cost_entry_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'internal cost helpers remain executable RPC surfaces';
  END IF;
END;
$$;

-- Direct guard behavior for trusted SQL writers: posted entries remain immutable without bypass.
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.cost_entries(category,period,amount,workflow_status,source_type)
  VALUES('guard-test','2026-12',1,'posted','test') RETURNING id INTO v_id;
  BEGIN
    UPDATE public.cost_entries SET amount=2 WHERE id=v_id;
    RAISE EXCEPTION 'expected posted-entry immutability rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%لا يمكن تعديل قيد مرحل أو معكوس%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT 'Gate 11 PostgreSQL behavior checks passed ✓' AS result;
