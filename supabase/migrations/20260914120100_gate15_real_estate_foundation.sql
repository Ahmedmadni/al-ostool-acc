BEGIN;

DO $$
BEGIN
  IF to_regclass('public.group_companies') IS NULL
     OR to_regclass('public.group_modules') IS NULL
     OR to_regprocedure('public.group_has_module_access(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Gate 15 requires Gate 13 multi-company foundation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_companies WHERE code='RE')
     OR NOT EXISTS (SELECT 1 FROM public.group_modules WHERE module_key='real_estate') THEN
    RAISE EXCEPTION 'Gate 15 requires RE / real_estate Gate 13 configuration';
  END IF;

  IF to_regclass('public.customers') IS NULL
     OR to_regclass('public.vendors') IS NULL
     OR to_regclass('public.contracts') IS NULL
     OR to_regclass('public.invoices') IS NULL
     OR to_regclass('public.cost_entries') IS NULL
     OR to_regclass('public.fixed_assets') IS NULL THEN
    RAISE EXCEPTION 'Gate 15 requires customer, vendor, contract, invoice, cost and fixed-asset foundations';
  END IF;

  IF to_regclass('public.ops_sites') IS NULL OR to_regclass('public.ops_assets') IS NULL THEN
    RAISE EXCEPTION 'Gate 15 requires Gate 14 facilities/maintenance foundation';
  END IF;
END $$;

CREATE SEQUENCE public.re_master_lease_seq;
CREATE SEQUENCE public.re_tenant_lease_seq;

CREATE TABLE public.re_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  property_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  property_type text NOT NULL CHECK (property_type IN ('residential','commercial','mixed_use','industrial','land','other')),
  ownership_model text NOT NULL CHECK (ownership_model IN ('owned','leased_in','managed')),
  fixed_asset_id uuid REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  city text,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','under_development','disposed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,property_code),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE public.re_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.re_properties(id) ON DELETE RESTRICT,
  building_code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  floors_count integer CHECK (floors_count IS NULL OR floors_count >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','under_maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id,building_code)
);

CREATE TABLE public.re_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.re_buildings(id) ON DELETE RESTRICT,
  floor_no integer NOT NULL,
  name_ar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(building_id,floor_no)
);

CREATE TABLE public.re_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.re_buildings(id) ON DELETE RESTRICT,
  floor_id uuid REFERENCES public.re_floors(id) ON DELETE SET NULL,
  unit_code text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('apartment','office','shop','warehouse','villa','land','parking','other')),
  area_sqm numeric(18,2) CHECK (area_sqm IS NULL OR area_sqm > 0),
  bedrooms integer CHECK (bedrooms IS NULL OR bedrooms >= 0),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','occupied','maintenance','inactive')),
  asking_rent_monthly numeric(18,2) CHECK (asking_rent_monthly IS NULL OR asking_rent_monthly >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(building_id,unit_code)
);

CREATE TABLE public.re_master_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  lease_no text NOT NULL UNIQUE,
  property_id uuid NOT NULL REFERENCES public.re_properties(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric(18,2) NOT NULL CHECK (monthly_rent >= 0),
  security_deposit numeric(18,2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','terminated','expired','closed','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  terminated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE public.re_tenant_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  lease_no text NOT NULL UNIQUE,
  unit_id uuid NOT NULL REFERENCES public.re_units(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric(18,2) NOT NULL CHECK (monthly_rent >= 0),
  security_deposit numeric(18,2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
  billing_day integer NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','terminated','expired','closed','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  activated_at timestamptz,
  terminated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE public.re_lease_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_lease_id uuid NOT NULL REFERENCES public.re_tenant_leases(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','invoiced','paid','waived')),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_lease_id,due_date),
  CHECK (period_end >= period_start),
  CHECK ((status='invoiced' AND invoice_id IS NOT NULL) OR status<>'invoiced' OR invoice_id IS NOT NULL)
);

CREATE TABLE public.re_occupancy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.re_units(id) ON DELETE RESTRICT,
  tenant_lease_id uuid REFERENCES public.re_tenant_leases(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('reserved','occupied','vacated','maintenance','available')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  note text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.re_facility_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.re_properties(id) ON DELETE CASCADE,
  building_id uuid REFERENCES public.re_buildings(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.re_units(id) ON DELETE CASCADE,
  ops_site_id uuid REFERENCES public.ops_sites(id) ON DELETE SET NULL,
  ops_asset_id uuid REFERENCES public.ops_assets(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(property_id,building_id,unit_id)=1),
  CHECK (num_nonnulls(ops_site_id,ops_asset_id)>=1)
);

CREATE TABLE public.re_property_cost_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.re_properties(id) ON DELETE CASCADE,
  building_id uuid REFERENCES public.re_buildings(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.re_units(id) ON DELETE CASCADE,
  cost_entry_id uuid NOT NULL REFERENCES public.cost_entries(id) ON DELETE RESTRICT,
  allocated_amount numeric(18,2) NOT NULL CHECK (allocated_amount >= 0),
  allocation_note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(property_id,building_id,unit_id)=1),
  UNIQUE(cost_entry_id,property_id,building_id,unit_id)
);

CREATE TABLE public.re_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('master_lease','tenant_lease','unit')),
  entity_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_re_properties_company_status ON public.re_properties(company_id,status);
CREATE INDEX idx_re_buildings_property ON public.re_buildings(property_id);
CREATE INDEX idx_re_units_building_status ON public.re_units(building_id,status);
CREATE INDEX idx_re_master_leases_property_dates ON public.re_master_leases(property_id,start_date,end_date);
CREATE INDEX idx_re_tenant_leases_unit_dates ON public.re_tenant_leases(unit_id,start_date,end_date);
CREATE INDEX idx_re_tenant_leases_customer ON public.re_tenant_leases(customer_id,status);
CREATE INDEX idx_re_schedule_due ON public.re_lease_schedules(due_date,status);
CREATE INDEX idx_re_occupancy_unit ON public.re_occupancy_events(unit_id,effective_at DESC);
CREATE INDEX idx_re_facility_property ON public.re_facility_links(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_re_cost_property ON public.re_property_cost_links(property_id) WHERE property_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.re_has_company_access(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_companies c
    WHERE c.id=_company_id
      AND c.code='RE'
      AND c.is_active
      AND public.group_has_module_access(c.code,'real_estate')
  )
$$;

CREATE OR REPLACE FUNCTION public.re_access_role(_company_id uuid)
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
      WHERE a.user_id=auth.uid()
        AND a.company_id=_company_id
        AND a.is_active
        AND m.module_key='real_estate'
        AND m.is_active
        AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE)
        AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE)
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.re_require_role(_company_id uuid,_roles text[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_role text;
BEGIN
  IF NOT public.re_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'real estate module access denied';
  END IF;
  v_role := public.re_access_role(_company_id);
  IF v_role IS NULL OR NOT (v_role=ANY(_roles)) THEN
    RAISE EXCEPTION 'real estate operation requires role in %',_roles;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.re_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT id FROM public.group_companies WHERE code='RE' AND is_active LIMIT 1
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    're_properties','re_buildings','re_floors','re_units','re_master_leases','re_tenant_leases',
    're_lease_schedules','re_occupancy_events','re_facility_links','re_property_cost_links','re_status_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

CREATE POLICY re_properties_read ON public.re_properties FOR SELECT TO authenticated
USING (public.re_has_company_access(company_id));

CREATE POLICY re_buildings_read ON public.re_buildings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.re_properties p WHERE p.id=property_id AND public.re_has_company_access(p.company_id)));

CREATE POLICY re_floors_read ON public.re_floors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=building_id AND public.re_has_company_access(p.company_id)));

CREATE POLICY re_units_read ON public.re_units FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=building_id AND public.re_has_company_access(p.company_id)));

CREATE POLICY re_master_leases_read ON public.re_master_leases FOR SELECT TO authenticated
USING (public.re_has_company_access(company_id));

CREATE POLICY re_tenant_leases_read ON public.re_tenant_leases FOR SELECT TO authenticated
USING (public.re_has_company_access(company_id));

CREATE POLICY re_schedule_read ON public.re_lease_schedules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.re_tenant_leases l WHERE l.id=tenant_lease_id AND public.re_has_company_access(l.company_id)));

CREATE POLICY re_occupancy_read ON public.re_occupancy_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=unit_id AND public.re_has_company_access(p.company_id)));

CREATE POLICY re_facility_links_read ON public.re_facility_links FOR SELECT TO authenticated
USING (
  (property_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_properties p WHERE p.id=property_id AND public.re_has_company_access(p.company_id))) OR
  (building_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=building_id AND public.re_has_company_access(p.company_id))) OR
  (unit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=unit_id AND public.re_has_company_access(p.company_id)))
);

CREATE POLICY re_cost_links_read ON public.re_property_cost_links FOR SELECT TO authenticated
USING (
  (property_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_properties p WHERE p.id=property_id AND public.re_has_company_access(p.company_id))) OR
  (building_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_buildings b JOIN public.re_properties p ON p.id=b.property_id WHERE b.id=building_id AND public.re_has_company_access(p.company_id))) OR
  (unit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=unit_id AND public.re_has_company_access(p.company_id)))
);

CREATE POLICY re_status_events_read ON public.re_status_events FOR SELECT TO authenticated
USING (
  (entity_type='tenant_lease' AND EXISTS (SELECT 1 FROM public.re_tenant_leases l WHERE l.id=entity_id AND public.re_has_company_access(l.company_id))) OR
  (entity_type='master_lease' AND EXISTS (SELECT 1 FROM public.re_master_leases l WHERE l.id=entity_id AND public.re_has_company_access(l.company_id))) OR
  (entity_type='unit' AND EXISTS (SELECT 1 FROM public.re_units u JOIN public.re_buildings b ON b.id=u.building_id JOIN public.re_properties p ON p.id=b.property_id WHERE u.id=entity_id AND public.re_has_company_access(p.company_id)))
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    're_properties','re_buildings','re_floors','re_units','re_master_leases','re_tenant_leases',
    're_lease_schedules','re_occupancy_events','re_facility_links','re_property_cost_links','re_status_events'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.re_has_company_access(uuid),public.re_access_role(uuid),public.re_require_role(uuid,text[]),public.re_company_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.re_has_company_access(uuid),public.re_access_role(uuid),public.re_company_id() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.re_require_role(uuid,text[]) TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.re_master_lease_seq,public.re_tenant_lease_seq TO service_role;

COMMIT;
