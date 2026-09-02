-- Phase D3.4: monthly attendance reports, controlled close/reopen and payroll gate.

-- Gate 3 is deliberately fail-fast.  A retry after any DDL below would otherwise
-- rename wrappers a second time and leave a partially nested call graph.
DO $$
BEGIN
  IF to_regclass('public.hr_attendance_periods') IS NOT NULL
     OR to_regclass('public.hr_attendance_period_audit') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_period_is_closed(date)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_refresh_days_period_core(date,date,uuid)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_decide_day_period_core(uuid,boolean,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_request_correction_period_core(uuid,timestamp with time zone,timestamp with time zone,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_decide_correction_period_core(uuid,boolean,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_apply_correction_period_core(uuid,boolean)') IS NOT NULL
     OR to_regprocedure('public.hr_apply_attendance_to_payroll_period_core(uuid)') IS NOT NULL
     OR to_regprocedure('public.hr_payroll_create_run_attendance_core(integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='attendance monthly-close migration is already or partially applied; inspect schema history before retrying';
  END IF;
  IF to_regprocedure('public.hr_attendance_refresh_days(date,date,uuid)') IS NULL
     OR to_regprocedure('public.hr_attendance_decide_day(uuid,boolean,text)') IS NULL
     OR to_regprocedure('public.hr_attendance_request_correction(uuid,timestamp with time zone,timestamp with time zone,text)') IS NULL
     OR to_regprocedure('public.hr_attendance_decide_correction(uuid,boolean,text)') IS NULL
     OR to_regprocedure('public.hr_attendance_apply_correction(uuid,boolean)') IS NULL
     OR to_regprocedure('public.hr_apply_attendance_to_payroll(uuid)') IS NULL
     OR to_regprocedure('public.hr_payroll_create_run(integer,integer)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 3 requires the verified Gate 1 and Gate 2 function signatures';
  END IF;
END;
$$;

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
  UNIQUE(period_year,period_month),
  CHECK ((status='closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
    OR status='open'),
  CHECK ((reopened_by IS NULL AND reopened_at IS NULL AND reopen_reason IS NULL)
    OR (reopened_by IS NOT NULL AND reopened_at IS NOT NULL AND char_length(btrim(reopen_reason))>=10))
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

CREATE OR REPLACE FUNCTION public.hr_attendance_period_audit_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'سجل تاريخ إقفال الحضور غير قابل للتعديل أو الحذف'; END; $$;
CREATE TRIGGER trg_hr_attendance_period_audit_immutable BEFORE UPDATE OR DELETE
ON public.hr_attendance_period_audit FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_period_audit_immutable();

CREATE OR REPLACE FUNCTION public.hr_attendance_period_is_closed(_work_date DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.hr_attendance_periods
    WHERE period_year=EXTRACT(YEAR FROM _work_date)::INTEGER
      AND period_month=EXTRACT(MONTH FROM _work_date)::INTEGER AND status='closed')
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_close_period(_year INTEGER,_month INTEGER)
RETURNS public.hr_attendance_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_from DATE; v_to DATE; v_missing INTEGER; v_unapproved INTEGER; v_corrections INTEGER;
  v_snapshot JSONB; v_period public.hr_attendance_periods;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إقفال الحضور';
  END IF;
  IF _year NOT BETWEEN 2000 AND 2200 OR _month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'الفترة غير صالحة'; END IF;
  v_from:=make_date(_year,_month,1); v_to:=(v_from+INTERVAL '1 month - 1 day')::DATE;
  IF v_to>=CURRENT_DATE THEN RAISE EXCEPTION 'لا يمكن إقفال فترة لم تنته بعد'; END IF;
  -- The calendar-month key is the first lock in every Gate 3 mutation path.
  PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',_year,_month),0));

  WITH expected AS (
    SELECT DISTINCT a.employee_id,days.work_date::DATE work_date
    FROM public.hr_shift_assignments a JOIN public.hr_shift_groups g ON g.id=a.group_id AND g.is_active
    CROSS JOIN LATERAL generate_series(GREATEST(a.effective_from,v_from),LEAST(COALESCE(a.effective_to,v_to),v_to),INTERVAL '1 day') AS days(work_date)
    JOIN public.hr_shift_schedules s ON s.group_id=a.group_id AND s.is_working_day
      AND s.day_of_week=EXTRACT(DOW FROM days.work_date)::INTEGER
    JOIN public.hr_employees e ON e.id=a.employee_id AND e.hire_date<=days.work_date::DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.hr_terminations t
        WHERE t.employee_id=e.id AND t.status IN ('approved','paid')
          AND t.last_working_day<days.work_date::DATE
      )
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
RETURNS public.hr_attendance_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_period public.hr_attendance_periods;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') AND public.has_permission(auth.uid(),'hr.payroll','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'إعادة الفتح تتطلب صلاحية اعتماد الحضور والرواتب';
  END IF;
  IF char_length(BTRIM(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'يجب تسجيل سبب واضح لإعادة الفتح'; END IF;
  SELECT * INTO v_period FROM public.hr_attendance_periods WHERE id=_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'فترة الحضور غير موجودة'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',v_period.period_year,v_period.period_month),0));
  SELECT * INTO v_period FROM public.hr_attendance_periods WHERE id=_period_id FOR UPDATE;
  IF v_period.status<>'closed' THEN RAISE EXCEPTION 'فترة الحضور غير مقفلة'; END IF;
  IF EXISTS(SELECT 1 FROM public.hr_payroll_runs WHERE period_year=v_period.period_year AND period_month=v_period.period_month AND status IN ('approved','paid')) THEN
    RAISE EXCEPTION 'لا يمكن إعادة فتح حضور مرتبط بمسير رواتب معتمد أو مصروف';
  END IF;
  INSERT INTO public.hr_attendance_period_audit(period_id,action,actor_id,reason,snapshot)
  VALUES(v_period.id,'reopened',auth.uid(),BTRIM(_reason),v_period.summary_snapshot);
  UPDATE public.hr_attendance_periods SET status='open',reopened_by=auth.uid(),reopened_at=now(),
    reopen_reason=BTRIM(_reason),updated_at=now() WHERE id=v_period.id RETURNING * INTO v_period;
  RETURN v_period;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_lock_periods(_from DATE,_to DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_month DATE;
BEGIN
  IF _from IS NULL OR _to IS NULL OR _to<_from THEN RAISE EXCEPTION 'الفترة غير صالحة'; END IF;
  FOR v_month IN SELECT generate_series(date_trunc('month',_from)::DATE,date_trunc('month',_to)::DATE,INTERVAL '1 month')::DATE LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',EXTRACT(YEAR FROM v_month)::INTEGER,EXTRACT(MONTH FROM v_month)::INTEGER),0));
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_day_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_date DATE:=COALESCE(NEW.work_date,OLD.work_date);
BEGIN
  IF TG_OP='UPDATE' AND OLD.work_date IS DISTINCT FROM NEW.work_date THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',EXTRACT(YEAR FROM OLD.work_date)::INTEGER,EXTRACT(MONTH FROM OLD.work_date)::INTEGER),0));
    IF public.hr_attendance_period_is_closed(OLD.work_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل التعديل'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',EXTRACT(YEAR FROM v_date)::INTEGER,EXTRACT(MONTH FROM v_date)::INTEGER),0));
  IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل التعديل'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_days_closed_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hr_attendance_days
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_day_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_event_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.hr_attendance_events:=COALESCE(NEW,OLD); v_date DATE; v_old_date DATE;
BEGIN
  IF TG_OP='UPDATE' THEN
    SELECT d.work_date INTO v_old_date FROM public.hr_attendance_days d
      WHERE d.employee_id=OLD.employee_id AND d.schedule_id=OLD.schedule_id
        AND OLD.occurred_at BETWEEN d.work_date::TIMESTAMPTZ-INTERVAL '12 hours' AND d.work_date::TIMESTAMPTZ+INTERVAL '2 days'
      ORDER BY ABS(EXTRACT(EPOCH FROM (OLD.occurred_at-d.work_date::TIMESTAMPTZ))) LIMIT 1;
    v_old_date:=COALESCE(v_old_date,(OLD.occurred_at AT TIME ZONE 'Asia/Riyadh')::DATE);
  END IF;
  SELECT d.work_date INTO v_date FROM public.hr_attendance_days d
    WHERE d.employee_id=v_event.employee_id AND d.schedule_id=v_event.schedule_id
      AND v_event.occurred_at BETWEEN d.work_date::TIMESTAMPTZ-INTERVAL '12 hours' AND d.work_date::TIMESTAMPTZ+INTERVAL '2 days'
    ORDER BY ABS(EXTRACT(EPOCH FROM (v_event.occurred_at-d.work_date::TIMESTAMPTZ))) LIMIT 1;
  v_date:=COALESCE(v_date,(v_event.occurred_at AT TIME ZONE 'Asia/Riyadh')::DATE);
  PERFORM public.hr_attendance_lock_periods(LEAST(v_date,COALESCE(v_old_date,v_date)),GREATEST(v_date,COALESCE(v_old_date,v_date)));
  IF v_old_date IS NOT NULL AND public.hr_attendance_period_is_closed(v_old_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل تعديل الحركات'; END IF;
  IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل حركات جديدة'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_events_closed_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hr_attendance_events
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_event_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_correction_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.hr_attendance_correction_requests:=COALESCE(NEW,OLD); v_date DATE;
BEGIN
  SELECT work_date INTO v_date FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',EXTRACT(YEAR FROM v_date)::INTEGER,EXTRACT(MONTH FROM v_date)::INTEGER),0));
  IF public.hr_attendance_period_is_closed(v_date) THEN RAISE EXCEPTION 'فترة الحضور مقفلة ولا تقبل طلبات تصحيح'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_corrections_closed_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.hr_attendance_correction_requests FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_correction_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_closed_holiday_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_holiday public.hr_attendance_holidays:=COALESCE(NEW,OLD); v_month DATE;
BEGIN
  -- Lock the ordered envelope of OLD and NEW so cross-month moves cannot take
  -- the same two keys in opposite order.
  FOR v_month IN SELECT generate_series(
      date_trunc('month',CASE WHEN TG_OP='INSERT' THEN NEW.date_from ELSE LEAST(OLD.date_from,COALESCE(NEW.date_from,OLD.date_from)) END)::DATE,
      date_trunc('month',CASE WHEN TG_OP='INSERT' THEN NEW.date_to ELSE GREATEST(OLD.date_to,COALESCE(NEW.date_to,OLD.date_to)) END)::DATE,
      INTERVAL '1 month')::DATE LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(format('hr-attendance-period:%s:%s',EXTRACT(YEAR FROM v_month)::INTEGER,EXTRACT(MONTH FROM v_month)::INTEGER),0));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.hr_attendance_periods p WHERE p.status='closed'
    AND daterange(make_date(p.period_year,p.period_month,1),
      (make_date(p.period_year,p.period_month,1)+INTERVAL '1 month')::DATE,'[)')
      && daterange(v_holiday.date_from,v_holiday.date_to,'[]'))
    OR (TG_OP IN ('UPDATE','DELETE') AND EXISTS(SELECT 1 FROM public.hr_attendance_periods p WHERE p.status='closed'
      AND daterange(make_date(p.period_year,p.period_month,1),
        (make_date(p.period_year,p.period_month,1)+INTERVAL '1 month')::DATE,'[)')
        && daterange(OLD.date_from,OLD.date_to,'[]'))) THEN
    RAISE EXCEPTION 'لا يمكن تعديل عطلة تتقاطع مع فترة حضور مقفلة';
  END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_attendance_holidays_closed_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.hr_attendance_holidays FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_holiday_guard();

-- Closed facts retain IDs and a calculation snapshot, but the snapshot does
-- not duplicate every mutable schedule/policy attribute.  Preserve historical
-- interpretation narrowly: only reject UPDATE/DELETE of a configuration row
-- that an attendance day in a closed month actually references.  New future
-- configuration and rows used exclusively by open periods remain editable.
CREATE OR REPLACE FUNCTION public.hr_attendance_closed_config_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID:=COALESCE(OLD.id,NEW.id); v_month DATE;
  v_group_id UUID:=(to_jsonb(COALESCE(NEW,OLD))->>'group_id')::UUID;
  v_effective_from DATE:=(to_jsonb(COALESCE(NEW,OLD))->>'effective_from')::DATE;
  v_effective_to DATE:=(to_jsonb(COALESCE(NEW,OLD))->>'effective_to')::DATE;
BEGIN
  IF TG_TABLE_NAME='hr_shift_assignments' THEN
    FOR v_month IN SELECT generate_series(date_trunc('month',v_effective_from)::DATE,
        date_trunc('month',COALESCE(v_effective_to,CURRENT_DATE))::DATE,INTERVAL '1 month')::DATE LOOP
      PERFORM public.hr_attendance_lock_periods(v_month,v_month);
    END LOOP;
    IF EXISTS(SELECT 1 FROM public.hr_attendance_periods p WHERE p.status='closed'
      AND daterange(make_date(p.period_year,p.period_month,1),(make_date(p.period_year,p.period_month,1)+INTERVAL '1 month')::DATE,'[)')
        && daterange(v_effective_from,COALESCE(v_effective_to,'infinity'::DATE),'[]')) THEN
      RAISE EXCEPTION 'لا يمكن تعديل تكليف وردية يتقاطع مع فترة حضور مقفلة';
    END IF;
  ELSIF TG_OP='INSERT' AND TG_TABLE_NAME IN ('hr_shift_schedules','hr_attendance_policies')
  THEN
    FOR v_month IN SELECT DISTINCT date_trunc('month',d.work_date)::DATE
      FROM public.hr_attendance_days d WHERE d.group_id=v_group_id ORDER BY 1 LOOP
      PERFORM public.hr_attendance_lock_periods(v_month,v_month);
    END LOOP;
    IF EXISTS(SELECT 1 FROM public.hr_attendance_days d JOIN public.hr_attendance_periods p
        ON p.period_year=EXTRACT(YEAR FROM d.work_date)::INTEGER
       AND p.period_month=EXTRACT(MONTH FROM d.work_date)::INTEGER AND p.status='closed'
        WHERE d.group_id=v_group_id) THEN
      RAISE EXCEPTION 'لا يمكن إضافة مصدر احتساب بأثر رجعي إلى فترة حضور مقفلة';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  FOR v_month IN
    SELECT DISTINCT date_trunc('month',d.work_date)::DATE
    FROM public.hr_attendance_days d
    WHERE (TG_TABLE_NAME='hr_shift_assignments' AND d.assignment_id=v_id)
       OR (TG_TABLE_NAME='hr_shift_schedules' AND d.schedule_id=v_id)
       OR (TG_TABLE_NAME='hr_shift_groups' AND d.group_id=v_id)
       OR (TG_TABLE_NAME='hr_attendance_policies' AND EXISTS (
         SELECT 1 FROM public.hr_attendance_policies policy
         WHERE policy.id=v_id AND policy.group_id=d.group_id
       ))
    ORDER BY 1
  LOOP
    PERFORM public.hr_attendance_lock_periods(v_month,v_month);
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.hr_attendance_days d
    JOIN public.hr_attendance_periods p
      ON p.period_year=EXTRACT(YEAR FROM d.work_date)::INTEGER
     AND p.period_month=EXTRACT(MONTH FROM d.work_date)::INTEGER
     AND p.status='closed'
    WHERE (TG_TABLE_NAME='hr_shift_assignments' AND d.assignment_id=v_id)
       OR (TG_TABLE_NAME='hr_shift_schedules' AND d.schedule_id=v_id)
       OR (TG_TABLE_NAME='hr_shift_groups' AND d.group_id=v_id)
       OR (TG_TABLE_NAME='hr_attendance_policies' AND EXISTS (
         SELECT 1 FROM public.hr_attendance_policies policy
         WHERE policy.id=v_id AND policy.group_id=d.group_id
       ))
  ) THEN
    RAISE EXCEPTION 'لا يمكن تعديل مصدر احتساب مستخدم في فترة حضور مقفلة';
  END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_hr_shift_assignments_closed_config BEFORE INSERT OR UPDATE OR DELETE ON public.hr_shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_config_guard();
CREATE TRIGGER trg_hr_shift_schedules_closed_config BEFORE INSERT OR UPDATE OR DELETE ON public.hr_shift_schedules
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_config_guard();
CREATE TRIGGER trg_hr_shift_groups_closed_config BEFORE UPDATE OR DELETE ON public.hr_shift_groups
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_config_guard();
CREATE TRIGGER trg_hr_attendance_policies_closed_config BEFORE INSERT OR UPDATE OR DELETE ON public.hr_attendance_policies
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_closed_config_guard();

-- Wrap every Gate 1/2 mutation with the same ordered period lock.  Core
-- functions retain their employee/day locks, giving one hierarchy:
-- calendar period -> employee/day -> correction row.  A range takes only its
-- (at most four) month keys in ascending order, not a lock per possible day.
ALTER FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) RENAME TO hr_attendance_refresh_days_period_core;
ALTER FUNCTION public.hr_attendance_decide_day(UUID,BOOLEAN,TEXT) RENAME TO hr_attendance_decide_day_period_core;
ALTER FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) RENAME TO hr_attendance_request_correction_period_core;
ALTER FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) RENAME TO hr_attendance_decide_correction_period_core;
ALTER FUNCTION public.hr_attendance_apply_correction(UUID,BOOLEAN) RENAME TO hr_attendance_apply_correction_period_core;
ALTER FUNCTION public.hr_apply_attendance_to_payroll(UUID) RENAME TO hr_apply_attendance_to_payroll_period_core;
REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days_period_core(DATE,DATE,UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_day_period_core(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_request_correction_period_core(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_correction_period_core(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_apply_correction_period_core(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll_period_core(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.hr_attendance_refresh_days(_date_from DATE,_date_to DATE,_employee_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.hr_attendance_lock_periods(_date_from,_date_to); RETURN public.hr_attendance_refresh_days_period_core(_date_from,_date_to,_employee_id); END; $$;
CREATE OR REPLACE FUNCTION public.hr_attendance_decide_day(_day_id UUID,_approved BOOLEAN,_notes TEXT DEFAULT NULL)
RETURNS public.hr_attendance_days LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d DATE; BEGIN SELECT work_date INTO d FROM public.hr_attendance_days WHERE id=_day_id; IF d IS NULL THEN RAISE EXCEPTION 'سجل اليوم غير موجود'; END IF; PERFORM public.hr_attendance_lock_periods(d,d); RETURN public.hr_attendance_decide_day_period_core(_day_id,_approved,_notes); END; $$;
CREATE OR REPLACE FUNCTION public.hr_attendance_request_correction(_day UUID,_in TIMESTAMPTZ,_out TIMESTAMPTZ,_reason TEXT)
RETURNS public.hr_attendance_correction_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d DATE; BEGIN SELECT work_date INTO d FROM public.hr_attendance_days WHERE id=_day; IF d IS NULL THEN RAISE EXCEPTION 'سجل اليوم غير موجود'; END IF; PERFORM public.hr_attendance_lock_periods(d,d); RETURN public.hr_attendance_request_correction_period_core(_day,_in,_out,_reason); END; $$;
CREATE OR REPLACE FUNCTION public.hr_attendance_apply_correction(_request UUID,_capture BOOLEAN DEFAULT false)
RETURNS public.hr_attendance_days LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d DATE; BEGIN SELECT ad.work_date INTO d FROM public.hr_attendance_correction_requests r JOIN public.hr_attendance_days ad ON ad.id=r.attendance_day_id WHERE r.id=_request; IF d IS NULL THEN RAISE EXCEPTION 'طلب التصحيح غير موجود'; END IF; PERFORM public.hr_attendance_lock_periods(d,d); RETURN public.hr_attendance_apply_correction_period_core(_request,_capture); END; $$;
CREATE OR REPLACE FUNCTION public.hr_attendance_decide_correction(_request UUID,_approved BOOLEAN,_notes TEXT DEFAULT NULL)
RETURNS public.hr_attendance_correction_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d DATE; BEGIN SELECT ad.work_date INTO d FROM public.hr_attendance_correction_requests r JOIN public.hr_attendance_days ad ON ad.id=r.attendance_day_id WHERE r.id=_request; IF d IS NULL THEN RAISE EXCEPTION 'طلب التصحيح غير موجود'; END IF; PERFORM public.hr_attendance_lock_periods(d,d); RETURN public.hr_attendance_decide_correction_period_core(_request,_approved,_notes); END; $$;

CREATE OR REPLACE FUNCTION public.hr_apply_attendance_to_payroll(_run_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE y INTEGER; m INTEGER; d DATE;
BEGIN
  SELECT period_year,period_month INTO y,m FROM public.hr_payroll_runs WHERE id=_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;
  d:=make_date(y,m,1); PERFORM public.hr_attendance_lock_periods(d,d);
  IF NOT EXISTS(SELECT 1 FROM public.hr_attendance_periods WHERE period_year=y AND period_month=m AND status='closed') THEN
    RAISE EXCEPTION 'يجب إقفال فترة الحضور قبل تطبيقها على مسير الرواتب';
  END IF;
  RETURN public.hr_apply_attendance_to_payroll_period_core(_run_id);
END; $$;

-- Attendance-configured employees require a closed attendance period before payroll generation.
ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_attendance_core;
CREATE OR REPLACE FUNCTION public.hr_payroll_create_run(_period_year INTEGER,_period_month INTEGER)
RETURNS public.hr_payroll_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_run public.hr_payroll_runs; v_from DATE:=make_date(_period_year,_period_month,1); v_to DATE;
BEGIN
  v_to:=(v_from+INTERVAL '1 month - 1 day')::DATE;
  PERFORM public.hr_attendance_lock_periods(v_from,v_to);
  IF EXISTS(SELECT 1 FROM public.hr_shift_assignments WHERE effective_from<=v_to AND COALESCE(effective_to,v_to)>=v_from)
    AND NOT EXISTS(SELECT 1 FROM public.hr_attendance_periods WHERE period_year=_period_year AND period_month=_period_month AND status='closed') THEN
    RAISE EXCEPTION 'يجب إقفال فترة الحضور قبل إنشاء مسير الرواتب';
  END IF;
  v_run:=public.hr_payroll_create_run_attendance_core(_period_year,_period_month); RETURN v_run;
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_period_is_closed(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_close_period(INTEGER,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_reopen_period(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_lock_periods(DATE,DATE) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_day(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_apply_correction(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_period_is_closed(DATE) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_close_period(INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_reopen_period(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_decide_day(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_periods,public.hr_attendance_period_audit FROM authenticated;
