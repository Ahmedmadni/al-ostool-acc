-- Gate 18: production hardening for the existing Zakat engine.
-- Closes RPC search_path/ACL, overlapping-period, concurrency, source drift,
-- direct mutation, mapping audit, approval/submission, reopen, and RLS gaps.

BEGIN;

DO $$
DECLARE
  v_overlap integer;
  v_duplicate_sources integer;
BEGIN
  IF to_regclass('public.zakat_returns') IS NULL
     OR to_regclass('public.zakat_return_sources') IS NULL
     OR to_regclass('public.zakat_return_adjustments') IS NULL
     OR to_regclass('public.zakat_account_mappings') IS NULL
     OR to_regclass('public.zakat_return_status_events') IS NULL
     OR to_regclass('public.trial_balance_entries') IS NULL
     OR to_regprocedure('public.zakat_calculate_return_mapped(date,date,jsonb,jsonb,jsonb,numeric,numeric)') IS NULL
     OR to_regprocedure('public.zakat_approve_return(uuid)') IS NULL
     OR to_regprocedure('public.zakat_submit_return(uuid,text)') IS NULL
     OR to_regprocedure('public.zakat_reopen_return(uuid,text)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 18 requires the complete mapped Zakat foundation';
  END IF;

  IF to_regprocedure('public.zakat_gate18_lock()') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 18 is already or partially applied; inspect schema history before retrying';
  END IF;

  SELECT count(*) INTO v_overlap
  FROM public.zakat_returns a
  JOIN public.zakat_returns b ON a.id < b.id
    AND a.year_from <= b.year_to
    AND b.year_from <= a.year_to;
  IF v_overlap > 0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE=format('Gate 18 found %s overlapping Zakat return periods; reconcile them before applying',v_overlap);
  END IF;

  SELECT count(*) INTO v_duplicate_sources
  FROM (
    SELECT return_id,trial_balance_entry_id
    FROM public.zakat_return_sources
    GROUP BY return_id,trial_balance_entry_id
    HAVING count(*)>1
  ) duplicates;
  IF v_duplicate_sources > 0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE=format('Gate 18 found %s duplicated trial-balance sources across Zakat targets; reconcile them before applying',v_duplicate_sources);
  END IF;
END;
$$;

ALTER TABLE public.zakat_returns
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_zakat_return_source_once
  ON public.zakat_return_sources(return_id,trial_balance_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_zakat_submission_reference
  ON public.zakat_returns(lower(submission_reference))
  WHERE submission_reference IS NOT NULL;

CREATE TABLE public.zakat_account_mapping_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id uuid,
  account_code text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert','update','delete')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_account_mapping_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zakat_account_mapping_events TO authenticated;
GRANT ALL ON public.zakat_account_mapping_events TO service_role;
CREATE POLICY zakat_mapping_events_read_gate18
  ON public.zakat_account_mapping_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE FUNCTION public.zakat_gate18_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('tax:zakat-ledger',0));
END;
$$;

CREATE FUNCTION public.zakat_gate18_assert_no_overlap(
  _year_from date,
  _year_to date,
  _exclude_return_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF _year_from IS NULL OR _year_to IS NULL OR _year_to<_year_from OR _year_to-_year_from>370 THEN
    RAISE EXCEPTION 'السنة المالية غير صالحة';
  END IF;
  PERFORM public.zakat_gate18_lock();
  IF EXISTS (
    SELECT 1
    FROM public.zakat_returns r
    WHERE (_exclude_return_id IS NULL OR r.id IS DISTINCT FROM _exclude_return_id)
      AND r.year_from<=_year_to
      AND r.year_to>=_year_from
  ) THEN
    RAISE EXCEPTION 'الفترة تتداخل مع إقرار زكوي موجود';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.zakat_source_fingerprint(_return_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT md5(COALESCE(string_agg(value,';' ORDER BY value),'empty'))
  FROM (
    SELECT concat_ws('|','source',s.trial_balance_entry_id,s.target_key,s.multiplier,s.source_snapshot::text) value
    FROM public.zakat_return_sources s
    WHERE s.return_id=_return_id
    UNION ALL
    SELECT concat_ws('|','manual',a.field_key,a.amount,a.reason)
    FROM public.zakat_return_adjustments a
    WHERE a.return_id=_return_id
  ) fingerprint_rows
$$;

CREATE FUNCTION public.zakat_gate18_assert_sources_current(_return_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_return public.zakat_returns;
  v_changed integer;
  v_stored text;
BEGIN
  PERFORM public.zakat_gate18_lock();
  SELECT * INTO v_return
  FROM public.zakat_returns r
  WHERE r.id=_return_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإقرار الزكوي غير موجود'; END IF;

  SELECT count(*) INTO v_changed
  FROM public.zakat_return_sources s
  LEFT JOIN public.trial_balance_entries t ON t.id=s.trial_balance_entry_id
  WHERE s.return_id=_return_id
    AND (
      t.id IS NULL
      OR t.period IS DISTINCT FROM s.source_snapshot->>'period'
      OR t.account_code IS DISTINCT FROM s.source_snapshot->>'account_code'
      OR t.account_name IS DISTINCT FROM s.source_snapshot->>'account_name'
      OR COALESCE(t.debit,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'debit')::numeric,0)
      OR COALESCE(t.credit,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'credit')::numeric,0)
      OR COALESCE(t.balance,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'balance')::numeric,0)
    );
  IF v_changed>0 THEN
    RAISE EXCEPTION 'تغير مصدر ميزان المراجعة بعد الاحتساب؛ أعد الاحتساب';
  END IF;

  v_stored:=public.zakat_source_fingerprint(_return_id);
  IF v_return.source_fingerprint IS NULL
     OR v_stored IS DISTINCT FROM v_return.source_fingerprint THEN
    RAISE EXCEPTION 'تغيرت تفاصيل أو تعديلات الإقرار بعد الاحتساب؛ أعد الاحتساب';
  END IF;
END;
$$;

CREATE FUNCTION public.zakat_gate18_return_period_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_exclude uuid;
BEGIN
  PERFORM public.zakat_gate18_lock();
  IF TG_OP='UPDATE' THEN
    v_exclude:=NEW.id;
  ELSE
    SELECT r.id INTO v_exclude
    FROM public.zakat_returns r
    WHERE r.year_from=NEW.year_from AND r.year_to=NEW.year_to
    FOR UPDATE;
  END IF;
  PERFORM public.zakat_gate18_assert_no_overlap(NEW.year_from,NEW.year_to,v_exclude);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.zakat_gate18_return_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF current_setting('app.zakat_return_write',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'direct Zakat return mutation is blocked';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.zakat_gate18_detail_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_return_id uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.return_id ELSE NEW.return_id END;
  v_status text;
BEGIN
  IF current_setting('app.zakat_detail_write',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'direct Zakat source or adjustment mutation is blocked';
  END IF;
  SELECT r.status INTO v_status
  FROM public.zakat_returns r
  WHERE r.id=v_return_id
  FOR UPDATE;
  IF v_status IS NULL OR v_status NOT IN ('draft','calculated') THEN
    RAISE EXCEPTION 'مصادر الإقرار المعتمد أو المقدم غير قابلة للتعديل';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION public.zakat_gate18_mapping_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF current_setting('app.zakat_mapping_write',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'direct Zakat account mapping mutation is blocked';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION public.zakat_gate18_log_mapping_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  INSERT INTO public.zakat_account_mapping_events(
    mapping_id,account_code,operation,before_data,after_data,changed_by
  ) VALUES(
    COALESCE(NEW.id,OLD.id),
    COALESCE(NEW.account_code,OLD.account_code),
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_zakat_gate18_period_guard ON public.zakat_returns;
CREATE TRIGGER trg_zakat_gate18_period_guard
BEFORE INSERT OR UPDATE OF year_from,year_to ON public.zakat_returns
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_return_period_guard();

DROP TRIGGER IF EXISTS trg_zakat_gate18_return_write ON public.zakat_returns;
CREATE TRIGGER trg_zakat_gate18_return_write
BEFORE INSERT OR UPDATE ON public.zakat_returns
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_return_write_guard();

DROP TRIGGER IF EXISTS trg_zakat_gate18_sources_write ON public.zakat_return_sources;
CREATE TRIGGER trg_zakat_gate18_sources_write
BEFORE INSERT OR UPDATE OR DELETE ON public.zakat_return_sources
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_detail_write_guard();

DROP TRIGGER IF EXISTS trg_zakat_gate18_adjustments_write ON public.zakat_return_adjustments;
CREATE TRIGGER trg_zakat_gate18_adjustments_write
BEFORE INSERT OR UPDATE OR DELETE ON public.zakat_return_adjustments
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_detail_write_guard();

DROP TRIGGER IF EXISTS trg_zakat_gate18_mappings_write ON public.zakat_account_mappings;
CREATE TRIGGER trg_zakat_gate18_mappings_write
BEFORE INSERT OR UPDATE OR DELETE ON public.zakat_account_mappings
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_mapping_write_guard();

DROP TRIGGER IF EXISTS trg_zakat_gate18_mapping_audit ON public.zakat_account_mappings;
CREATE TRIGGER trg_zakat_gate18_mapping_audit
AFTER INSERT OR UPDATE OR DELETE ON public.zakat_account_mappings
FOR EACH ROW EXECUTE FUNCTION public.zakat_gate18_log_mapping_change();

CREATE OR REPLACE FUNCTION public.zakat_calculate_return_mapped(
  _year_from date,_year_to date,_sources jsonb DEFAULT '[]'::jsonb,
  _manual_adjustments jsonb DEFAULT '[]'::jsonb,_form_data jsonb DEFAULT '{}'::jsonb,
  _zakat_rate numeric DEFAULT 0.025,_income_tax_rate numeric DEFAULT 0.20
) RETURNS public.zakat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_return public.zakat_returns;
  v_existing_id uuid;
  v_invalid integer;
  v_totals jsonb;
  v_manual jsonb;
  v_zakat_add numeric;
  v_zakat_deduct numeric;
  v_tax_base numeric;
  v_fingerprint text;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية احتساب الإقرار الزكوي';
  END IF;
  IF jsonb_typeof(COALESCE(_sources,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_sources,'[]'::jsonb))>500
     OR jsonb_typeof(COALESCE(_manual_adjustments,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_manual_adjustments,'[]'::jsonb))>100
     OR jsonb_typeof(COALESCE(_form_data,'{}'::jsonb))<>'object' THEN
    RAISE EXCEPTION 'مصادر أو تعديلات أو بيانات الإقرار غير صالحة';
  END IF;
  IF _zakat_rate<0 OR _zakat_rate>1 OR _income_tax_rate<0 OR _income_tax_rate>1
     OR _zakat_rate::text='NaN' OR _income_tax_rate::text='NaN' THEN
    RAISE EXCEPTION 'نسبة الزكاة أو الضريبة غير صالحة';
  END IF;

  PERFORM public.zakat_gate18_lock();
  SELECT r.id INTO v_existing_id
  FROM public.zakat_returns r
  WHERE r.year_from=_year_from AND r.year_to=_year_to
  FOR UPDATE;
  PERFORM public.zakat_gate18_assert_no_overlap(_year_from,_year_to,v_existing_id);

  SELECT count(*) INTO v_invalid
  FROM jsonb_to_recordset(COALESCE(_sources,'[]'::jsonb))
    AS s(entry_id uuid,target_key text,multiplier numeric)
  LEFT JOIN public.trial_balance_entries t ON t.id=s.entry_id
  WHERE t.id IS NULL
     OR s.target_key NOT IN ('revenue','expense','z_capital','z_retained','z_provisions','z_reserves','z_loans','z_fixed_assets','z_investments','z_losses_carried','tax_base')
     OR COALESCE(s.multiplier,1) NOT IN (-1,1);
  IF v_invalid>0 THEN RAISE EXCEPTION 'حساب مختار بلا تصنيف زكوي صالح'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(_sources,'[]'::jsonb))
      AS s(entry_id uuid,target_key text,multiplier numeric)
    GROUP BY s.entry_id
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'لا يمكن استخدام حساب ميزان المراجعة أكثر من مرة في الإقرار'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
      AS a(field_key text,amount numeric,reason text)
    WHERE a.field_key NOT IN ('zakat_add','zakat_deduct','tax_base')
       OR a.amount IS NULL OR a.amount::text='NaN' OR abs(a.amount)>999999999999.99
       OR char_length(btrim(COALESCE(a.reason,'')))<5
       OR char_length(btrim(COALESCE(a.reason,'')))>1000
  ) THEN RAISE EXCEPTION 'كل تعديل يدوي يحتاج بنداً ومبلغاً وسبباً صالحاً'; END IF;

  PERFORM set_config('app.zakat_return_write','on',true);
  PERFORM set_config('app.zakat_detail_write','on',true);
  PERFORM set_config('app.zakat_transition_reason','احتساب أو إعادة احتساب الإقرار',true);

  INSERT INTO public.zakat_returns(
    year_from,year_to,data,status,created_by,updated_by,calculated_by,calculated_at,
    approved_by,approved_at,submitted_by,submitted_at,submission_reference
  ) VALUES(
    _year_from,_year_to,'{}'::jsonb,'calculated',auth.uid(),auth.uid(),auth.uid(),now(),
    NULL,NULL,NULL,NULL,NULL
  )
  ON CONFLICT(year_from,year_to) DO UPDATE SET
    data='{}'::jsonb,status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now(),
    approved_by=NULL,approved_at=NULL,submitted_by=NULL,submitted_at=NULL,submission_reference=NULL
  WHERE zakat_returns.status IN ('draft','calculated')
  RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;

  DELETE FROM public.zakat_return_sources s WHERE s.return_id=v_return.id;
  DELETE FROM public.zakat_return_adjustments a WHERE a.return_id=v_return.id;

  INSERT INTO public.zakat_return_sources(
    return_id,trial_balance_entry_id,target_key,multiplier,source_snapshot
  )
  SELECT v_return.id,t.id,s.target_key,COALESCE(s.multiplier,1),
    jsonb_build_object(
      'period',t.period,'account_code',t.account_code,'account_name',t.account_name,
      'debit',COALESCE(t.debit,0),'credit',COALESCE(t.credit,0),'balance',COALESCE(t.balance,0)
    )
  FROM jsonb_to_recordset(COALESCE(_sources,'[]'::jsonb))
    AS s(entry_id uuid,target_key text,multiplier numeric)
  JOIN public.trial_balance_entries t ON t.id=s.entry_id
  ORDER BY t.id;

  INSERT INTO public.zakat_return_adjustments(return_id,field_key,amount,reason,created_by)
  SELECT v_return.id,a.field_key,a.amount,btrim(a.reason),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
    AS a(field_key text,amount numeric,reason text);

  SELECT COALESCE(jsonb_object_agg(x.target_key,x.total),'{}'::jsonb) INTO v_totals
  FROM (
    SELECT s.target_key,round(sum(COALESCE((s.source_snapshot->>'balance')::numeric,0)*s.multiplier),2) total
    FROM public.zakat_return_sources s
    WHERE s.return_id=v_return.id
    GROUP BY s.target_key
  ) x;
  SELECT COALESCE(jsonb_object_agg(x.field_key,x.total),'{}'::jsonb) INTO v_manual
  FROM (
    SELECT a.field_key,round(sum(a.amount),2) total
    FROM public.zakat_return_adjustments a
    WHERE a.return_id=v_return.id
    GROUP BY a.field_key
  ) x;

  v_zakat_add:=COALESCE((v_totals->>'z_capital')::numeric,0)
    +COALESCE((v_totals->>'z_retained')::numeric,0)
    +COALESCE((v_totals->>'z_provisions')::numeric,0)
    +COALESCE((v_totals->>'z_reserves')::numeric,0)
    +COALESCE((v_totals->>'z_loans')::numeric,0)
    +COALESCE((v_manual->>'zakat_add')::numeric,0);
  v_zakat_deduct:=COALESCE((v_totals->>'z_fixed_assets')::numeric,0)
    +COALESCE((v_totals->>'z_investments')::numeric,0)
    +COALESCE((v_totals->>'z_losses_carried')::numeric,0)
    +COALESCE((v_manual->>'zakat_deduct')::numeric,0);
  v_tax_base:=GREATEST(
    COALESCE((v_totals->>'tax_base')::numeric,0)+COALESCE((v_manual->>'tax_base')::numeric,0),0
  );
  v_fingerprint:=public.zakat_source_fingerprint(v_return.id);

  UPDATE public.zakat_returns r SET
    data=_form_data||jsonb_build_object(
      'source','mapped-trial-balance','calculation_version','zakat-v3-gate18',
      'ledger_totals',v_totals,'manual_totals',v_manual,
      'zakat_base',GREATEST(v_zakat_add-v_zakat_deduct,0),'tax_base',v_tax_base,
      'zakat_rate',_zakat_rate,'income_tax_rate',_income_tax_rate,
      'source_selection',jsonb_build_object(
        'source_count',(SELECT count(*) FROM public.zakat_return_sources s WHERE s.return_id=v_return.id),
        'adjustment_count',(SELECT count(*) FROM public.zakat_return_adjustments a WHERE a.return_id=v_return.id)
      )
    ),
    zakat_due=round(GREATEST(v_zakat_add-v_zakat_deduct,0)*_zakat_rate,2),
    tax_due=round(v_tax_base*_income_tax_rate,2),
    source_fingerprint=v_fingerprint
  WHERE r.id=v_return.id
  RETURNING r.* INTO v_return;
  PERFORM set_config('app.zakat_detail_write','off',true);
  PERFORM set_config('app.zakat_return_write','off',true);
  RETURN v_return;
END;
$;

CREATE OR REPLACE FUNCTION public.zakat_save_account_mappings(_mappings jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تعديل قوالب الربط';
  END IF;
  IF jsonb_typeof(COALESCE(_mappings,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_mappings,'[]'::jsonb))>500 THEN
    RAISE EXCEPTION 'قالب الربط غير صالح';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(_mappings,'[]'::jsonb))
      AS m(account_code text,target_key text,multiplier numeric)
    WHERE btrim(COALESCE(m.account_code,''))=''
       OR char_length(btrim(m.account_code))>80
       OR m.target_key NOT IN ('revenue','expense','z_capital','z_retained','z_provisions','z_reserves','z_loans','z_fixed_assets','z_investments','z_losses_carried','tax_base')
       OR COALESCE(m.multiplier,1) NOT IN (-1,1)
  ) THEN RAISE EXCEPTION 'قالب الربط يحتوي على قيمة غير صالحة'; END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(_mappings,'[]'::jsonb))
      AS m(account_code text,target_key text,multiplier numeric)
    GROUP BY btrim(m.account_code)
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'قالب الربط يحتوي على رقم حساب مكرر'; END IF;

  PERFORM public.zakat_gate18_lock();
  PERFORM set_config('app.zakat_mapping_write','on',true);
  INSERT INTO public.zakat_account_mappings(
    account_code,target_key,multiplier,is_active,created_by,updated_by
  )
  SELECT btrim(m.account_code),m.target_key,COALESCE(m.multiplier,1),true,auth.uid(),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_mappings,'[]'::jsonb))
    AS m(account_code text,target_key text,multiplier numeric)
  ON CONFLICT(account_code) DO UPDATE SET
    target_key=EXCLUDED.target_key,multiplier=EXCLUDED.multiplier,is_active=true,
    updated_by=auth.uid(),updated_at=now();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  PERFORM set_config('app.zakat_mapping_write','off',true);
  RETURN v_count;
END;
$;

CREATE OR REPLACE FUNCTION public.zakat_approve_return(_return_id uuid)
RETURNS public.zakat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_return public.zakat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الإقرار الزكوي';
  END IF;
  PERFORM public.zakat_gate18_lock();
  SELECT * INTO v_return FROM public.zakat_returns r WHERE r.id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'calculated' THEN RAISE EXCEPTION 'الإقرار غير جاهز للاعتماد'; END IF;
  PERFORM public.zakat_gate18_assert_no_overlap(v_return.year_from,v_return.year_to,v_return.id);
  PERFORM public.zakat_gate18_assert_sources_current(_return_id);
  IF v_return.calculated_at IS NULL OR v_return.source_fingerprint IS NULL
     OR v_return.zakat_due IS NULL OR v_return.tax_due IS NULL
     OR v_return.zakat_due<0 OR v_return.tax_due<0 THEN
    RAISE EXCEPTION 'بيانات الإقرار المحتسب غير مكتملة للاعتماد';
  END IF;

  PERFORM set_config('app.zakat_return_write','on',true);
  PERFORM set_config('app.zakat_transition_reason','اعتماد الإقرار الزكوي',true);
  UPDATE public.zakat_returns r SET
    status='approved',approved_by=auth.uid(),approved_at=now(),
    submitted_by=NULL,submitted_at=NULL,submission_reference=NULL,updated_by=auth.uid()
  WHERE r.id=_return_id
  RETURNING r.* INTO v_return;
  PERFORM set_config('app.zakat_return_write','off',true);
  RETURN v_return;
END;
$;

CREATE OR REPLACE FUNCTION public.zakat_submit_return(_return_id uuid,_reference text)
RETURNS public.zakat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_return public.zakat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تسجيل تقديم الإقرار';
  END IF;
  IF char_length(btrim(COALESCE(_reference,'')))<3
     OR char_length(btrim(COALESCE(_reference,'')))>120 THEN
    RAISE EXCEPTION 'أدخل مرجع تقديم صالح';
  END IF;
  PERFORM public.zakat_gate18_lock();
  SELECT * INTO v_return FROM public.zakat_returns r WHERE r.id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'approved' THEN
    RAISE EXCEPTION 'يجب اعتماد الإقرار قبل تسجيل تقديمه';
  END IF;
  IF v_return.approved_by IS NULL OR v_return.approved_at IS NULL THEN
    RAISE EXCEPTION 'بيانات اعتماد الإقرار غير مكتملة';
  END IF;
  PERFORM public.zakat_gate18_assert_no_overlap(v_return.year_from,v_return.year_to,v_return.id);
  PERFORM public.zakat_gate18_assert_sources_current(_return_id);
  IF EXISTS (
    SELECT 1 FROM public.zakat_returns r
    WHERE r.id<>_return_id
      AND lower(r.submission_reference)=lower(btrim(_reference))
  ) THEN RAISE EXCEPTION 'مرجع التقديم مستخدم لإقرار آخر'; END IF;

  PERFORM set_config('app.zakat_return_write','on',true);
  PERFORM set_config('app.zakat_transition_reason','تسجيل تقديم الإقرار',true);
  UPDATE public.zakat_returns r SET
    status='submitted',submitted_by=auth.uid(),submitted_at=now(),
    submission_reference=btrim(_reference),updated_by=auth.uid()
  WHERE r.id=_return_id
  RETURNING r.* INTO v_return;
  PERFORM set_config('app.zakat_return_write','off',true);
  RETURN v_return;
END;
$;

CREATE OR REPLACE FUNCTION public.zakat_reopen_return(_return_id uuid,_reason text)
RETURNS public.zakat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_return public.zakat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إعادة فتح الإقرار';
  END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10
     OR char_length(btrim(COALESCE(_reason,'')))>1000 THEN
    RAISE EXCEPTION 'اكتب سبب إعادة فتح واضحاً من 10 إلى 1000 حرف';
  END IF;
  PERFORM public.zakat_gate18_lock();
  SELECT * INTO v_return FROM public.zakat_returns r WHERE r.id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status NOT IN ('approved','submitted') THEN
    RAISE EXCEPTION 'يمكن إعادة فتح الإقرار المعتمد أو المقدم فقط';
  END IF;

  PERFORM set_config('app.zakat_return_write','on',true);
  PERFORM set_config('app.zakat_transition_reason',btrim(_reason),true);
  UPDATE public.zakat_returns r SET
    status='calculated',approved_by=NULL,approved_at=NULL,
    submitted_by=NULL,submitted_at=NULL,submission_reference=NULL,updated_by=auth.uid()
  WHERE r.id=_return_id
  RETURNING r.* INTO v_return;
  PERFORM set_config('app.zakat_return_write','off',true);
  RETURN v_return;
END;
$;

CREATE OR REPLACE FUNCTION public.zakat_log_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.zakat_return_status_events(return_id,from_status,to_status,reason,changed_by)
    VALUES(
      NEW.id,OLD.status,NEW.status,
      NULLIF(current_setting('app.zakat_transition_reason',true),''),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tax_return_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF OLD.status IN ('approved','filed','submitted') AND COALESCE(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'لا يمكن حذف إقرار معتمد أو مقدم؛ استخدم إعادة الفتح الرقابية أولاً';
  END IF;
  IF NOT (
    public.has_permission(auth.uid(),'tax','delete')
    OR public.is_admin(auth.uid())
    OR COALESCE(auth.role(),'')='service_role'
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية حذف الإقرار';
  END IF;
  RETURN OLD;
END;
$$;

DROP POLICY IF EXISTS zakat_returns_read ON public.zakat_returns;
DROP POLICY IF EXISTS zakat_returns_insert ON public.zakat_returns;
DROP POLICY IF EXISTS zakat_returns_update ON public.zakat_returns;
DROP POLICY IF EXISTS zakat_returns_read_gate18 ON public.zakat_returns;
CREATE POLICY zakat_returns_read_gate18
  ON public.zakat_returns FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS zakat_return_sources_read ON public.zakat_return_sources;
DROP POLICY IF EXISTS zakat_return_sources_read_gate18 ON public.zakat_return_sources;
CREATE POLICY zakat_return_sources_read_gate18
  ON public.zakat_return_sources FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS zakat_return_adjustments_read ON public.zakat_return_adjustments;
DROP POLICY IF EXISTS zakat_return_adjustments_read_gate18 ON public.zakat_return_adjustments;
CREATE POLICY zakat_return_adjustments_read_gate18
  ON public.zakat_return_adjustments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS zakat_account_mappings_read ON public.zakat_account_mappings;
DROP POLICY IF EXISTS zakat_account_mappings_read_gate18 ON public.zakat_account_mappings;
CREATE POLICY zakat_account_mappings_read_gate18
  ON public.zakat_account_mappings FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS zakat_status_events_read ON public.zakat_return_status_events;
DROP POLICY IF EXISTS zakat_status_events_read_gate18 ON public.zakat_return_status_events;
CREATE POLICY zakat_status_events_read_gate18
  ON public.zakat_return_status_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

GRANT SELECT ON public.zakat_returns,public.zakat_return_sources,
  public.zakat_return_adjustments,public.zakat_account_mappings,
  public.zakat_return_status_events,public.zakat_account_mapping_events
TO authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
  ON public.zakat_returns,public.zakat_return_sources,
     public.zakat_return_adjustments,public.zakat_account_mappings,
     public.zakat_return_status_events,public.zakat_account_mapping_events
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.zakat_calculate_return_flexible(date,date,jsonb,jsonb,numeric,numeric)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_lock() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_assert_no_overlap(date,date,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_assert_sources_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_return_period_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_return_write_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_detail_write_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_mapping_write_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_gate18_log_mapping_change() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_log_status_transition() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tax_return_delete_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.zakat_source_fingerprint(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zakat_source_fingerprint(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.zakat_calculate_return_mapped(date,date,jsonb,jsonb,jsonb,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zakat_save_account_mappings(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zakat_approve_return(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zakat_submit_return(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.zakat_reopen_return(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zakat_calculate_return_mapped(date,date,jsonb,jsonb,jsonb,numeric,numeric) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.zakat_save_account_mappings(jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.zakat_approve_return(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.zakat_submit_return(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.zakat_reopen_return(uuid,text) TO authenticated,service_role;

COMMIT;
