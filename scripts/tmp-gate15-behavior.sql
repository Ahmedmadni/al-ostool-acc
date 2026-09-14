\set ON_ERROR_STOP on

DO $$
DECLARE
  p public.re_properties;
  p_lease public.re_properties;
  b1 public.re_buildings;
  b2 public.re_buildings;
  f1 public.re_floors;
  f2 public.re_floors;
  u1 public.re_units;
  l1 public.re_tenant_leases;
  l2 public.re_tenant_leases;
  ml1 public.re_master_leases;
  ml2 public.re_master_leases;
  v_schedule uuid;
  v_profit jsonb;
  v_failed boolean;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

  SELECT * INTO p FROM public.re_create_property('PROP-001','عقار الاختبار','residential','owned','Riyadh',24.7136,46.6753);
  IF p.company_id::text<>'10000000-0000-0000-0000-000000000001' THEN RAISE EXCEPTION 'property company isolation failed'; END IF;

  SELECT * INTO b1 FROM public.re_create_building(p.id,'B01','المبنى الأول',2);
  SELECT * INTO f1 FROM public.re_create_floor(b1.id,1,'الدور الأول');
  SELECT * INTO u1 FROM public.re_create_unit(b1.id,f1.id,'U101','apartment',120,2500);
  SELECT * INTO b2 FROM public.re_create_building(p.id,'B02','المبنى الثاني',1);
  SELECT * INTO f2 FROM public.re_create_floor(b2.id,1,'دور مختلف');

  v_failed:=false;
  BEGIN
    INSERT INTO public.re_units(building_id,floor_id,unit_code,unit_type) VALUES(b1.id,f2.id,'BAD-FLOOR','apartment');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('floor does not belong' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'cross-building floor integrity was not rejected'; END IF;

  SELECT * INTO l1 FROM public.re_create_tenant_lease(
    u1.id,'30000000-0000-0000-0000-000000000001',CURRENT_DATE-5,CURRENT_DATE+65,2500,1000,'first lease'
  );
  SELECT * INTO l1 FROM public.re_set_tenant_lease_status(l1.id,'approved','approved test');
  SELECT * INTO l1 FROM public.re_set_tenant_lease_status(l1.id,'active','activate test');
  IF l1.status<>'active' THEN RAISE EXCEPTION 'tenant lease activation failed'; END IF;
  IF (SELECT status FROM public.re_units WHERE id=u1.id)<>'occupied' THEN RAISE EXCEPTION 'unit was not marked occupied'; END IF;
  SELECT count(*) INTO v_count FROM public.re_lease_schedules WHERE tenant_lease_id=l1.id;
  IF v_count<2 THEN RAISE EXCEPTION 'rent schedule was not generated'; END IF;

  SELECT * INTO l2 FROM public.re_create_tenant_lease(
    u1.id,'30000000-0000-0000-0000-000000000002',CURRENT_DATE,CURRENT_DATE+30,2600,0,'overlap test'
  );
  v_failed:=false;
  BEGIN
    PERFORM public.re_set_tenant_lease_status(l2.id,'approved','should fail overlap');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('overlaps another approved/active lease' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'tenant lease overlap was not rejected'; END IF;

  SELECT id INTO v_schedule FROM public.re_lease_schedules WHERE tenant_lease_id=l1.id ORDER BY due_date LIMIT 1;
  v_failed:=false;
  BEGIN
    PERFORM public.re_link_schedule_invoice(v_schedule,'50000000-0000-0000-0000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('invoice customer does not match tenant' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'cross-tenant invoice link was not rejected'; END IF;
  PERFORM public.re_link_schedule_invoice(v_schedule,'50000000-0000-0000-0000-000000000001');
  IF (SELECT status FROM public.re_lease_schedules WHERE id=v_schedule)<>'invoiced' THEN RAISE EXCEPTION 'valid invoice link failed'; END IF;

  PERFORM public.re_link_facility(p.id,NULL,NULL,'70000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','OM facility link');
  v_failed:=false;
  BEGIN
    PERFORM public.re_link_facility(p.id,NULL,NULL,'70000000-0000-0000-0000-000000000002',NULL,'wrong company');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('not an OM site' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'cross-company facility site was not rejected'; END IF;

  PERFORM public.re_link_property_cost('60000000-0000-0000-0000-000000000001',600,p.id,NULL,NULL,'allocated cost');
  v_failed:=false;
  BEGIN
    PERFORM public.re_link_property_cost('60000000-0000-0000-0000-000000000001',500,NULL,b1.id,NULL,'over allocation');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('allocations exceed cost entry amount' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'cost over-allocation was not rejected'; END IF;

  v_profit:=public.re_property_profitability(p.id,CURRENT_DATE-30,CURRENT_DATE+90);
  IF (v_profit->>'allocated_cost')::numeric<>600 THEN RAISE EXCEPTION 'property cost profitability total is incorrect'; END IF;
  IF (v_profit->>'scheduled_revenue')::numeric<=0 THEN RAISE EXCEPTION 'scheduled property revenue missing'; END IF;
  IF (v_profit->>'occupied_units')::integer<>1 THEN RAISE EXCEPTION 'occupancy profitability metric is incorrect'; END IF;

  SELECT * INTO p_lease FROM public.re_create_property('PROP-LEASE','عقار مستأجر','commercial','leased_in','Riyadh',NULL,NULL);
  SELECT * INTO ml1 FROM public.re_create_master_lease(
    p_lease.id,'40000000-0000-0000-0000-000000000001',CURRENT_DATE-10,CURRENT_DATE+180,10000,5000,'head lease'
  );
  SELECT * INTO ml1 FROM public.re_set_master_lease_status(ml1.id,'approved','approved master');
  SELECT * INTO ml2 FROM public.re_create_master_lease(
    p_lease.id,'40000000-0000-0000-0000-000000000001',CURRENT_DATE,CURRENT_DATE+90,11000,0,'overlap master'
  );
  v_failed:=false;
  BEGIN
    PERFORM public.re_set_master_lease_status(ml2.id,'approved','should overlap');
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('overlaps another approved/active lease' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'master lease overlap was not rejected'; END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
  v_failed:=false;
  BEGIN
    PERFORM public.re_property_profitability(p.id,CURRENT_DATE-30,CURRENT_DATE+90);
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('access denied' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'profitability leaked to user without RE access'; END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
  IF (SELECT count(*) FROM public.re_status_events WHERE entity_type='tenant_lease' AND entity_id=l1.id)<3 THEN
    RAISE EXCEPTION 'tenant lease audit trail is incomplete';
  END IF;
END $$;

SELECT 'Gate 15 PostgreSQL behavior checks passed' AS result;
