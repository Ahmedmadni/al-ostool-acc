-- Gate 11: Cost Accounting Engine hardening.
-- Preserves existing cost foundations while closing concurrency, audit, idempotency,
-- and SECURITY DEFINER/search_path gaps across manual costs, imports, budgets,
-- reversals, and period close/reopen.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.cost_entries') IS NULL
     OR to_regclass('public.cost_periods') IS NULL
     OR to_regclass('public.cost_entry_status_events') IS NULL
     OR to_regclass('public.cost_period_status_events') IS NULL
     OR to_regclass('public.cost_import_batches') IS NULL
     OR to_regclass('public.cost_import_lines') IS NULL
     OR to_regclass('public.hr_costs') IS NULL
     OR to_regclass('public.equipment_costs') IS NULL
     OR to_regclass('public.cost_budgets') IS NULL
     OR to_regclass('public.cost_budget_events') IS NULL
     OR to_regprocedure('public.cost_entry_create_manual(text,numeric,text,text,uuid,uuid)') IS NULL
     OR to_regprocedure('public.cost_entry_approve(uuid)') IS NULL
     OR to_regprocedure('public.cost_entry_reverse(uuid,text)') IS NULL
     OR to_regprocedure('public.cost_import_post(text,text,jsonb)') IS NULL
     OR to_regprocedure('public.cost_aux_import_post(text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.cost_period_set_status(text,boolean,text)') IS NULL
     OR to_regprocedure('public.cost_budget_save(text,text,numeric,uuid,uuid,text,text)') IS NULL
     OR to_regprocedure('public.cost_budget_approve(uuid)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 11 requires the complete cost-accounting foundation through Gate 10';
  END IF;

  IF to_regprocedure('public.cost_gate11_period_lock(text)') IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name='cost_import_batches'
         AND column_name='request_fingerprint'
     ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 11 is already or partially applied; inspect schema history before retrying';
  END IF;
END;
$$;

ALTER TABLE public.cost_import_batches
  ADD COLUMN request_fingerprint TEXT;

CREATE FUNCTION public.cost_gate11_period_lock(_period TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path=''
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(_period,'')),'') IS NULL THEN
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cost-period:'||_period,0));
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_entry_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_old_period TEXT;
  v_new_period TEXT;
  v_bypass BOOLEAN:=COALESCE(current_setting('app.cost_workflow_bypass',true),'')='on';
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    v_old_period:=NULLIF(LEFT(COALESCE(OLD.period,''),7),'');
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_new_period:=NULLIF(LEFT(COALESCE(NEW.period,''),7),'');
  END IF;

  IF v_old_period IS NOT NULL AND v_new_period IS NOT NULL AND v_old_period IS DISTINCT FROM v_new_period THEN
    IF v_old_period < v_new_period THEN
      PERFORM public.cost_gate11_period_lock(v_old_period);
      PERFORM public.cost_gate11_period_lock(v_new_period);
    ELSE
      PERFORM public.cost_gate11_period_lock(v_new_period);
      PERFORM public.cost_gate11_period_lock(v_old_period);
    END IF;
  ELSE
    PERFORM public.cost_gate11_period_lock(COALESCE(v_old_period,v_new_period));
  END IF;

  IF v_old_period IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.cost_periods WHERE period=v_old_period AND status='closed'
  ) THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;
  IF v_new_period IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.cost_periods WHERE period=v_new_period AND status='closed'
  ) THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  IF TG_OP='DELETE' THEN
    IF NOT v_bypass AND OLD.workflow_status<>'draft' THEN
      RAISE EXCEPTION 'لا يمكن حذف قيد تكلفة غير مسودة؛ استخدم القيد العكسي';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP='UPDATE' AND NOT v_bypass AND OLD.workflow_status IN ('posted','reversed') THEN
    RAISE EXCEPTION 'لا يمكن تعديل قيد مرحل أو معكوس';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_entry_create_manual(
  _category TEXT,
  _amount NUMERIC,
  _period TEXT,
  _description TEXT DEFAULT NULL,
  _project_id UUID DEFAULT NULL,
  _department_id UUID DEFAULT NULL
) RETURNS public.cost_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_entry public.cost_entries;
  v_project TEXT;
  v_department TEXT;
  v_period TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إنشاء تكلفة';
  END IF;
  IF btrim(COALESCE(_category,''))=''
     OR COALESCE(_amount,0)=0
     OR COALESCE(_period,'')!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN
    RAISE EXCEPTION 'بيانات قيد التكلفة غير صالحة';
  END IF;

  v_period:=LEFT(_period,7);
  PERFORM public.cost_gate11_period_lock(v_period);
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed') THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  IF _project_id IS NOT NULL THEN
    SELECT name INTO v_project FROM public.projects WHERE id=_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'المشروع المحدد غير موجود'; END IF;
  END IF;
  IF _department_id IS NOT NULL THEN
    SELECT name_ar INTO v_department
    FROM public.departments
    WHERE id=_department_id AND COALESCE(is_active,true);
    IF NOT FOUND THEN RAISE EXCEPTION 'الإدارة المحددة غير موجودة أو غير نشطة'; END IF;
  END IF;

  INSERT INTO public.cost_entries(
    category,amount,period,description,project,project_id,department,department_id,
    imported_by,workflow_status,source_type,meta
  ) VALUES (
    btrim(_category),_amount,_period,NULLIF(btrim(_description),''),v_project,_project_id,
    v_department,_department_id,auth.uid(),'draft','manual',
    jsonb_build_object('created_via','cost_entry_create_manual')
  ) RETURNING * INTO v_entry;

  INSERT INTO public.cost_entry_status_events(cost_entry_id,to_status,reason,changed_by)
  VALUES(v_entry.id,'draft','إنشاء يدوي',auth.uid());
  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_entry_approve(_entry_id UUID)
RETURNS public.cost_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_entry public.cost_entries;
  v_period TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد التكلفة';
  END IF;

  SELECT NULLIF(LEFT(COALESCE(period,''),7),'') INTO v_period
  FROM public.cost_entries WHERE id=_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'قيد التكلفة غير موجود'; END IF;

  PERFORM public.cost_gate11_period_lock(v_period);
  SELECT * INTO v_entry FROM public.cost_entries WHERE id=_entry_id FOR UPDATE;
  IF NOT FOUND OR v_entry.workflow_status<>'draft' THEN
    RAISE EXCEPTION 'قيد التكلفة غير جاهز للاعتماد';
  END IF;
  IF NULLIF(LEFT(COALESCE(v_entry.period,''),7),'') IS DISTINCT FROM v_period THEN
    RAISE EXCEPTION 'تغيرت فترة قيد التكلفة بالتزامن؛ أعد المحاولة';
  END IF;
  IF v_period IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed'
  ) THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  PERFORM set_config('app.cost_workflow_bypass','on',true);
  UPDATE public.cost_entries
  SET workflow_status='posted',approved_by=auth.uid(),approved_at=now()
  WHERE id=_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.cost_entry_status_events(cost_entry_id,from_status,to_status,reason,changed_by)
  VALUES(_entry_id,'draft','posted','اعتماد وترحيل',auth.uid());
  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_entry_reverse(_entry_id UUID,_reason TEXT)
RETURNS public.cost_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_original public.cost_entries;
  v_reversal public.cost_entries;
  v_period TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية عكس التكلفة';
  END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10 THEN
    RAISE EXCEPTION 'سبب العكس يجب ألا يقل عن 10 أحرف';
  END IF;

  SELECT NULLIF(LEFT(COALESCE(period,''),7),'') INTO v_period
  FROM public.cost_entries WHERE id=_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'قيد التكلفة غير موجود'; END IF;

  PERFORM public.cost_gate11_period_lock(v_period);
  SELECT * INTO v_original FROM public.cost_entries WHERE id=_entry_id FOR UPDATE;
  IF NOT FOUND OR v_original.workflow_status<>'posted' OR v_original.reversal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'القيد غير قابل للعكس';
  END IF;
  IF NULLIF(LEFT(COALESCE(v_original.period,''),7),'') IS DISTINCT FROM v_period THEN
    RAISE EXCEPTION 'تغيرت فترة قيد التكلفة بالتزامن؛ أعد المحاولة';
  END IF;
  IF v_period IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed'
  ) THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  PERFORM set_config('app.cost_workflow_bypass','on',true);
  INSERT INTO public.cost_entries(
    category,amount,period,description,project,project_id,company,department,department_id,
    section,imported_by,workflow_status,source_type,meta
  ) VALUES (
    v_original.category,-v_original.amount,v_original.period,
    'عكس: '||COALESCE(v_original.description,v_original.category),
    v_original.project,v_original.project_id,v_original.company,v_original.department,
    v_original.department_id,v_original.section,auth.uid(),'posted','reversal',
    jsonb_build_object('reverses_entry_id',v_original.id,'reason',btrim(_reason))
  ) RETURNING * INTO v_reversal;

  UPDATE public.cost_entries
  SET workflow_status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_entry_id=v_reversal.id
  WHERE id=_entry_id;

  INSERT INTO public.cost_entry_status_events(cost_entry_id,from_status,to_status,reason,changed_by)
  VALUES(_entry_id,'posted','reversed',btrim(_reason),auth.uid());
  RETURN v_reversal;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_period_set_status(_period TEXT,_closed BOOLEAN,_reason TEXT)
RETURNS public.cost_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_period public.cost_periods;
  v_from TEXT;
  v_target TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إدارة فترات التكاليف';
  END IF;
  IF COALESCE(_period,'')!~'^[0-9]{4}-[0-9]{2}$'
     OR char_length(btrim(COALESCE(_reason,'')))<10 THEN
    RAISE EXCEPTION 'الفترة أو السبب غير صالح';
  END IF;

  v_target:=CASE WHEN _closed THEN 'closed' ELSE 'open' END;
  PERFORM public.cost_gate11_period_lock(_period);
  SELECT status INTO v_from FROM public.cost_periods WHERE period=_period FOR UPDATE;
  IF v_from IS NOT DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'الفترة في الحالة المطلوبة بالفعل';
  END IF;

  IF _closed AND EXISTS(
    SELECT 1
    FROM public.cost_entries
    WHERE LEFT(COALESCE(period,''),7)=_period
      AND workflow_status NOT IN ('posted','reversed')
  ) THEN
    RAISE EXCEPTION 'لا يمكن إقفال فترة تحتوي قيود تكلفة غير مرحّلة';
  END IF;

  INSERT INTO public.cost_periods(period,status,reason,closed_by,closed_at,reopened_by,reopened_at)
  VALUES(
    _period,v_target,btrim(_reason),
    CASE WHEN _closed THEN auth.uid() END,
    CASE WHEN _closed THEN now() END,
    CASE WHEN NOT _closed THEN auth.uid() END,
    CASE WHEN NOT _closed THEN now() END
  )
  ON CONFLICT(period) DO UPDATE SET
    status=EXCLUDED.status,
    reason=EXCLUDED.reason,
    closed_by=EXCLUDED.closed_by,
    closed_at=EXCLUDED.closed_at,
    reopened_by=EXCLUDED.reopened_by,
    reopened_at=EXCLUDED.reopened_at
  RETURNING * INTO v_period;

  INSERT INTO public.cost_period_status_events(period,from_status,to_status,reason,changed_by)
  VALUES(_period,v_from,v_period.status,btrim(_reason),auth.uid());

  RETURN v_period;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_import_post(_import_key TEXT,_file_name TEXT,_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_batch public.cost_import_batches;
  v_count INTEGER;
  v_accepted INTEGER;
  v_rejected INTEGER;
  v_total NUMERIC;
  v_key TEXT;
  v_fingerprint TEXT;
  v_lock_period TEXT;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(),'costs','create')
    OR public.has_permission(auth.uid(),'costs','edit')
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية استيراد التكاليف';
  END IF;
  IF char_length(btrim(COALESCE(_import_key,'')))<16 THEN
    RAISE EXCEPTION 'مفتاح الاستيراد غير صالح';
  END IF;
  IF jsonb_typeof(COALESCE(_rows,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_rows,'[]'::jsonb))=0
     OR jsonb_array_length(_rows)>5000 THEN
    RAISE EXCEPTION 'يجب أن تحتوي الدفعة على 1 إلى 5000 صف';
  END IF;

  v_key:=btrim(_import_key);
  v_fingerprint:=md5('general|'||COALESCE(NULLIF(btrim(_file_name),''),'')||'|'||_rows::TEXT);
  PERFORM pg_advisory_xact_lock(hashtextextended('cost-import:general:'||v_key,0));

  SELECT * INTO v_batch
  FROM public.cost_import_batches
  WHERE import_key=v_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_batch.source_type IS DISTINCT FROM 'general' THEN
      RAISE EXCEPTION 'مفتاح الاستيراد مستخدم لمصدر تكلفة مختلف';
    END IF;
    IF v_batch.request_fingerprint IS NOT NULL
       AND v_batch.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'مفتاح الاستيراد مستخدم مسبقاً بمحتوى مختلف';
    END IF;
    RETURN jsonb_build_object(
      'batch_id',v_batch.id,'status',v_batch.status,'row_count',v_batch.row_count,
      'accepted_count',v_batch.accepted_count,'rejected_count',v_batch.rejected_count,
      'total_amount',v_batch.total_amount,'duplicate',true
    );
  END IF;

  FOR v_lock_period IN
    SELECT DISTINCT LEFT(row_data->>'period',7)
    FROM jsonb_array_elements(_rows) source(row_data)
    WHERE btrim(COALESCE(row_data->>'category',''))<>''
      AND CASE
        WHEN COALESCE(row_data->>'amount','')~'^[-+]?[0-9]+([.][0-9]+)?$'
          THEN (row_data->>'amount')::NUMERIC<>0
        ELSE FALSE
      END
      AND NULLIF(row_data->>'period','') IS NOT NULL
      AND row_data->>'period'~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'
    ORDER BY 1
  LOOP
    PERFORM public.cost_gate11_period_lock(v_lock_period);
    IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_lock_period AND status='closed') THEN
      RAISE EXCEPTION 'فترة التكلفة مقفلة: %',v_lock_period;
    END IF;
  END LOOP;

  INSERT INTO public.cost_import_batches(import_key,file_name,source_type,request_fingerprint,created_by)
  VALUES(v_key,NULLIF(btrim(_file_name),''),'general',v_fingerprint,auth.uid())
  RETURNING * INTO v_batch;

  INSERT INTO public.cost_import_lines(batch_id,row_number,raw_data,validation_errors)
  SELECT v_batch.id,ordinality,row_data,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN btrim(COALESCE(row_data->>'category',''))='' THEN 'الفئة مطلوبة' END,
      CASE
        WHEN COALESCE(row_data->>'amount','')!~'^[-+]?[0-9]+([.][0-9]+)?$' THEN 'المبلغ يجب أن يكون رقماً صالحاً'
        WHEN (row_data->>'amount')::NUMERIC=0 THEN 'المبلغ يجب ألا يساوي صفراً'
      END,
      CASE
        WHEN NULLIF(row_data->>'period','') IS NOT NULL
         AND row_data->>'period'!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'
        THEN 'صيغة الفترة غير صالحة'
      END
    ],NULL))
  FROM jsonb_array_elements(_rows) WITH ORDINALITY source(row_data,ordinality);

  INSERT INTO public.cost_entries(
    category,description,project,company,department,section,period,amount,imported_by,
    workflow_status,source_type,meta
  )
  SELECT btrim(l.raw_data->>'category'),NULLIF(btrim(l.raw_data->>'description'),''),
    NULLIF(btrim(l.raw_data->>'project'),''),NULLIF(btrim(l.raw_data->>'company'),''),
    NULLIF(btrim(l.raw_data->>'department'),''),NULLIF(btrim(l.raw_data->>'section'),''),
    NULLIF(btrim(l.raw_data->>'period'),''),(l.raw_data->>'amount')::NUMERIC,auth.uid(),
    'posted','manual_import',
    jsonb_build_object(
      'source_type','manual_import','batch_id',v_batch.id,'row_number',l.row_number,
      'import_line_key',v_batch.id::TEXT||':'||l.row_number
    )
  FROM public.cost_import_lines l
  WHERE l.batch_id=v_batch.id AND jsonb_array_length(l.validation_errors)=0;

  UPDATE public.cost_import_lines l
  SET cost_entry_id=c.id
  FROM public.cost_entries c
  WHERE l.batch_id=v_batch.id
    AND c.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;

  SELECT COUNT(*),
    COUNT(*) FILTER(WHERE cost_entry_id IS NOT NULL),
    COUNT(*) FILTER(WHERE cost_entry_id IS NULL),
    COALESCE(SUM((raw_data->>'amount')::NUMERIC) FILTER(WHERE cost_entry_id IS NOT NULL),0)
  INTO v_count,v_accepted,v_rejected,v_total
  FROM public.cost_import_lines
  WHERE batch_id=v_batch.id;

  UPDATE public.cost_import_batches
  SET row_count=v_count,accepted_count=v_accepted,rejected_count=v_rejected,total_amount=v_total,
      status=CASE WHEN v_accepted=0 THEN 'rejected' ELSE 'posted' END
  WHERE id=v_batch.id
  RETURNING * INTO v_batch;

  RETURN jsonb_build_object(
    'batch_id',v_batch.id,'status',v_batch.status,'row_count',v_count,
    'accepted_count',v_accepted,'rejected_count',v_rejected,'total_amount',v_total,'duplicate',false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_aux_import_post(
  _source_type TEXT,
  _import_key TEXT,
  _file_name TEXT,
  _rows JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_batch public.cost_import_batches;
  v_count INTEGER;
  v_accepted INTEGER;
  v_rejected INTEGER;
  v_total NUMERIC;
  v_key TEXT;
  v_fingerprint TEXT;
  v_lock_period TEXT;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(),'costs','create')
    OR public.has_permission(auth.uid(),'costs','edit')
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية استيراد التكاليف';
  END IF;
  IF _source_type NOT IN ('hr','equipment') THEN
    RAISE EXCEPTION 'نوع مصدر الاستيراد غير صالح';
  END IF;
  IF char_length(btrim(COALESCE(_import_key,'')))<16 THEN
    RAISE EXCEPTION 'مفتاح الاستيراد غير صالح';
  END IF;
  IF jsonb_typeof(COALESCE(_rows,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_rows,'[]'::jsonb))=0
     OR jsonb_array_length(_rows)>5000 THEN
    RAISE EXCEPTION 'يجب أن تحتوي الدفعة على 1 إلى 5000 صف';
  END IF;

  v_key:=_source_type||':'||btrim(_import_key);
  v_fingerprint:=md5(_source_type||'|'||COALESCE(NULLIF(btrim(_file_name),''),'')||'|'||_rows::TEXT);
  PERFORM pg_advisory_xact_lock(hashtextextended('cost-import:'||v_key,0));

  SELECT * INTO v_batch
  FROM public.cost_import_batches
  WHERE import_key=v_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_batch.source_type IS DISTINCT FROM _source_type THEN
      RAISE EXCEPTION 'مفتاح الاستيراد مستخدم لمصدر تكلفة مختلف';
    END IF;
    IF v_batch.request_fingerprint IS NOT NULL
       AND v_batch.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'مفتاح الاستيراد مستخدم مسبقاً بمحتوى مختلف';
    END IF;
    RETURN jsonb_build_object(
      'batch_id',v_batch.id,'source_type',v_batch.source_type,'status',v_batch.status,
      'row_count',v_batch.row_count,'accepted_count',v_batch.accepted_count,
      'rejected_count',v_batch.rejected_count,'total_amount',v_batch.total_amount,'duplicate',true
    );
  END IF;

  FOR v_lock_period IN
    SELECT DISTINCT LEFT(row_data->>'period',7)
    FROM jsonb_array_elements(_rows) source(row_data)
    WHERE ((_source_type='hr' AND btrim(COALESCE(row_data->>'employee_name',''))<>'')
        OR (_source_type='equipment' AND btrim(COALESCE(row_data->>'equipment_name',''))<>''))
      AND CASE
        WHEN COALESCE(row_data->>'total_cost','')~'^[-+]?[0-9]+([.][0-9]+)?$'
          THEN (row_data->>'total_cost')::NUMERIC<>0
        ELSE FALSE
      END
      AND NULLIF(row_data->>'period','') IS NOT NULL
      AND row_data->>'period'~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each_text(row_data) field
        WHERE field.key = ANY(
          CASE WHEN _source_type='hr'
            THEN ARRAY['salary','housing','food','tickets','medical','gosi','eos']
            ELSE ARRAY['purchase_cost','depreciation','insurance','operating_cost','maintenance','fuel']
          END
        )
          AND field.value<>''
          AND field.value!~'^[-+]?[0-9]+([.][0-9]+)?$'
      )
    ORDER BY 1
  LOOP
    PERFORM public.cost_gate11_period_lock(v_lock_period);
    IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_lock_period AND status='closed') THEN
      RAISE EXCEPTION 'فترة التكلفة مقفلة: %',v_lock_period;
    END IF;
  END LOOP;

  INSERT INTO public.cost_import_batches(import_key,file_name,source_type,request_fingerprint,created_by)
  VALUES(v_key,NULLIF(btrim(_file_name),''),_source_type,v_fingerprint,auth.uid())
  RETURNING * INTO v_batch;

  INSERT INTO public.cost_import_lines(batch_id,row_number,raw_data,validation_errors)
  SELECT v_batch.id,ordinality,row_data,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN _source_type='hr' AND btrim(COALESCE(row_data->>'employee_name',''))='' THEN 'اسم الموظف مطلوب' END,
      CASE WHEN _source_type='equipment' AND btrim(COALESCE(row_data->>'equipment_name',''))='' THEN 'اسم المعدة مطلوب' END,
      CASE
        WHEN COALESCE(row_data->>'total_cost','')!~'^[-+]?[0-9]+([.][0-9]+)?$' THEN 'الإجمالي يجب أن يكون رقماً صالحاً'
        WHEN (row_data->>'total_cost')::NUMERIC=0 THEN 'الإجمالي يجب ألا يساوي صفراً'
      END,
      CASE WHEN EXISTS (
        SELECT 1 FROM jsonb_each_text(row_data) field
        WHERE field.key = ANY(
          CASE WHEN _source_type='hr'
            THEN ARRAY['salary','housing','food','tickets','medical','gosi','eos']
            ELSE ARRAY['purchase_cost','depreciation','insurance','operating_cost','maintenance','fuel']
          END
        )
          AND field.value<>''
          AND field.value!~'^[-+]?[0-9]+([.][0-9]+)?$'
      ) THEN 'أحد مكونات التكلفة ليس رقماً صالحاً' END,
      CASE
        WHEN NULLIF(row_data->>'period','') IS NOT NULL
         AND row_data->>'period'!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'
        THEN 'صيغة الفترة غير صالحة'
      END
    ],NULL))
  FROM jsonb_array_elements(_rows) WITH ORDINALITY source(row_data,ordinality);

  IF _source_type='hr' THEN
    INSERT INTO public.hr_costs(
      employee_code,employee_name,nationality,job_title,department,project,period,
      salary,housing,food,tickets,medical,gosi,eos,total_cost,imported_by,meta
    )
    SELECT NULLIF(btrim(raw_data->>'employee_code'),''),btrim(raw_data->>'employee_name'),
      NULLIF(btrim(raw_data->>'nationality'),''),NULLIF(btrim(raw_data->>'job_title'),''),
      NULLIF(btrim(raw_data->>'department'),''),NULLIF(btrim(raw_data->>'project'),''),
      NULLIF(btrim(raw_data->>'period'),''),COALESCE(NULLIF(raw_data->>'salary','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'housing','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'food','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'tickets','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'medical','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'gosi','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'eos','')::NUMERIC,0),
      (raw_data->>'total_cost')::NUMERIC,auth.uid(),
      jsonb_build_object(
        'source_type','hr_import','batch_id',v_batch.id,'row_number',row_number,
        'import_line_key',v_batch.id::TEXT||':'||row_number
      )
    FROM public.cost_import_lines
    WHERE batch_id=v_batch.id AND jsonb_array_length(validation_errors)=0;

    UPDATE public.cost_import_lines l
    SET source_record_id=h.id
    FROM public.hr_costs h
    WHERE l.batch_id=v_batch.id
      AND h.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;
  ELSE
    INSERT INTO public.equipment_costs(
      equipment_code,equipment_name,equipment_type,project,department,period,
      purchase_cost,depreciation,insurance,operating_cost,maintenance,fuel,total_cost,imported_by,meta
    )
    SELECT NULLIF(btrim(raw_data->>'equipment_code'),''),btrim(raw_data->>'equipment_name'),
      NULLIF(btrim(raw_data->>'equipment_type'),''),NULLIF(btrim(raw_data->>'project'),''),
      NULLIF(btrim(raw_data->>'department'),''),NULLIF(btrim(raw_data->>'period'),''),
      COALESCE(NULLIF(raw_data->>'purchase_cost','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'depreciation','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'insurance','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'operating_cost','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'maintenance','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'fuel','')::NUMERIC,0),
      (raw_data->>'total_cost')::NUMERIC,auth.uid(),
      jsonb_build_object(
        'source_type','equipment_import','batch_id',v_batch.id,'row_number',row_number,
        'import_line_key',v_batch.id::TEXT||':'||row_number
      )
    FROM public.cost_import_lines
    WHERE batch_id=v_batch.id AND jsonb_array_length(validation_errors)=0;

    UPDATE public.cost_import_lines l
    SET source_record_id=e.id
    FROM public.equipment_costs e
    WHERE l.batch_id=v_batch.id
      AND e.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;
  END IF;

  INSERT INTO public.cost_entries(
    category,description,project,department,period,amount,source_type,imported_by,
    workflow_status,meta
  )
  SELECT CASE WHEN _source_type='hr' THEN 'HR' ELSE 'EQUIPMENT' END,
    CASE WHEN _source_type='hr' THEN raw_data->>'employee_name' ELSE raw_data->>'equipment_name' END,
    NULLIF(btrim(raw_data->>'project'),''),NULLIF(btrim(raw_data->>'department'),''),
    NULLIF(btrim(raw_data->>'period'),''),(raw_data->>'total_cost')::NUMERIC,
    _source_type||'_import',auth.uid(),'posted',
    jsonb_build_object(
      'source_type',_source_type||'_import','source_record_id',source_record_id,
      'batch_id',v_batch.id,'row_number',row_number,
      'import_line_key',v_batch.id::TEXT||':'||row_number
    )
  FROM public.cost_import_lines
  WHERE batch_id=v_batch.id AND source_record_id IS NOT NULL;

  UPDATE public.cost_import_lines l
  SET cost_entry_id=c.id
  FROM public.cost_entries c
  WHERE l.batch_id=v_batch.id
    AND c.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;

  SELECT COUNT(*),
    COUNT(*) FILTER(WHERE cost_entry_id IS NOT NULL),
    COUNT(*) FILTER(WHERE cost_entry_id IS NULL),
    COALESCE(SUM((raw_data->>'total_cost')::NUMERIC) FILTER(WHERE cost_entry_id IS NOT NULL),0)
  INTO v_count,v_accepted,v_rejected,v_total
  FROM public.cost_import_lines
  WHERE batch_id=v_batch.id;

  UPDATE public.cost_import_batches
  SET row_count=v_count,accepted_count=v_accepted,rejected_count=v_rejected,total_amount=v_total,
      status=CASE WHEN v_accepted=0 THEN 'rejected' ELSE 'posted' END
  WHERE id=v_batch.id
  RETURNING * INTO v_batch;

  RETURN jsonb_build_object(
    'batch_id',v_batch.id,'source_type',v_batch.source_type,'status',v_batch.status,
    'row_count',v_count,'accepted_count',v_accepted,'rejected_count',v_rejected,
    'total_amount',v_total,'duplicate',false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_budget_save(
  _period TEXT,
  _category TEXT,
  _amount NUMERIC,
  _project_id UUID DEFAULT NULL,
  _department_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _revision_reason TEXT DEFAULT NULL
) RETURNS public.cost_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_budget public.cost_budgets;
  v_previous NUMERIC;
  v_event TEXT;
  v_category TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إدارة موازنات التكاليف';
  END IF;
  IF COALESCE(_period,'')!~'^[0-9]{4}-[0-9]{2}$'
     OR btrim(COALESCE(_category,''))=''
     OR COALESCE(_amount,-1)<0 THEN
    RAISE EXCEPTION 'بيانات الموازنة غير صالحة';
  END IF;

  v_category:=btrim(_category);
  PERFORM public.cost_gate11_period_lock(_period);
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=_period AND status='closed') THEN
    RAISE EXCEPTION 'لا يمكن تعديل موازنة فترة مقفلة';
  END IF;
  IF _project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=_project_id) THEN
    RAISE EXCEPTION 'المشروع غير موجود';
  END IF;
  IF _department_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.departments WHERE id=_department_id AND COALESCE(is_active,true)
  ) THEN
    RAISE EXCEPTION 'الإدارة غير موجودة أو غير نشطة';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'cost-budget:'||_period||':'||v_category||':'||COALESCE(_project_id::TEXT,'')||':'||COALESCE(_department_id::TEXT,''),0
  ));

  SELECT * INTO v_budget
  FROM public.cost_budgets
  WHERE period=_period AND category=v_category
    AND project_id IS NOT DISTINCT FROM _project_id
    AND department_id IS NOT DISTINCT FROM _department_id
  FOR UPDATE;

  IF FOUND THEN
    v_previous:=v_budget.amount;
    IF v_budget.status='approved' AND char_length(btrim(COALESCE(_revision_reason,'')))<10 THEN
      RAISE EXCEPTION 'سبب مراجعة الموازنة المعتمدة يجب ألا يقل عن 10 أحرف';
    END IF;
    v_event:=CASE WHEN v_budget.status='approved' THEN 'revised' ELSE 'updated' END;
    UPDATE public.cost_budgets
    SET amount=_amount,notes=NULLIF(btrim(_notes),''),status='draft',
        revision=revision+CASE WHEN status='approved' THEN 1 ELSE 0 END,
        updated_by=auth.uid(),updated_at=now(),approved_by=NULL,approved_at=NULL
    WHERE id=v_budget.id
    RETURNING * INTO v_budget;
  ELSE
    INSERT INTO public.cost_budgets(
      period,category,project_id,department_id,amount,notes,created_by,updated_by
    ) VALUES (
      _period,v_category,_project_id,_department_id,_amount,NULLIF(btrim(_notes),''),auth.uid(),auth.uid()
    ) RETURNING * INTO v_budget;
    v_event:='created';
  END IF;

  INSERT INTO public.cost_budget_events(
    budget_id,event_type,previous_amount,new_amount,reason,revision,changed_by
  ) VALUES (
    v_budget.id,v_event,v_previous,v_budget.amount,NULLIF(btrim(_revision_reason),''),v_budget.revision,auth.uid()
  );
  RETURN v_budget;
END;
$$;

CREATE OR REPLACE FUNCTION public.cost_budget_approve(_budget_id UUID)
RETURNS public.cost_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_budget public.cost_budgets;
  v_period TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الموازنة';
  END IF;

  SELECT period INTO v_period FROM public.cost_budgets WHERE id=_budget_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الموازنة غير موجودة'; END IF;

  PERFORM public.cost_gate11_period_lock(v_period);
  SELECT * INTO v_budget FROM public.cost_budgets WHERE id=_budget_id FOR UPDATE;
  IF NOT FOUND OR v_budget.status<>'draft' THEN
    RAISE EXCEPTION 'الموازنة غير جاهزة للاعتماد';
  END IF;
  IF v_budget.period IS DISTINCT FROM v_period THEN
    RAISE EXCEPTION 'تغيرت فترة الموازنة بالتزامن؛ أعد المحاولة';
  END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed') THEN
    RAISE EXCEPTION 'لا يمكن اعتماد موازنة فترة مقفلة';
  END IF;

  UPDATE public.cost_budgets
  SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid(),updated_at=now()
  WHERE id=_budget_id
  RETURNING * INTO v_budget;

  INSERT INTO public.cost_budget_events(budget_id,event_type,new_amount,revision,changed_by)
  VALUES(v_budget.id,'approved',v_budget.amount,v_budget.revision,auth.uid());
  RETURN v_budget;
END;
$$;

REVOKE ALL ON FUNCTION public.cost_gate11_period_lock(TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.cost_entry_guard() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.cost_entry_create_manual(TEXT,NUMERIC,TEXT,TEXT,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_entry_approve(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_entry_reverse(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_import_post(TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_aux_import_post(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_period_set_status(TEXT,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_budget_save(TEXT,TEXT,NUMERIC,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cost_budget_approve(UUID) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.cost_entry_create_manual(TEXT,NUMERIC,TEXT,TEXT,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_entry_approve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_entry_reverse(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_import_post(TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_aux_import_post(TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_period_set_status(TEXT,BOOLEAN,TEXT) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cost_budget_save(TEXT,TEXT,NUMERIC,UUID,UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cost_budget_approve(UUID) TO authenticated;

COMMIT;
