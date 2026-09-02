-- Phase F4: auditable period operations and authoritative dimensions for manual costs.
CREATE TABLE public.cost_period_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period~'^[0-9]{4}-[0-9]{2}$'),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('open','closed')),
  to_status TEXT NOT NULL CHECK (to_status IN ('open','closed')),
  reason TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cost_period_status_events_period_idx
  ON public.cost_period_status_events(period,changed_at DESC);
ALTER TABLE public.cost_period_status_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cost_period_status_events TO authenticated;
GRANT ALL ON public.cost_period_status_events TO service_role;
CREATE POLICY cost_period_status_events_read ON public.cost_period_status_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.cost_entry_create_manual(_category TEXT,_amount NUMERIC,_period TEXT,_description TEXT DEFAULT NULL,_project_id UUID DEFAULT NULL,_department_id UUID DEFAULT NULL)
RETURNS public.cost_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry public.cost_entries; v_project TEXT; v_department TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','create') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إنشاء تكلفة'; END IF;
  IF btrim(COALESCE(_category,''))='' OR COALESCE(_amount,0)=0 OR _period!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN RAISE EXCEPTION 'بيانات قيد التكلفة غير صالحة'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=LEFT(_period,7) AND status='closed') THEN RAISE EXCEPTION 'فترة التكلفة مقفلة'; END IF;
  IF _project_id IS NOT NULL THEN
    SELECT name INTO v_project FROM public.projects WHERE id=_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'المشروع المحدد غير موجود'; END IF;
  END IF;
  IF _department_id IS NOT NULL THEN
    SELECT name_ar INTO v_department FROM public.departments WHERE id=_department_id AND COALESCE(is_active,true);
    IF NOT FOUND THEN RAISE EXCEPTION 'الإدارة المحددة غير موجودة أو غير نشطة'; END IF;
  END IF;
  INSERT INTO public.cost_entries(category,amount,period,description,project,project_id,department,department_id,imported_by,workflow_status,source_type,meta)
  VALUES(btrim(_category),_amount,_period,NULLIF(btrim(_description),''),v_project,_project_id,v_department,_department_id,auth.uid(),'draft','manual',jsonb_build_object('created_via','cost_entry_create_manual')) RETURNING * INTO v_entry;
  INSERT INTO public.cost_entry_status_events(cost_entry_id,to_status,reason,changed_by) VALUES(v_entry.id,'draft','إنشاء يدوي',auth.uid()); RETURN v_entry;
END; $$;

CREATE OR REPLACE FUNCTION public.cost_period_set_status(_period TEXT,_closed BOOLEAN,_reason TEXT)
RETURNS public.cost_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_period public.cost_periods; v_from TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إدارة فترات التكاليف'; END IF;
  IF _period!~'^[0-9]{4}-[0-9]{2}$' OR char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'الفترة أو السبب غير صالح'; END IF;
  SELECT status INTO v_from FROM public.cost_periods WHERE period=_period FOR UPDATE;
  IF v_from=CASE WHEN _closed THEN 'closed' ELSE 'open' END THEN RAISE EXCEPTION 'الفترة في الحالة المطلوبة بالفعل'; END IF;
  INSERT INTO public.cost_periods(period,status,reason,closed_by,closed_at,reopened_by,reopened_at)
  VALUES(_period,CASE WHEN _closed THEN 'closed' ELSE 'open' END,btrim(_reason),CASE WHEN _closed THEN auth.uid() END,CASE WHEN _closed THEN now() END,CASE WHEN NOT _closed THEN auth.uid() END,CASE WHEN NOT _closed THEN now() END)
  ON CONFLICT(period) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,closed_by=EXCLUDED.closed_by,closed_at=EXCLUDED.closed_at,reopened_by=EXCLUDED.reopened_by,reopened_at=EXCLUDED.reopened_at RETURNING * INTO v_period;
  INSERT INTO public.cost_period_status_events(period,from_status,to_status,reason,changed_by)
  VALUES(_period,v_from,v_period.status,btrim(_reason),auth.uid());
  RETURN v_period;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.cost_period_status_events FROM authenticated;
