-- Phase F2: cost-entry approval, reversal, and period locks.
ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'posted' CHECK (workflow_status IN ('draft','approved','posted','reversed')),
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_entry_id UUID REFERENCES public.cost_entries(id);

CREATE TABLE public.cost_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), period TEXT NOT NULL UNIQUE CHECK (period~'^[0-9]{4}-[0-9]{2}$'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')), reason TEXT,
  closed_by UUID REFERENCES auth.users(id), closed_at TIMESTAMPTZ, reopened_by UUID REFERENCES auth.users(id), reopened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.cost_entry_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cost_entry_id UUID NOT NULL REFERENCES public.cost_entries(id) ON DELETE RESTRICT,
  from_status TEXT, to_status TEXT NOT NULL, reason TEXT, changed_by UUID REFERENCES auth.users(id), changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entry_status_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cost_periods,public.cost_entry_status_events TO authenticated;
GRANT ALL ON public.cost_periods,public.cost_entry_status_events TO service_role;
CREATE POLICY cost_periods_read ON public.cost_periods FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));
CREATE POLICY cost_events_read ON public.cost_entry_status_events FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.cost_entry_guard() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('app.cost_workflow_bypass',true)='on' THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_OP='DELETE' AND OLD.workflow_status<>'draft' THEN RAISE EXCEPTION 'لا يمكن حذف قيد تكلفة غير مسودة؛ استخدم القيد العكسي'; END IF;
  IF TG_OP='UPDATE' AND OLD.workflow_status IN ('posted','reversed') THEN RAISE EXCEPTION 'لا يمكن تعديل قيد مرحل أو معكوس'; END IF;
  IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.cost_periods WHERE period=LEFT(NEW.period,7) AND status='closed') THEN RAISE EXCEPTION 'فترة التكلفة مقفلة'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_cost_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cost_entries FOR EACH ROW EXECUTE FUNCTION public.cost_entry_guard();

CREATE OR REPLACE FUNCTION public.cost_entry_create_manual(_category TEXT,_amount NUMERIC,_period TEXT,_description TEXT DEFAULT NULL,_project_id UUID DEFAULT NULL,_department_id UUID DEFAULT NULL)
RETURNS public.cost_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry public.cost_entries;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','create') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إنشاء تكلفة'; END IF;
  IF btrim(COALESCE(_category,''))='' OR COALESCE(_amount,0)=0 OR _period!~'^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN RAISE EXCEPTION 'بيانات قيد التكلفة غير صالحة'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=LEFT(_period,7) AND status='closed') THEN RAISE EXCEPTION 'فترة التكلفة مقفلة'; END IF;
  INSERT INTO public.cost_entries(category,amount,period,description,project_id,department_id,imported_by,workflow_status,source_type,meta)
  VALUES(btrim(_category),_amount,_period,NULLIF(btrim(_description),''),_project_id,_department_id,auth.uid(),'draft','manual',jsonb_build_object('created_via','cost_entry_create_manual')) RETURNING * INTO v_entry;
  INSERT INTO public.cost_entry_status_events(cost_entry_id,to_status,reason,changed_by) VALUES(v_entry.id,'draft','إنشاء يدوي',auth.uid()); RETURN v_entry;
END; $$;

CREATE OR REPLACE FUNCTION public.cost_entry_approve(_entry_id UUID) RETURNS public.cost_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entry public.cost_entries;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية اعتماد التكلفة'; END IF;
  SELECT * INTO v_entry FROM public.cost_entries WHERE id=_entry_id FOR UPDATE;
  IF NOT FOUND OR v_entry.workflow_status<>'draft' THEN RAISE EXCEPTION 'قيد التكلفة غير جاهز للاعتماد'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=LEFT(v_entry.period,7) AND status='closed') THEN RAISE EXCEPTION 'فترة التكلفة مقفلة'; END IF;
  PERFORM set_config('app.cost_workflow_bypass','on',true);
  UPDATE public.cost_entries SET workflow_status='posted',approved_by=auth.uid(),approved_at=now() WHERE id=_entry_id RETURNING * INTO v_entry;
  INSERT INTO public.cost_entry_status_events(cost_entry_id,from_status,to_status,reason,changed_by) VALUES(_entry_id,'draft','posted','اعتماد وترحيل',auth.uid()); RETURN v_entry;
END; $$;

CREATE OR REPLACE FUNCTION public.cost_entry_reverse(_entry_id UUID,_reason TEXT) RETURNS public.cost_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_original public.cost_entries; v_reversal public.cost_entries;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية عكس التكلفة'; END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'سبب العكس يجب ألا يقل عن 10 أحرف'; END IF;
  SELECT * INTO v_original FROM public.cost_entries WHERE id=_entry_id FOR UPDATE;
  IF NOT FOUND OR v_original.workflow_status<>'posted' OR v_original.reversal_entry_id IS NOT NULL THEN RAISE EXCEPTION 'القيد غير قابل للعكس'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=LEFT(v_original.period,7) AND status='closed') THEN RAISE EXCEPTION 'فترة التكلفة مقفلة'; END IF;
  PERFORM set_config('app.cost_workflow_bypass','on',true);
  INSERT INTO public.cost_entries(category,amount,period,description,project,project_id,company,department,department_id,section,imported_by,workflow_status,source_type,meta)
  VALUES(v_original.category,-v_original.amount,v_original.period,'عكس: '||COALESCE(v_original.description,v_original.category),v_original.project,v_original.project_id,v_original.company,v_original.department,v_original.department_id,v_original.section,auth.uid(),'posted','reversal',jsonb_build_object('reverses_entry_id',v_original.id,'reason',btrim(_reason))) RETURNING * INTO v_reversal;
  UPDATE public.cost_entries SET workflow_status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_entry_id=v_reversal.id WHERE id=_entry_id;
  INSERT INTO public.cost_entry_status_events(cost_entry_id,from_status,to_status,reason,changed_by) VALUES(_entry_id,'posted','reversed',btrim(_reason),auth.uid()); RETURN v_reversal;
END; $$;

CREATE OR REPLACE FUNCTION public.cost_period_set_status(_period TEXT,_closed BOOLEAN,_reason TEXT) RETURNS public.cost_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_period public.cost_periods;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إدارة فترات التكاليف'; END IF;
  IF _period!~'^[0-9]{4}-[0-9]{2}$' OR char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'الفترة أو السبب غير صالح'; END IF;
  INSERT INTO public.cost_periods(period,status,reason,closed_by,closed_at,reopened_by,reopened_at)
  VALUES(_period,CASE WHEN _closed THEN 'closed' ELSE 'open' END,btrim(_reason),CASE WHEN _closed THEN auth.uid() END,CASE WHEN _closed THEN now() END,CASE WHEN NOT _closed THEN auth.uid() END,CASE WHEN NOT _closed THEN now() END)
  ON CONFLICT(period) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,closed_by=EXCLUDED.closed_by,closed_at=EXCLUDED.closed_at,reopened_by=EXCLUDED.reopened_by,reopened_at=EXCLUDED.reopened_at RETURNING * INTO v_period; RETURN v_period;
END; $$;

REVOKE UPDATE,DELETE ON public.cost_entries FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.cost_periods,public.cost_entry_status_events FROM authenticated;
REVOKE ALL ON FUNCTION public.cost_entry_create_manual(TEXT,NUMERIC,TEXT,TEXT,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_entry_approve(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_entry_reverse(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cost_period_set_status(TEXT,BOOLEAN,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_entry_create_manual(TEXT,NUMERIC,TEXT,TEXT,UUID,UUID),public.cost_entry_approve(UUID),public.cost_entry_reverse(UUID,TEXT),public.cost_period_set_status(TEXT,BOOLEAN,TEXT) TO authenticated;
