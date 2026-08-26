-- Phase D3.3: holidays, missed-punch corrections and immutable approval audit.

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
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid();
  ELSE NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; NEW.updated_at:=now(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_hr_attendance_holiday_audit BEFORE INSERT OR UPDATE ON public.hr_attendance_holidays
FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_holiday_audit_guard();

CREATE OR REPLACE FUNCTION public.hr_attendance_request_correction(
  _attendance_day_id UUID,_requested_check_in TIMESTAMPTZ,_requested_check_out TIMESTAMPTZ,_reason TEXT
) RETURNS public.hr_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_day public.hr_attendance_days; v_employee public.hr_employees; v_schedule public.hr_shift_schedules;
  v_group public.hr_shift_groups; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ; v_row public.hr_attendance_correction_requests;
BEGIN
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=_attendance_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'سجل يوم الحضور غير موجود'; END IF;
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
  v_end := (v_day.work_date+v_schedule.end_time) AT TIME ZONE v_group.timezone;
  IF v_end<=v_start THEN v_end:=v_end+INTERVAL '1 day'; END IF;
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

CREATE OR REPLACE FUNCTION public.hr_attendance_decide_correction(
  _request_id UUID,_approved BOOLEAN,_decision_notes TEXT DEFAULT NULL
) RETURNS public.hr_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.hr_attendance_correction_requests; v_day public.hr_attendance_days;
  v_schedule public.hr_shift_schedules; v_group public.hr_shift_groups; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
  v_row public.hr_attendance_correction_requests;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد تصحيحات الحضور';
  END IF;
  SELECT * INTO v_request FROM public.hr_attendance_correction_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'pending' THEN RAISE EXCEPTION 'طلب التصحيح غير موجود أو سبق اتخاذ القرار عليه'; END IF;
  SELECT * INTO v_day FROM public.hr_attendance_days WHERE id=v_request.attendance_day_id FOR UPDATE;
  IF _approved THEN
    SELECT * INTO v_schedule FROM public.hr_shift_schedules WHERE id=v_day.schedule_id;
    SELECT * INTO v_group FROM public.hr_shift_groups WHERE id=v_day.group_id;
    v_start:=(v_day.work_date+v_schedule.start_time) AT TIME ZONE v_group.timezone;
    v_end:=(v_day.work_date+v_schedule.end_time) AT TIME ZONE v_group.timezone;
    IF v_end<=v_start THEN v_end:=v_end+INTERVAL '1 day'; END IF;
    IF v_request.requested_check_in IS NOT NULL THEN
      UPDATE public.hr_attendance_events SET validation_status='manual_review',
        metadata=metadata||jsonb_build_object('superseded_by_correction',v_request.id)
      WHERE employee_id=v_request.employee_id AND schedule_id=v_day.schedule_id AND event_type='check_in'
        AND validation_status='accepted' AND occurred_at BETWEEN v_start-INTERVAL '12 hours' AND v_end+INTERVAL '12 hours';
      INSERT INTO public.hr_attendance_events(employee_id,event_type,source,occurred_at,schedule_id,validation_status,metadata,created_by)
      VALUES(v_request.employee_id,'check_in','manual',v_request.requested_check_in,v_day.schedule_id,'accepted',
        jsonb_build_object('correction_request_id',v_request.id,'reason',v_request.reason),auth.uid());
    END IF;
    IF v_request.requested_check_out IS NOT NULL THEN
      UPDATE public.hr_attendance_events SET validation_status='manual_review',
        metadata=metadata||jsonb_build_object('superseded_by_correction',v_request.id)
      WHERE employee_id=v_request.employee_id AND schedule_id=v_day.schedule_id AND event_type='check_out'
        AND validation_status='accepted' AND occurred_at BETWEEN v_start-INTERVAL '12 hours' AND v_end+INTERVAL '12 hours';
      INSERT INTO public.hr_attendance_events(employee_id,event_type,source,occurred_at,schedule_id,validation_status,metadata,created_by)
      VALUES(v_request.employee_id,'check_out','manual',v_request.requested_check_out,v_day.schedule_id,'accepted',
        jsonb_build_object('correction_request_id',v_request.id,'reason',v_request.reason),auth.uid());
    END IF;
    UPDATE public.hr_attendance_days SET approval_status='pending',approved_by=NULL,approved_at=NULL,
      notes='تم اعتماد تصحيح بصمة؛ يجب إعادة معالجة اليوم',updated_at=now() WHERE id=v_day.id;
  END IF;
  UPDATE public.hr_attendance_correction_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
    decided_by=auth.uid(),decided_at=now(),decision_notes=NULLIF(BTRIM(_decision_notes),'') WHERE id=v_request.id
  RETURNING * INTO v_row; RETURN v_row;
END; $$;

-- Wrap the D3.2 processor so configured holidays become rest days and never
-- create absence/late/overtime payroll inputs.
ALTER FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) RENAME TO hr_attendance_refresh_days_core;
CREATE OR REPLACE FUNCTION public.hr_attendance_refresh_days(_date_from DATE,_date_to DATE,_employee_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count INTEGER;
BEGIN
  v_count:=public.hr_attendance_refresh_days_core(_date_from,_date_to,_employee_id);
  WITH holiday_matches AS (
    SELECT DISTINCT ON (d.id) d.id day_id,h.id,h.name_ar,h.is_paid
    FROM public.hr_attendance_days d JOIN public.hr_attendance_holidays h
      ON d.work_date BETWEEN h.date_from AND h.date_to AND (h.group_id IS NULL OR h.group_id=d.group_id)
    WHERE d.work_date BETWEEN _date_from AND _date_to AND (_employee_id IS NULL OR d.employee_id=_employee_id)
    ORDER BY d.id,h.group_id NULLS LAST
  )
  UPDATE public.hr_attendance_days d SET status='rest_day',actual_minutes=0,late_minutes=0,
    early_leave_minutes=0,overtime_minutes=0,approval_status='pending',approved_by=NULL,approved_at=NULL,
    calculation_details=d.calculation_details||jsonb_build_object('holiday_id',h.id,'holiday_name',h.name_ar,'holiday_paid',h.is_paid),updated_at=now()
  FROM holiday_matches h WHERE d.id=h.day_id
    AND (d.calculation_details->>'holiday_id') IS DISTINCT FROM h.id::TEXT;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_request_correction(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_decide_correction(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_correction_requests FROM authenticated;
