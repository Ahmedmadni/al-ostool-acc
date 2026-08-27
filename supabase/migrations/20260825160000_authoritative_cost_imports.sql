-- Phase F1: auditable and idempotent cost imports.
CREATE TABLE public.cost_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key TEXT NOT NULL UNIQUE,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','rejected')),
  row_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.cost_import_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cost_import_batches(id) ON DELETE RESTRICT,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  cost_entry_id UUID REFERENCES public.cost_entries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id,row_number)
);
CREATE UNIQUE INDEX cost_entries_import_line_unique
  ON public.cost_entries ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;

ALTER TABLE public.cost_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_import_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cost_import_batches,public.cost_import_lines TO authenticated;
GRANT ALL ON public.cost_import_batches,public.cost_import_lines TO service_role;
CREATE POLICY cost_import_batches_read ON public.cost_import_batches FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));
CREATE POLICY cost_import_lines_read ON public.cost_import_lines FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.cost_import_post(_import_key TEXT,_file_name TEXT,_rows JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_batch public.cost_import_batches; v_count INTEGER; v_accepted INTEGER; v_rejected INTEGER; v_total NUMERIC;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','create') OR public.has_permission(auth.uid(),'costs','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية استيراد التكاليف';
  END IF;
  IF char_length(btrim(COALESCE(_import_key,'')))<16 THEN RAISE EXCEPTION 'مفتاح الاستيراد غير صالح'; END IF;
  IF jsonb_typeof(COALESCE(_rows,'[]'))<>'array' OR jsonb_array_length(COALESCE(_rows,'[]'))=0 OR jsonb_array_length(_rows)>5000 THEN
    RAISE EXCEPTION 'يجب أن تحتوي الدفعة على 1 إلى 5000 صف';
  END IF;
  SELECT * INTO v_batch FROM public.cost_import_batches WHERE import_key=_import_key;
  IF FOUND THEN
    RETURN jsonb_build_object('batch_id',v_batch.id,'status',v_batch.status,'row_count',v_batch.row_count,
      'accepted_count',v_batch.accepted_count,'rejected_count',v_batch.rejected_count,'total_amount',v_batch.total_amount,'duplicate',true);
  END IF;
  INSERT INTO public.cost_import_batches(import_key,file_name,created_by) VALUES(btrim(_import_key),NULLIF(btrim(_file_name),''),auth.uid()) RETURNING * INTO v_batch;

  INSERT INTO public.cost_import_lines(batch_id,row_number,raw_data,validation_errors)
  SELECT v_batch.id,ordinality,row_data,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN btrim(COALESCE(row_data->>'category',''))='' THEN 'الفئة مطلوبة' END,
      CASE WHEN COALESCE(row_data->>'amount','')!~'^[-+]?[0-9]+([.][0-9]+)?$' THEN 'المبلغ يجب أن يكون رقماً صالحاً'
        WHEN (row_data->>'amount')::NUMERIC=0 THEN 'المبلغ يجب ألا يساوي صفراً' END,
      CASE WHEN NULLIF(row_data->>'period','') IS NOT NULL AND row_data->>'period'!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN 'صيغة الفترة غير صالحة' END
    ],NULL))
  FROM jsonb_array_elements(_rows) WITH ORDINALITY source(row_data,ordinality);

  INSERT INTO public.cost_entries(category,description,project,company,department,section,period,amount,imported_by,meta)
  SELECT btrim(l.raw_data->>'category'),NULLIF(btrim(l.raw_data->>'description'),''),NULLIF(btrim(l.raw_data->>'project'),''),
    NULLIF(btrim(l.raw_data->>'company'),''),NULLIF(btrim(l.raw_data->>'department'),''),NULLIF(btrim(l.raw_data->>'section'),''),
    NULLIF(btrim(l.raw_data->>'period'),''),(l.raw_data->>'amount')::NUMERIC,auth.uid(),
    jsonb_build_object('source_type','manual_import','batch_id',v_batch.id,'row_number',l.row_number,'import_line_key',v_batch.id::TEXT||':'||l.row_number)
  FROM public.cost_import_lines l WHERE l.batch_id=v_batch.id AND jsonb_array_length(l.validation_errors)=0;

  UPDATE public.cost_import_lines l SET cost_entry_id=c.id FROM public.cost_entries c
  WHERE l.batch_id=v_batch.id AND c.meta->>'import_line_key'=v_batch.id::TEXT||':'||l.row_number;
  SELECT COUNT(*),COUNT(*) FILTER(WHERE cost_entry_id IS NOT NULL),COUNT(*) FILTER(WHERE cost_entry_id IS NULL),
    COALESCE(SUM((raw_data->>'amount')::NUMERIC) FILTER(WHERE cost_entry_id IS NOT NULL),0)
  INTO v_count,v_accepted,v_rejected,v_total FROM public.cost_import_lines WHERE batch_id=v_batch.id;
  UPDATE public.cost_import_batches SET row_count=v_count,accepted_count=v_accepted,rejected_count=v_rejected,total_amount=v_total,
    status=CASE WHEN v_accepted=0 THEN 'rejected' ELSE 'posted' END WHERE id=v_batch.id RETURNING * INTO v_batch;
  RETURN jsonb_build_object('batch_id',v_batch.id,'status',v_batch.status,'row_count',v_count,'accepted_count',v_accepted,
    'rejected_count',v_rejected,'total_amount',v_total,'duplicate',false);
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.cost_import_batches,public.cost_import_lines FROM authenticated;
REVOKE INSERT ON public.cost_entries FROM authenticated;
REVOKE ALL ON FUNCTION public.cost_import_post(TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_import_post(TEXT,TEXT,JSONB) TO authenticated;
