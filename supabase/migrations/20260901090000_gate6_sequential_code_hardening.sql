-- Gate 6: sequential code hardening for HR work sites, shift groups and biometric devices.
--
-- This migration does NOT redesign the Gate 5 model. It closes four defects in
-- 20260825210000_hr_sequential_codes_and_device_api.sql and one in
-- 20260825220000_biometric_api_security.sql:
--
--   1. The original seeding used an unconditional setval() against MAX(code).
--      Re-running the migration REWINDS the sequence to the current maximum, so
--      codes belonging to deleted rows would be re-issued. Sequence movement is
--      now strictly forward-only.
--   2. The three code sequences were never revoked from client roles. Supabase
--      default privileges hand USAGE on public sequences to anon/authenticated,
--      which lets a signed-in client burn or skip official codes with a direct
--      nextval() outside the creation workflow.
--   3. hr_attendance_register_device inserted the CLIENT-SUPPLIED _device_code
--      into hr_biometric_devices.device_code. The BEFORE INSERT trigger masked
--      it, but the official identifier must never originate from the client --
--      not even on a path that is currently shadowed.
--   4. hr_assign_sequential_code() ran with SET search_path=public instead of
--      the Gates 4/5 standard SET search_path=''.
--   5. Nothing enforced the canonical code shape at the storage layer, so a
--      missing or disabled trigger would silently persist non-authoritative
--      identifiers.
--
-- NOT APPLIED to any database by this change. DB reconciliation is deferred.

-- ---------------------------------------------------------------------------
-- 1. Preflight: detect partial application and legacy data hazards, fail fast.
--    Nothing below this block runs unless the Gate 5 foundation is fully intact.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_count BIGINT;
BEGIN
  IF to_regclass('public.hr_work_site_code_seq') IS NULL
     OR to_regclass('public.hr_shift_group_code_seq') IS NULL
     OR to_regclass('public.hr_biometric_device_code_seq') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 6 requires the HR sequential code sequences created by 20260825210000';
  END IF;

  IF to_regprocedure('public.hr_assign_sequential_code()') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 6 requires public.hr_assign_sequential_code() created by 20260825210000';
  END IF;

  IF to_regprocedure('public.hr_attendance_register_device(text,text,uuid,text)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 6 requires the Gate 5 device provisioning RPC to be applied first';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('trg_hr_work_sites_sequential_code','hr_work_sites','code'),
      ('trg_hr_shift_groups_sequential_code','hr_shift_groups','code'),
      ('trg_hr_biometric_devices_sequential_code','hr_biometric_devices','device_code')
    ) AS t(trigger_name,table_name,column_name)
  LOOP
    -- A missing OR administratively disabled trigger both defeat server
    -- authority, so treat them identically instead of only checking existence.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger g
      JOIN pg_class c ON c.oid=g.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=r.table_name
        AND g.tgname=r.trigger_name AND NOT g.tgisinternal AND g.tgenabled<>'D'
    ) THEN
      RAISE EXCEPTION USING ERRCODE='55000',
        MESSAGE=format('Gate 6 preflight: trigger %I on public.%I is missing or disabled', r.trigger_name, r.table_name);
    END IF;

    -- Legacy hazards are reported, never repaired. Repair needs evidence from
    -- the real database, which is not available at migration authoring time.
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL OR btrim(%I)=%L', r.table_name, r.column_name, r.column_name, '')
      INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION USING ERRCODE='55000',
        MESSAGE=format('Gate 6 preflight: public.%I has %s row(s) with a null or empty %I; reconcile before applying Gate 6', r.table_name, v_count, r.column_name);
    END IF;

    -- The UNIQUE index is case-sensitive, so SITE-000001 and site-000001 can
    -- coexist while colliding for every human and external consumer.
    EXECUTE format('SELECT count(*) FROM (SELECT upper(btrim(%I)) k FROM public.%I GROUP BY 1 HAVING count(*)>1) d', r.column_name, r.table_name)
      INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION USING ERRCODE='55000',
        MESSAGE=format('Gate 6 preflight: public.%I has %s case-insensitive duplicate %I value(s); reconcile before applying Gate 6', r.table_name, v_count, r.column_name);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Forward-only sequence reconciliation.
--    Replaces the original unconditional setval(). The sequence is advanced to
--    cover any legacy row that sits above it and is NEVER moved backwards, so
--    re-running this migration can never re-issue a retired code.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_max BIGINT;
  v_issued BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.hr_work_site_code_seq','hr_work_sites','code','^SITE-([0-9]+)$'),
      ('public.hr_shift_group_code_seq','hr_shift_groups','code','^SHIFT-([0-9]+)$'),
      ('public.hr_biometric_device_code_seq','hr_biometric_devices','device_code','^DEV-([0-9]+)$')
    ) AS t(seq_name,table_name,column_name,pattern)
  LOOP
    EXECUTE format('SELECT COALESCE(MAX((regexp_match(%I,%L))[1]::BIGINT),0) FROM public.%I WHERE %I ~ %L',
                   r.column_name, r.pattern, r.table_name, r.column_name, r.pattern)
      INTO v_max;
    -- is_called=false means last_value has not been handed out yet.
    EXECUTE format('SELECT CASE WHEN is_called THEN last_value ELSE last_value-1 END FROM %s', r.seq_name)
      INTO v_issued;
    IF v_max > v_issued THEN
      PERFORM setval(r.seq_name::regclass, v_max, true);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON SEQUENCE public.hr_work_site_code_seq IS
  'Gate 6: sole authority for SITE-* codes. Monotonic and forward-only. Never reset or synchronise against MAX(code): deleting a work site must not release its code for reuse.';
COMMENT ON SEQUENCE public.hr_shift_group_code_seq IS
  'Gate 6: sole authority for SHIFT-* codes. Monotonic and forward-only. Never reset or synchronise against MAX(code): deleting a shift group must not release its code for reuse.';
COMMENT ON SEQUENCE public.hr_biometric_device_code_seq IS
  'Gate 6: sole authority for DEV-* codes. Monotonic and forward-only. Device code identity is independent of the device credential lifecycle; token rotation never changes it.';

-- ---------------------------------------------------------------------------
-- 3. Generator hardening: Gates 4/5 SECURITY DEFINER standard.
--    SECURITY DEFINER is deliberate and load-bearing -- step 5 revokes nextval
--    from every client role, so the trigger must run as the sequence owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hr_assign_sequential_code() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='hr_biometric_devices' THEN
      IF NEW.device_code IS DISTINCT FROM OLD.device_code THEN RAISE EXCEPTION 'لا يمكن تعديل الكود التسلسلي بعد إنشائه'; END IF;
    ELSE
      IF NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'لا يمكن تعديل الكود التسلسلي بعد إنشائه'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  -- On INSERT any client-supplied value is discarded unconditionally: the
  -- sequence is the only source of an official code.
  IF TG_TABLE_NAME='hr_work_sites' THEN
    NEW.code:='SITE-'||pg_catalog.lpad(pg_catalog.nextval('public.hr_work_site_code_seq')::TEXT,6,'0');
  ELSIF TG_TABLE_NAME='hr_shift_groups' THEN
    NEW.code:='SHIFT-'||pg_catalog.lpad(pg_catalog.nextval('public.hr_shift_group_code_seq')::TEXT,6,'0');
  ELSIF TG_TABLE_NAME='hr_biometric_devices' THEN
    NEW.device_code:='DEV-'||pg_catalog.lpad(pg_catalog.nextval('public.hr_biometric_device_code_seq')::TEXT,6,'0');
  ELSE
    RAISE EXCEPTION 'جدول غير مدعوم لتوليد الكود';
  END IF;
  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.hr_assign_sequential_code() IS
  'Gate 6: single official generator for SITE-/SHIFT-/DEV- codes. Assigns from the owning sequence on INSERT (discarding any client value) and rejects any change to the code on UPDATE.';

-- ---------------------------------------------------------------------------
-- 4. Device provisioning: remove the client-supplied code from the insert path.
--    The signature is preserved on purpose so the Gate 5 REVOKE/GRANT
--    statements and the generated TypeScript types stay valid. _device_code is
--    now an accepted-but-inert compatibility parameter and is rejected outright
--    when a caller tries to supply an actual value.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hr_attendance_register_device(_device_code TEXT,_name_ar TEXT,_site_id UUID,_vendor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(extensions.gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل جهاز'; END IF;
  IF NULLIF(btrim(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'اسم الجهاز مطلوب'; END IF;
  IF NULLIF(btrim(COALESCE(_device_code,'')),'') IS NOT NULL THEN
    RAISE EXCEPTION 'رمز الجهاز يولده النظام تلقائياً ولا يمكن إرساله من العميل';
  END IF;
  IF _site_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hr_work_sites WHERE id=_site_id AND is_active) THEN RAISE EXCEPTION 'الموقع غير موجود أو غير نشط'; END IF;
  -- device_code is intentionally left empty: trg_hr_biometric_devices_sequential_code
  -- overwrites it from public.hr_biometric_device_code_seq.
  INSERT INTO public.hr_biometric_devices(device_code,name_ar,site_id,vendor,token_hash,token_last_four,token_rotated_at)
  VALUES('',btrim(_name_ar),_site_id,NULLIF(btrim(_vendor),''),extensions.crypt(v_token,extensions.gen_salt('bf',12)),right(v_token,4),clock_timestamp())
  RETURNING * INTO v_device;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END;
$$;

COMMENT ON FUNCTION public.hr_attendance_register_device(TEXT,TEXT,UUID,TEXT) IS
  'Gate 5/6: registers a biometric device and returns its one-time token. _device_code is an inert compatibility parameter -- the DEV-* identifier is generated server-side and a non-empty client value is rejected.';

-- ---------------------------------------------------------------------------
-- 5. Grants: no client role may reserve, burn or skip an official code by
--    calling nextval() directly, bypassing the creation RPCs.
--    Sequence owner privileges are untouched, so the SECURITY DEFINER trigger
--    in step 3 keeps working.
-- ---------------------------------------------------------------------------
REVOKE ALL ON SEQUENCE public.hr_work_site_code_seq,public.hr_shift_group_code_seq,public.hr_biometric_device_code_seq
  FROM PUBLIC,anon,authenticated,service_role;

-- Gate 5 revoked INSERT from authenticated only; close the anon path too so the
-- creation RPCs stay the single entry point for every client role.
REVOKE INSERT ON public.hr_work_sites,public.hr_shift_groups,public.hr_biometric_devices FROM PUBLIC,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage-layer format invariant (defence in depth behind the trigger).
--    NOT VALID follows the Gate 5 precedent: historical rows are never rejected
--    at deploy time, while every new or changed row must carry a canonical
--    server-generated identifier even if a trigger is later dropped.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_existing TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('hr_work_sites','hr_work_sites_code_format','code','^SITE-[0-9]{6,}$'),
      ('hr_shift_groups','hr_shift_groups_code_format','code','^SHIFT-[0-9]{6,}$'),
      ('hr_biometric_devices','hr_biometric_devices_code_format','device_code','^DEV-[0-9]{6,}$')
    ) AS t(table_name,constraint_name,column_name,pattern)
  LOOP
    SELECT pg_get_constraintdef(c.oid) INTO v_existing
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname=r.table_name AND c.conname=r.constraint_name;

    IF v_existing IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I ~ %L) NOT VALID',
                     r.table_name, r.constraint_name, r.column_name, r.pattern);
    ELSIF strpos(v_existing,r.pattern)=0 THEN
      -- Same name, different rule: a partial or divergent application. Do not
      -- silently continue over it.
      RAISE EXCEPTION USING ERRCODE='55000',
        MESSAGE=format('Gate 6: constraint %I on public.%I already exists with a conflicting definition: %s', r.constraint_name, r.table_name, v_existing);
    END IF;
  END LOOP;
END;
$$;
