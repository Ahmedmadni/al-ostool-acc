\set ON_ERROR_STOP on

SELECT set_config('app.test_admin','true',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);

INSERT INTO public.invoices(id,invoice_number,issue_date,amount,vat_amount,tax_category,status) VALUES
('10000000-0000-0000-0000-000000000001','S-JAN-1','2026-01-10',1000,150,'standard','issued'),
('10000000-0000-0000-0000-000000000002','S-FEB-1','2026-02-10',500,75,'standard','issued'),
('10000000-0000-0000-0000-000000000003','S-OUT-1','2026-04-10',100,15,'standard','issued'),
('10000000-0000-0000-0000-000000000004','S-CONC-1','2027-01-10',100,15,'standard','issued');
INSERT INTO public.purchase_invoices(id,invoice_number,issue_date,amount,vat_amount,tax_category,status,currency) VALUES
('20000000-0000-0000-0000-000000000001','P-JAN-1','2026-01-11',200,30,'standard','received','SAR'),
('20000000-0000-0000-0000-000000000002','P-FEB-1','2026-02-11',100,15,'standard','received','SAR');

DO $$
DECLARE r public.vat_returns;
BEGIN
  r:=public.vat_calculate_return_flexible(
    '2026-01-01','2026-01-31',
    ARRAY['10000000-0000-0000-0000-000000000001'::uuid],
    ARRAY['20000000-0000-0000-0000-000000000001'::uuid],
    '[{"direction":"sale","tax_category":"standard","net_amount":10,"vat_amount":1.5,"reason":"test adjustment"}]'::jsonb,
    0,
    jsonb_build_object('period_from','2026-01-01','period_to','2026-01-31')
  );
  IF r.status<>'calculated' OR r.net_vat<>121.50 OR r.final_vat<>121.50 THEN
    RAISE EXCEPTION 'Gate12 VAT calculation mismatch: status %, net %, final %',r.status,r.net_vat,r.final_vat;
  END IF;
  IF (SELECT count(*) FROM public.vat_return_sources WHERE return_id=r.id)<>2 THEN
    RAISE EXCEPTION 'Gate12 did not snapshot selected sources';
  END IF;
  IF r.data->>'calculation_version'<>'vat-v3-gate12' THEN
    RAISE EXCEPTION 'Gate12 calculation version not persisted';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.vat_calculate_return_flexible('2026-01-15','2026-02-15',NULL,NULL,'[]'::jsonb,0,'{}'::jsonb);
    RAISE EXCEPTION 'overlapping VAT return was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='overlapping VAT return was accepted' OR position('تتداخل' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE rid uuid;
BEGIN
  SELECT id INTO rid FROM public.vat_returns WHERE period_from='2026-01-01';
  PERFORM public.vat_approve_return(rid);
  IF (SELECT status FROM public.vat_returns WHERE id=rid)<>'approved' THEN RAISE EXCEPTION 'VAT approval failed'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.invoices SET issue_date='2026-03-01' WHERE id='10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'finalized source moved out of VAT period';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='finalized source moved out of VAT period' OR position('إقرار معتمد أو مقدم' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.invoices SET issue_date='2026-01-20' WHERE id='10000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'source moved into finalized VAT period';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='source moved into finalized VAT period' OR position('إقرار معتمد أو مقدم' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.purchase_invoices SET currency='USD' WHERE id='20000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'purchase currency changed inside finalized VAT period';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='purchase currency changed inside finalized VAT period' OR position('إقرار معتمد أو مقدم' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE rid uuid;
BEGIN
  PERFORM public.vat_calculate_return_flexible(
    '2026-02-01','2026-02-28',
    ARRAY['10000000-0000-0000-0000-000000000002'::uuid],
    ARRAY['20000000-0000-0000-0000-000000000002'::uuid],
    '[]'::jsonb,0,'{}'::jsonb
  );
  SELECT id INTO rid FROM public.vat_returns WHERE period_from='2026-02-01';
  UPDATE public.invoices SET invoice_number='S-FEB-1-EDIT' WHERE id='10000000-0000-0000-0000-000000000002';
  BEGIN
    PERFORM public.vat_approve_return(rid);
    RAISE EXCEPTION 'approval accepted changed invoice number';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='approval accepted changed invoice number' OR position('تغير مصدر' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  PERFORM public.vat_calculate_return_flexible(
    '2026-02-01','2026-02-28',
    ARRAY['10000000-0000-0000-0000-000000000002'::uuid],
    ARRAY['20000000-0000-0000-0000-000000000002'::uuid],
    '[]'::jsonb,0,'{}'::jsonb
  );
  UPDATE public.purchase_invoices SET currency='USD' WHERE id='20000000-0000-0000-0000-000000000002';
  BEGIN
    PERFORM public.vat_approve_return(rid);
    RAISE EXCEPTION 'approval accepted changed purchase currency';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='approval accepted changed purchase currency' OR position('تغير مصدر' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  UPDATE public.purchase_invoices SET currency='SAR' WHERE id='20000000-0000-0000-0000-000000000002';
  PERFORM public.vat_calculate_return_flexible(
    '2026-02-01','2026-02-28',
    ARRAY['10000000-0000-0000-0000-000000000002'::uuid],
    ARRAY['20000000-0000-0000-0000-000000000002'::uuid],
    '[]'::jsonb,0,'{}'::jsonb
  );
  PERFORM public.vat_approve_return(rid);
END $$;

DO $$
DECLARE rid uuid; original_snapshot jsonb;
BEGIN
  SELECT id INTO rid FROM public.vat_returns WHERE period_from='2026-01-01';
  SELECT source_snapshot INTO original_snapshot FROM public.vat_return_sources
  WHERE return_id=rid AND source_type='sales_invoice' LIMIT 1;
  UPDATE public.vat_return_sources SET source_snapshot=jsonb_set(source_snapshot,'{invoice_number}','"tampered"'::jsonb)
  WHERE return_id=rid AND source_type='sales_invoice';
  BEGIN
    PERFORM public.vat_file_return(rid,'REF-001');
    RAISE EXCEPTION 'filing accepted tampered VAT snapshot';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='filing accepted tampered VAT snapshot'
       OR (position('تغير مصدر مختار' in SQLERRM)=0 AND position('تغيرت لقطة' in SQLERRM)=0) THEN RAISE; END IF;
  END;
  UPDATE public.vat_return_sources SET source_snapshot=original_snapshot
  WHERE return_id=rid AND source_type='sales_invoice';
  PERFORM public.vat_file_return(rid,'REF-001');
  IF (SELECT status FROM public.vat_returns WHERE id=rid)<>'filed' THEN RAISE EXCEPTION 'VAT filing failed'; END IF;
  PERFORM public.vat_reopen_return(rid,'سبب رقابي واضح لإعادة فتح الإقرار');
  IF (SELECT status FROM public.vat_returns WHERE id=rid)<>'calculated' THEN RAISE EXCEPTION 'VAT reopen failed'; END IF;
  IF (SELECT count(*) FROM public.vat_return_status_events WHERE return_id=rid)<3 THEN RAISE EXCEPTION 'VAT status audit events missing'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.tax_rate_rules(tax_type,rate,effective_from,effective_to,source_note)
    VALUES('vat',0.20,'2027-01-01',NULL,'overlap test');
    RAISE EXCEPTION 'overlapping VAT rate window accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='overlapping VAT rate window accepted' OR position('لا يجوز أن تتداخل' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.tax_rate_rules SET rate=0.16 WHERE tax_type='vat' AND effective_from='2020-07-01';
    RAISE EXCEPTION 'finalized VAT rate changed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='finalized VAT rate changed'
       OR (position('إقراراً معتمداً أو مقدماً' in SQLERRM)=0 AND position('إقرار معتمد أو مقدم' in SQLERRM)=0) THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE v_bad integer;
BEGIN
  IF has_function_privilege('authenticated','public.vat_calculate_return(date,date,numeric,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.vat_calculate_return(date,date,numeric,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'legacy VAT calculator remains executable';
  END IF;
  IF NOT has_function_privilege('authenticated','public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vat_approve_return(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vat_file_return(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.vat_reopen_return(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'supported VAT RPC lost authenticated execute';
  END IF;
  IF has_function_privilege('anon','public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.vat_approve_return(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.vat_file_return(uuid,text)','EXECUTE')
     OR has_function_privilege('anon','public.vat_reopen_return(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute a supported VAT RPC';
  END IF;
  IF has_function_privilege('authenticated','public.vat_gate12_lock()','EXECUTE')
     OR has_function_privilege('service_role','public.vat_gate12_lock()','EXECUTE')
     OR has_function_privilege('authenticated','public.vat_gate12_assert_sources_current(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.vat_invoice_tax_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'Gate12 internal helper remains exposed';
  END IF;

  SELECT count(*) INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'vat_calculate_return_flexible','vat_approve_return','vat_file_return','vat_reopen_return',
      'vat_gate12_lock','vat_gate12_assert_no_overlap','vat_gate12_assert_sources_current',
      'vat_return_period_guard','vat_invoice_tax_guard','vat_tax_rate_rule_guard','vat_log_status_transition'
    )
    AND (NOT p.prosecdef OR NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}'::text[])) cfg
      WHERE cfg IN ('search_path=','search_path=""')
    ));
  IF v_bad<>0 THEN RAISE EXCEPTION '% Gate12 VAT functions have invalid SECURITY DEFINER/empty search_path posture',v_bad; END IF;
END $$;

SELECT 'Gate 12 VAT behavior checks passed' AS result;
