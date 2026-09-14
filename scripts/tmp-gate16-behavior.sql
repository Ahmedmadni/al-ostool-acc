\set ON_ERROR_STOP on

DO $$
DECLARE
  v_json jsonb;
  v_ticket public.cs_tickets;
  v_request public.ops_service_requests;
  v_existing uuid;
  v_failed boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',false);
  PERFORM set_config('request.jwt.claim.sub','',false);

  v_json:=public.cs_public_submit_ticket(
    'RE','investment_enquiry','Public Investor','0500000000','investor@example.com',
    'Investment request','Looking for an investment opportunity','normal',
    '90000000-0000-0000-0000-000000000001',repeat('a',64)
  );
  IF v_json->>'status'<>'new' OR COALESCE(v_json->>'ticket_no','')='' THEN
    RAISE EXCEPTION 'public investment request was not accepted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cs_tickets
    WHERE ticket_no=v_json->>'ticket_no' AND request_type='investment_enquiry' AND module_key='real_estate' AND source='public_web'
  ) THEN RAISE EXCEPTION 'public investment ticket scope is incorrect'; END IF;

  v_json:=public.cs_public_submit_ticket(
    'RE','investment_enquiry','Public Investor','0500000000','investor@example.com',
    'Investment request','Looking for an investment opportunity','normal',
    '90000000-0000-0000-0000-000000000001',repeat('a',64)
  );
  IF COALESCE((v_json->>'duplicate')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'public idempotent retry did not return duplicate=true';
  END IF;

  PERFORM public.cs_public_submit_ticket(
    'OM','emergency_maintenance','Maintenance Caller','0500000001','',
    'Emergency issue','Critical maintenance issue','critical',
    '90000000-0000-0000-0000-000000000002',repeat('b',64)
  );
  IF NOT EXISTS (SELECT 1 FROM public.cs_tickets WHERE request_type='emergency_maintenance' AND module_key='maintenance') THEN
    RAISE EXCEPTION 'public emergency maintenance category was not accepted';
  END IF;

  v_failed:=false;
  BEGIN
    PERFORM public.cs_public_submit_ticket(
      'OM','investment_opportunity','Wrong Scope','0500000002','',
      'Wrong company','Must reject','normal',
      '90000000-0000-0000-0000-000000000003',repeat('c',64)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('request type is not valid for selected company' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'cross-company investment scope was not rejected'; END IF;

  PERFORM set_config('request.jwt.claim.role','authenticated',false);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','emergency_maintenance','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Emergency executable','Emergency conversion', 'normal', NULL,NULL
  );
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.request_type<>'emergency' THEN RAISE EXCEPTION 'emergency maintenance did not map to emergency'; END IF;
  v_existing:=v_request.id;
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.id<>v_existing THEN RAISE EXCEPTION 'maintenance conversion retry was not idempotent'; END IF;

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','preventive_maintenance','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Preventive executable','Preventive conversion', 'normal', NULL,NULL
  );
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.request_type<>'preventive' THEN RAISE EXCEPTION 'preventive maintenance did not map to preventive'; END IF;

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','maintenance','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Corrective executable','Corrective conversion', 'normal', NULL,NULL
  );
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.request_type<>'corrective' THEN RAISE EXCEPTION 'standard maintenance did not map to corrective'; END IF;

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','maintenance','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Critical corrective','Critical priority conversion', 'critical', NULL,NULL
  );
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.request_type<>'emergency' THEN RAISE EXCEPTION 'critical maintenance did not map to emergency'; END IF;

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','maintenance_contract','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Contract enquiry','Commercial request only', 'normal', NULL,NULL
  );
  v_failed:=false;
  BEGIN
    PERFORM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('not an executable maintenance/facility request' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'maintenance contract enquiry was incorrectly converted to an operations request'; END IF;

  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'OM','quote_request','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Quote enquiry','Needs commercial review', 'normal', NULL,NULL
  );
  v_failed:=false;
  BEGIN
    PERFORM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('not an executable maintenance/facility request' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'quote request was incorrectly converted to an operations request'; END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
  SELECT * INTO v_ticket FROM public.cs_create_ticket(
    'RE','facility','30000000-0000-0000-0000-000000000001',NULL,NULL,NULL,
    'Property facility issue','Bridge to OM without direct OM module access', 'normal',
    '80000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001'
  );
  SELECT * INTO v_request FROM public.cs_convert_ticket_to_maintenance(v_ticket.id);
  IF v_request.request_type<>'corrective'
     OR v_request.site_id<>'70000000-0000-0000-0000-000000000001'::uuid
     OR v_request.asset_id<>'71000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'RE facility bridge did not preserve facility scope';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cs_ticket_events WHERE event_type='converted_to_maintenance') THEN
    RAISE EXCEPTION 'customer-service conversion audit events are missing';
  END IF;
END $$;

SELECT 'Gate 16 PostgreSQL behavior checks passed' AS result;
