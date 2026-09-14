BEGIN;

ALTER TABLE public.re_lease_schedules
  ADD COLUMN waiver_reason text,
  ADD COLUMN waived_by uuid REFERENCES auth.users(id),
  ADD COLUMN waived_at timestamptz;

ALTER TABLE public.re_lease_schedules
  ADD CONSTRAINT re_schedule_invoice_required CHECK (status NOT IN ('invoiced','paid') OR invoice_id IS NOT NULL),
  ADD CONSTRAINT re_schedule_paid_at_required CHECK (status<>'paid' OR paid_at IS NOT NULL),
  ADD CONSTRAINT re_schedule_waiver_audit_required CHECK (status<>'waived' OR (waived_at IS NOT NULL AND waived_by IS NOT NULL AND NULLIF(btrim(waiver_reason),'') IS NOT NULL));

CREATE OR REPLACE FUNCTION public.re_mark_schedule_paid(_schedule_id uuid,_paid_at timestamptz DEFAULT now())
RETURNS public.re_lease_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.re_lease_schedules;
  l public.re_tenant_leases;
BEGIN
  SELECT * INTO s FROM public.re_lease_schedules WHERE id=_schedule_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'rent schedule row not found'; END IF;
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=s.tenant_lease_id;
  PERFORM public.re_require_role(l.company_id,ARRAY['manager','admin']);
  IF s.status<>'invoiced' OR s.invoice_id IS NULL THEN RAISE EXCEPTION 'rent schedule must be invoiced before payment'; END IF;
  IF _paid_at IS NULL THEN RAISE EXCEPTION 'payment timestamp is required'; END IF;
  UPDATE public.re_lease_schedules SET status='paid',paid_at=_paid_at,updated_at=now() WHERE id=s.id RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.re_waive_schedule(_schedule_id uuid,_reason text)
RETURNS public.re_lease_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.re_lease_schedules;
  l public.re_tenant_leases;
BEGIN
  SELECT * INTO s FROM public.re_lease_schedules WHERE id=_schedule_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'rent schedule row not found'; END IF;
  SELECT * INTO l FROM public.re_tenant_leases WHERE id=s.tenant_lease_id;
  PERFORM public.re_require_role(l.company_id,ARRAY['manager','admin']);
  IF s.status NOT IN ('pending','invoiced') THEN RAISE EXCEPTION 'only pending or invoiced schedules can be waived'; END IF;
  IF NULLIF(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'waiver reason is required'; END IF;
  UPDATE public.re_lease_schedules SET
    status='waived',waiver_reason=btrim(_reason),waived_by=auth.uid(),waived_at=now(),updated_at=now()
  WHERE id=s.id RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.re_portfolio_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid := public.re_company_id();
  v_properties integer;
  v_units integer;
  v_occupied integer;
  v_available integer;
  v_active_leases integer;
  v_expiring integer;
  v_monthly_rent numeric;
  v_receivables numeric;
  v_costs numeric;
  v_facilities integer;
BEGIN
  IF v_company IS NULL OR NOT public.re_has_company_access(v_company) THEN RAISE EXCEPTION 'real estate module access denied'; END IF;

  SELECT count(*) INTO v_properties FROM public.re_properties WHERE company_id=v_company AND status<>'disposed';
  SELECT count(*),count(*) FILTER (WHERE u.status='occupied'),count(*) FILTER (WHERE u.status='available')
  INTO v_units,v_occupied,v_available
  FROM public.re_units u
  JOIN public.re_buildings b ON b.id=u.building_id
  JOIN public.re_properties p ON p.id=b.property_id
  WHERE p.company_id=v_company AND p.status<>'disposed';

  SELECT count(*),COALESCE(sum(monthly_rent),0),count(*) FILTER (WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+60)
  INTO v_active_leases,v_monthly_rent,v_expiring
  FROM public.re_tenant_leases
  WHERE company_id=v_company AND status='active';

  SELECT COALESCE(sum(s.amount),0) INTO v_receivables
  FROM public.re_lease_schedules s
  JOIN public.re_tenant_leases l ON l.id=s.tenant_lease_id
  WHERE l.company_id=v_company AND s.status IN ('pending','invoiced') AND s.due_date<=CURRENT_DATE+90;

  SELECT COALESCE(sum(cl.allocated_amount),0) INTO v_costs
  FROM public.re_property_cost_links cl
  LEFT JOIN public.re_properties p0 ON p0.id=cl.property_id
  LEFT JOIN public.re_buildings b ON b.id=cl.building_id
  LEFT JOIN public.re_properties p1 ON p1.id=b.property_id
  LEFT JOIN public.re_units u ON u.id=cl.unit_id
  LEFT JOIN public.re_buildings ub ON ub.id=u.building_id
  LEFT JOIN public.re_properties p2 ON p2.id=ub.property_id
  WHERE COALESCE(p0.company_id,p1.company_id,p2.company_id)=v_company;

  SELECT count(*) INTO v_facilities
  FROM public.re_facility_links fl
  LEFT JOIN public.re_properties p0 ON p0.id=fl.property_id
  LEFT JOIN public.re_buildings b ON b.id=fl.building_id
  LEFT JOIN public.re_properties p1 ON p1.id=b.property_id
  LEFT JOIN public.re_units u ON u.id=fl.unit_id
  LEFT JOIN public.re_buildings ub ON ub.id=u.building_id
  LEFT JOIN public.re_properties p2 ON p2.id=ub.property_id
  WHERE COALESCE(p0.company_id,p1.company_id,p2.company_id)=v_company;

  RETURN jsonb_build_object(
    'properties',v_properties,'units',v_units,'occupied',v_occupied,'available',v_available,
    'occupancy_rate',CASE WHEN v_units=0 THEN 0 ELSE round(v_occupied::numeric*100/v_units,2) END,
    'active_leases',v_active_leases,'expiring_60_days',v_expiring,'monthly_rent_roll',round(v_monthly_rent,2),
    'receivables_90_days',round(v_receivables,2),'allocated_costs',round(v_costs,2),'facility_links',v_facilities
  );
END $$;

REVOKE ALL ON FUNCTION public.re_mark_schedule_paid(uuid,timestamptz),public.re_waive_schedule(uuid,text),public.re_portfolio_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.re_mark_schedule_paid(uuid,timestamptz),public.re_waive_schedule(uuid,text),public.re_portfolio_snapshot() TO authenticated,service_role;

COMMIT;
