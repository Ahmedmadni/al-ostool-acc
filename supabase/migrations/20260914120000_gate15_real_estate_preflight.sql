BEGIN;

DO $$
DECLARE
  v_found integer := 0;
  v_expected constant integer := 15;
BEGIN
  v_found := v_found + CASE WHEN to_regclass('public.re_properties') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_buildings') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_floors') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_units') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_master_leases') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_tenant_leases') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_lease_schedules') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_occupancy_events') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_facility_links') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_property_cost_links') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_status_events') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_master_lease_seq') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regclass('public.re_tenant_lease_seq') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.re_create_property(text,text,text,text,text,numeric,numeric)') IS NOT NULL THEN 1 ELSE 0 END;
  v_found := v_found + CASE WHEN to_regprocedure('public.re_create_tenant_lease(uuid,uuid,date,date,numeric,numeric,text)') IS NOT NULL THEN 1 ELSE 0 END;

  IF v_found > 0 AND v_found < v_expected THEN
    RAISE EXCEPTION 'Gate 15 real estate and facilities appears partially applied (%/% core markers found); stop and reconcile before retry', v_found, v_expected;
  END IF;
END $$;

COMMIT;
