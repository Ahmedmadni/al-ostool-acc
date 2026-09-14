-- Gate 12 follow-up: keep the no-overlap invariant compatible with the
-- existing exact-period UPSERT path. A BEFORE INSERT trigger sees the fresh
-- NEW.id before ON CONFLICT resolves to the existing row, so explicitly
-- exclude an already-existing exact period while still rejecting all other overlaps.

CREATE OR REPLACE FUNCTION public.vat_return_period_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_exclude uuid;
BEGIN
  PERFORM public.vat_gate12_lock();

  IF TG_OP='UPDATE' THEN
    v_exclude:=NEW.id;
  ELSE
    SELECT r.id INTO v_exclude
    FROM public.vat_returns r
    WHERE r.period_from=NEW.period_from
      AND r.period_to=NEW.period_to
    FOR UPDATE;
  END IF;

  PERFORM public.vat_gate12_assert_no_overlap(NEW.period_from,NEW.period_to,v_exclude);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vat_return_period_guard() FROM PUBLIC,anon,authenticated,service_role;
