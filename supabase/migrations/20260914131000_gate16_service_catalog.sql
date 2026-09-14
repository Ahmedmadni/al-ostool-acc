-- Gate 16 follow-up: expand the public/customer-service catalog for maintenance and real-estate investment.
-- Code-only migration. Do not apply to Production before the full code plan and DB preflight are complete.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.cs_tickets') IS NULL
     OR to_regprocedure('public.cs_validate_scope(public.group_companies,text,text)') IS NULL
     OR to_regprocedure('public.cs_convert_ticket_to_maintenance(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 service catalog requires the Gate 16 customer-service hub foundation';
  END IF;
  IF to_regclass('public.ops_service_requests') IS NULL
     OR to_regprocedure('public.ops_next_request_no()') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 service catalog requires the Gate 14 maintenance foundation';
  END IF;
END $$;

ALTER TABLE public.cs_tickets
  DROP CONSTRAINT IF EXISTS cs_tickets_request_type_check;

ALTER TABLE public.cs_tickets
  ADD CONSTRAINT cs_tickets_request_type_check CHECK (request_type IN (
    'maintenance',
    'emergency_maintenance',
    'preventive_maintenance',
    'maintenance_contract',
    'facility',
    'quote_request',
    'investment_enquiry',
    'investment_opportunity',
    'property_management',
    'leasing_enquiry',
    'property_enquiry',
    'complaint',
    'general'
  ));

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
    'leasing_enquiry','property_enquiry','complaint','general'
  ) THEN
    RAISE EXCEPTION 'invalid customer-service request type';
  END IF;

  IF (_request_type IN ('maintenance','emergency_maintenance','preventive_maintenance','maintenance_contract','quote_request') AND _company.code<>'OM')
     OR (_request_type IN ('investment_enquiry','investment_opportunity','property_management','leasing_enquiry','property_enquiry') AND _company.code<>'RE')
     OR (_request_type='facility' AND _company.code NOT IN ('RE','OM')) THEN
    RAISE EXCEPTION 'request type is not valid for selected company';
  END IF;

  IF (_company.code='OM' AND _module_key<>'maintenance')
     OR (_company.code='RE' AND _module_key<>'real_estate')
     OR (_company.code='CORE' AND _module_key<>'corporate_erp') THEN
    RAISE EXCEPTION 'module/company mismatch';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cs_convert_ticket_to_maintenance(_ticket_id uuid)
RETURNS public.ops_service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  t public.cs_tickets;
  v_om uuid;
  v_sla public.ops_sla_policies;
  v_link public.re_facility_links;
  r public.ops_service_requests;
  v_ops_request_type text;
BEGIN
  SELECT * INTO t FROM public.cs_tickets WHERE id=_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;

  IF t.request_type NOT IN ('maintenance','emergency_maintenance','preventive_maintenance','facility') THEN
    RAISE EXCEPTION 'ticket is not an executable maintenance/facility request';
  END IF;
  IF public.cs_access_role(t.company_id) NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'manager access required to convert ticket';
  END IF;
  IF t.customer_id IS NULL THEN
    RAISE EXCEPTION 'ticket must be linked to a CRM customer before maintenance conversion';
  END IF;
  IF t.ops_service_request_id IS NOT NULL THEN
    SELECT * INTO r FROM public.ops_service_requests WHERE id=t.ops_service_request_id;
    RETURN r;
  END IF;

  SELECT id INTO v_om FROM public.group_companies WHERE code='OM' AND is_active;
  IF v_om IS NULL THEN RAISE EXCEPTION 'maintenance company is not active'; END IF;

  IF t.unit_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.re_facility_links WHERE unit_id=t.unit_id ORDER BY created_at DESC LIMIT 1;
  ELSIF t.property_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.re_facility_links WHERE property_id=t.property_id ORDER BY created_at DESC LIMIT 1;
  END IF;

  SELECT * INTO v_sla FROM public.ops_sla_policies
  WHERE company_id=v_om AND priority=t.priority AND is_active
  LIMIT 1;

  v_ops_request_type:=CASE
    WHEN t.request_type='emergency_maintenance' OR t.priority='critical' THEN 'emergency'
    WHEN t.request_type='preventive_maintenance' THEN 'preventive'
    ELSE 'corrective'
  END;

  INSERT INTO public.ops_service_requests(
    company_id,request_no,customer_id,site_id,asset_id,sla_policy_id,title,description,
    request_type,priority,response_due_at,resolution_due_at,requested_by
  )
  VALUES(
    v_om,public.ops_next_request_no(),t.customer_id,
    COALESCE(t.ops_site_id,v_link.ops_site_id),COALESCE(t.ops_asset_id,v_link.ops_asset_id),
    v_sla.id,t.title,t.description,v_ops_request_type,t.priority,
    CASE WHEN v_sla.id IS NULL THEN NULL ELSE now()+make_interval(mins=>v_sla.response_minutes) END,
    CASE WHEN v_sla.id IS NULL THEN NULL ELSE now()+make_interval(mins=>v_sla.resolution_minutes) END,
    auth.uid()
  )
  RETURNING * INTO r;

  INSERT INTO public.ops_status_events(entity_type,entity_id,to_status,reason,changed_by)
  VALUES('service_request',r.id,'new','created from customer-service ticket '||t.ticket_no,auth.uid());

  UPDATE public.cs_tickets
  SET ops_service_request_id=r.id,
      ops_site_id=r.site_id,
      ops_asset_id=r.asset_id,
      status='in_progress',
      responded_at=COALESCE(responded_at,now()),
      updated_at=now()
  WHERE id=t.id;

  INSERT INTO public.cs_ticket_events(ticket_id,event_type,from_status,to_status,details,changed_by)
  VALUES(t.id,'converted_to_maintenance',t.status,'in_progress',
         jsonb_build_object('ops_service_request_id',r.id,'ops_request_no',r.request_no,'ops_request_type',r.request_type),auth.uid());

  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.cs_validate_scope(public.group_companies,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_validate_scope(public.group_companies,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_convert_ticket_to_maintenance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cs_convert_ticket_to_maintenance(uuid) TO authenticated,service_role;

COMMENT ON TABLE public.cs_tickets IS 'Gate 16 canonical cross-company customer-service intake for maintenance, facilities, real-estate investment, property management, leasing, complaints and general enquiries.';
COMMENT ON FUNCTION public.cs_convert_ticket_to_maintenance(uuid) IS 'Controlled RE/OM bridge for executable maintenance/facility requests. Emergency and preventive public categories map to the corresponding Gate 14 request types; commercial maintenance enquiries remain customer-service tickets.';

COMMIT;
