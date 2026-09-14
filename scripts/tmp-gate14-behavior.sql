\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

DO $$
DECLARE c uuid; s public.ops_sites; a public.ops_assets;
BEGIN
  SELECT id INTO c FROM public.group_companies WHERE code='OM';
  PERFORM public.ops_upsert_sla_policy('critical',15,120,'حرج','Critical');
  s:=public.ops_create_site('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','SITE-01','موقع الاختبار','الرياض','الرياض');
  a:=public.ops_create_asset('30000000-0000-0000-0000-000000000001',s.id,'AHU-01','وحدة مناولة الهواء','hvac','SN-01','Test','M1','high');
  IF NOT public.ops_has_company_access(c) THEN RAISE EXCEPTION 'admin should have OM maintenance access'; END IF;
  IF a.site_id<>s.id THEN RAISE EXCEPTION 'asset/site linkage failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);

DO $$
DECLARE s uuid; a uuid; r public.ops_service_requests;
BEGIN
  SELECT id INTO s FROM public.ops_sites WHERE code='SITE-01';
  SELECT id INTO a FROM public.ops_assets WHERE asset_code='AHU-01';
  r:=public.ops_create_service_request('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',s,'عطل تكييف','درجة الحرارة مرتفعة','critical',a);
  IF r.status<>'new' OR r.request_no !~ '^SR-[0-9]{4}-[0-9]{6}$' THEN RAISE EXCEPTION 'service request creation/numbering failed'; END IF;
  IF r.response_due_at IS NULL OR r.resolution_due_at IS NULL THEN RAISE EXCEPTION 'SLA due timestamps were not calculated'; END IF;
  PERFORM public.ops_set_request_status(r.id,'triaged','تم التصنيف');
  BEGIN
    PERFORM public.ops_set_request_status(r.id,'approved','member approval must fail');
    RAISE EXCEPTION 'member approved service request';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='member approved service request' OR position('manager access required' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ops_create_work_order(r.id,NULL);
    RAISE EXCEPTION 'member created work order';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='member created work order' OR position('manager access required' in SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

DO $$
DECLARE rid uuid; wid uuid; w public.ops_work_orders; v public.ops_work_visits; acc public.ops_work_acceptances;
BEGIN
  SELECT id INTO rid FROM public.ops_service_requests LIMIT 1;
  PERFORM public.ops_set_request_status(rid,'approved','اعتماد الطلب');
  w:=public.ops_create_work_order(rid,NULL);
  wid:=w.id;
  IF w.work_order_no !~ '^WO-[0-9]{4}-[0-9]{6}$' OR w.status<>'draft' THEN RAISE EXCEPTION 'work order creation/numbering failed'; END IF;

  PERFORM public.ops_transition_work_order(wid,'approved','اعتماد أمر العمل');
  PERFORM public.ops_assign_employee(wid,'50000000-0000-0000-0000-000000000001','technician');
  IF (SELECT status FROM public.ops_work_orders WHERE id=wid)<>'assigned' THEN RAISE EXCEPTION 'assignment did not move work order to assigned'; END IF;

  v:=public.ops_record_visit(wid,'50000000-0000-0000-0000-000000000001',now()-interval '1 hour',now(),'تشخيص','إصلاح','تم الاختبار');
  IF (SELECT status FROM public.ops_work_orders WHERE id=wid)<>'in_progress' THEN RAISE EXCEPTION 'visit did not start work order'; END IF;

  PERFORM public.ops_add_material(wid,'70000000-0000-0000-0000-000000000001','فلتر',2,50);
  PERFORM public.ops_add_subcontract_cost(wid,'60000000-0000-0000-0000-000000000001','اختبار متخصص',300,'INV-T-1');
  IF public.ops_work_order_cost(wid)<>400 THEN RAISE EXCEPTION 'work order cost mismatch: %',public.ops_work_order_cost(wid); END IF;

  PERFORM public.ops_transition_work_order(wid,'completed','اكتمل التنفيذ');
  BEGIN
    PERFORM public.ops_transition_work_order(wid,'accepted','must use acceptance RPC');
    RAISE EXCEPTION 'direct accepted transition allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='direct accepted transition allowed' OR position('invalid work order transition' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  acc:=public.ops_accept_work_order(wid,'ممثل العميل','مدير الموقع','مقبول','sig:test','{"source":"test"}'::jsonb);
  IF (SELECT status FROM public.ops_work_orders WHERE id=wid)<>'accepted' OR acc.signature_ref<>'sig:test' THEN RAISE EXCEPTION 'customer acceptance failed'; END IF;
  IF (SELECT count(*) FROM public.ops_status_events WHERE entity_type='work_order' AND entity_id=wid)<5 THEN RAISE EXCEPTION 'work order audit trail incomplete'; END IF;
END $$;

DO $$
DECLARE c uuid;
BEGIN
  SELECT id INTO c FROM public.group_companies WHERE code='OM';
  IF has_function_privilege('anon','public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute service request RPC'; END IF;
  IF NOT has_function_privilege('authenticated','public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'authenticated lost supported RPC execute'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.ops_work_orders'::regclass) THEN RAISE EXCEPTION 'work order RLS disabled'; END IF;
END $$;

SELECT 'Gate 14 maintenance operations behavior checks passed' AS result;
