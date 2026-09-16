-- Gate 17: investment-holding portfolio brands + IT company/module + portfolio-wide public intake.
-- Code-only migration. Do not apply to Production before final DB preflight.

BEGIN;

DO $$
DECLARE v_found integer := 0;
BEGIN
  IF to_regclass('public.group_companies') IS NULL
     OR to_regclass('public.group_modules') IS NULL
     OR to_regclass('public.group_company_modules') IS NULL
     OR to_regprocedure('public.group_has_module_access(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Gate 17 requires Gate 13 multi-company foundation';
  END IF;
  IF to_regclass('public.cs_tickets') IS NULL
     OR to_regprocedure('public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text)') IS NULL
     OR to_regprocedure('public.cs_create_ticket(text,text,uuid,text,text,text,text,text,text,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Gate 17 requires Gate 16 customer-service foundation';
  END IF;

  v_found := v_found + CASE WHEN EXISTS (SELECT 1 FROM public.group_companies WHERE code='IT') THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN EXISTS (SELECT 1 FROM public.group_modules WHERE module_key='it_services') THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.cs_module_for_company_code(text)') IS NOT NULL THEN 1 ELSE 0 END;
  IF v_found > 0 THEN
    RAISE EXCEPTION 'Gate 17 portfolio/IT foundation appears already or partially applied (%/3 markers); stop and reconcile before retry', v_found;
  END IF;
END $$;

-- Working portfolio brands remain operational display names; legal/trademark validation
-- can rename them later without changing stable company codes or foreign keys.
UPDATE public.group_companies
SET name_ar='مدار للتشغيل والصيانة',
    name_en='Madar Operations & Maintenance',
    updated_at=now()
WHERE code='OM';

UPDATE public.group_companies
SET name_ar='روافد للاستثمار العقاري وإدارة الأصول',
    name_en='Rawafid Real Estate Investment & Asset Management',
    updated_at=now()
WHERE code='RE';

INSERT INTO public.group_companies(code,slug,name_ar,name_en,company_type,parent_company_id,sort_order)
SELECT 'IT','technology','نواة للحلول الرقمية وتقنية المعلومات','Nawa Digital Solutions & IT','subsidiary',h.id,40
FROM public.group_companies h
WHERE h.code='HOLDING'
ON CONFLICT (code) DO UPDATE SET
  slug=EXCLUDED.slug,
  name_ar=EXCLUDED.name_ar,
  name_en=EXCLUDED.name_en,
  company_type='subsidiary',
  parent_company_id=EXCLUDED.parent_company_id,
  sort_order=EXCLUDED.sort_order,
  is_active=true,
  updated_at=now();

INSERT INTO public.group_modules(module_key,name_ar,name_en,route_prefix,sort_order)
VALUES ('it_services','الحلول الرقمية وتقنية المعلومات','Digital Solutions & IT','/technology',40)
ON CONFLICT (module_key) DO UPDATE SET
  name_ar=EXCLUDED.name_ar,
  name_en=EXCLUDED.name_en,
  route_prefix=EXCLUDED.route_prefix,
  sort_order=EXCLUDED.sort_order,
  is_active=true;

INSERT INTO public.group_company_modules(company_id,module_id)
SELECT c.id,m.id
FROM public.group_companies c
JOIN public.group_modules m ON m.module_key='it_services'
WHERE c.code='IT'
ON CONFLICT (company_id,module_id) DO UPDATE SET is_active=true;

ALTER TABLE public.cs_tickets DROP CONSTRAINT IF EXISTS cs_tickets_module_key_check;
ALTER TABLE public.cs_tickets ADD CONSTRAINT cs_tickets_module_key_check CHECK (
  module_key IN ('maintenance','real_estate','corporate_erp','it_services')
);

ALTER TABLE public.cs_tickets DROP CONSTRAINT IF EXISTS cs_tickets_request_type_check;
ALTER TABLE public.cs_tickets ADD CONSTRAINT cs_tickets_request_type_check CHECK (request_type IN (
  'maintenance','emergency_maintenance','preventive_maintenance','maintenance_contract',
  'facility','quote_request',
  'investment_enquiry','investment_opportunity','property_management','leasing_enquiry','property_enquiry',
  'project_opportunity',
  'erp_consulting','digital_platform','integration_automation','data_bi','cloud_infrastructure','managed_it_support','cybersecurity',
  'complaint','general'
));

CREATE FUNCTION public.cs_module_for_company_code(_company_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT CASE upper(btrim(_company_code))
    WHEN 'OM' THEN 'maintenance'
    WHEN 'RE' THEN 'real_estate'
    WHEN 'IT' THEN 'it_services'
    WHEN 'CORE' THEN 'corporate_erp'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION public.cs_module_for_company_code(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_module_for_company_code(text) TO service_role;

CREATE OR REPLACE FUNCTION public.cs_company_for_code(_company_code text)
RETURNS public.group_companies
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company public.group_companies;
BEGIN
  SELECT * INTO v_company
  FROM public.group_companies
  WHERE code=upper(btrim(_company_code)) AND is_active;
  IF NOT FOUND OR v_company.code NOT IN ('CORE','OM','RE','IT') THEN
    RAISE EXCEPTION 'invalid service company';
  END IF;
  RETURN v_company;
END $$;

CREATE OR REPLACE FUNCTION public.cs_validate_scope(
  _company public.group_companies,
  _request_type text,
  _module_key text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path=''
AS $$
BEGIN
  IF _request_type NOT IN (
    'maintenance','emergency_maintenance','preventive_maintenance','maintenance_contract',
    'facility','quote_request','investment_enquiry','investment_opportunity','property_management',
    'leasing_enquiry','property_enquiry','project_opportunity',
    'erp_consulting','digital_platform','integration_automation','data_bi','cloud_infrastructure','managed_it_support','cybersecurity',
    'complaint','general'
  ) THEN
    RAISE EXCEPTION 'invalid customer-service request type';
  END IF;

  IF _company.code='OM' AND _request_type NOT IN (
       'maintenance','emergency_maintenance','preventive_maintenance','maintenance_contract','facility','quote_request','complaint','general'
     ) THEN RAISE EXCEPTION 'request type is not valid for selected company'; END IF;
  IF _company.code='RE' AND _request_type NOT IN (
       'investment_enquiry','investment_opportunity','property_management','leasing_enquiry','property_enquiry','facility','complaint','general'
     ) THEN RAISE EXCEPTION 'request type is not valid for selected company'; END IF;
  IF _company.code='CORE' AND _request_type NOT IN ('project_opportunity','quote_request','complaint','general') THEN
    RAISE EXCEPTION 'request type is not valid for selected company';
  END IF;
  IF _company.code='IT' AND _request_type NOT IN (
       'erp_consulting','digital_platform','integration_automation','data_bi','cloud_infrastructure','managed_it_support','cybersecurity','quote_request','complaint','general'
     ) THEN RAISE EXCEPTION 'request type is not valid for selected company'; END IF;

  IF public.cs_module_for_company_code(_company.code) IS DISTINCT FROM _module_key THEN
    RAISE EXCEPTION 'module/company mismatch';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cs_public_submit_ticket(
  _company_code text,_request_type text,_contact_name text,_contact_phone text,_contact_email text,
  _title text,_description text,_priority text,_request_key text,_source_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company public.group_companies;
  v_module text;
  v_key uuid;
  v_existing public.cs_tickets;
  v_ticket public.cs_tickets;
  v_fp text;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  v_company:=public.cs_company_for_code(_company_code);
  v_module:=public.cs_module_for_company_code(v_company.code);
  IF v_module IS NULL THEN RAISE EXCEPTION 'invalid service module'; END IF;
  PERFORM public.cs_validate_scope(v_company,_request_type,v_module);
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF char_length(btrim(COALESCE(_contact_name,'')))<2 OR char_length(btrim(COALESCE(_title,'')))<3 THEN
    RAISE EXCEPTION 'contact name and title are required';
  END IF;
  IF NULLIF(btrim(COALESCE(_contact_phone,'')),'') IS NULL AND NULLIF(btrim(COALESCE(_contact_email,'')),'') IS NULL THEN
    RAISE EXCEPTION 'phone or email is required';
  END IF;
  IF COALESCE(_source_hash,'')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid request source'; END IF;
  BEGIN v_key:=_request_key::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid request key'; END;
  v_fp:=md5(concat_ws('|',v_company.code,_request_type,btrim(_contact_name),COALESCE(btrim(_contact_phone),''),COALESCE(lower(btrim(_contact_email)),''),btrim(_title),COALESCE(_description,''),_priority));

  PERFORM pg_advisory_xact_lock(hashtextextended('cs-public:'||v_key::text,0));
  SELECT * INTO v_existing FROM public.cs_tickets WHERE public_request_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.public_request_fingerprint IS DISTINCT FROM v_fp THEN RAISE EXCEPTION 'request key reused with different content'; END IF;
    RETURN jsonb_build_object('ticket_no',v_existing.ticket_no,'status',v_existing.status,'duplicate',true);
  END IF;
  IF (SELECT count(*) FROM public.cs_public_submission_log WHERE source_hash=_source_hash AND created_at>clock_timestamp()-interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'public request rate limit exceeded';
  END IF;
  INSERT INTO public.cs_public_submission_log(source_hash,request_key,accepted) VALUES(_source_hash,v_key,false);

  INSERT INTO public.cs_tickets(
    ticket_no,company_id,module_key,request_type,source,contact_name,contact_phone,contact_email,
    title,description,priority,public_request_key,public_request_fingerprint
  ) VALUES(
    public.cs_next_ticket_no(),v_company.id,v_module,_request_type,'public_web',btrim(_contact_name),
    NULLIF(btrim(_contact_phone),''),NULLIF(lower(btrim(_contact_email)),''),btrim(_title),
    NULLIF(btrim(_description),''),_priority,v_key,v_fp
  ) RETURNING * INTO v_ticket;

  UPDATE public.cs_public_submission_log SET accepted=true WHERE request_key=v_key;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,to_status,details)
  VALUES(v_ticket.id,'created','new',jsonb_build_object('source','public_web','company_code',v_company.code,'module_key',v_module));
  RETURN jsonb_build_object('ticket_no',v_ticket.ticket_no,'status',v_ticket.status,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.cs_create_ticket(
  _company_code text,_request_type text,_customer_id uuid,_contact_name text,_contact_phone text,_contact_email text,
  _title text,_description text,_priority text DEFAULT 'normal',_property_id uuid DEFAULT NULL,_unit_id uuid DEFAULT NULL
) RETURNS public.cs_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company public.group_companies; v_module text; v_ticket public.cs_tickets;
BEGIN
  v_company:=public.cs_company_for_code(_company_code);
  v_module:=public.cs_module_for_company_code(v_company.code);
  IF v_module IS NULL THEN RAISE EXCEPTION 'invalid service module'; END IF;
  IF NOT public.cs_has_company_access(v_company.id) THEN RAISE EXCEPTION 'customer-service company access denied'; END IF;
  PERFORM public.cs_validate_scope(v_company,_request_type,v_module);
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=_customer_id) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF _property_id IS NOT NULL AND v_company.code<>'RE' THEN RAISE EXCEPTION 'property scope is only valid for real-estate tickets'; END IF;
  IF _unit_id IS NOT NULL AND v_company.code<>'RE' THEN RAISE EXCEPTION 'unit scope is only valid for real-estate tickets'; END IF;
  IF _property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.re_properties p WHERE p.id=_property_id AND p.company_id=v_company.id) THEN RAISE EXCEPTION 'property not in selected company'; END IF;
  IF _unit_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.re_units u
    JOIN public.re_buildings b ON b.id=u.building_id
    JOIN public.re_properties p ON p.id=b.property_id
    WHERE u.id=_unit_id AND p.company_id=v_company.id
  ) THEN RAISE EXCEPTION 'unit not in selected company'; END IF;
  IF _customer_id IS NULL AND NULLIF(btrim(COALESCE(_contact_name,'')),'') IS NULL THEN RAISE EXCEPTION 'customer or contact name is required'; END IF;

  INSERT INTO public.cs_tickets(
    ticket_no,company_id,module_key,request_type,source,customer_id,contact_name,contact_phone,contact_email,
    title,description,priority,property_id,unit_id,created_by
  ) VALUES(
    public.cs_next_ticket_no(),v_company.id,v_module,_request_type,'internal',_customer_id,
    NULLIF(btrim(_contact_name),''),NULLIF(btrim(_contact_phone),''),NULLIF(lower(btrim(_contact_email)),''),
    btrim(_title),NULLIF(btrim(_description),''),_priority,_property_id,_unit_id,auth.uid()
  ) RETURNING * INTO v_ticket;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,to_status,changed_by,details)
  VALUES(v_ticket.id,'created','new',auth.uid(),jsonb_build_object('company_code',v_company.code,'module_key',v_module));
  RETURN v_ticket;
END $$;

REVOKE ALL ON FUNCTION public.cs_company_for_code(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_company_for_code(text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_validate_scope(public.group_companies,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_validate_scope(public.group_companies,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_create_ticket(text,text,uuid,text,text,text,text,text,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cs_create_ticket(text,text,uuid,text,text,text,text,text,text,uuid,uuid) TO authenticated,service_role;

COMMENT ON TABLE public.cs_tickets IS 'Canonical customer-service intake for the group portfolio: contracting, maintenance, real estate/facilities and technology.';
COMMENT ON FUNCTION public.cs_module_for_company_code(text) IS 'Gate 17 stable company-code to operational-module mapping for customer-service intake.';

COMMIT;
