BEGIN;

DO $$
DECLARE
  v_found integer := 0;
BEGIN
  v_found := v_found + CASE WHEN to_regclass('public.ops_service_requests') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.ops_work_orders') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.ops_assets') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.ops_work_visits') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid)') IS NOT NULL THEN 1 ELSE 0 END;
  IF v_found > 0 AND v_found < 5 THEN
    RAISE EXCEPTION 'Gate 14 maintenance operations engine appears partially applied (%/5 markers found); stop and reconcile before retry', v_found;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.group_companies') IS NULL
     OR to_regclass('public.group_modules') IS NULL
     OR to_regprocedure('public.group_has_module_access(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Gate 14 requires Gate 13 multi-company foundation';
  END IF;
  IF to_regclass('public.customers') IS NULL OR to_regclass('public.contracts') IS NULL
     OR to_regclass('public.hr_employees') IS NULL OR to_regclass('public.vendors') IS NULL
     OR to_regclass('public.inventory_items') IS NULL OR to_regclass('public.cost_entries') IS NULL THEN
    RAISE EXCEPTION 'Gate 14 requires customer, contract, HR, vendor, inventory and cost foundations';
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.ops_service_request_seq;
CREATE SEQUENCE IF NOT EXISTS public.ops_work_order_seq;

CREATE TABLE IF NOT EXISTS public.ops_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  address text,
  city text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  contact_name text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public.ops_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  priority text NOT NULL CHECK (priority IN ('low','normal','high','critical')),
  response_minutes integer NOT NULL CHECK (response_minutes > 0),
  resolution_minutes integer NOT NULL CHECK (resolution_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,priority),
  CHECK (resolution_minutes >= response_minutes)
);

CREATE TABLE IF NOT EXISTS public.ops_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.ops_sites(id) ON DELETE SET NULL,
  asset_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  category text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  install_date date,
  warranty_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','out_of_service','retired')),
  criticality text NOT NULL DEFAULT 'normal' CHECK (criticality IN ('low','normal','high','critical')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,asset_code)
);

CREATE TABLE IF NOT EXISTS public.ops_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  request_no text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.ops_sites(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.ops_assets(id) ON DELETE SET NULL,
  sla_policy_id uuid REFERENCES public.ops_sla_policies(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  request_type text NOT NULL DEFAULT 'corrective' CHECK (request_type IN ('corrective','preventive','inspection','emergency','other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','approved','converted','cancelled','closed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  work_order_no text NOT NULL UNIQUE,
  service_request_id uuid REFERENCES public.ops_service_requests(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.ops_sites(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.ops_assets(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','assigned','in_progress','on_hold','completed','accepted','cancelled')),
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  completion_summary text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (planned_end IS NULL OR planned_start IS NULL OR planned_end >= planned_start),
  CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start)
);

CREATE TABLE IF NOT EXISTS public.ops_work_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.ops_work_orders(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
  assignment_role text NOT NULL DEFAULT 'technician' CHECK (assignment_role IN ('technician','lead','supervisor')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  unassigned_at timestamptz,
  UNIQUE(work_order_id,employee_id)
);

CREATE TABLE IF NOT EXISTS public.ops_work_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.ops_work_orders(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  arrival_latitude numeric(10,7),
  arrival_longitude numeric(10,7),
  diagnosis text,
  action_taken text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (arrival_latitude IS NULL OR arrival_latitude BETWEEN -90 AND 90),
  CHECK (arrival_longitude IS NULL OR arrival_longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public.ops_work_order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.ops_work_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric(18,2) GENERATED ALWAYS AS (round(quantity * unit_cost,2)) STORED,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.ops_subcontract_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.ops_work_orders(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE RESTRICT,
  description text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  invoice_reference text,
  cost_entry_id uuid REFERENCES public.cost_entries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_work_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL UNIQUE REFERENCES public.ops_work_orders(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  customer_role text,
  accepted_at timestamptz NOT NULL,
  acceptance_note text,
  signature_ref text,
  accepted_by_user uuid REFERENCES auth.users(id),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_preventive_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id) ON DELETE CASCADE,
  title text NOT NULL,
  frequency_days integer NOT NULL CHECK (frequency_days > 0),
  next_due_date date NOT NULL,
  last_generated_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('service_request','work_order')),
  entity_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_requests_company_status ON public.ops_service_requests(company_id,status,requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_requests_customer ON public.ops_service_requests(customer_id,requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_work_orders_company_status ON public.ops_work_orders(company_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_work_orders_request ON public.ops_work_orders(service_request_id) WHERE service_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_visits_work_order ON public.ops_work_visits(work_order_id,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_materials_work_order ON public.ops_work_order_materials(work_order_id);
CREATE INDEX IF NOT EXISTS idx_ops_subcontract_work_order ON public.ops_subcontract_costs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_ops_pm_due ON public.ops_preventive_plans(next_due_date) WHERE is_active;

CREATE OR REPLACE FUNCTION public.ops_has_company_access(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_companies c
    WHERE c.id=_company_id
      AND c.code='OM'
      AND public.group_has_module_access(c.code,'maintenance')
  )
$$;

CREATE OR REPLACE FUNCTION public.ops_access_role(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.is_admin(auth.uid()) THEN 'admin'
    ELSE (
      SELECT a.access_role
      FROM public.group_user_module_access a
      JOIN public.group_modules m ON m.id=a.module_id
      WHERE a.user_id=auth.uid() AND a.company_id=_company_id
        AND a.is_active AND m.module_key='maintenance' AND m.is_active
        AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE)
        AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE)
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.ops_next_request_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT 'SR-' || to_char(CURRENT_DATE,'YYYY') || '-' || lpad(nextval('public.ops_service_request_seq')::text,6,'0')
$$;

CREATE OR REPLACE FUNCTION public.ops_next_work_order_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT 'WO-' || to_char(CURRENT_DATE,'YYYY') || '-' || lpad(nextval('public.ops_work_order_seq')::text,6,'0')
$$;

CREATE OR REPLACE FUNCTION public.ops_create_service_request(
  _customer_id uuid,_contract_id uuid,_site_id uuid,_title text,_description text,
  _priority text DEFAULT 'normal',_asset_id uuid DEFAULT NULL
)
RETURNS public.ops_service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company_id uuid;
  v_sla public.ops_sla_policies;
  v_row public.ops_service_requests;
BEGIN
  SELECT id INTO v_company_id FROM public.group_companies WHERE code='OM' AND is_active;
  IF v_company_id IS NULL OR NOT public.ops_has_company_access(v_company_id) THEN
    RAISE EXCEPTION 'maintenance module access denied';
  END IF;
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF NULLIF(btrim(_title),'') IS NULL THEN RAISE EXCEPTION 'title is required'; END IF;
  SELECT * INTO v_sla FROM public.ops_sla_policies
  WHERE company_id=v_company_id AND priority=_priority AND is_active LIMIT 1;

  INSERT INTO public.ops_service_requests(
    company_id,request_no,customer_id,contract_id,site_id,asset_id,sla_policy_id,title,description,priority,
    response_due_at,resolution_due_at,requested_by
  ) VALUES (
    v_company_id,public.ops_next_request_no(),_customer_id,_contract_id,_site_id,_asset_id,v_sla.id,btrim(_title),_description,_priority,
    CASE WHEN v_sla.id IS NULL THEN NULL ELSE now() + make_interval(mins=>v_sla.response_minutes) END,
    CASE WHEN v_sla.id IS NULL THEN NULL ELSE now() + make_interval(mins=>v_sla.resolution_minutes) END,
    auth.uid()
  ) RETURNING * INTO v_row;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,changed_by)
  VALUES('service_request',v_row.id,NULL,'new',auth.uid());
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.ops_create_work_order(_request_id uuid,_title text DEFAULT NULL)
RETURNS public.ops_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  r public.ops_service_requests;
  w public.ops_work_orders;
BEGIN
  SELECT * INTO r FROM public.ops_service_requests WHERE id=_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'service request not found'; END IF;
  IF NOT public.ops_has_company_access(r.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  IF r.status NOT IN ('approved','triaged') THEN RAISE EXCEPTION 'service request must be triaged or approved before conversion'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_work_orders WHERE service_request_id=r.id AND status<>'cancelled') THEN
    RAISE EXCEPTION 'active work order already exists for service request';
  END IF;
  INSERT INTO public.ops_work_orders(company_id,work_order_no,service_request_id,customer_id,contract_id,site_id,asset_id,title,description,priority,created_by)
  VALUES(r.company_id,public.ops_next_work_order_no(),r.id,r.customer_id,r.contract_id,r.site_id,r.asset_id,COALESCE(NULLIF(btrim(_title),''),r.title),r.description,r.priority,auth.uid())
  RETURNING * INTO w;
  UPDATE public.ops_service_requests SET status='converted',updated_at=now() WHERE id=r.id;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,changed_by) VALUES('service_request',r.id,r.status,'converted',auth.uid());
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,changed_by) VALUES('work_order',w.id,NULL,'draft',auth.uid());
  RETURN w;
END $$;

CREATE OR REPLACE FUNCTION public.ops_transition_work_order(_work_order_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.ops_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  w public.ops_work_orders;
  v_ok boolean := false;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(w.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  v_ok := CASE w.status
    WHEN 'draft' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('assigned','cancelled')
    WHEN 'assigned' THEN _to_status IN ('in_progress','cancelled')
    WHEN 'in_progress' THEN _to_status IN ('on_hold','completed','cancelled')
    WHEN 'on_hold' THEN _to_status IN ('in_progress','cancelled')
    WHEN 'completed' THEN _to_status IN ('accepted')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid work order transition % -> %',w.status,_to_status; END IF;
  IF _to_status='assigned' AND NOT EXISTS(SELECT 1 FROM public.ops_work_order_assignments a WHERE a.work_order_id=w.id AND a.unassigned_at IS NULL) THEN
    RAISE EXCEPTION 'work order requires an active assignment';
  END IF;
  IF _to_status='completed' AND NOT EXISTS(SELECT 1 FROM public.ops_work_visits v WHERE v.work_order_id=w.id AND v.ended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'work order requires a completed visit';
  END IF;
  IF _to_status='accepted' AND NOT EXISTS(SELECT 1 FROM public.ops_work_acceptances a WHERE a.work_order_id=w.id) THEN
    RAISE EXCEPTION 'customer acceptance evidence is required';
  END IF;
  UPDATE public.ops_work_orders SET
    status=_to_status,
    approved_by=CASE WHEN _to_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN _to_status='approved' THEN now() ELSE approved_at END,
    actual_start=CASE WHEN _to_status='in_progress' AND actual_start IS NULL THEN now() ELSE actual_start END,
    actual_end=CASE WHEN _to_status='completed' THEN now() ELSE actual_end END,
    updated_at=now()
  WHERE id=w.id RETURNING * INTO w;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('work_order',w.id,(SELECT from_status FROM (VALUES (CASE _to_status WHEN 'approved' THEN 'draft' ELSE NULL END)) AS x(from_status) LIMIT 1),_to_status,_reason,auth.uid());
  RETURN w;
END $$;

CREATE OR REPLACE FUNCTION public.ops_accept_work_order(_work_order_id uuid,_customer_name text,_customer_role text DEFAULT NULL,_note text DEFAULT NULL,_signature_ref text DEFAULT NULL,_evidence jsonb DEFAULT '{}'::jsonb)
RETURNS public.ops_work_acceptances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  w public.ops_work_orders;
  a public.ops_work_acceptances;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(w.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  IF w.status<>'completed' THEN RAISE EXCEPTION 'work order must be completed before acceptance'; END IF;
  IF NULLIF(btrim(_customer_name),'') IS NULL THEN RAISE EXCEPTION 'customer name is required'; END IF;
  INSERT INTO public.ops_work_acceptances(work_order_id,customer_name,customer_role,accepted_at,acceptance_note,signature_ref,accepted_by_user,evidence)
  VALUES(w.id,btrim(_customer_name),_customer_role,now(),_note,_signature_ref,auth.uid(),COALESCE(_evidence,'{}'::jsonb))
  RETURNING * INTO a;
  UPDATE public.ops_work_orders SET status='accepted',updated_at=now() WHERE id=w.id;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('work_order',w.id,'completed','accepted',_note,auth.uid());
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.ops_work_order_cost(_work_order_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT round(
    COALESCE((SELECT sum(m.total_cost) FROM public.ops_work_order_materials m WHERE m.work_order_id=_work_order_id),0)
    + COALESCE((SELECT sum(s.amount) FROM public.ops_subcontract_costs s WHERE s.work_order_id=_work_order_id AND s.status IN ('approved','posted')),0)
  ,2)
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_sites','ops_sla_policies','ops_assets','ops_service_requests','ops_work_orders','ops_work_order_assignments','ops_work_visits','ops_work_order_materials','ops_subcontract_costs','ops_work_acceptances','ops_preventive_plans','ops_status_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_sites','ops_sla_policies','ops_assets','ops_service_requests','ops_work_orders','ops_preventive_plans']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_read',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.ops_has_company_access(company_id))',t||'_read',t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS ops_assignments_read ON public.ops_work_order_assignments;
CREATE POLICY ops_assignments_read ON public.ops_work_order_assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=work_order_id AND public.ops_has_company_access(w.company_id)));
DROP POLICY IF EXISTS ops_visits_read ON public.ops_work_visits;
CREATE POLICY ops_visits_read ON public.ops_work_visits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=work_order_id AND public.ops_has_company_access(w.company_id)));
DROP POLICY IF EXISTS ops_materials_read ON public.ops_work_order_materials;
CREATE POLICY ops_materials_read ON public.ops_work_order_materials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=work_order_id AND public.ops_has_company_access(w.company_id)));
DROP POLICY IF EXISTS ops_subcontract_read ON public.ops_subcontract_costs;
CREATE POLICY ops_subcontract_read ON public.ops_subcontract_costs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=work_order_id AND public.ops_has_company_access(w.company_id)));
DROP POLICY IF EXISTS ops_acceptances_read ON public.ops_work_acceptances;
CREATE POLICY ops_acceptances_read ON public.ops_work_acceptances FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=work_order_id AND public.ops_has_company_access(w.company_id)));
DROP POLICY IF EXISTS ops_status_events_read ON public.ops_status_events;
CREATE POLICY ops_status_events_read ON public.ops_status_events FOR SELECT TO authenticated USING (
  (entity_type='work_order' AND EXISTS (SELECT 1 FROM public.ops_work_orders w WHERE w.id=entity_id AND public.ops_has_company_access(w.company_id)))
  OR (entity_type='service_request' AND EXISTS (SELECT 1 FROM public.ops_service_requests r WHERE r.id=entity_id AND public.ops_has_company_access(r.company_id)))
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_sites','ops_sla_policies','ops_assets','ops_service_requests','ops_work_orders','ops_work_order_assignments','ops_work_visits','ops_work_order_materials','ops_subcontract_costs','ops_work_acceptances','ops_preventive_plans','ops_status_events']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.ops_has_company_access(uuid),public.ops_access_role(uuid),public.ops_next_request_no(),public.ops_next_work_order_no(),public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid),public.ops_create_work_order(uuid,text),public.ops_transition_work_order(uuid,text,text),public.ops_accept_work_order(uuid,text,text,text,text,jsonb),public.ops_work_order_cost(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_has_company_access(uuid),public.ops_access_role(uuid),public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid),public.ops_create_work_order(uuid,text),public.ops_transition_work_order(uuid,text,text),public.ops_accept_work_order(uuid,text,text,text,text,jsonb),public.ops_work_order_cost(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ops_next_request_no(),public.ops_next_work_order_no() TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.ops_service_request_seq,public.ops_work_order_seq TO service_role;

COMMIT;
