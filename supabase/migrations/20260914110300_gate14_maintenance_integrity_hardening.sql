BEGIN;

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
  IF v_company_id IS NULL OR NOT public.ops_has_company_access(v_company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  IF _priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  IF NULLIF(btrim(_title),'') IS NULL THEN RAISE EXCEPTION 'title is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customers c WHERE c.id=_customer_id) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF _contract_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.contracts c WHERE c.id=_contract_id AND (c.customer_id IS NULL OR c.customer_id=_customer_id)
  ) THEN RAISE EXCEPTION 'contract does not belong to customer'; END IF;
  IF _site_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.ops_sites s WHERE s.id=_site_id AND s.company_id=v_company_id AND s.is_active AND (s.customer_id IS NULL OR s.customer_id=_customer_id)
  ) THEN RAISE EXCEPTION 'site does not belong to maintenance company/customer'; END IF;
  IF _asset_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.ops_assets a
    WHERE a.id=_asset_id AND a.company_id=v_company_id AND a.status<>'retired'
      AND (a.customer_id IS NULL OR a.customer_id=_customer_id)
      AND (_site_id IS NULL OR a.site_id IS NULL OR a.site_id=_site_id)
  ) THEN RAISE EXCEPTION 'asset does not belong to maintenance company/customer/site'; END IF;

  SELECT * INTO v_sla FROM public.ops_sla_policies WHERE company_id=v_company_id AND priority=_priority AND is_active LIMIT 1;
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
  IF NOT EXISTS(SELECT 1 FROM public.customers c WHERE c.id=_customer_id) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF _contract_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.contracts c WHERE c.id=_contract_id AND (c.customer_id IS NULL OR c.customer_id=_customer_id)
  ) THEN RAISE EXCEPTION 'contract does not belong to customer'; END IF;
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
  IF NULLIF(btrim(_asset_code),'') IS NULL OR NULLIF(btrim(_name_ar),'') IS NULL OR NULLIF(btrim(_category),'') IS NULL THEN RAISE EXCEPTION 'asset code, name and category are required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customers c WHERE c.id=_customer_id) THEN RAISE EXCEPTION 'customer not found'; END IF;
  IF _site_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.ops_sites s WHERE s.id=_site_id AND s.company_id=v_company AND s.is_active AND (s.customer_id IS NULL OR s.customer_id=_customer_id)
  ) THEN RAISE EXCEPTION 'site does not belong to maintenance company/customer'; END IF;
  INSERT INTO public.ops_assets(company_id,customer_id,site_id,asset_code,name_ar,category,serial_number,manufacturer,model,criticality)
  VALUES(v_company,_customer_id,_site_id,upper(btrim(_asset_code)),btrim(_name_ar),btrim(_category),_serial_number,_manufacturer,_model,_criticality)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.ops_work_order_cost(_work_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_company uuid; v_total numeric;
BEGIN
  SELECT company_id INTO v_company FROM public.ops_work_orders WHERE id=_work_order_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'work order not found'; END IF;
  IF NOT public.ops_has_company_access(v_company) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  SELECT round(
    COALESCE((SELECT sum(m.total_cost) FROM public.ops_work_order_materials m WHERE m.work_order_id=_work_order_id),0)
    + COALESCE((SELECT sum(s.amount) FROM public.ops_subcontract_costs s WHERE s.work_order_id=_work_order_id AND s.status IN ('approved','posted')),0)
  ,2) INTO v_total;
  RETURN v_total;
END $$;

COMMIT;
