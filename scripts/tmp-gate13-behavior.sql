\set ON_ERROR_STOP on

DO $$
DECLARE
  v_holding uuid;
  v_om uuid;
  v_re uuid;
  v_maintenance uuid;
  v_real_estate uuid;
BEGIN
  IF (SELECT count(*) FROM public.group_companies WHERE code IN ('HOLDING','CORE','OM','RE')) <> 4 THEN
    RAISE EXCEPTION 'Gate13 company seed mismatch';
  END IF;
  IF (SELECT count(*) FROM public.group_modules WHERE module_key IN ('corporate_erp','maintenance','real_estate')) <> 3 THEN
    RAISE EXCEPTION 'Gate13 module seed mismatch';
  END IF;
  SELECT id INTO v_holding FROM public.group_companies WHERE code='HOLDING';
  SELECT id INTO v_om FROM public.group_companies WHERE code='OM';
  SELECT id INTO v_re FROM public.group_companies WHERE code='RE';
  SELECT id INTO v_maintenance FROM public.group_modules WHERE module_key='maintenance';
  SELECT id INTO v_real_estate FROM public.group_modules WHERE module_key='real_estate';

  IF EXISTS (
    SELECT 1 FROM public.group_companies
    WHERE code IN ('CORE','OM','RE') AND parent_company_id IS DISTINCT FROM v_holding
  ) THEN
    RAISE EXCEPTION 'Gate13 subsidiary hierarchy mismatch';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_company_modules WHERE company_id=v_om AND module_id=v_maintenance AND is_active)
     OR NOT EXISTS (SELECT 1 FROM public.group_company_modules WHERE company_id=v_re AND module_id=v_real_estate AND is_active) THEN
    RAISE EXCEPTION 'Gate13 company-module assignment mismatch';
  END IF;
END $$;

DO $$
BEGIN
  IF has_table_privilege('anon','public.group_companies','SELECT')
     OR has_table_privilege('anon','public.group_user_module_access','SELECT') THEN
    RAISE EXCEPTION 'anon can read Gate13 tables';
  END IF;

  IF has_table_privilege('authenticated','public.group_companies','INSERT')
     OR has_table_privilege('authenticated','public.group_companies','UPDATE')
     OR has_table_privilege('authenticated','public.group_companies','DELETE')
     OR has_table_privilege('authenticated','public.group_user_module_access','INSERT')
     OR has_table_privilege('authenticated','public.group_user_module_access','UPDATE')
     OR has_table_privilege('authenticated','public.group_user_module_access','DELETE') THEN
    RAISE EXCEPTION 'authenticated can mutate Gate13 tables directly';
  END IF;

  IF NOT has_table_privilege('authenticated','public.group_companies','SELECT')
     OR NOT has_table_privilege('authenticated','public.group_modules','SELECT') THEN
    RAISE EXCEPTION 'authenticated lost required Gate13 read access';
  END IF;

  IF has_function_privilege('anon','public.group_has_module_access(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute Gate13 module access RPC';
  END IF;
  IF NOT has_function_privilege('authenticated','public.group_has_module_access(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute Gate13 module access RPC';
  END IF;
END $$;

SELECT set_config('app.test_admin','false',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

DO $$
BEGIN
  IF public.group_has_module_access('OM','maintenance') THEN
    RAISE EXCEPTION 'user without Gate13 grant received maintenance access';
  END IF;
  IF public.group_has_module_access('RE','real_estate') THEN
    RAISE EXCEPTION 'user without Gate13 grant received real-estate access';
  END IF;
END $$;

INSERT INTO public.group_user_module_access(user_id,company_id,module_id,access_role,created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  c.id,
  m.id,
  'member',
  '00000000-0000-0000-0000-000000000002'::uuid
FROM public.group_companies c
JOIN public.group_modules m ON m.module_key='maintenance'
WHERE c.code='OM';

DO $$
BEGIN
  IF NOT public.group_has_module_access('OM','maintenance') THEN
    RAISE EXCEPTION 'valid Gate13 maintenance grant was rejected';
  END IF;
  IF NOT public.group_has_module_access(' om ',' MAINTENANCE ') THEN
    RAISE EXCEPTION 'Gate13 access normalization failed';
  END IF;
  IF public.group_has_module_access('RE','maintenance') THEN
    RAISE EXCEPTION 'Gate13 company/module cross-scope access leaked';
  END IF;
  IF public.group_has_module_access('OM','real_estate') THEN
    RAISE EXCEPTION 'Gate13 module cross-scope access leaked';
  END IF;
END $$;

UPDATE public.group_user_module_access
SET valid_from=CURRENT_DATE-10,valid_to=CURRENT_DATE-1
WHERE user_id='00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
  IF public.group_has_module_access('OM','maintenance') THEN
    RAISE EXCEPTION 'expired Gate13 access remains active';
  END IF;
END $$;

UPDATE public.group_user_module_access
SET valid_from=CURRENT_DATE,valid_to=NULL,is_active=false
WHERE user_id='00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
  IF public.group_has_module_access('OM','maintenance') THEN
    RAISE EXCEPTION 'disabled Gate13 access remains active';
  END IF;
END $$;

SELECT set_config('app.test_admin','true',false);
DO $$
BEGIN
  IF NOT public.group_has_module_access('OM','maintenance')
     OR NOT public.group_has_module_access('RE','real_estate') THEN
    RAISE EXCEPTION 'Gate13 admin access failed';
  END IF;
END $$;

SELECT set_config('app.test_admin','false',false);
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
  IF public.group_has_module_access('OM','maintenance') THEN
    RAISE EXCEPTION 'anonymous/null user received Gate13 access';
  END IF;
END $$;

DO $$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='group_has_module_access'
    AND (
      NOT p.prosecdef
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig,'{}'::text[])) cfg
        WHERE cfg IN ('search_path=','search_path=""')
      )
    );
  IF v_bad<>0 THEN
    RAISE EXCEPTION 'Gate13 RPC has invalid SECURITY DEFINER/empty search_path posture';
  END IF;
END $$;

-- Exercise RLS as authenticated and prove direct mutation is blocked.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
SELECT count(*) AS visible_active_companies FROM public.group_companies;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.group_companies(code,slug,name_ar,name_en,company_type)
    VALUES('BAD','bad','غير مسموح','Forbidden','holding');
    RAISE EXCEPTION 'authenticated direct Gate13 insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT 'Gate 13 holding / multi-company behavior checks passed' AS result;
