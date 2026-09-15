\set ON_ERROR_STOP on

DO $$
DECLARE
  v_it public.group_companies;
  v_module public.group_modules;
  v_json jsonb;
  v_ticket public.cs_tickets;
  v_count integer;
BEGIN
  SELECT * INTO v_it FROM public.group_companies WHERE code='IT';
  IF NOT FOUND THEN RAISE EXCEPTION 'Gate17 test: IT company missing'; END IF;
  IF v_it.name_ar <> 'نواة للحلول الرقمية وتقنية المعلومات' OR v_it.slug <> 'technology' THEN
    RAISE EXCEPTION 'Gate17 test: IT company branding/scope mismatch';
  END IF;

  SELECT * INTO v_module FROM public.group_modules WHERE module_key='it_services';
  IF NOT FOUND OR v_module.route_prefix <> '/technology' THEN
    RAISE EXCEPTION 'Gate17 test: it_services module missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_company_modules cm
    WHERE cm.company_id=v_it.id AND cm.module_id=v_module.id AND cm.is_active
  ) THEN RAISE EXCEPTION 'Gate17 test: IT company/module mapping missing'; END IF;

  IF (SELECT name_ar FROM public.group_companies WHERE code='OM') <> 'مدار للتشغيل والصيانة' THEN
    RAISE EXCEPTION 'Gate17 test: Madar working brand not applied';
  END IF;
  IF (SELECT name_ar FROM public.group_companies WHERE code='RE') <> 'روافد للاستثمار العقاري وإدارة الأصول' THEN
    RAISE EXCEPTION 'Gate17 test: Rawafid working brand not applied';
  END IF;

  IF public.cs_module_for_company_code('IT') <> 'it_services'
     OR public.cs_module_for_company_code('OM') <> 'maintenance'
     OR public.cs_module_for_company_code('RE') <> 'real_estate'
     OR public.cs_module_for_company_code('CORE') <> 'corporate_erp' THEN
    RAISE EXCEPTION 'Gate17 test: company/module mapping helper incorrect';
  END IF;

  IF has_function_privilege('anon','public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Gate17 test: public intake RPC exposed to client roles';
  END IF;
  IF NOT has_function_privilege('service_role','public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Gate17 test: service_role lost public intake RPC access';
  END IF;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_json := public.cs_public_submit_ticket(
    'IT','erp_consulting','Tech Client','0500000000','tech@example.com',
    'ERP transformation','Need integrated ERP and workflow automation','high',
    '90000000-0000-0000-0000-000000000001','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  );
  IF COALESCE(v_json->>'ticket_no','')='' OR COALESCE(v_json->>'duplicate','false')::boolean THEN
    RAISE EXCEPTION 'Gate17 test: first IT public submission invalid: %', v_json;
  END IF;

  v_json := public.cs_public_submit_ticket(
    'IT','erp_consulting','Tech Client','0500000000','tech@example.com',
    'ERP transformation','Need integrated ERP and workflow automation','high',
    '90000000-0000-0000-0000-000000000001','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  );
  IF NOT COALESCE(v_json->>'duplicate','false')::boolean THEN
    RAISE EXCEPTION 'Gate17 test: IT public idempotent retry was not recognized';
  END IF;

  SELECT * INTO v_ticket FROM public.cs_tickets WHERE public_request_key='90000000-0000-0000-0000-000000000001';
  IF v_ticket.module_key <> 'it_services' OR v_ticket.request_type <> 'erp_consulting'
     OR v_ticket.company_id <> v_it.id OR v_ticket.source <> 'public_web' THEN
    RAISE EXCEPTION 'Gate17 test: IT public ticket routing incorrect';
  END IF;

  v_json := public.cs_public_submit_ticket(
    'CORE','project_opportunity','Project Client','0550000000','projects@example.com',
    'Infrastructure opportunity','Invitation to discuss project opportunity','normal',
    '90000000-0000-0000-0000-000000000002','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  );
  IF COALESCE(v_json->>'ticket_no','')='' THEN
    RAISE EXCEPTION 'Gate17 test: CORE project opportunity was not accepted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cs_tickets t JOIN public.group_companies c ON c.id=t.company_id
    WHERE t.public_request_key='90000000-0000-0000-0000-000000000002'
      AND c.code='CORE' AND t.module_key='corporate_erp' AND t.request_type='project_opportunity'
  ) THEN RAISE EXCEPTION 'Gate17 test: CORE ticket routing incorrect'; END IF;

  BEGIN
    PERFORM public.cs_public_submit_ticket(
      'IT','maintenance','Bad Scope','0500000001','bad@example.com','Wrong request type',NULL,'normal',
      '90000000-0000-0000-0000-000000000003','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    );
    RAISE EXCEPTION 'Gate17 test: IT accepted OM maintenance request';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Gate17 test:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%request type is not valid for selected company%' THEN RAISE; END IF;
  END;

  INSERT INTO public.group_user_module_access(user_id,company_id,module_id,access_role)
  VALUES ('00000000-0000-0000-0000-000000000001',v_it.id,v_module.id,'manager');
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  IF NOT public.group_has_module_access('IT','it_services') THEN
    RAISE EXCEPTION 'Gate17 test: IT module access was not granted to seeded manager';
  END IF;

  SELECT public.cs_create_ticket(
    'IT','digital_platform','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Customer portal','Build a customer portal','normal',NULL,NULL
  ) INTO v_ticket;
  IF v_ticket.module_key <> 'it_services' OR v_ticket.request_type <> 'digital_platform' OR v_ticket.created_by <> '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Gate17 test: authenticated IT internal ticket routing incorrect';
  END IF;

  SELECT count(*) INTO v_count FROM public.cs_tickets WHERE module_key='it_services';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Gate17 test: expected two IT tickets, found %', v_count; END IF;
END $$;

-- Gate 16 direct-table write closure must remain intact.
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.cs_tickets','INSERT')
     OR has_table_privilege('authenticated','public.cs_tickets','UPDATE')
     OR has_table_privilege('authenticated','public.cs_tickets','DELETE') THEN
    RAISE EXCEPTION 'Gate17 test: authenticated direct writes to cs_tickets were reopened';
  END IF;
  IF has_table_privilege('anon','public.cs_tickets','SELECT')
     OR has_table_privilege('anon','public.cs_tickets','INSERT') THEN
    RAISE EXCEPTION 'Gate17 test: anon access to cs_tickets was reopened';
  END IF;
END $$;

SELECT 'Gate 17 PostgreSQL behavior checks passed' AS result;
