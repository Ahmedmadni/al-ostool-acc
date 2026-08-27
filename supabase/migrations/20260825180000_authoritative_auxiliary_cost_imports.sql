-- Phase F3: route detailed HR/equipment imports through one auditable,
-- idempotent server workflow and mirror accepted rows into the cost ledger.
ALTER TABLE public.cost_import_batches
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'general'
  CHECK (source_type IN ('general','hr','equipment'));

ALTER TABLE public.cost_import_lines
  ADD COLUMN source_record_id UUID;

CREATE UNIQUE INDEX hr_costs_import_line_unique
  ON public.hr_costs ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;
CREATE UNIQUE INDEX equipment_costs_import_line_unique
  ON public.equipment_costs ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cost_aux_import_post(
  _source_type TEXT,
  _import_key TEXT,
  _file_name TEXT,
  _rows JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_batch public.cost_import_batches;
  v_count INTEGER;
  v_accepted INTEGER;
  v_rejected INTEGER;
  v_total NUMERIC;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','create') OR public.has_permission(auth.uid(),'costs','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية استيراد التكاليف';
  END IF;
  IF _source_type NOT IN ('hr','equipment') THEN RAISE EXCEPTION 'نوع مصدر الاستيراد غير صالح'; END IF;
  IF char_length(btrim(COALESCE(_import_key,''))) < 16 THEN RAISE EXCEPTION 'مفتاح الاستيراد غير صالح'; END IF;
  IF jsonb_typeof(COALESCE(_rows,'[]')) <> 'array' OR jsonb_array_length(COALESCE(_rows,'[]')) = 0 OR jsonb_array_length(_rows) > 5000 THEN
    RAISE EXCEPTION 'يجب أن تحتوي الدفعة على 1 إلى 5000 صف';
  END IF;

  SELECT * INTO v_batch FROM public.cost_import_batches WHERE import_key = _source_type || ':' || _import_key;
  IF FOUND THEN
    RETURN jsonb_build_object('batch_id',v_batch.id,'source_type',v_batch.source_type,'status',v_batch.status,
      'row_count',v_batch.row_count,'accepted_count',v_batch.accepted_count,'rejected_count',v_batch.rejected_count,
      'total_amount',v_batch.total_amount,'duplicate',true);
  END IF;

  INSERT INTO public.cost_import_batches(import_key,file_name,source_type,created_by)
  VALUES (_source_type || ':' || btrim(_import_key),NULLIF(btrim(_file_name),''),_source_type,auth.uid())
  RETURNING * INTO v_batch;

  INSERT INTO public.cost_import_lines(batch_id,row_number,raw_data,validation_errors)
  SELECT v_batch.id, ordinality, row_data,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN _source_type='hr' AND btrim(COALESCE(row_data->>'employee_name',''))='' THEN 'اسم الموظف مطلوب' END,
      CASE WHEN _source_type='equipment' AND btrim(COALESCE(row_data->>'equipment_name',''))='' THEN 'اسم المعدة مطلوب' END,
      CASE WHEN COALESCE(row_data->>'total_cost','') !~ '^[-+]?[0-9]+([.][0-9]+)?$' THEN 'الإجمالي يجب أن يكون رقماً صالحاً'
        WHEN (row_data->>'total_cost')::NUMERIC = 0 THEN 'الإجمالي يجب ألا يساوي صفراً' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM jsonb_each_text(row_data) field
        WHERE field.key = ANY(CASE WHEN _source_type='hr'
          THEN ARRAY['salary','housing','food','tickets','medical','gosi','eos']
          ELSE ARRAY['purchase_cost','depreciation','insurance','operating_cost','maintenance','fuel'] END)
          AND field.value <> '' AND field.value !~ '^[-+]?[0-9]+([.][0-9]+)?$'
      ) THEN 'أحد مكونات التكلفة ليس رقماً صالحاً' END,
      CASE WHEN NULLIF(row_data->>'period','') IS NOT NULL AND row_data->>'period' !~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN 'صيغة الفترة غير صالحة' END
    ],NULL))
  FROM jsonb_array_elements(_rows) WITH ORDINALITY source(row_data,ordinality);

  IF _source_type='hr' THEN
    INSERT INTO public.hr_costs(employee_code,employee_name,nationality,job_title,department,project,period,
      salary,housing,food,tickets,medical,gosi,eos,total_cost,imported_by,meta)
    SELECT NULLIF(btrim(raw_data->>'employee_code'),''),btrim(raw_data->>'employee_name'),NULLIF(btrim(raw_data->>'nationality'),''),
      NULLIF(btrim(raw_data->>'job_title'),''),NULLIF(btrim(raw_data->>'department'),''),NULLIF(btrim(raw_data->>'project'),''),
      NULLIF(btrim(raw_data->>'period'),''),COALESCE(NULLIF(raw_data->>'salary','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'housing','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'food','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'tickets','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'medical','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'gosi','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'eos','')::NUMERIC,0),
      (raw_data->>'total_cost')::NUMERIC,auth.uid(),
      jsonb_build_object('source_type','hr_import','batch_id',v_batch.id,'row_number',row_number,'import_line_key',v_batch.id::TEXT||':'||row_number)
    FROM public.cost_import_lines WHERE batch_id=v_batch.id AND jsonb_array_length(validation_errors)=0;

    UPDATE public.cost_import_lines l SET source_record_id=h.id FROM public.hr_costs h
    WHERE l.batch_id=v_batch.id AND h.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;
  ELSE
    INSERT INTO public.equipment_costs(equipment_code,equipment_name,equipment_type,project,department,period,
      purchase_cost,depreciation,insurance,operating_cost,maintenance,fuel,total_cost,imported_by,meta)
    SELECT NULLIF(btrim(raw_data->>'equipment_code'),''),btrim(raw_data->>'equipment_name'),NULLIF(btrim(raw_data->>'equipment_type'),''),
      NULLIF(btrim(raw_data->>'project'),''),NULLIF(btrim(raw_data->>'department'),''),NULLIF(btrim(raw_data->>'period'),''),
      COALESCE(NULLIF(raw_data->>'purchase_cost','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'depreciation','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'insurance','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'operating_cost','')::NUMERIC,0),
      COALESCE(NULLIF(raw_data->>'maintenance','')::NUMERIC,0),COALESCE(NULLIF(raw_data->>'fuel','')::NUMERIC,0),
      (raw_data->>'total_cost')::NUMERIC,auth.uid(),
      jsonb_build_object('source_type','equipment_import','batch_id',v_batch.id,'row_number',row_number,'import_line_key',v_batch.id::TEXT||':'||row_number)
    FROM public.cost_import_lines WHERE batch_id=v_batch.id AND jsonb_array_length(validation_errors)=0;

    UPDATE public.cost_import_lines l SET source_record_id=e.id FROM public.equipment_costs e
    WHERE l.batch_id=v_batch.id AND e.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;
  END IF;

  INSERT INTO public.cost_entries(category,description,project,department,period,amount,source_type,imported_by,meta)
  SELECT CASE WHEN _source_type='hr' THEN 'HR' ELSE 'EQUIPMENT' END,
    CASE WHEN _source_type='hr' THEN raw_data->>'employee_name' ELSE raw_data->>'equipment_name' END,
    NULLIF(btrim(raw_data->>'project'),''),NULLIF(btrim(raw_data->>'department'),''),NULLIF(btrim(raw_data->>'period'),''),
    (raw_data->>'total_cost')::NUMERIC,_source_type||'_import',auth.uid(),
    jsonb_build_object('source_type',_source_type||'_import','source_record_id',source_record_id,
      'batch_id',v_batch.id,'row_number',row_number,'import_line_key',v_batch.id::TEXT||':'||row_number)
  FROM public.cost_import_lines WHERE batch_id=v_batch.id AND source_record_id IS NOT NULL;

  UPDATE public.cost_import_lines l SET cost_entry_id=c.id FROM public.cost_entries c
  WHERE l.batch_id=v_batch.id AND c.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;

  SELECT COUNT(*),COUNT(*) FILTER(WHERE cost_entry_id IS NOT NULL),COUNT(*) FILTER(WHERE cost_entry_id IS NULL),
    COALESCE(SUM((raw_data->>'total_cost')::NUMERIC) FILTER(WHERE cost_entry_id IS NOT NULL),0)
  INTO v_count,v_accepted,v_rejected,v_total FROM public.cost_import_lines WHERE batch_id=v_batch.id;
  UPDATE public.cost_import_batches SET row_count=v_count,accepted_count=v_accepted,rejected_count=v_rejected,total_amount=v_total,
    status=CASE WHEN v_accepted=0 THEN 'rejected' ELSE 'posted' END WHERE id=v_batch.id RETURNING * INTO v_batch;
  RETURN jsonb_build_object('batch_id',v_batch.id,'source_type',v_batch.source_type,'status',v_batch.status,
    'row_count',v_count,'accepted_count',v_accepted,'rejected_count',v_rejected,'total_amount',v_total,'duplicate',false);
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.hr_costs,public.equipment_costs FROM authenticated;
REVOKE ALL ON FUNCTION public.cost_aux_import_post(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_aux_import_post(TEXT,TEXT,TEXT,JSONB) TO authenticated;
