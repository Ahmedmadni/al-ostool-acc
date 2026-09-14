\set ON_ERROR_STOP on

DO $$
DECLARE
  v_lease uuid;
  v_invoiced uuid;
  v_pending uuid;
  v_snapshot jsonb;
  v_failed boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
  SELECT id INTO v_lease FROM public.re_tenant_leases WHERE status='active' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_invoiced FROM public.re_lease_schedules WHERE tenant_lease_id=v_lease AND status='invoiced' ORDER BY due_date LIMIT 1;
  IF v_invoiced IS NULL THEN RAISE EXCEPTION 'expected invoiced schedule missing'; END IF;
  PERFORM public.re_mark_schedule_paid(v_invoiced,now());
  IF NOT EXISTS (SELECT 1 FROM public.re_lease_schedules WHERE id=v_invoiced AND status='paid' AND paid_at IS NOT NULL) THEN
    RAISE EXCEPTION 'mark schedule paid failed';
  END IF;

  SELECT id INTO v_pending FROM public.re_lease_schedules WHERE tenant_lease_id=v_lease AND status='pending' ORDER BY due_date LIMIT 1;
  IF v_pending IS NULL THEN RAISE EXCEPTION 'expected pending schedule missing'; END IF;
  PERFORM public.re_waive_schedule(v_pending,'approved concession');
  IF NOT EXISTS (SELECT 1 FROM public.re_lease_schedules WHERE id=v_pending AND status='waived' AND waived_at IS NOT NULL AND waiver_reason='approved concession') THEN
    RAISE EXCEPTION 'schedule waiver audit failed';
  END IF;

  v_snapshot:=public.re_portfolio_snapshot();
  IF (v_snapshot->>'properties')::integer<2 THEN RAISE EXCEPTION 'portfolio snapshot property count failed'; END IF;
  IF (v_snapshot->>'units')::integer<1 OR (v_snapshot->>'occupied')::integer<1 THEN RAISE EXCEPTION 'portfolio snapshot occupancy failed'; END IF;
  IF (v_snapshot->>'monthly_rent_roll')::numeric<=0 THEN RAISE EXCEPTION 'portfolio snapshot rent roll failed'; END IF;
  IF (v_snapshot->>'allocated_costs')::numeric<>600 THEN RAISE EXCEPTION 'portfolio snapshot cost total failed'; END IF;
  IF (v_snapshot->>'facility_links')::integer<1 THEN RAISE EXCEPTION 'portfolio snapshot facility count failed'; END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
  v_failed:=false;
  BEGIN
    PERFORM public.re_portfolio_snapshot();
  EXCEPTION WHEN OTHERS THEN
    v_failed:=position('access denied' in SQLERRM)>0;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'portfolio snapshot leaked to user without RE access'; END IF;
END $$;

SELECT 'Gate 15 reporting and billing checks passed' AS result;
