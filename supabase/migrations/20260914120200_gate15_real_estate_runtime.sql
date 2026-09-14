BEGIN;

CREATE OR REPLACE FUNCTION public.re_next_master_lease_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT 'ML-' || to_char(CURRENT_DATE,'YYYY') || '-' || lpad(nextval('public.re_master_lease_seq')::text,6,'0')
$$;

CREATE OR REPLACE FUNCTION public.re_next_tenant_lease_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT 'TL-' || to_char(CURRENT_DATE,'YYYY') || '-' || lpad(nextval('public.re_tenant_lease_seq')::text,6,'0')
$$;

CREATE OR REPLACE FUNCTION public.re_create_property(
  _property_code text,
  _name_ar text,
  _property_type text,
  _ownership_model text,
  _city text DEFAULT NULL,
  _latitude numeric DEFAULT NULL,
  _longitude numeric DEFAULT NULL
)
RETURNS public.re_properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid := public.re_company_id();
  v_row public.re_properties;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'RE company is not configured'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['manager','admin']);
  IF NULLIF(btrim(_property_code),'') IS NULL OR NULLIF(btrim(_name_ar),'') IS NULL THEN
    RAISE EXCEPTION 'property code and Arabic name are required';
  END IF;
  IF _property_type NOT IN ('residential','commercial','mixed_use','industrial','land','other') THEN
    RAISE EXCEPTION 'invalid property type';
  END IF;
  IF _ownership_model NOT IN ('owned','leased_in','managed') THEN RAISE EXCEPTION 'invalid ownership model'; END IF;

  INSERT INTO public.re_properties(company_id,property_code,name_ar,property_type,ownership_model,city,latitude,longitude,created_by)
  VALUES(v_company,upper(btrim(_property_code)),btrim(_name_ar),_property_type,_ownership_model,NULLIF(btrim(_city),''),_latitude,_longitude,auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_create_building(_property_id uuid,_building_code text,_name_ar text,_floors_count integer DEFAULT NULL)
RETURNS public.re_buildings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  p public.re_properties;
  v_row public.re_buildings;
BEGIN
  SELECT * INTO p FROM public.re_properties WHERE id=_property_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'property not found'; END IF;
  PERFORM public.re_require_role(p.company_id,ARRAY['manager','admin']);
  IF NULLIF(btrim(_building_code),'') IS NULL OR NULLIF(btrim(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'building code and name are required'; END IF;
  INSERT INTO public.re_buildings(property_id,building_code,name_ar,floors_count)
  VALUES(p.id,upper(btrim(_building_code)),btrim(_name_ar),_floors_count)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_create_floor(_building_id uuid,_floor_no integer,_name_ar text DEFAULT NULL)
RETURNS public.re_floors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_row public.re_floors;
BEGIN
  SELECT p.company_id INTO v_company FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=_building_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'building not found'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['manager','admin']);
  INSERT INTO public.re_floors(building_id,floor_no,name_ar) VALUES(_building_id,_floor_no,NULLIF(btrim(_name_ar),'')) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_create_unit(
  _building_id uuid,_floor_id uuid,_unit_code text,_unit_type text,_area_sqm numeric DEFAULT NULL,_asking_rent_monthly numeric DEFAULT NULL
)
RETURNS public.re_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_floor_building uuid;
  v_row public.re_units;
BEGIN
  SELECT p.company_id INTO v_company FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=_building_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'building not found'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['manager','admin']);
  IF _floor_id IS NOT NULL THEN
    SELECT building_id INTO v_floor_building FROM public.re_floors WHERE id=_floor_id;
    IF v_floor_building IS DISTINCT FROM _building_id THEN RAISE EXCEPTION 'floor does not belong to building'; END IF;
  END IF;
  IF NULLIF(btrim(_unit_code),'') IS NULL THEN RAISE EXCEPTION 'unit code is required'; END IF;
  IF _unit_type NOT IN ('apartment','office','shop','warehouse','villa','land','parking','other') THEN RAISE EXCEPTION 'invalid unit type'; END IF;
  INSERT INTO public.re_units(building_id,floor_id,unit_code,unit_type,area_sqm,asking_rent_monthly)
  VALUES(_building_id,_floor_id,upper(btrim(_unit_code)),_unit_type,_area_sqm,_asking_rent_monthly)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_create_master_lease(
  _property_id uuid,_vendor_id uuid,_start_date date,_end_date date,_monthly_rent numeric,_security_deposit numeric DEFAULT 0,_notes text DEFAULT NULL
)
RETURNS public.re_master_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  p public.re_properties;
  v_row public.re_master_leases;
BEGIN
  SELECT * INTO p FROM public.re_properties WHERE id=_property_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'property not found'; END IF;
  PERFORM public.re_require_role(p.company_id,ARRAY['manager','admin']);
  IF p.ownership_model<>'leased_in' THEN RAISE EXCEPTION 'master leases require a leased_in property'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id=_vendor_id) THEN RAISE EXCEPTION 'landlord/vendor not found'; END IF;
  IF _end_date<_start_date OR _monthly_rent<0 OR COALESCE(_security_deposit,0)<0 THEN RAISE EXCEPTION 'invalid master lease dates or amounts'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-property:'||p.id::text,0));

  INSERT INTO public.re_master_leases(company_id,lease_no,property_id,vendor_id,start_date,end_date,monthly_rent,security_deposit,notes,created_by)
  VALUES(p.company_id,public.re_next_master_lease_no(),p.id,_vendor_id,_start_date,_end_date,_monthly_rent,COALESCE(_security_deposit,0),_notes,auth.uid())
  RETURNING * INTO v_row;
  INSERT INTO public.re_status_events(entity_type,entity_id,from_status,to_status,changed_by)
  VALUES('master_lease',v_row.id,NULL,'draft',auth.uid());
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_create_tenant_lease(
  _unit_id uuid,_customer_id uuid,_start_date date,_end_date date,_monthly_rent numeric,_security_deposit numeric DEFAULT 0,_notes text DEFAULT NULL
)
RETURNS public.re_tenant_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_row public.re_tenant_leases;
BEGIN
  SELECT p.company_id INTO v_company
  FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id
  WHERE u.id=_unit_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'unit not found'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['member','manager','admin']);
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id=_customer_id) THEN RAISE EXCEPTION 'tenant/customer not found'; END IF;
  IF _end_date<_start_date OR _monthly_rent<0 OR COALESCE(_security_deposit,0)<0 THEN RAISE EXCEPTION 'invalid tenant lease dates or amounts'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-unit:'||_unit_id::text,0));

  INSERT INTO public.re_tenant_leases(company_id,lease_no,unit_id,customer_id,start_date,end_date,monthly_rent,security_deposit,notes,created_by)
  VALUES(v_company,public.re_next_tenant_lease_no(),_unit_id,_customer_id,_start_date,_end_date,_monthly_rent,COALESCE(_security_deposit,0),_notes,auth.uid())
  RETURNING * INTO v_row;
  INSERT INTO public.re_status_events(entity_type,entity_id,from_status,to_status,changed_by)
  VALUES('tenant_lease',v_row.id,NULL,'draft',auth.uid());
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_assert_no_tenant_overlap(_lease_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE l public.re_tenant_leases;
BEGIN
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=_lease_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'tenant lease not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-unit:'||l.unit_id::text,0));
  IF EXISTS (
    SELECT 1 FROM public.re_tenant_leases x
    WHERE x.unit_id=l.unit_id AND x.id<>l.id
      AND x.status IN ('approved','active')
      AND daterange(x.start_date,x.end_date,'[]') && daterange(l.start_date,l.end_date,'[]')
  ) THEN
    RAISE EXCEPTION 'tenant lease overlaps another approved/active lease for the unit';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.re_assert_no_master_overlap(_lease_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE l public.re_master_leases;
BEGIN
  SELECT * INTO l FROM public.re_master_leases WHERE id=_lease_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'master lease not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-property:'||l.property_id::text,0));
  IF EXISTS (
    SELECT 1 FROM public.re_master_leases x
    WHERE x.property_id=l.property_id AND x.id<>l.id
      AND x.status IN ('approved','active')
      AND daterange(x.start_date,x.end_date,'[]') && daterange(l.start_date,l.end_date,'[]')
  ) THEN
    RAISE EXCEPTION 'master lease overlaps another approved/active lease for the property';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.re_generate_rent_schedule(_lease_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  l public.re_tenant_leases;
  v_month date;
  v_due date;
  v_end date;
  v_count integer := 0;
BEGIN
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=_lease_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'tenant lease not found'; END IF;
  IF l.status NOT IN ('approved','active') THEN RAISE EXCEPTION 'rent schedule requires an approved or active lease'; END IF;

  v_month := date_trunc('month',l.start_date)::date;
  WHILE v_month <= l.end_date LOOP
    v_due := (v_month + (LEAST(l.billing_day,28)-1))::date;
    IF v_due<l.start_date THEN v_due:=l.start_date; END IF;
    v_end := LEAST((v_month + interval '1 month - 1 day')::date,l.end_date);
    INSERT INTO public.re_lease_schedules(tenant_lease_id,due_date,period_start,period_end,amount)
    VALUES(l.id,v_due,GREATEST(v_month,l.start_date),v_end,l.monthly_rent)
    ON CONFLICT (tenant_lease_id,due_date) DO NOTHING;
    IF FOUND THEN v_count:=v_count+1; END IF;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.re_set_tenant_lease_status(_lease_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.re_tenant_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  l public.re_tenant_leases;
  v_from text;
  v_ok boolean := false;
BEGIN
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=_lease_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'tenant lease not found'; END IF;
  PERFORM public.re_require_role(l.company_id,ARRAY['manager','admin']);
  v_from:=l.status;
  v_ok:=CASE l.status
    WHEN 'draft' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('active','cancelled')
    WHEN 'active' THEN _to_status IN ('terminated','expired')
    WHEN 'terminated' THEN _to_status='closed'
    WHEN 'expired' THEN _to_status='closed'
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid tenant lease transition % -> %',l.status,_to_status; END IF;

  IF _to_status IN ('approved','active') THEN PERFORM public.re_assert_no_tenant_overlap(l.id); END IF;
  IF _to_status='active' THEN
    IF CURRENT_DATE<l.start_date OR CURRENT_DATE>l.end_date THEN RAISE EXCEPTION 'lease cannot activate outside its date range'; END IF;
  END IF;
  IF _to_status='terminated' AND NULLIF(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'termination reason is required'; END IF;

  UPDATE public.re_tenant_leases SET
    status=_to_status,
    approved_by=CASE WHEN _to_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN _to_status='approved' THEN now() ELSE approved_at END,
    activated_at=CASE WHEN _to_status='active' THEN now() ELSE activated_at END,
    terminated_at=CASE WHEN _to_status='terminated' THEN now() ELSE terminated_at END,
    updated_at=now()
  WHERE id=l.id RETURNING * INTO l;

  IF _to_status='active' THEN
    PERFORM public.re_generate_rent_schedule(l.id);
    UPDATE public.re_units SET status='occupied',updated_at=now() WHERE id=l.unit_id;
    INSERT INTO public.re_occupancy_events(unit_id,tenant_lease_id,event_type,changed_by)
    VALUES(l.unit_id,l.id,'occupied',auth.uid());
  ELSIF _to_status IN ('terminated','expired') THEN
    UPDATE public.re_units SET status='available',updated_at=now() WHERE id=l.unit_id;
    INSERT INTO public.re_occupancy_events(unit_id,tenant_lease_id,event_type,note,changed_by)
    VALUES(l.unit_id,l.id,'vacated',_reason,auth.uid());
  END IF;

  INSERT INTO public.re_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('tenant_lease',l.id,v_from,_to_status,_reason,auth.uid());
  RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.re_set_master_lease_status(_lease_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.re_master_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  l public.re_master_leases;
  v_from text;
  v_ok boolean := false;
BEGIN
  SELECT * INTO l FROM public.re_master_leases WHERE id=_lease_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'master lease not found'; END IF;
  PERFORM public.re_require_role(l.company_id,ARRAY['manager','admin']);
  v_from:=l.status;
  v_ok:=CASE l.status
    WHEN 'draft' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('active','cancelled')
    WHEN 'active' THEN _to_status IN ('terminated','expired')
    WHEN 'terminated' THEN _to_status='closed'
    WHEN 'expired' THEN _to_status='closed'
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid master lease transition % -> %',l.status,_to_status; END IF;
  IF _to_status IN ('approved','active') THEN PERFORM public.re_assert_no_master_overlap(l.id); END IF;
  IF _to_status='active' AND (CURRENT_DATE<l.start_date OR CURRENT_DATE>l.end_date) THEN RAISE EXCEPTION 'master lease cannot activate outside its date range'; END IF;
  IF _to_status='terminated' AND NULLIF(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'termination reason is required'; END IF;

  UPDATE public.re_master_leases SET
    status=_to_status,
    approved_by=CASE WHEN _to_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN _to_status='approved' THEN now() ELSE approved_at END,
    terminated_at=CASE WHEN _to_status='terminated' THEN now() ELSE terminated_at END,
    updated_at=now()
  WHERE id=l.id RETURNING * INTO l;
  INSERT INTO public.re_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('master_lease',l.id,v_from,_to_status,_reason,auth.uid());
  RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.re_link_schedule_invoice(_schedule_id uuid,_invoice_id uuid)
RETURNS public.re_lease_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.re_lease_schedules;
  l public.re_tenant_leases;
  v_invoice_customer uuid;
BEGIN
  SELECT * INTO s FROM public.re_lease_schedules WHERE id=_schedule_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'rent schedule row not found'; END IF;
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=s.tenant_lease_id;
  PERFORM public.re_require_role(l.company_id,ARRAY['manager','admin']);
  SELECT customer_id INTO v_invoice_customer FROM public.invoices WHERE id=_invoice_id;
  IF v_invoice_customer IS DISTINCT FROM l.customer_id THEN RAISE EXCEPTION 'invoice customer does not match tenant'; END IF;
  UPDATE public.re_lease_schedules SET invoice_id=_invoice_id,status='invoiced',updated_at=now() WHERE id=s.id RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.re_link_facility(
  _property_id uuid DEFAULT NULL,_building_id uuid DEFAULT NULL,_unit_id uuid DEFAULT NULL,_ops_site_id uuid DEFAULT NULL,_ops_asset_id uuid DEFAULT NULL,_notes text DEFAULT NULL
)
RETURNS public.re_facility_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_row public.re_facility_links;
BEGIN
  IF num_nonnulls(_property_id,_building_id,_unit_id)<>1 THEN RAISE EXCEPTION 'exactly one real-estate target is required'; END IF;
  IF num_nonnulls(_ops_site_id,_ops_asset_id)<1 THEN RAISE EXCEPTION 'maintenance site or asset is required'; END IF;
  IF _property_id IS NOT NULL THEN SELECT company_id INTO v_company FROM public.re_properties WHERE id=_property_id;
  ELSIF _building_id IS NOT NULL THEN SELECT p.company_id INTO v_company FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=_building_id;
  ELSE SELECT p.company_id INTO v_company FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=_unit_id; END IF;
  IF v_company IS NULL THEN RAISE EXCEPTION 'real-estate target not found'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['manager','admin']);

  IF _ops_site_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ops_sites s JOIN public.group_companies c ON c.id=s.company_id WHERE s.id=_ops_site_id AND c.code='OM'
  ) THEN RAISE EXCEPTION 'maintenance site is not an OM site'; END IF;
  IF _ops_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ops_assets a JOIN public.group_companies c ON c.id=a.company_id WHERE a.id=_ops_asset_id AND c.code='OM'
  ) THEN RAISE EXCEPTION 'maintenance asset is not an OM asset'; END IF;

  INSERT INTO public.re_facility_links(property_id,building_id,unit_id,ops_site_id,ops_asset_id,notes,created_by)
  VALUES(_property_id,_building_id,_unit_id,_ops_site_id,_ops_asset_id,_notes,auth.uid()) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_link_property_cost(
  _cost_entry_id uuid,_allocated_amount numeric,_property_id uuid DEFAULT NULL,_building_id uuid DEFAULT NULL,_unit_id uuid DEFAULT NULL,_note text DEFAULT NULL
)
RETURNS public.re_property_cost_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_cost_amount numeric;
  v_allocated numeric;
  v_row public.re_property_cost_links;
BEGIN
  IF num_nonnulls(_property_id,_building_id,_unit_id)<>1 THEN RAISE EXCEPTION 'exactly one real-estate target is required'; END IF;
  IF _allocated_amount<0 THEN RAISE EXCEPTION 'allocated amount cannot be negative'; END IF;
  IF _property_id IS NOT NULL THEN SELECT company_id INTO v_company FROM public.re_properties WHERE id=_property_id;
  ELSIF _building_id IS NOT NULL THEN SELECT p.company_id INTO v_company FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=_building_id;
  ELSE SELECT p.company_id INTO v_company FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=_unit_id; END IF;
  IF v_company IS NULL THEN RAISE EXCEPTION 'real-estate target not found'; END IF;
  PERFORM public.re_require_role(v_company,ARRAY['manager','admin']);
  SELECT amount INTO v_cost_amount FROM public.cost_entries WHERE id=_cost_entry_id;
  IF v_cost_amount IS NULL THEN RAISE EXCEPTION 'cost entry not found or has no amount'; END IF;
  SELECT COALESCE(sum(allocated_amount),0) INTO v_allocated FROM public.re_property_cost_links WHERE cost_entry_id=_cost_entry_id;
  IF v_allocated+_allocated_amount>abs(v_cost_amount)+0.005 THEN RAISE EXCEPTION 'real-estate allocations exceed cost entry amount'; END IF;

  INSERT INTO public.re_property_cost_links(property_id,building_id,unit_id,cost_entry_id,allocated_amount,allocation_note,created_by)
  VALUES(_property_id,_building_id,_unit_id,_cost_entry_id,_allocated_amount,_note,auth.uid()) RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.re_property_profitability(_property_id uuid,_from date,_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  p public.re_properties;
  v_revenue numeric;
  v_cost numeric;
  v_units integer;
  v_occupied integer;
BEGIN
  SELECT * INTO p FROM public.re_properties WHERE id=_property_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'property not found'; END IF;
  IF NOT public.re_has_company_access(p.company_id) THEN RAISE EXCEPTION 'real estate module access denied'; END IF;
  IF _to<_from THEN RAISE EXCEPTION 'invalid profitability period'; END IF;

  SELECT COALESCE(sum(s.amount),0) INTO v_revenue
  FROM public.re_lease_schedules s
  JOIN public.re_tenant_leases l ON l.id=s.tenant_lease_id
  JOIN public.re_units u ON u.id=l.unit_id
  JOIN public.re_buildings b ON b.id=u.building_id
  WHERE b.property_id=p.id AND s.due_date BETWEEN _from AND _to AND s.status<>'waived';

  SELECT COALESCE(sum(cl.allocated_amount),0) INTO v_cost
  FROM public.re_property_cost_links cl
  LEFT JOIN public.re_buildings b ON b.id=cl.building_id
  LEFT JOIN public.re_units u ON u.id=cl.unit_id
  LEFT JOIN public.re_buildings ub ON ub.id=u.building_id
  WHERE (cl.property_id=p.id OR b.property_id=p.id OR ub.property_id=p.id)
    AND cl.created_at::date BETWEEN _from AND _to;

  SELECT count(*),count(*) FILTER (WHERE u.status='occupied') INTO v_units,v_occupied
  FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id WHERE b.property_id=p.id;

  RETURN jsonb_build_object(
    'property_id',p.id,'from',_from,'to',_to,'scheduled_revenue',round(v_revenue,2),
    'allocated_cost',round(v_cost,2),'operating_margin',round(v_revenue-v_cost,2),
    'units',v_units,'occupied_units',v_occupied,
    'occupancy_rate',CASE WHEN v_units=0 THEN 0 ELSE round((v_occupied::numeric/v_units::numeric)*100,2) END
  );
END $$;

REVOKE ALL ON FUNCTION public.re_next_master_lease_no(),public.re_next_tenant_lease_no() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.re_next_master_lease_no(),public.re_next_tenant_lease_no() TO service_role;

REVOKE ALL ON FUNCTION public.re_create_property(text,text,text,text,text,numeric,numeric),
  public.re_create_building(uuid,text,text,integer),public.re_create_floor(uuid,integer,text),public.re_create_unit(uuid,uuid,text,text,numeric,numeric),
  public.re_create_master_lease(uuid,uuid,date,date,numeric,numeric,text),public.re_create_tenant_lease(uuid,uuid,date,date,numeric,numeric,text),
  public.re_assert_no_tenant_overlap(uuid),public.re_assert_no_master_overlap(uuid),public.re_generate_rent_schedule(uuid),
  public.re_set_tenant_lease_status(uuid,text,text),public.re_set_master_lease_status(uuid,text,text),public.re_link_schedule_invoice(uuid,uuid),
  public.re_link_facility(uuid,uuid,uuid,uuid,uuid,text),public.re_link_property_cost(uuid,numeric,uuid,uuid,uuid,text),
  public.re_property_profitability(uuid,date,date) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.re_create_property(text,text,text,text,text,numeric,numeric),
  public.re_create_building(uuid,text,text,integer),public.re_create_floor(uuid,integer,text),public.re_create_unit(uuid,uuid,text,text,numeric,numeric),
  public.re_create_master_lease(uuid,uuid,date,date,numeric,numeric,text),public.re_create_tenant_lease(uuid,uuid,date,date,numeric,numeric,text),
  public.re_set_tenant_lease_status(uuid,text,text),public.re_set_master_lease_status(uuid,text,text),public.re_link_schedule_invoice(uuid,uuid),
  public.re_link_facility(uuid,uuid,uuid,uuid,uuid,text),public.re_link_property_cost(uuid,numeric,uuid,uuid,uuid,text),
  public.re_property_profitability(uuid,date,date) TO authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.re_assert_no_tenant_overlap(uuid),public.re_assert_no_master_overlap(uuid),public.re_generate_rent_schedule(uuid) TO service_role;

COMMIT;
