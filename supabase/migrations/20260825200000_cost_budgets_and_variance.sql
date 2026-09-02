-- Phase F5: versioned cost budgets used for actual-versus-budget monitoring.
CREATE TABLE public.cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period~'^[0-9]{4}-[0-9]{2}$'),
  category TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  department_id UUID REFERENCES public.departments(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount>=0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX cost_budgets_dimension_unique ON public.cost_budgets
  (period,category,COALESCE(project_id,'00000000-0000-0000-0000-000000000000'::UUID),COALESCE(department_id,'00000000-0000-0000-0000-000000000000'::UUID));

CREATE TABLE public.cost_budget_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.cost_budgets(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','updated','revised','approved')),
  previous_amount NUMERIC(15,2),
  new_amount NUMERIC(15,2) NOT NULL,
  reason TEXT,
  revision INTEGER NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_budget_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cost_budgets,public.cost_budget_events TO authenticated;
GRANT ALL ON public.cost_budgets,public.cost_budget_events TO service_role;
CREATE POLICY cost_budgets_read ON public.cost_budgets FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));
CREATE POLICY cost_budget_events_read ON public.cost_budget_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'costs','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.cost_budget_save(_period TEXT,_category TEXT,_amount NUMERIC,_project_id UUID DEFAULT NULL,_department_id UUID DEFAULT NULL,_notes TEXT DEFAULT NULL,_revision_reason TEXT DEFAULT NULL)
RETURNS public.cost_budgets LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_budget public.cost_budgets; v_previous NUMERIC; v_event TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إدارة موازنات التكاليف'; END IF;
  IF _period!~'^[0-9]{4}-[0-9]{2}$' OR btrim(COALESCE(_category,''))='' OR COALESCE(_amount,-1)<0 THEN RAISE EXCEPTION 'بيانات الموازنة غير صالحة'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=_period AND status='closed') THEN RAISE EXCEPTION 'لا يمكن تعديل موازنة فترة مقفلة'; END IF;
  IF _project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=_project_id) THEN RAISE EXCEPTION 'المشروع غير موجود'; END IF;
  IF _department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE id=_department_id AND COALESCE(is_active,true)) THEN RAISE EXCEPTION 'الإدارة غير موجودة أو غير نشطة'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_period||':'||btrim(_category)||':'||COALESCE(_project_id::TEXT,'')||':'||COALESCE(_department_id::TEXT,''),0));
  SELECT * INTO v_budget FROM public.cost_budgets WHERE period=_period AND category=btrim(_category)
    AND project_id IS NOT DISTINCT FROM _project_id AND department_id IS NOT DISTINCT FROM _department_id FOR UPDATE;
  IF FOUND THEN
    v_previous:=v_budget.amount;
    IF v_budget.status='approved' AND char_length(btrim(COALESCE(_revision_reason,'')))<10 THEN RAISE EXCEPTION 'سبب مراجعة الموازنة المعتمدة يجب ألا يقل عن 10 أحرف'; END IF;
    v_event:=CASE WHEN v_budget.status='approved' THEN 'revised' ELSE 'updated' END;
    UPDATE public.cost_budgets SET amount=_amount,notes=NULLIF(btrim(_notes),''),status='draft',revision=revision+CASE WHEN status='approved' THEN 1 ELSE 0 END,
      updated_by=auth.uid(),updated_at=now(),approved_by=NULL,approved_at=NULL WHERE id=v_budget.id RETURNING * INTO v_budget;
  ELSE
    INSERT INTO public.cost_budgets(period,category,project_id,department_id,amount,notes,created_by,updated_by)
    VALUES(_period,btrim(_category),_project_id,_department_id,_amount,NULLIF(btrim(_notes),''),auth.uid(),auth.uid()) RETURNING * INTO v_budget;
    v_event:='created';
  END IF;
  INSERT INTO public.cost_budget_events(budget_id,event_type,previous_amount,new_amount,reason,revision,changed_by)
  VALUES(v_budget.id,v_event,v_previous,v_budget.amount,NULLIF(btrim(_revision_reason),''),v_budget.revision,auth.uid());
  RETURN v_budget;
END; $$;

CREATE OR REPLACE FUNCTION public.cost_budget_approve(_budget_id UUID) RETURNS public.cost_budgets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_budget public.cost_budgets;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الموازنة'; END IF;
  SELECT * INTO v_budget FROM public.cost_budgets WHERE id=_budget_id FOR UPDATE;
  IF NOT FOUND OR v_budget.status<>'draft' THEN RAISE EXCEPTION 'الموازنة غير جاهزة للاعتماد'; END IF;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_budget.period AND status='closed') THEN RAISE EXCEPTION 'لا يمكن اعتماد موازنة فترة مقفلة'; END IF;
  UPDATE public.cost_budgets SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid(),updated_at=now()
    WHERE id=_budget_id RETURNING * INTO v_budget;
  INSERT INTO public.cost_budget_events(budget_id,event_type,new_amount,revision,changed_by)
    VALUES(v_budget.id,'approved',v_budget.amount,v_budget.revision,auth.uid());
  RETURN v_budget;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.cost_budgets,public.cost_budget_events FROM authenticated;
REVOKE ALL ON FUNCTION public.cost_budget_save(TEXT,TEXT,NUMERIC,UUID,UUID,TEXT,TEXT),public.cost_budget_approve(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cost_budget_save(TEXT,TEXT,NUMERIC,UUID,UUID,TEXT,TEXT),public.cost_budget_approve(UUID) TO authenticated;
