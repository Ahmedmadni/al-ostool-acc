-- Phase D3.4: monthly attendance reports, controlled close/reopen and payroll gate.

CREATE TABLE public.hr_attendance_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2200),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  summary_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES auth.users(id),
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_year,period_month)
);

CREATE TABLE public.hr_attendance_period_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.hr_attendance_periods(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('closed','reopened')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_attendance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_period_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_attendance_periods,public.hr_attendance_period_audit TO authenticated;
GRANT ALL ON public.hr_attendance_periods,public.hr_attendance_period_audit TO service_role;
CREATE POLICY hr_attendance_periods_read ON public.hr_attendance_periods FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','view') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_period_audit_read ON public.hr_attendance_period_audit FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.hr_attendance_period_is_closed(_work_date DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.hr_attendance_periods
    WHERE period_year=EXTRACT(YEAR FROM _work_date)::INTEGER
      AND period_month=EXTRACT(MONTH FROM _work_date)::INTEGER AND status='closed')
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_close_period(_year INTEGER,_month INTEGER)
RETURNS public.hr_attendance_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_from DATE; v_to DATE; v_missing INTEGER; v_unapproved INTEGER; v_corrections INTEGER;
  v_snapshot JSONB; v_period public.hr_attendance_periods;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إقفال الحضور';
  END IF;
  IF _year NOT BETWEEN 2000 AND 2200 OR _month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'الفترة غير صالحة'; END IF;
  v_from:=make_date(_year,_month,1); v_to:=(v_from+INTERVAL '1 month - 1 day')::DATE;
  IF v_to>=CURRENT_DATE THEN RAISE EXCEPTION 'لا يمكن إقفال فترة لم تنته بعد'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(format('attendance-%s-%s',_year,_month),0));

  WITH expected AS (
    SELECT DISTINCT a.employee_id,days.work_date::DATE work_date
    FROM public.hr_shift_assignments a JOIN public.hr_shift_groups g ON g.id=a.group_id AND g.is_active
    CROSS JOIN LATERAL generate_series(GREATEST(a.effective_from,v_from),LEAST(COALESCE(a.effective_to,v_to),v_to),INTERVAL '1 day') AS days(work_date)
    JOIN public.hr_shift_schedules s ON s.group_id=a.group_id AND s.is_working_day
      AND s.day_of_week=EXTRACT(DOW FROM days.work_date)::INTEGER
    JOIN public.hr_employees e ON e.id=a.employee_id AND e.hire_date<=days.work_date::DATE
  ) SELECT COUNT(*) INTO v_missing FROM expected x LEFT JOIN public.hr_attendance_days d
    ON d.employee_id=x.employee_id AND d.work_date=x.work_date WHERE d.id IS NULL;
  SELECT COUNT(*) INTO v_unapproved FROM public.hr_attendance_days
    WHERE work_date BETWEEN v_from AND v_to AND approval_status<>'approved';
  SELECT COUNT(*) INTO v_corrections FROM public.hr_attendance_correction_requests r
    JOIN public.hr_attendance_days d ON d.id=r.attendance_day_id
    WHERE d.work_date BETWEEN v_from AND v_to AND r.status='pending';
  IF v_missing>0 THEN RAISE EXCEPTION 'لا يمكن الإقفال: % يوم دوام لم تتم معالجته',v_missing; END IF;
  IF v_unapproved>0 THEN RAISE EXCEPTION 'لا يمكن الإقفال: % سجل يومي غير معتمد',v_unapproved; END IF;
  IF v_corrections>0 THEN RAISE EXCEPTION 'لا يمكن الإقفال: % طلب تصحيح معلق',v_corrections; END IF;

  SELECT jsonb_build_object('engine','attendance-close-v1','period_from',v_from,'period_to',v_to,
    'employees',COUNT(DISTINCT employee_id),'days',COUNT(*),'present_days',COUNT(*) FILTER(WHERE status='present'),
    'absent_days',COUNT(*) FILTER(WHERE status='absent'),'leave_days',COUNT(*) FILTER(WHERE status='approved_leave'),
    'rest_days',COUNT(*) FILTER(WHERE status='rest_day'),'incomplete_days',COUNT(*) FILTER(WHERE status='incomplete'),
    'actual_minutes',COALESCE(SUM(actual_minutes),0),'late_minutes',COALESCE(SUM(late_minutes),0),
    'early_leave_minutes',COALESCE(SUM(early_leave_minutes),0),'overtime_minutes',COALESCE(SUM(overtime_minutes),0),
    'closed_at',now()) INTO v_snapshot FROM public.hr_attendance_days WHERE work_date BETWEEN v_from AND v_to;

  INSERT INTO public.hr_attendance_periods(period_year,period_month,status,summary_snapshot,closed_by,closed_at)
  VALUES(_year,_month,'closed',v_snapshot,auth.uid(),now())
  ON CONFLICT(period_year,period_month) DO UPDATE SET status='closed',summary_snapshot=EXCLUDED.summary_snapshot,
    closed_by=auth.uid(),closed_at=now(),updated_at=now() WHERE hr_attendance_periods.status='open'
  RETURNING * INTO v_period;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'الفترة مقفلة مسبقاً'; END IF;
  INSERT INTO public.hr_attendance_period_audit(period_id,action,actor_id,snapshot)
  VALUES(v_period.id,'closed',auth.uid(),v_snapshot);
  RETURN v_period;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_reopen_period(_period_id UUID,_reason TEXT)
RETURNS public.hr_attendance_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_period public.hr_attendance_periods;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') AND public.has_permission(auth.uid(),'hr.payroll','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'إعادة الفتح تتطلب صلاحية اعتماد الحضور والرواتب';
  END IF;
  IF char_length(BTRIM(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'يجب تسجيل سبب واضح لإعادة الفتح'; END IF;
  SELECT * INTO v_period FROM public.hr_attendance_periods WHERE id=_period_id FOR UPDATE;
  IF NOT FOUND OR v_period.status<>'closed' THEN RAISE EXCEPTION 'فترة الحضور غير مقفلة'; END IF;
  IF EXISTS(SELECT 1 FROM public.hr_payroll_runs WHERE period_year=v_period.period_year AND period_month=v_period.period_month AND status IN ('approved','paid')) THEN
    RAISE EXCEPTION 'لا يمكن إعادة فتح حضور مرتبط بمسير رواتب معتمد أو مصروف';
  END IF;
  INSERT INTO public.hr_attendance_period_audit(period_id,action,actor_id,reason,snapshot)
  VALUES(v_period.id,'reopened',auth.uid(),BTRIM(_reason),v_period.summary_snapshot);
  UPDATE public.hr_attendance_periods SET status='open',reopened_by=auth.uid(),reopened_at=now(),
    reopen_reason=BTRIM(_reason),updated_at=now() WHERE id=v_period.id RETURNING * INTO v_period;
  RETURN v_period;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_day_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_date DATE:=COALESCE(NEW.work_date,OLD.work_date);
BEGIN IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل التعديل'; END IF; RETURN COALESCE(NEW,OLD); END; $$;
CREATE TRIGGER trg_hr_attendance_days_closed_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hr_attendance_days
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_day_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_event_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event public.hr_attendance_events:=COALESCE(NEW,OLD); v_date DATE;
BEGIN
  SELECT d.work_date INTO v_date FROM public.hr_attendance_days d
    WHERE d.employee_id=v_event.employee_id AND d.schedule_id=v_event.schedule_id
      AND v_event.occurred_at BETWEEN d.work_date::TIMESTAMPTZ-INTERVAL '12 hours' AND d.work_date::TIMESTAMPTZ+INTERVAL '2 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (v_event.occurred_at-d.work_date::TIMESTAMPTZ))) LIMIT 1;
  v_date:=COALESCE(v_date,(v_event.occurred_at AT TIME ZONE 'Asia/Riyadh')::DATE);
  IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل حركات جديدة'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_events_closed_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hr_attendance_events
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_event_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_correction_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.hr_attendance_correction_requests:=COALESCE(NEW,OLD); v_date DATE;
BEGIN
  SELECT work_date INTO v_date FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id;
  IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل طلبات تصحيح'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_corrections_closed_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.hr_attendance_correction_requests FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_correction_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_holiday_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_holiday public.hr_attendance_holidays:=COALESCE(NEW,OLD);
BEGIN
  IF EXISTS(SELECT 1 FROM public.hr_attendance_periods p WHERE p.status='closed'
    AND daterange(make_date(p.period_year,p.period_month,1),
      (make_date(p.period_year,p.period_month,1)+INTERVAL '1 month')::DATE,'[)')
      && daterange(v_holiday.date_from,v_holiday.date_to,'[]')) THEN
    RAISE EXCEPTION 'لا يمكن تعديل عطلة تتقاطع مع فترة حضور مقفلة';
  END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_holidays_closed_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.hr_attendance_holidays FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_holiday_guard();

-- Attendance-configured employees require a closed attendance period before payroll generation.
ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_attendance_core;
CREATE OR REPLACE FUNCTION public.hr_payroll_create_run(_period_year INTEGER,_period_month INTEGER)
RETURNS public.hr_payroll_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_run public.hr_payroll_runs; v_from DATE:=make_date(_period_year,_period_month,1); v_to DATE;
BEGIN
  v_to:=(v_from+INTERVAL '1 month - 1 day')::DATE;
  IF EXISTS(SELECT 1 FROM public.hr_shift_assignments WHERE effective_from<=v_to AND COALESCE(effective_to,v_to)>=v_from)
    AND NOT EXISTS(SELECT 1 FROM public.hr_attendance_periods WHERE period_year=_period_year AND period_month=_period_month AND status='closed') THEN
    RAISE EXCEPTION 'يجب إقفال فترة الحضور قبل إنشاء مسير الرواتب';
  END IF;
  v_run:=public.hr_payroll_create_run_attendance_core(_period_year,_period_month); RETURN v_run;
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_period_is_closed(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_close_period(INTEGER,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_reopen_period(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_period_is_closed(DATE) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_close_period(INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_reopen_period(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_periods,public.hr_attendance_period_audit FROM authenticated;
