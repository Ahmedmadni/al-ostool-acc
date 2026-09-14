BEGIN;

CREATE OR REPLACE FUNCTION public.re_enforce_hierarchy_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_floor_building uuid;
  v_property_company uuid;
BEGIN
  IF TG_TABLE_NAME='re_properties' THEN
    IF NOT EXISTS (SELECT 1 FROM public.group_companies c WHERE c.id=NEW.company_id AND c.code='RE') THEN
      RAISE EXCEPTION 'real-estate property must belong to RE company';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='re_units' THEN
    IF NEW.floor_id IS NOT NULL THEN
      SELECT building_id INTO v_floor_building FROM public.re_floors WHERE id=NEW.floor_id;
      IF v_floor_building IS DISTINCT FROM NEW.building_id THEN RAISE EXCEPTION 'floor does not belong to unit building'; END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='re_master_leases' THEN
    SELECT company_id INTO v_property_company FROM public.re_properties WHERE id=NEW.property_id;
    IF v_property_company IS NULL OR NEW.company_id IS DISTINCT FROM v_property_company THEN RAISE EXCEPTION 'master lease company does not match property company'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.re_properties p WHERE p.id=NEW.property_id AND p.ownership_model='leased_in') THEN
      RAISE EXCEPTION 'master lease requires leased_in property';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='re_tenant_leases' THEN
    SELECT p.company_id INTO v_company
    FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id
    WHERE u.id=NEW.unit_id;
    IF v_company IS NULL OR NEW.company_id IS DISTINCT FROM v_company THEN RAISE EXCEPTION 'tenant lease company does not match unit property company'; END IF;
    IF NEW.status='active' AND (CURRENT_DATE<NEW.start_date OR CURRENT_DATE>NEW.end_date) THEN RAISE EXCEPTION 'active tenant lease must cover current date'; END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_property_company_integrity ON public.re_properties;
CREATE TRIGGER trg_re_property_company_integrity BEFORE INSERT OR UPDATE OF company_id ON public.re_properties
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_hierarchy_integrity();

DROP TRIGGER IF EXISTS trg_re_unit_floor_integrity ON public.re_units;
CREATE TRIGGER trg_re_unit_floor_integrity BEFORE INSERT OR UPDATE OF building_id,floor_id ON public.re_units
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_hierarchy_integrity();

DROP TRIGGER IF EXISTS trg_re_master_company_integrity ON public.re_master_leases;
CREATE TRIGGER trg_re_master_company_integrity BEFORE INSERT OR UPDATE OF company_id,property_id ON public.re_master_leases
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_hierarchy_integrity();

DROP TRIGGER IF EXISTS trg_re_tenant_company_integrity ON public.re_tenant_leases;
CREATE TRIGGER trg_re_tenant_company_integrity BEFORE INSERT OR UPDATE OF company_id,unit_id,status,start_date,end_date ON public.re_tenant_leases
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_hierarchy_integrity();

CREATE OR REPLACE FUNCTION public.re_enforce_tenant_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NEW.status NOT IN ('approved','active') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-unit:'||NEW.unit_id::text,0));
  IF EXISTS (
    SELECT 1 FROM public.re_tenant_leases x
    WHERE x.unit_id=NEW.unit_id AND x.id<>NEW.id
      AND x.status IN ('approved','active')
      AND daterange(x.start_date,x.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')
  ) THEN RAISE EXCEPTION 'tenant lease overlaps another approved/active lease for the unit'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_tenant_overlap ON public.re_tenant_leases;
CREATE TRIGGER trg_re_tenant_overlap BEFORE INSERT OR UPDATE OF unit_id,start_date,end_date,status ON public.re_tenant_leases
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_tenant_overlap();

CREATE OR REPLACE FUNCTION public.re_enforce_master_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NEW.status NOT IN ('approved','active') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-property:'||NEW.property_id::text,0));
  IF EXISTS (
    SELECT 1 FROM public.re_master_leases x
    WHERE x.property_id=NEW.property_id AND x.id<>NEW.id
      AND x.status IN ('approved','active')
      AND daterange(x.start_date,x.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')
  ) THEN RAISE EXCEPTION 'master lease overlaps another approved/active lease for the property'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_master_overlap ON public.re_master_leases;
CREATE TRIGGER trg_re_master_overlap BEFORE INSERT OR UPDATE OF property_id,start_date,end_date,status ON public.re_master_leases
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_master_overlap();

CREATE OR REPLACE FUNCTION public.re_enforce_schedule_invoice_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_customer uuid; v_invoice_customer uuid;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    IF NEW.status='invoiced' THEN RAISE EXCEPTION 'invoiced rent schedule requires invoice'; END IF;
    RETURN NEW;
  END IF;
  SELECT l.customer_id INTO v_customer FROM public.re_tenant_leases l WHERE l.id=NEW.tenant_lease_id;
  SELECT i.customer_id INTO v_invoice_customer FROM public.invoices i WHERE i.id=NEW.invoice_id;
  IF v_customer IS NULL OR v_invoice_customer IS DISTINCT FROM v_customer THEN RAISE EXCEPTION 'invoice customer does not match tenant'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_schedule_invoice_customer ON public.re_lease_schedules;
CREATE TRIGGER trg_re_schedule_invoice_customer BEFORE INSERT OR UPDATE OF tenant_lease_id,invoice_id,status ON public.re_lease_schedules
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_schedule_invoice_customer();

CREATE OR REPLACE FUNCTION public.re_enforce_facility_link_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF num_nonnulls(NEW.property_id,NEW.building_id,NEW.unit_id)<>1 THEN RAISE EXCEPTION 'exactly one real-estate target is required'; END IF;
  IF num_nonnulls(NEW.ops_site_id,NEW.ops_asset_id)<1 THEN RAISE EXCEPTION 'maintenance site or asset is required'; END IF;
  IF NEW.ops_site_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ops_sites s JOIN public.group_companies c ON c.id=s.company_id WHERE s.id=NEW.ops_site_id AND c.code='OM'
  ) THEN RAISE EXCEPTION 'facility link site must belong to OM'; END IF;
  IF NEW.ops_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ops_assets a JOIN public.group_companies c ON c.id=a.company_id WHERE a.id=NEW.ops_asset_id AND c.code='OM'
  ) THEN RAISE EXCEPTION 'facility link asset must belong to OM'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_facility_link_integrity ON public.re_facility_links;
CREATE TRIGGER trg_re_facility_link_integrity BEFORE INSERT OR UPDATE ON public.re_facility_links
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_facility_link_integrity();

CREATE OR REPLACE FUNCTION public.re_enforce_cost_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_cost numeric; v_other numeric;
BEGIN
  IF num_nonnulls(NEW.property_id,NEW.building_id,NEW.unit_id)<>1 THEN RAISE EXCEPTION 'exactly one real-estate cost target is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('re-cost:'||NEW.cost_entry_id::text,0));
  SELECT amount INTO v_cost FROM public.cost_entries WHERE id=NEW.cost_entry_id;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'cost entry not found or has no amount'; END IF;
  SELECT COALESCE(sum(allocated_amount),0) INTO v_other FROM public.re_property_cost_links WHERE cost_entry_id=NEW.cost_entry_id AND id<>NEW.id;
  IF v_other+NEW.allocated_amount>abs(v_cost)+0.005 THEN RAISE EXCEPTION 'real-estate allocations exceed cost entry amount'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_cost_allocation ON public.re_property_cost_links;
CREATE TRIGGER trg_re_cost_allocation BEFORE INSERT OR UPDATE OF cost_entry_id,allocated_amount,property_id,building_id,unit_id ON public.re_property_cost_links
FOR EACH ROW EXECUTE FUNCTION public.re_enforce_cost_allocation();

REVOKE ALL ON FUNCTION public.re_enforce_hierarchy_integrity(),public.re_enforce_tenant_overlap(),public.re_enforce_master_overlap(),public.re_enforce_schedule_invoice_customer(),public.re_enforce_facility_link_integrity(),public.re_enforce_cost_allocation() FROM PUBLIC,anon,authenticated;

COMMIT;
