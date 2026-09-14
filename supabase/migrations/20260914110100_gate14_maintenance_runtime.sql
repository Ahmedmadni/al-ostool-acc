BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ops_work_orders') IS NULL OR to_regprocedure('public.ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Gate 14 maintenance foundation must be applied before runtime RPCs';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_require_manager(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.ops_access_role(_company_id);
  IF v_role IS NULL OR v_role NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'maintenance manager access required';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_upsert_sla_policy(
  _priority text,_response_minutes integer,_resolution_minutes integer,_name_ar text,_name_en text DEFAULT NULL
)
RETURNS public.ops_sla_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company uuid; v_row public.ops_sla_policies;
BEGIN
  SELECT id INTO v_company FROM public.group_companies WHERE code='OM' AND is_active;
  PERFORM public.ops_require_manager(v_company);
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF _response_minutes<=0 OR _resolution_minutes<_response_minutes THEN RAISE EXCEPTION 'invalid SLA window'; END IF;
  INSERT INTO public.ops_sla_policies(company_id,name_ar,name_en,priority,response_minutes,resolution_minutes,is_active)
  VALUES(v_company,btrim(_name_ar),_name_en,_priority,_response_minutes,_resolution_minutes,true)
  ON CONFLICT(company_id,priority) DO UPDATE SET
    name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,response_minutes=EXCLUDED.response_minutes,
    resolution_minutes=EXCLUDED.resolution_minutes,is_active=true,updated_at=now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.ops_create_site(
  _customer_id uuid,_contract_id uuid,_code text,_name_ar text,_address text DEFAULT NULL,_city text DEFAULT NULL
)
RETURNS public.ops_sites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company uuid; v_row public.ops_sites;
BEGIN
  SELECT id INTO v_company FROM public.group_companies WHERE code='OM' AND is_active;
  PERFORM public.ops_require_manager(v_company);
  IF NULLIF(btrim(_code),'') IS NULL OR NULLIF(btrim(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'site code and name are required'; END IF;
  INSERT INTO public.ops_sites(company_id,customer_id,contract_id,code,name_ar,address,city)
  VALUES(v_company,_customer_id,_contract_id,upper(btrim(_code)),btrim(_name_ar),_address,_city)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.ops_create_asset(
  _customer_id uuid,_site_id uuid,_asset_code text,_name_ar text,_category text,_serial_number text DEFAULT NULL,
  _manufacturer text DEFAULT NULL,_model text DEFAULT NULL,_criticality text DEFAULT 'normal'
)
RETURNS public.ops_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company uuid; v_row public.ops_assets;
BEGIN
  SELECT id INTO v_company FROM public.group_companies WHERE code='OM' AND is_active;
  PERFORM public.ops_require_manager(v_company);
  IF _criticality NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid criticality'; END IF;
  IF NULLIF(btrim(_asset_code),'') IS NULL OR NULLIF(btrim(_name_ar),'') IS NULL OR NULLIF(btrim(_category),'') IS NULL THEN
    RAISE EXCEPTION 'asset code, name and category are required';
  END IF;
  INSERT INTO public.ops_assets(company_id,customer_id,site_id,asset_code,name_ar,category,serial_number,manufacturer,model,criticality)
  VALUES(v_company,_customer_id,_site_id,upper(btrim(_asset_code)),btrim(_name_ar),btrim(_category),_serial_number,_manufacturer,_model,_criticality)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.ops_set_request_status(_request_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.ops_service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.ops_service_requests; v_from text; v_ok boolean;
BEGIN
  SELECT * INTO r FROM public.ops_service_requests WHERE id=_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'service request not found'; END IF;
  IF NOT public.ops_has_company_access(r.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  v_from:=r.status;
  v_ok:=CASE v_from
    WHEN 'new' THEN _to_status IN ('triaged','cancelled')
    WHEN 'triaged' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('cancelled','closed')
    WHEN 'converted' THEN _to_status IN ('closed')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid service request transition % -> %',v_from,_to_status; END IF;
  UPDATE public.ops_service_requests SET status=_to_status,
    responded_at=CASE WHEN _to_status IN ('triaged','approved') AND responded_at IS NULL THEN now() ELSE responded_at END,
    closed_at=CASE WHEN _to_status IN ('closed','cancelled') THEN now() ELSE closed_at END,
    updated_at=now()
  WHERE id=r.id RETURNING * INTO r;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('service_request',r.id,v_from,_to_status,_reason,auth.uid());
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ops_assign_employee(_work_order_id uuid,_employee_id uuid,_assignment_role text DEFAULT 'technician')
RETURNS public.ops_work_order_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE w public.ops_work_orders; a public.ops_work_order_assignments;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  PERFORM public.ops_require_manager(w.company_id);
  IF w.status NOT IN ('approved','assigned') THEN RAISE EXCEPTION 'work order must be approved before assignment'; END IF;
  IF _assignment_role NOT IN ('technician','lead','supervisor') THEN RAISE EXCEPTION 'invalid assignment role'; END IF;
  INSERT INTO public.ops_work_order_assignments(work_order_id,employee_id,assignment_role,assigned_by)
  VALUES(w.id,_employee_id,_assignment_role,auth.uid())
  ON CONFLICT(work_order_id,employee_id) DO UPDATE SET assignment_role=EXCLUDED.assignment_role,unassigned_at=NULL,assigned_at=now(),assigned_by=auth.uid()
  RETURNING * INTO a;
  IF w.status='approved' THEN
    UPDATE public.ops_work_orders SET status='assigned',updated_at=now() WHERE id=w.id;
    INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
    VALUES('work_order',w.id,'approved','assigned','employee assignment',auth.uid());
  END IF;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.ops_record_visit(
  _work_order_id uuid,_technician_id uuid,_started_at timestamptz,_ended_at timestamptz DEFAULT NULL,
  _diagnosis text DEFAULT NULL,_action_taken text DEFAULT NULL,_notes text DEFAULT NULL
)
RETURNS public.ops_work_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE w public.ops_work_orders; v public.ops_work_visits;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(w.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  IF w.status NOT IN ('assigned','in_progress','on_hold') THEN RAISE EXCEPTION 'work order is not visit-ready'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ops_work_order_assignments a WHERE a.work_order_id=w.id AND a.employee_id=_technician_id AND a.unassigned_at IS NULL)
     AND public.ops_access_role(w.company_id) NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'technician is not assigned to work order';
  END IF;
  INSERT INTO public.ops_work_visits(work_order_id,technician_id,started_at,ended_at,diagnosis,action_taken,notes,created_by)
  VALUES(w.id,_technician_id,_started_at,_ended_at,_diagnosis,_action_taken,_notes,auth.uid()) RETURNING * INTO v;
  IF w.status='assigned' THEN
    UPDATE public.ops_work_orders SET status='in_progress',actual_start=COALESCE(actual_start,_started_at),updated_at=now() WHERE id=w.id;
    INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
    VALUES('work_order',w.id,'assigned','in_progress','first service visit',auth.uid());
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.ops_add_material(
  _work_order_id uuid,_inventory_item_id uuid,_description text,_quantity numeric,_unit_cost numeric
)
RETURNS public.ops_work_order_materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE w public.ops_work_orders; m public.ops_work_order_materials;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(w.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  IF w.status NOT IN ('assigned','in_progress','on_hold') THEN RAISE EXCEPTION 'materials can only be posted to active work orders'; END IF;
  INSERT INTO public.ops_work_order_materials(work_order_id,inventory_item_id,description,quantity,unit_cost,created_by)
  VALUES(w.id,_inventory_item_id,btrim(_description),_quantity,_unit_cost,auth.uid()) RETURNING * INTO m;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.ops_add_subcontract_cost(
  _work_order_id uuid,_vendor_id uuid,_description text,_amount numeric,_invoice_reference text DEFAULT NULL
)
RETURNS public.ops_subcontract_costs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE w public.ops_work_orders; s public.ops_subcontract_costs;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  PERFORM public.ops_require_manager(w.company_id);
  IF w.status IN ('draft','cancelled') THEN RAISE EXCEPTION 'subcontract cost requires an active work order'; END IF;
  INSERT INTO public.ops_subcontract_costs(work_order_id,vendor_id,description,amount,invoice_reference,status,created_by)
  VALUES(w.id,_vendor_id,btrim(_description),_amount,_invoice_reference,'approved',auth.uid()) RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.ops_transition_work_order(_work_order_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.ops_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE w public.ops_work_orders; v_from text; v_ok boolean := false;
BEGIN
  SELECT * INTO w FROM public.ops_work_orders WHERE id=_work_order_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(w.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  v_from:=w.status;
  v_ok:=CASE v_from
    WHEN 'draft' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('assigned','cancelled')
    WHEN 'assigned' THEN _to_status IN ('in_progress','cancelled')
    WHEN 'in_progress' THEN _to_status IN ('on_hold','completed','cancelled')
    WHEN 'on_hold' THEN _to_status IN ('in_progress','cancelled')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid work order transition % -> %',v_from,_to_status; END IF;
  IF _to_status='assigned' AND NOT EXISTS(SELECT 1 FROM public.ops_work_order_assignments a WHERE a.work_order_id=w.id AND a.unassigned_at IS NULL) THEN RAISE EXCEPTION 'work order requires an active assignment'; END IF;
  IF _to_status='completed' AND NOT EXISTS(SELECT 1 FROM public.ops_work_visits v WHERE v.work_order_id=w.id AND v.ended_at IS NOT NULL) THEN RAISE EXCEPTION 'work order requires a completed visit'; END IF;
  IF _to_status IN ('approved','cancelled') THEN PERFORM public.ops_require_manager(w.company_id); END IF;
  UPDATE public.ops_work_orders SET status=_to_status,
    approved_by=CASE WHEN _to_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN _to_status='approved' THEN now() ELSE approved_at END,
    actual_start=CASE WHEN _to_status='in_progress' AND actual_start IS NULL THEN now() ELSE actual_start END,
    actual_end=CASE WHEN _to_status='completed' THEN now() ELSE actual_end END,
    updated_at=now()
  WHERE id=w.id RETURNING * INTO w;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('work_order',w.id,v_from,_to_status,_reason,auth.uid());
  RETURN w;
END $$;

REVOKE ALL ON FUNCTION public.ops_require_manager(uuid),public.ops_upsert_sla_policy(text,integer,integer,text,text),public.ops_create_site(uuid,uuid,text,text,text,text),public.ops_create_asset(uuid,uuid,text,text,text,text,text,text,text),public.ops_set_request_status(uuid,text,text),public.ops_assign_employee(uuid,uuid,text),public.ops_record_visit(uuid,uuid,timestamptz,timestamptz,text,text,text),public.ops_add_material(uuid,uuid,text,numeric,numeric),public.ops_add_subcontract_cost(uuid,uuid,text,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_upsert_sla_policy(text,integer,integer,text,text),public.ops_create_site(uuid,uuid,text,text,text,text),public.ops_create_asset(uuid,uuid,text,text,text,text,text,text,text),public.ops_set_request_status(uuid,text,text),public.ops_assign_employee(uuid,uuid,text),public.ops_record_visit(uuid,uuid,timestamptz,timestamptz,text,text,text),public.ops_add_material(uuid,uuid,text,numeric,numeric),public.ops_add_subcontract_cost(uuid,uuid,text,numeric,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ops_require_manager(uuid) TO service_role;

COMMIT;
