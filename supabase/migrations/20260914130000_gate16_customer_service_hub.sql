-- Gate 16: shared customer-service hub and cross-module intake.
-- Code-only migration. Apply only after the full code plan is closed and production DB preflight is complete.

BEGIN;

DO $$
DECLARE v_found integer := 0;
BEGIN
  v_found := v_found + CASE WHEN to_regclass('public.cs_tickets') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.cs_ticket_events') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.cs_ticket_comments') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text)') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.cs_convert_ticket_to_maintenance(uuid)') IS NOT NULL THEN 1 ELSE 0 END;
  IF v_found > 0 THEN
    RAISE EXCEPTION 'Gate 16 customer-service hub appears already or partially applied (%/5 markers); stop and reconcile before retry', v_found;
  END IF;
  IF to_regclass('public.group_companies') IS NULL
     OR to_regclass('public.group_modules') IS NULL
     OR to_regclass('public.group_company_modules') IS NULL
     OR to_regclass('public.group_user_module_access') IS NULL
     OR to_regprocedure('public.group_has_module_access(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 requires Gate 13 multi-company foundation';
  END IF;
  IF to_regclass('public.ops_service_requests') IS NULL
     OR to_regclass('public.ops_sites') IS NULL
     OR to_regclass('public.ops_assets') IS NULL
     OR to_regprocedure('public.ops_next_request_no()') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 requires Gate 14 maintenance foundation';
  END IF;
  IF to_regclass('public.re_properties') IS NULL
     OR to_regclass('public.re_units') IS NULL
     OR to_regclass('public.re_facility_links') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 requires Gate 15 real-estate/facilities foundation';
  END IF;
  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Gate 16 requires the shared CRM customer foundation';
  END IF;
END $$;

CREATE SEQUENCE public.cs_ticket_seq;
REVOKE ALL ON SEQUENCE public.cs_ticket_seq FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.cs_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  module_key text NOT NULL CHECK (module_key IN ('maintenance','real_estate','corporate_erp')),
  request_type text NOT NULL CHECK (request_type IN (
    'maintenance','facility','complaint','leasing_enquiry','property_enquiry','general'
  )),
  source text NOT NULL DEFAULT 'internal' CHECK (source IN ('internal','public_web','customer_portal','tenant_portal')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  contact_name text,
  contact_phone text,
  contact_email text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','triaged','assigned','in_progress','waiting_customer','resolved','closed','cancelled'
  )),
  property_id uuid REFERENCES public.re_properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.re_units(id) ON DELETE SET NULL,
  ops_site_id uuid REFERENCES public.ops_sites(id) ON DELETE SET NULL,
  ops_asset_id uuid REFERENCES public.ops_assets(id) ON DELETE SET NULL,
  ops_service_request_id uuid REFERENCES public.ops_service_requests(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_team text,
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  public_request_key uuid,
  public_request_fingerprint text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(btrim(title)) BETWEEN 3 AND 300),
  CHECK (description IS NULL OR char_length(description) <= 8000),
  CHECK (contact_name IS NULL OR char_length(contact_name) <= 200),
  CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  CHECK (customer_id IS NOT NULL OR contact_name IS NOT NULL),
  CHECK ((source='public_web' AND public_request_key IS NOT NULL AND public_request_fingerprint IS NOT NULL) OR source<>'public_web'),
  UNIQUE(public_request_key)
);

CREATE TABLE public.cs_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.cs_tickets(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created','triaged','assigned','status_changed','commented','converted_to_maintenance','resolved','closed','cancelled')),
  from_status text,
  to_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cs_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.cs_tickets(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','customer')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cs_public_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  request_key uuid NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cs_public_submission_rate ON public.cs_public_submission_log(source_hash,created_at DESC);
CREATE INDEX idx_cs_tickets_company_status ON public.cs_tickets(company_id,status,created_at DESC);
CREATE INDEX idx_cs_tickets_customer ON public.cs_tickets(customer_id,created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_cs_tickets_assignment ON public.cs_tickets(assigned_to,status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_cs_ticket_events_ticket ON public.cs_ticket_events(ticket_id,created_at);
CREATE INDEX idx_cs_ticket_comments_ticket ON public.cs_ticket_comments(ticket_id,created_at);

CREATE FUNCTION public.cs_next_ticket_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT 'TKT-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.cs_ticket_seq')::text,7,'0')
$$;
REVOKE ALL ON FUNCTION public.cs_next_ticket_no() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.cs_has_company_access(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin(auth.uid()) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.group_companies c
      JOIN public.group_company_modules cm ON cm.company_id=c.id AND cm.is_active
      JOIN public.group_modules m ON m.id=cm.module_id AND m.is_active
      WHERE c.id=_company_id AND c.is_active
        AND public.group_has_module_access(c.code,m.module_key)
    ) END
$$;

CREATE FUNCTION public.cs_access_role(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT CASE WHEN public.is_admin(auth.uid()) THEN 'admin'
    ELSE (
      SELECT a.access_role
      FROM public.group_user_module_access a
      JOIN public.group_company_modules cm ON cm.company_id=a.company_id AND cm.module_id=a.module_id AND cm.is_active
      WHERE a.user_id=auth.uid() AND a.company_id=_company_id AND a.is_active
        AND (a.valid_from IS NULL OR a.valid_from<=current_date)
        AND (a.valid_to IS NULL OR a.valid_to>=current_date)
      ORDER BY CASE a.access_role WHEN 'admin' THEN 4 WHEN 'manager' THEN 3 WHEN 'member' THEN 2 ELSE 1 END DESC
      LIMIT 1
    ) END
$$;

CREATE FUNCTION public.cs_company_for_code(_company_code text)
RETURNS public.group_companies
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company public.group_companies;
BEGIN
  SELECT * INTO v_company FROM public.group_companies WHERE code=upper(btrim(_company_code)) AND is_active;
  IF NOT FOUND OR v_company.code NOT IN ('CORE','OM','RE') THEN RAISE EXCEPTION 'invalid service company'; END IF;
  RETURN v_company;
END $$;

CREATE FUNCTION public.cs_validate_scope(_company public.group_companies,_request_type text,_module_key text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path=''
AS $$
BEGIN
  IF _request_type NOT IN ('maintenance','facility','complaint','leasing_enquiry','property_enquiry','general') THEN
    RAISE EXCEPTION 'invalid customer-service request type';
  END IF;
  IF (_request_type IN ('leasing_enquiry','property_enquiry') AND _company.code<>'RE')
     OR (_request_type='maintenance' AND _company.code<>'OM')
     OR (_request_type='facility' AND _company.code NOT IN ('RE','OM')) THEN
    RAISE EXCEPTION 'request type is not valid for selected company';
  END IF;
  IF (_company.code='OM' AND _module_key<>'maintenance')
     OR (_company.code='RE' AND _module_key<>'real_estate')
     OR (_company.code='CORE' AND _module_key<>'corporate_erp') THEN
    RAISE EXCEPTION 'module/company mismatch';
  END IF;
END $$;

CREATE FUNCTION public.cs_public_submit_ticket(
  _company_code text,_request_type text,_contact_name text,_contact_phone text,_contact_email text,
  _title text,_description text,_priority text,_request_key text,_source_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company public.group_companies; v_module text; v_key uuid; v_existing public.cs_tickets; v_ticket public.cs_tickets; v_fp text;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  v_company:=public.cs_company_for_code(_company_code);
  v_module:=CASE v_company.code WHEN 'OM' THEN 'maintenance' WHEN 'RE' THEN 'real_estate' ELSE 'corporate_erp' END;
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

  INSERT INTO public.cs_tickets(ticket_no,company_id,module_key,request_type,source,contact_name,contact_phone,contact_email,title,description,priority,public_request_key,public_request_fingerprint)
  VALUES(public.cs_next_ticket_no(),v_company.id,v_module,_request_type,'public_web',btrim(_contact_name),NULLIF(btrim(_contact_phone),''),NULLIF(lower(btrim(_contact_email)),''),btrim(_title),NULLIF(btrim(_description),''),_priority,v_key,v_fp)
  RETURNING * INTO v_ticket;
  UPDATE public.cs_public_submission_log SET accepted=true WHERE request_key=v_key;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,to_status,details)
  VALUES(v_ticket.id,'created','new',jsonb_build_object('source','public_web'));
  RETURN jsonb_build_object('ticket_no',v_ticket.ticket_no,'status',v_ticket.status,'duplicate',false);
END $$;

CREATE FUNCTION public.cs_create_ticket(
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
  v_module:=CASE v_company.code WHEN 'OM' THEN 'maintenance' WHEN 'RE' THEN 'real_estate' ELSE 'corporate_erp' END;
  IF NOT public.cs_has_company_access(v_company.id) THEN RAISE EXCEPTION 'customer-service company access denied'; END IF;
  PERFORM public.cs_validate_scope(v_company,_request_type,v_module);
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=_customer_id) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF _property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.re_properties p WHERE p.id=_property_id AND p.company_id=v_company.id) THEN RAISE EXCEPTION 'property not in selected company'; END IF;
  IF _unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=_unit_id AND p.company_id=v_company.id) THEN RAISE EXCEPTION 'unit not in selected company'; END IF;
  IF _customer_id IS NULL AND NULLIF(btrim(COALESCE(_contact_name,'')),'') IS NULL THEN RAISE EXCEPTION 'customer or contact name is required'; END IF;
  INSERT INTO public.cs_tickets(ticket_no,company_id,module_key,request_type,source,customer_id,contact_name,contact_phone,contact_email,title,description,priority,property_id,unit_id,created_by)
  VALUES(public.cs_next_ticket_no(),v_company.id,v_module,_request_type,'internal',_customer_id,NULLIF(btrim(_contact_name),''),NULLIF(btrim(_contact_phone),''),NULLIF(lower(btrim(_contact_email)),''),btrim(_title),NULLIF(btrim(_description),''),_priority,_property_id,_unit_id,auth.uid()) RETURNING * INTO v_ticket;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,to_status,changed_by) VALUES(v_ticket.id,'created','new',auth.uid());
  RETURN v_ticket;
END $$;

CREATE FUNCTION public.cs_transition_ticket(_ticket_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.cs_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE t public.cs_tickets; v_from text; v_role text; v_ok boolean;
BEGIN
  SELECT * INTO t FROM public.cs_tickets WHERE id=_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF NOT public.cs_has_company_access(t.company_id) THEN RAISE EXCEPTION 'customer-service company access denied'; END IF;
  v_role:=public.cs_access_role(t.company_id); v_from:=t.status;
  v_ok:=CASE v_from
    WHEN 'new' THEN _to_status IN ('triaged','cancelled')
    WHEN 'triaged' THEN _to_status IN ('assigned','in_progress','cancelled')
    WHEN 'assigned' THEN _to_status IN ('in_progress','waiting_customer','cancelled')
    WHEN 'in_progress' THEN _to_status IN ('waiting_customer','resolved','cancelled')
    WHEN 'waiting_customer' THEN _to_status IN ('in_progress','resolved','cancelled')
    WHEN 'resolved' THEN _to_status IN ('closed','in_progress')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid ticket transition % -> %',v_from,_to_status; END IF;
  IF _to_status IN ('cancelled','closed') AND v_role NOT IN ('manager','admin') THEN RAISE EXCEPTION 'manager access required for closing/cancelling tickets'; END IF;
  UPDATE public.cs_tickets SET status=_to_status,
    responded_at=CASE WHEN _to_status IN ('triaged','assigned','in_progress') AND responded_at IS NULL THEN now() ELSE responded_at END,
    resolved_at=CASE WHEN _to_status='resolved' THEN now() WHEN _to_status='in_progress' THEN NULL ELSE resolved_at END,
    closed_at=CASE WHEN _to_status IN ('closed','cancelled') THEN now() ELSE closed_at END,updated_at=now()
  WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,from_status,to_status,details,changed_by)
  VALUES(t.id,CASE WHEN _to_status='resolved' THEN 'resolved' WHEN _to_status='closed' THEN 'closed' WHEN _to_status='cancelled' THEN 'cancelled' ELSE 'status_changed' END,v_from,_to_status,jsonb_build_object('reason',NULLIF(btrim(_reason),'')),auth.uid());
  RETURN t;
END $$;

CREATE FUNCTION public.cs_assign_ticket(_ticket_id uuid,_assigned_to uuid,_assigned_team text DEFAULT NULL)
RETURNS public.cs_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE t public.cs_tickets; v_from text;
BEGIN
  SELECT * INTO t FROM public.cs_tickets WHERE id=_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF public.cs_access_role(t.company_id) NOT IN ('manager','admin') THEN RAISE EXCEPTION 'manager access required to assign tickets'; END IF;
  IF _assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_assigned_to) THEN RAISE EXCEPTION 'assigned user not found'; END IF;
  v_from:=t.status;
  UPDATE public.cs_tickets SET assigned_to=_assigned_to,assigned_team=NULLIF(btrim(_assigned_team),''),status=CASE WHEN status IN ('new','triaged') THEN 'assigned' ELSE status END,responded_at=COALESCE(responded_at,now()),updated_at=now() WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,from_status,to_status,details,changed_by)
  VALUES(t.id,'assigned',v_from,t.status,jsonb_build_object('assigned_to',_assigned_to,'assigned_team',_assigned_team),auth.uid());
  RETURN t;
END $$;

CREATE FUNCTION public.cs_add_comment(_ticket_id uuid,_body text,_visibility text DEFAULT 'internal')
RETURNS public.cs_ticket_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE t public.cs_tickets; c public.cs_ticket_comments;
BEGIN
  SELECT * INTO t FROM public.cs_tickets WHERE id=_ticket_id;
  IF NOT FOUND OR NOT public.cs_has_company_access(t.company_id) THEN RAISE EXCEPTION 'ticket access denied'; END IF;
  IF _visibility NOT IN ('internal','customer') OR char_length(btrim(COALESCE(_body,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'invalid comment'; END IF;
  INSERT INTO public.cs_ticket_comments(ticket_id,body,visibility,created_by) VALUES(t.id,btrim(_body),_visibility,auth.uid()) RETURNING * INTO c;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,details,changed_by) VALUES(t.id,'commented',jsonb_build_object('visibility',_visibility,'comment_id',c.id),auth.uid());
  RETURN c;
END $$;

CREATE FUNCTION public.cs_convert_ticket_to_maintenance(_ticket_id uuid)
RETURNS public.ops_service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE t public.cs_tickets; v_om uuid; v_sla public.ops_sla_policies; v_link public.re_facility_links; r public.ops_service_requests;
BEGIN
  SELECT * INTO t FROM public.cs_tickets WHERE id=_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF t.request_type NOT IN ('maintenance','facility') THEN RAISE EXCEPTION 'ticket is not maintenance/facility work'; END IF;
  IF public.cs_access_role(t.company_id) NOT IN ('manager','admin') THEN RAISE EXCEPTION 'manager access required to convert ticket'; END IF;
  IF t.customer_id IS NULL THEN RAISE EXCEPTION 'ticket must be linked to a CRM customer before maintenance conversion'; END IF;
  IF t.ops_service_request_id IS NOT NULL THEN SELECT * INTO r FROM public.ops_service_requests WHERE id=t.ops_service_request_id; RETURN r; END IF;
  SELECT id INTO v_om FROM public.group_companies WHERE code='OM' AND is_active;
  IF v_om IS NULL THEN RAISE EXCEPTION 'maintenance company is not active'; END IF;
  IF t.unit_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.re_facility_links WHERE unit_id=t.unit_id ORDER BY created_at DESC LIMIT 1;
  ELSIF t.property_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.re_facility_links WHERE property_id=t.property_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  SELECT * INTO v_sla FROM public.ops_sla_policies WHERE company_id=v_om AND priority=t.priority AND is_active LIMIT 1;
  INSERT INTO public.ops_service_requests(company_id,request_no,customer_id,site_id,asset_id,sla_policy_id,title,description,request_type,priority,response_due_at,resolution_due_at,requested_by)
  VALUES(v_om,public.ops_next_request_no(),t.customer_id,COALESCE(t.ops_site_id,v_link.ops_site_id),COALESCE(t.ops_asset_id,v_link.ops_asset_id),v_sla.id,t.title,t.description,CASE WHEN t.priority='critical' THEN 'emergency' ELSE 'corrective' END,t.priority,CASE WHEN v_sla.id IS NULL THEN NULL ELSE now()+make_interval(mins=>v_sla.response_minutes) END,CASE WHEN v_sla.id IS NULL THEN NULL ELSE now()+make_interval(mins=>v_sla.resolution_minutes) END,auth.uid()) RETURNING * INTO r;
  INSERT INTO public.ops_status_events(entity_type,entity_id,to_status,reason,changed_by) VALUES('service_request',r.id,'new','created from customer-service ticket '||t.ticket_no,auth.uid());
  UPDATE public.cs_tickets SET ops_service_request_id=r.id,ops_site_id=r.site_id,ops_asset_id=r.asset_id,status='in_progress',responded_at=COALESCE(responded_at,now()),updated_at=now() WHERE id=t.id;
  INSERT INTO public.cs_ticket_events(ticket_id,event_type,from_status,to_status,details,changed_by) VALUES(t.id,'converted_to_maintenance',t.status,'in_progress',jsonb_build_object('ops_service_request_id',r.id,'ops_request_no',r.request_no),auth.uid());
  RETURN r;
END $$;

ALTER TABLE public.cs_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_public_submission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cs_tickets_read ON public.cs_tickets FOR SELECT TO authenticated USING (public.cs_has_company_access(company_id));
CREATE POLICY cs_ticket_events_read ON public.cs_ticket_events FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.cs_tickets t WHERE t.id=ticket_id AND public.cs_has_company_access(t.company_id)));
CREATE POLICY cs_ticket_comments_read ON public.cs_ticket_comments FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.cs_tickets t WHERE t.id=ticket_id AND public.cs_has_company_access(t.company_id)));

REVOKE ALL ON public.cs_tickets,public.cs_ticket_events,public.cs_ticket_comments,public.cs_public_submission_log FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE ON public.cs_tickets,public.cs_ticket_events,public.cs_ticket_comments,public.cs_public_submission_log FROM authenticated;
GRANT SELECT ON public.cs_tickets,public.cs_ticket_events,public.cs_ticket_comments TO authenticated;
GRANT ALL ON public.cs_tickets,public.cs_ticket_events,public.cs_ticket_comments,public.cs_public_submission_log TO service_role;

REVOKE ALL ON FUNCTION public.cs_has_company_access(uuid),public.cs_access_role(uuid),public.cs_company_for_code(text),public.cs_validate_scope(public.group_companies,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_has_company_access(uuid),public.cs_access_role(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cs_company_for_code(text),public.cs_validate_scope(public.group_companies,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cs_public_submit_ticket(text,text,text,text,text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.cs_create_ticket(text,text,uuid,text,text,text,text,text,text,uuid,uuid),public.cs_transition_ticket(uuid,text,text),public.cs_assign_ticket(uuid,uuid,text),public.cs_add_comment(uuid,text,text),public.cs_convert_ticket_to_maintenance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cs_create_ticket(text,text,uuid,text,text,text,text,text,text,uuid,uuid),public.cs_transition_ticket(uuid,text,text),public.cs_assign_ticket(uuid,uuid,text),public.cs_add_comment(uuid,text,text),public.cs_convert_ticket_to_maintenance(uuid) TO authenticated,service_role;

COMMENT ON TABLE public.cs_tickets IS 'Gate 16 canonical cross-company customer-service intake for maintenance, facilities, complaints and leasing/property enquiries.';
COMMENT ON FUNCTION public.cs_convert_ticket_to_maintenance(uuid) IS 'Controlled RE/OM bridge: converts a manager-authorized facility/maintenance ticket into the shared Gate 14 maintenance engine without requiring the source-company user to hold OM module access.';

COMMIT;
