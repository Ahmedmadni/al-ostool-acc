\set ON_ERROR_STOP on

DO $$
DECLARE
  v_return public.zakat_returns;
  v_mapping_id uuid;
  v_mapping_version integer;
  v_event_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

  PERFORM public.zakat_save_account_mappings(
    '[{"account_code":"3000","target_key":"z_capital","multiplier":1}]'::jsonb
  );
  PERFORM public.zakat_save_account_mappings(
    '[{"account_code":"3000","target_key":"z_capital","multiplier":1}]'::jsonb
  );
  SELECT id,version INTO v_mapping_id,v_mapping_version FROM public.zakat_account_mappings WHERE account_code='3000';
  IF v_mapping_version<>2 THEN RAISE EXCEPTION 'Gate18 test: mapping version was not incremented'; END IF;
  SELECT count(*) INTO v_event_count FROM public.zakat_account_mapping_events WHERE mapping_id=v_mapping_id;
  IF v_event_count<>2 THEN RAISE EXCEPTION 'Gate18 test: mapping audit events missing'; END IF;

  BEGIN
    UPDATE public.zakat_account_mappings SET target_key='z_retained' WHERE id=v_mapping_id;
    RAISE EXCEPTION 'Gate18 test: direct mapping update was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%direct Zakat account mapping mutation is blocked%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_return
  FROM public.zakat_calculate_return_mapped(
    '2026-01-01','2026-12-31',
    '[{"entry_id":"10000000-0000-0000-0000-000000000001","target_key":"z_capital","multiplier":1},{"entry_id":"10000000-0000-0000-0000-000000000002","target_key":"z_fixed_assets","multiplier":1}]'::jsonb,
    '[{"field_key":"zakat_add","amount":5000,"reason":"Manual approved addition"}]'::jsonb,
    '{"entity":"Gate 18 test"}'::jsonb,
    0.025,0.20
  );
  IF v_return.status<>'calculated'
     OR v_return.source_fingerprint IS NULL
     OR v_return.data->>'calculation_version'<>'zakat-v3-gate18'
     OR v_return.zakat_due<>2000 THEN
    RAISE EXCEPTION 'Gate18 test: mapped calculation output invalid: %',to_jsonb(v_return);
  END IF;

  BEGIN
    UPDATE public.zakat_return_sources
    SET multiplier=-1
    WHERE return_id=v_return.id
      AND trial_balance_entry_id='10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Gate18 test: direct source mutation was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%direct Zakat source or adjustment mutation is blocked%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.zakat_returns SET data=data||'{"tampered":true}'::jsonb WHERE id=v_return.id;
    RAISE EXCEPTION 'Gate18 test: direct return mutation was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%direct Zakat return mutation is blocked%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_return FROM public.zakat_approve_return(v_return.id);
  IF v_return.status<>'approved' OR v_return.approved_by IS NULL OR v_return.approved_at IS NULL THEN
    RAISE EXCEPTION 'Gate18 test: approval metadata missing';
  END IF;

  UPDATE public.trial_balance_entries
  SET balance=100001
  WHERE id='10000000-0000-0000-0000-000000000001';
  BEGIN
    PERFORM public.zakat_submit_return(v_return.id,'ZATCA-2026-001');
    RAISE EXCEPTION 'Gate18 test: submission accepted source drift';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%تغير مصدر ميزان المراجعة%' THEN RAISE; END IF;
  END;
  UPDATE public.trial_balance_entries
  SET balance=100000
  WHERE id='10000000-0000-0000-0000-000000000001';

  SELECT * INTO v_return FROM public.zakat_submit_return(v_return.id,'ZATCA-2026-001');
  IF v_return.status<>'submitted' OR v_return.submitted_at IS NULL OR v_return.submission_reference<>'ZATCA-2026-001' THEN
    RAISE EXCEPTION 'Gate18 test: valid submission failed';
  END IF;

  BEGIN
    PERFORM public.zakat_reopen_return(v_return.id,'short');
    RAISE EXCEPTION 'Gate18 test: short reopen reason was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%10 إلى 1000%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_return
  FROM public.zakat_reopen_return(v_return.id,'إعادة فتح الإقرار للتحقق من مستند جوهري');
  IF v_return.status<>'calculated' OR v_return.approved_by IS NOT NULL OR v_return.submitted_by IS NOT NULL THEN
    RAISE EXCEPTION 'Gate18 test: reopen did not clear finalization metadata';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.zakat_return_status_events e
    WHERE e.return_id=v_return.id
      AND e.from_status='submitted'
      AND e.to_status='calculated'
      AND e.reason='إعادة فتح الإقرار للتحقق من مستند جوهري'
  ) THEN RAISE EXCEPTION 'Gate18 test: reopen audit reason missing'; END IF;

  BEGIN
    PERFORM public.zakat_calculate_return_mapped(
      '2026-06-01','2027-05-31','[]'::jsonb,
      '[{"field_key":"zakat_add","amount":1000,"reason":"Overlapping test adjustment"}]'::jsonb,
      '{}'::jsonb,0.025,0.20
    );
    RAISE EXCEPTION 'Gate18 test: overlapping Zakat period was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate18 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%تتداخل مع إقرار زكوي%' THEN RAISE; END IF;
  END;

  IF has_table_privilege('authenticated','public.zakat_returns','INSERT')
     OR has_table_privilege('authenticated','public.zakat_returns','UPDATE')
     OR has_table_privilege('authenticated','public.zakat_return_sources','INSERT')
     OR has_table_privilege('authenticated','public.zakat_account_mappings','UPDATE') THEN
    RAISE EXCEPTION 'Gate18 test: authenticated direct table writes remain open';
  END IF;
  IF has_function_privilege('authenticated','public.zakat_gate18_lock()','EXECUTE')
     OR has_function_privilege('authenticated','public.zakat_gate18_assert_sources_current(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.zakat_calculate_return_flexible(date,date,jsonb,jsonb,numeric,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'Gate18 test: internal or legacy RPC is exposed';
  END IF;
  IF NOT has_function_privilege('authenticated','public.zakat_calculate_return_mapped(date,date,jsonb,jsonb,jsonb,numeric,numeric)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.zakat_approve_return(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.zakat_submit_return(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.zakat_reopen_return(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Gate18 test: required Zakat workflow RPC access missing';
  END IF;
END;
$$;

SELECT 'Gate 18 PostgreSQL behavior checks passed' AS result;
