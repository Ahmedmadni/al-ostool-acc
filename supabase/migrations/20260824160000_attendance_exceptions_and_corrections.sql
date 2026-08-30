-- Phase D3.3: holidays, missed-punch corrections and immutable approval audit.

-- Fail rather than concealing a complete or partial application.  In
-- particular, a second rename would build a nested refresh wrapper.
DO $$
BEGIN
  IF to_regclass('public.hr_attendance_holidays') IS NOT NULL
     OR to_regclass('public.hr_attendance_correction_requests') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_request_correction(uuid,timestamp with time zone,timestamp with time zone,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_decide_correction(uuid,boolean,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_apply_correction(uuid,boolean)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_refresh_days_core(date,date,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='attendance corrections migration is already or partially applied; inspect schema history before retrying';
  END IF;
  IF to_regprocedure('public.hr_attendance_refresh_days(date,date,uuid)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='expected Gate 1 hr_attendance_refresh_days(date,date,uuid) is missing';
  END IF;
END;
$$;

CREATE TABLE public.hr_attendance_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  group_id UUID REFERENCES public.hr_shift_groups(id) ON DELETE CASCADE,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from),
  CHECK (date_to - date_from <= 60)
);
CREATE INDEX idx_hr_attendance_holidays_dates ON public.hr_attendance_holidays(date_from,date_to);

CREATE TABLE public.hr_attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
  attendance_day_id UUID NOT NULL REFERENCES public.hr_attendance_days(id) ON DELETE RESTRICT,
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  original_snapshot JSONB NOT NULL,
  applied_snapshot JSONB,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status='pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_notes IS NULL)
    OR (status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL
      AND char_length(btrim(decision_notes)) BETWEEN 5 AND 1000)
    OR (status='cancelled' AND decided_by IS NULL AND decided_at IS NULL)),
  CHECK (requested_check_in IS NOT NULL OR requested_check_out IS NOT NULL),
  CHECK (requested_check_out IS NULL OR requested_check_in IS NULL OR requested_check_out > requested_check_in)
);
CREATE UNIQUE INDEX idx_hr_attendance_correction_one_pending
  ON public.hr_attendance_correction_requests(attendance_day_id) WHERE status='pending';
CREATE INDEX idx_hr_attendance_corrections_status ON public.hr_attendance_correction_requests(status,created_at DESC);

ALTER TABLE public.hr_attendance_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_correction_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hr_attendance_holidays TO authenticated;
GRANT SELECT ON public.hr_attendance_correction_requests TO authenticated;
GRANT ALL ON public.hr_attendance_holidays,public.hr_attendance_correction_requests TO service_role;
CREATE POLICY hr_attendance_holidays_read ON public.hr_attendance_holidays FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','view') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_holidays_write ON public.hr_attendance_holidays FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_corrections_read ON public.hr_attendance_correction_requests FOR SELECT TO authenticated USING (
  public.has_permission(auth.uid(),'hr.attendance','edit') OR public.has_permission(auth.uid(),'hr.attendance','approve')
  OR public.is_admin(auth.uid()) OR requested_by=auth.uid()
);

CREATE OR REPLACE FUNCTION public.hr_attendance_holiday_audit_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid();
  ELSE NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; NEW.updated_at:=now(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_hr_attendance_holiday_audit BEFORE INSERT OR UPDATE ON public.hr_attendance_holidays
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_holiday_audit_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_correction_audit_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.hr_attendance_days d
    WHERE d.id=NEW.attendance_day_id AND d.employee_id=NEW.employee_id) THEN
    RAISE EXCEPTION 'طلب التصحيح لا يطابق موظف سجل الحضور';
  END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF ROW(NEW.employee_id,NEW.attendance_day_id,NEW.requested_check_in,NEW.requested_check_out,
      NEW.reason,NEW.original_snapshot,NEW.requested_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.employee_id,OLD.attendance_day_id,OLD.requested_check_in,OLD.requested_check_out,
      OLD.reason,OLD.original_snapshot,OLD.requested_by,OLD.created_at) THEN
    RAISE EXCEPTION 'حقول طلب التصحيح الأصلية غير قابلة للتعديل';
  END IF;
  IF OLD.status='pending' AND NEW.status IN ('approved','rejected')
    AND NEW.applied_snapshot IS NULL THEN RETURN NEW; END IF;
  IF OLD.status='pending' AND NEW.status='cancelled' AND NEW.requested_by=auth.uid() THEN RETURN NEW; END IF;
  IF OLD.status='approved' AND NEW.status='approved' AND OLD.applied_snapshot IS NULL
    AND NEW.applied_snapshot IS NOT NULL
    AND ROW(NEW.decided_by,NEW.decided_at,NEW.decision_notes)
      IS NOT DISTINCT FROM ROW(OLD.decided_by,OLD.decided_at,OLD.decision_notes) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'انتقال حالة طلب التصحيح غير مسموح';
END; $$;
CREATE TRIGGER trg_hr_attendance_correction_audit BEFORE INSERT OR UPDATE ON public.hr_attendance_correction_requests
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_correction_audit_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_request_correction(
  _attendance_day_id UUID,_requested_check_in TIMESTAMPTZ,_requested_check_out TIMESTAMPTZ,_reason TEXT
) RETURNS public.hr_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_day public.hr_attendance_days; v_employee public.hr_employees; v_schedule public.hr_shift_schedules;
  v_group public.hr_shift_groups; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ; v_row public.hr_attendance_correction_requests;
BEGIN
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=_attendance_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'سجل يوم الحضور غير موجود'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_day.employee_id::TEXT||':'||v_day.work_date::TEXT,0));
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=_attendance_day_id FOR UPDATE;
  SELECT * INTO v_employee FROM public.hr_employees WHERE id=v_day.employee_id;
  IF v_employee.user_id IS DISTINCT FROM auth.uid() AND NOT (
    public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'لا يمكنك طلب تصحيح سجل موظف آخر';
  END IF;
  IF NULLIF(BTRIM(_reason),'') IS NULL OR char_length(BTRIM(_reason)) < 5 THEN RAISE EXCEPTION 'سبب التصحيح غير كاف'; END IF;
  IF _requested_check_in IS NULL AND _requested_check_out IS NULL THEN RAISE EXCEPTION 'أدخل وقت حضور أو انصراف مصححاً'; END IF;
  SELECT * INTO v_schedule FROM public.hr_shift_schedules WHERE id=v_day.schedule_id;
  SELECT * INTO v_group FROM public.hr_shift_groups WHERE id=v_day.group_id;
  v_start := (v_day.work_date+v_schedule.start_time) AT TIME ZONE v_group.timezone;
  v_end := (v_day.work_date+v_schedule.end_time
    +CASE WHEN v_schedule.end_time<=v_schedule.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END)
    AT TIME ZONE v_group.timezone;
  IF (_requested_check_in IS NOT NULL AND _requested_check_in NOT BETWEEN v_start-INTERVAL '12 hours' AND v_end+INTERVAL '12 hours')
    OR (_requested_check_out IS NOT NULL AND _requested_check_out NOT BETWEEN v_start-INTERVAL '12 hours' AND v_end+INTERVAL '12 hours') THEN
    RAISE EXCEPTION 'الوقت المطلوب بعيد عن نافذة يوم الدوام';
  END IF;
  INSERT INTO public.hr_attendance_correction_requests(employee_id,attendance_day_id,requested_check_in,requested_check_out,
    reason,original_snapshot,requested_by)
  VALUES(v_day.employee_id,v_day.id,_requested_check_in,_requested_check_out,BTRIM(_reason),
    jsonb_build_object('work_date',v_day.work_date,'status',v_day.status,'first_check_in',v_day.first_check_in,
      'last_check_out',v_day.last_check_out,'actual_minutes',v_day.actual_minutes,'late_minutes',v_day.late_minutes,
      'early_leave_minutes',v_day.early_leave_minutes,'overtime_minutes',v_day.overtime_minutes,
      'approval_status',v_day.approval_status,'calculation_details',v_day.calculation_details),auth.uid())
  RETURNING * INTO v_row; RETURN v_row;
END; $$;

-- Apply an approved override to calculated facts without changing source
-- biometric/mobile events.  _capture_snapshot is true only for the decision;
-- later deterministic refreshes reapply the override without rewriting audit.
CREATE OR REPLACE FUNCTION public.hr_attendance_apply_correction(_request_id UUID,_capture_snapshot BOOLEAN DEFAULT false)
RETURNS public.hr_attendance_days
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.hr_attendance_correction_requests; v_day public.hr_attendance_days;
  v_schedule public.hr_shift_schedules; v_group public.hr_shift_groups; v_policy public.hr_attendance_policies;
  v_start TIMESTAMPTZ; v_end TIMESTAMPTZ; v_in TIMESTAMPTZ; v_out TIMESTAMPTZ;
  v_actual INTEGER:=0; v_late INTEGER:=0; v_early INTEGER:=0; v_overtime INTEGER:=0; v_status TEXT; v_details JSONB;
BEGIN
  SELECT * INTO v_request FROM public.hr_attendance_correction_requests WHERE id=_request_id;
  IF NOT FOUND OR v_request.status<>'approved' THEN RAISE EXCEPTION 'لا يمكن تطبيق طلب تصحيح غير معتمد'; END IF;
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'سجل يوم الحضور غير موجود'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_day.employee_id::TEXT||':'||v_day.work_date::TEXT,0));
  SELECT * INTO v_request FROM public.hr_attendance_correction_requests WHERE id=_request_id FOR UPDATE;
  IF v_request.status<>'approved' THEN RAISE EXCEPTION 'لا يمكن تطبيق طلب تصحيح غير معتمد'; END IF;
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id FOR UPDATE;
  SELECT * INTO v_schedule FROM public.hr_shift_schedules WHERE id=v_day.schedule_id;
  SELECT * INTO v_group FROM public.hr_shift_groups WHERE id=v_day.group_id;
  IF v_schedule.id IS NULL OR v_group.id IS NULL THEN RAISE EXCEPTION 'لا يمكن تصحيح يوم بلا وردية وجدول صالحين'; END IF;
  SELECT * INTO v_policy FROM public.hr_attendance_policies WHERE group_id=v_day.group_id;
  v_start:=(v_day.work_date+v_schedule.start_time) AT TIME ZONE v_group.timezone;
  v_end:=(v_day.work_date+v_schedule.end_time
    +CASE WHEN v_schedule.end_time<=v_schedule.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0' END)
    AT TIME ZONE v_group.timezone;
  IF NOT _capture_snapshot AND v_request.applied_snapshot IS NOT NULL THEN
    v_in:=(v_request.applied_snapshot->>'first_check_in')::TIMESTAMPTZ;
    v_out:=(v_request.applied_snapshot->>'last_check_out')::TIMESTAMPTZ;
    v_status:=v_request.applied_snapshot->>'status';
    v_actual:=COALESCE((v_request.applied_snapshot->>'actual_minutes')::INTEGER,0);
    v_late:=COALESCE((v_request.applied_snapshot->>'late_minutes')::INTEGER,0);
    v_early:=COALESCE((v_request.applied_snapshot->>'early_leave_minutes')::INTEGER,0);
    v_overtime:=COALESCE((v_request.applied_snapshot->>'overtime_minutes')::INTEGER,0);
    v_details:=v_request.applied_snapshot->'calculation_details';
  ELSE
    v_in:=COALESCE(v_request.requested_check_in,v_day.first_check_in);
    v_out:=COALESCE(v_request.requested_check_out,v_day.last_check_out);
    IF v_in IS NULL OR v_out IS NULL OR v_out<=v_in THEN v_status:='incomplete';
    ELSE
      v_status:='present';
      v_actual:=GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_out-v_in))/60)::INTEGER-v_group.break_minutes,0);
      v_late:=GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_in-v_start))/60)::INTEGER-COALESCE(v_policy.grace_minutes,0),0);
      v_early:=GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_end-v_out))/60)::INTEGER,0);
      v_overtime:=GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_out-v_end))/60)::INTEGER,0);
      IF v_overtime<COALESCE(v_policy.minimum_overtime_minutes,30) THEN v_overtime:=0; END IF;
    END IF;
  END IF;
  v_details:=COALESCE(v_details,v_day.calculation_details||jsonb_build_object('correction_request_id',v_request.id,
    'correction_applied_at',v_request.decided_at,'correction_requested_check_in',v_request.requested_check_in,
    'correction_requested_check_out',v_request.requested_check_out));
  UPDATE public.hr_attendance_days SET first_check_in=v_in,last_check_out=v_out,status=v_status,
    actual_minutes=v_actual,late_minutes=v_late,early_leave_minutes=v_early,overtime_minutes=v_overtime,
    approval_status='pending',approved_by=NULL,approved_at=NULL,
    notes='تم تطبيق تصحيح معتمد؛ يجب إعادة اعتماد اليوم',
    calculation_details=v_details,updated_at=now()
  WHERE id=v_day.id AND ROW(first_check_in,last_check_out,status,actual_minutes,late_minutes,
      early_leave_minutes,overtime_minutes,approval_status,approved_by,approved_at,notes,calculation_details)
    IS DISTINCT FROM ROW(v_in,v_out,v_status,v_actual,v_late,v_early,v_overtime,'pending',NULL,NULL,
      'تم تطبيق تصحيح معتمد؛ يجب إعادة اعتماد اليوم',v_details)
  RETURNING * INTO v_day;
  IF NOT FOUND THEN SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id; END IF;
  IF _capture_snapshot THEN
    UPDATE public.hr_attendance_correction_requests SET applied_snapshot=jsonb_build_object(
      'status',v_day.status,'first_check_in',v_day.first_check_in,'last_check_out',v_day.last_check_out,
      'actual_minutes',v_day.actual_minutes,'late_minutes',v_day.late_minutes,
      'early_leave_minutes',v_day.early_leave_minutes,'overtime_minutes',v_day.overtime_minutes,
      'approval_status',v_day.approval_status,'calculation_details',v_day.calculation_details)
    WHERE id=v_request.id AND applied_snapshot IS NULL;
  END IF;
  RETURN v_day;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_decide_correction(
  _request_id UUID,_approved BOOLEAN,_decision_notes TEXT DEFAULT NULL
) RETURNS public.hr_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.hr_attendance_correction_requests; v_day public.hr_attendance_days;
  v_row public.hr_attendance_correction_requests;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد تصحيحات الحضور';
  END IF;
  SELECT * INTO v_request FROM public.hr_attendance_correction_requests WHERE id=_request_id;
  IF NOT FOUND OR v_request.status<>'pending' THEN RAISE EXCEPTION 'طلب التصحيح غير موجود أو سبق اتخاذ القرار عليه'; END IF;
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_day.employee_id::TEXT||':'||v_day.work_date::TEXT,0));
  SELECT * INTO v_request FROM public.hr_attendance_correction_requests WHERE id=_request_id FOR UPDATE;
  IF v_request.status<>'pending' THEN RAISE EXCEPTION 'طلب التصحيح غير موجود أو سبق اتخاذ القرار عليه'; END IF;
  IF char_length(BTRIM(COALESCE(_decision_notes,'')))<5 THEN RAISE EXCEPTION 'يجب تسجيل سبب واضح للقرار'; END IF;
  UPDATE public.hr_attendance_correction_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
    decided_by=auth.uid(),decided_at=now(),decision_notes=BTRIM(_decision_notes) WHERE id=v_request.id
  RETURNING * INTO v_row;
  IF _approved THEN PERFORM public.hr_attendance_apply_correction(v_row.id,true); END IF;
  SELECT * INTO v_row FROM public.hr_attendance_correction_requests WHERE id=v_row.id;
  RETURN v_row;
END; $$;

-- Wrap the D3.2 processor so configured holidays become rest days and never
-- create absence/late/overtime payroll inputs.
ALTER FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) RENAME TO hr_attendance_refresh_days_core;
REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days_core(DATE,DATE,UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.hr_attendance_refresh_days(_date_from DATE,_date_to DATE,_employee_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count INTEGER:=0; v_core_count INTEGER; v_approvals JSONB; v_audit_times JSONB;
  v_employee_ids UUID[]; v_employee UUID; v_day DATE;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()) OR auth.role()='service_role') THEN
    RAISE EXCEPTION 'ليست لديك صلاحية معالجة الحضور';
  END IF;
  IF _date_from IS NULL OR _date_to IS NULL OR _date_to<_date_from OR _date_to-_date_from>92 THEN
    RAISE EXCEPTION 'الفترة غير صالحة أو تتجاوز 93 يوماً';
  END IF;
  -- Materialize the Gate 1 employee universe once for this invocation.  Later
  -- status changes are intentionally deferred to the next refresh.
  SELECT COALESCE(array_agg(e.id ORDER BY e.id),'{}'::UUID[]) INTO v_employee_ids
  FROM public.hr_employees e
  WHERE e.status IN ('active','on_leave') AND (_employee_id IS NULL OR e.id=_employee_id);
  -- Acquire every fixed employee/date key before reading correction state.
  FOREACH v_employee IN ARRAY v_employee_ids LOOP
    FOR v_day IN SELECT generate_series(_date_from,_date_to,INTERVAL '1 day')::DATE LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(v_employee::TEXT||':'||v_day::TEXT,0));
    END LOOP;
  END LOOP;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_id',d.id,'calculated_at',d.calculated_at,
    'updated_at',d.updated_at)),'[]'::JSONB) INTO v_audit_times
  FROM public.hr_attendance_days d WHERE d.work_date BETWEEN _date_from AND _date_to
    AND d.employee_id=ANY(v_employee_ids)
    AND EXISTS(SELECT 1 FROM public.hr_attendance_correction_requests r
      WHERE r.attendance_day_id=d.id AND r.status='approved');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_id',d.id,'approved_by',d.approved_by,
    'approved_at',d.approved_at)),'[]'::JSONB) INTO v_approvals
  FROM public.hr_attendance_days d WHERE d.approval_status='approved'
    AND d.work_date BETWEEN _date_from AND _date_to AND d.employee_id=ANY(v_employee_ids)
    AND EXISTS(SELECT 1 FROM public.hr_attendance_correction_requests r
      WHERE r.attendance_day_id=d.id AND r.status='approved');
  UPDATE public.hr_attendance_days d SET approval_status='pending',approved_by=NULL,approved_at=NULL
  FROM jsonb_to_recordset(v_approvals) AS a(day_id UUID,approved_by UUID,approved_at TIMESTAMPTZ)
  WHERE d.id=a.day_id;
  FOREACH v_employee IN ARRAY v_employee_ids LOOP
    v_core_count:=public.hr_attendance_refresh_days_core(_date_from,_date_to,v_employee);
    v_count:=v_count+COALESCE(v_core_count,0);
  END LOOP;
  -- Gate 1 recalculates raw facts first; approved overrides are then reapplied
  -- deterministically without changing their immutable decision snapshots.
  PERFORM public.hr_attendance_apply_correction(r.id,false)
  FROM (
    SELECT DISTINCT ON (request.attendance_day_id) request.id,request.attendance_day_id
    FROM public.hr_attendance_correction_requests request
    WHERE request.status='approved' ORDER BY request.attendance_day_id,request.decided_at DESC,request.id DESC
  ) r JOIN public.hr_attendance_days d ON d.id=r.attendance_day_id
  WHERE d.work_date BETWEEN _date_from AND _date_to AND d.employee_id=ANY(v_employee_ids);
  UPDATE public.hr_attendance_days d SET approval_status='approved',approved_by=a.approved_by,approved_at=a.approved_at
  FROM jsonb_to_recordset(v_approvals) AS a(day_id UUID,approved_by UUID,approved_at TIMESTAMPTZ)
  WHERE d.id=a.day_id;
  UPDATE public.hr_attendance_days d SET calculated_at=a.calculated_at,updated_at=a.updated_at
  FROM jsonb_to_recordset(v_audit_times) AS a(day_id UUID,calculated_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)
  WHERE d.id=a.day_id;
  IF EXISTS(
    SELECT 1 FROM public.hr_attendance_days d JOIN public.hr_attendance_holidays h
      ON d.work_date BETWEEN h.date_from AND h.date_to AND (h.group_id IS NULL OR h.group_id=d.group_id)
    WHERE d.work_date BETWEEN _date_from AND _date_to AND d.employee_id=ANY(v_employee_ids)
      AND d.approval_status='approved' AND (d.calculation_details->>'holiday_id') IS DISTINCT FROM h.id::TEXT
  ) THEN RAISE EXCEPTION 'تغيير عطلة يؤثر في يوم معتمد؛ يلزم مسار تصحيح أو إعادة فتح'; END IF;
  WITH holiday_matches AS (
    SELECT DISTINCT ON (d.id) d.id day_id,h.id,h.name_ar,h.is_paid
    FROM public.hr_attendance_days d JOIN public.hr_attendance_holidays h
      ON d.work_date BETWEEN h.date_from AND h.date_to AND (h.group_id IS NULL OR h.group_id=d.group_id)
    WHERE d.work_date BETWEEN _date_from AND _date_to AND d.employee_id=ANY(v_employee_ids)
    ORDER BY d.id,h.group_id NULLS LAST
  )
  UPDATE public.hr_attendance_days d SET status='rest_day',actual_minutes=0,late_minutes=0,
    early_leave_minutes=0,overtime_minutes=0,approval_status='pending',approved_by=NULL,approved_at=NULL,
    calculation_details=d.calculation_details||jsonb_build_object('holiday_id',h.id,'holiday_name',h.name_ar,'holiday_paid',h.is_paid),updated_at=now()
  FROM holiday_matches h WHERE d.id=h.day_id
    AND (d.calculation_details->>'holiday_id') IS DISTINCT FROM h.id::TEXT;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_holiday_audit_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_correction_audit_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_apply_correction(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_apply_correction(UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_correction_requests FROM authenticated;
